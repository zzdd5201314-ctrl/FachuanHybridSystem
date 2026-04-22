from __future__ import annotations

from typing import TYPE_CHECKING, Any, ClassVar

from django import forms
from django.contrib import admin
from django.db.models import QuerySet
from django.http import FileResponse, Http404, HttpRequest
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from apps.cases.models import Case
from apps.contracts.models import Contract, ContractPayment, Invoice, InvoiceStatus
from apps.core.services import storage_service as storage

if TYPE_CHECKING:
    BaseModelAdmin = admin.ModelAdmin
    BaseTabularInline = admin.TabularInline
else:
    try:
        import nested_admin

        BaseModelAdmin = nested_admin.NestedModelAdmin
        BaseTabularInline = nested_admin.NestedTabularInline
    except ImportError:
        BaseModelAdmin = admin.ModelAdmin
        BaseTabularInline = admin.TabularInline


class ContractScopedCaseSelect(forms.Select):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.contract_map: dict[str, str] = {}

    def create_option(
        self,
        name: str,
        value: Any,
        label: Any,
        selected: bool,
        index: int,
        subindex: int | None = None,
        attrs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        option = super().create_option(name, value, label, selected, index, subindex=subindex, attrs=attrs)
        raw_value = getattr(value, "value", value)
        value_str = "" if raw_value in (None, "") else str(raw_value)
        contract_id = self.contract_map.get(value_str)
        if contract_id:
            option.setdefault("attrs", {})
            option["attrs"]["data-contract-id"] = contract_id
        return option


class ContractPaymentAdminForm(forms.ModelForm[ContractPayment]):
    case = forms.ModelChoiceField(
        queryset=Case.objects.none(),
        required=False,
        label=_("案件"),
        widget=ContractScopedCaseSelect,
    )

    class Meta:
        model = ContractPayment
        fields = ("contract", "case", "amount", "received_at", "invoiced_amount", "invoice_status", "note")
        widgets = {
            "note": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        contract_queryset = Contract.objects.order_by("-id")
        case_queryset = Case.objects.select_related("contract").order_by("contract_id", "id")

        self.fields["contract"].queryset = contract_queryset
        self.fields["case"].queryset = case_queryset
        self._auto_selected_case: Case | None = None

        case_widget = self.fields["case"].widget
        if isinstance(case_widget, ContractScopedCaseSelect):
            case_widget.contract_map = {
                str(case.pk): str(case.contract_id or "")
                for case in case_queryset
            }

        selected_contract_id = self._resolve_selected_contract_id()
        if selected_contract_id:
            self.fields["case"].help_text = _("请选择该合同下的具体案件。")
        else:
            self.fields["case"].help_text = _("请先选择合同，再选择具体案件。")

    def _resolve_selected_contract_id(self) -> int | None:
        contract_value = self.data.get("contract") or self.initial.get("contract")
        if contract_value:
            try:
                return int(contract_value)
            except (TypeError, ValueError):
                return None
        return getattr(self.instance, "contract_id", None)

    def clean(self) -> dict[str, Any]:
        cleaned_data = super().clean()
        contract: Contract | None = cleaned_data.get("contract")
        case: Case | None = cleaned_data.get("case")
        self._auto_selected_case = None

        if contract is None:
            return cleaned_data

        if case is not None and case.contract_id != contract.id:
            self.add_error("case", _("所选案件不属于当前合同。"))
            return cleaned_data

        contract_cases = list(contract.cases.order_by("id"))
        if case is None:
            if len(contract_cases) == 1:
                self._auto_selected_case = contract_cases[0]
            elif len(contract_cases) > 1:
                self.add_error("case", _("该合同下有多个案件，请选择具体案件。"))

        return cleaned_data

    def save(self, commit: bool = True) -> ContractPayment:
        instance = super().save(commit=False)
        if self._auto_selected_case is not None and instance.case_id is None:
            instance.case = self._auto_selected_case
        if commit:
            instance.save()
            self.save_m2m()
        return instance


class InvoiceAdminForm(forms.ModelForm[Invoice]):
    file = forms.FileField(
        required=False,
        label=_("上传发票"),
        help_text=_("支持 PDF、JPG、JPEG、PNG，单文件最大 20MB"),
    )

    class Meta:
        model = Invoice
        fields = (
            "file",
            "original_filename",
            "invoice_code",
            "invoice_number",
            "invoice_date",
            "amount",
            "tax_amount",
            "total_amount",
            "remark",
        )
        widgets = {
            "remark": forms.Textarea(attrs={"rows": 2, "cols": 20, "style": "width:160px;resize:vertical;"}),
        }

    def save(self, commit: bool = True) -> Invoice:
        instance = super().save(commit=False)
        uploaded_file = self.cleaned_data.get("file")
        if uploaded_file:
            from apps.contracts.admin.wiring_admin import get_invoice_upload_service

            svc = get_invoice_upload_service()
            payment_id: int = instance.payment_id or self.instance.payment_id
            saved = svc.save_invoice_file(uploaded_file, payment_id)
            saved.original_filename = instance.original_filename or saved.original_filename
            saved.invoice_code = instance.invoice_code
            saved.invoice_number = instance.invoice_number
            saved.invoice_date = instance.invoice_date
            saved.amount = instance.amount
            saved.tax_amount = instance.tax_amount
            saved.total_amount = instance.total_amount
            saved.remark = instance.remark
            saved.save(
                update_fields=[
                    "original_filename",
                    "invoice_code",
                    "invoice_number",
                    "invoice_date",
                    "amount",
                    "tax_amount",
                    "total_amount",
                    "remark",
                ]
            )
            return saved
        if commit:
            instance.save()
        return instance


class InvoiceInline(BaseTabularInline):
    model = Invoice
    form = InvoiceAdminForm
    extra = 1
    fields: ClassVar = ("file", "file_link", "total_amount")
    readonly_fields: ClassVar = ("file_link",)
    verbose_name = _("发票")
    verbose_name_plural = _("发票")

    @admin.display(description=_("查看文件"))
    def file_link(self, obj: Invoice) -> str:
        if not obj.pk or not obj.file_path or not obj.file_path.strip():
            return "-"
        url = reverse("admin:contracts_contractpayment_invoice_file", args=[obj.pk])
        return format_html('<a href="{}" target="_blank">{}</a>', url, obj.original_filename or _("查看"))

    def delete_model(self, request: HttpRequest, obj: Invoice) -> None:
        from apps.contracts.admin.wiring_admin import get_invoice_upload_service

        svc = get_invoice_upload_service()
        try:
            svc.delete_invoice(obj.pk)
        except Exception:
            obj.delete()


class ContractPaymentInline(BaseTabularInline[ContractPayment, ContractPayment]):
    model = ContractPayment
    extra = 0
    fields = ("case", "amount", "received_at", "invoiced_amount", "invoice_status", "note")

    def get_formset(self, request: HttpRequest, obj: Any = None, **kwargs: Any) -> Any:
        formset = super().get_formset(request, obj, **kwargs)
        original_clean = formset.clean

        def clean_fs(self: Any) -> None:
            original_clean(self)
            for form in self.forms:
                if not hasattr(form, "cleaned_data") or form.cleaned_data.get("DELETE"):
                    continue
                amount = form.cleaned_data.get("amount")
                invoiced_amount = form.cleaned_data.get("invoiced_amount") or 0
                if amount and invoiced_amount is not None:
                    if float(invoiced_amount) - float(amount) > 1e-6:
                        form.add_error("invoiced_amount", _("开票金额不能大于收款金额。"))
                    elif float(invoiced_amount) == 0:
                        form.cleaned_data["invoice_status"] = InvoiceStatus.UNINVOICED
                    elif 0 < float(invoiced_amount) < float(amount):
                        form.cleaned_data["invoice_status"] = InvoiceStatus.INVOICED_PARTIAL
                    else:
                        form.cleaned_data["invoice_status"] = InvoiceStatus.INVOICED_FULL

        formset.clean = clean_fs  # type: ignore[method-assign]
        return formset


@admin.register(ContractPayment)
class ContractPaymentAdmin(BaseModelAdmin[ContractPayment]):  # type: ignore[type-arg]
    form = ContractPaymentAdminForm
    change_form_template = "admin/contracts/contractpayment/change_form.html"
    fields = ("contract", "case", "amount", "received_at", "invoiced_amount", "invoice_status", "note")
    list_display = ("id", "contract", "case", "amount", "received_at", "invoice_status", "invoiced_amount")
    list_filter = ("invoice_status", "received_at")
    search_fields = ("contract__name", "case__name", "case__filing_number")
    inlines: ClassVar = [InvoiceInline]

    class Media:
        css = {"all": ("contracts/css/invoice_recognition.css",)}
        js = (
            "contracts/js/contract_payment_case_selector.js",
            "contracts/js/invoice_recognition.js",
        )

    def get_urls(self) -> list[Any]:
        urls = super().get_urls()
        custom = [
            path(
                "invoice-file/<int:invoice_id>/",
                self.admin_site.admin_view(self.invoice_file_view),
                name="contracts_contractpayment_invoice_file",
            )
        ]
        return custom + urls

    def invoice_file_view(self, request: HttpRequest, invoice_id: int) -> FileResponse:
        if not self.has_view_permission(request):
            raise Http404

        invoice = Invoice.objects.select_related("payment", "payment__contract").filter(pk=invoice_id).first()
        if invoice is None:
            raise Http404(_("发票不存在。"))

        file_path = storage.resolve_stored_file_path(invoice.file_path)
        if not file_path.exists() or not file_path.is_file():
            raise Http404(_("文件不存在。"))

        return FileResponse(
            file_path.open("rb"),
            as_attachment=False,
            filename=invoice.original_filename or file_path.name,
        )

    def get_queryset(self, request: HttpRequest) -> QuerySet[ContractPayment, ContractPayment]:
        return super().get_queryset(request).select_related("contract", "case")
