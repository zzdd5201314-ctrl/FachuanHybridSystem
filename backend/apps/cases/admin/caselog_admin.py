from __future__ import annotations

from pathlib import Path

from django import forms
from django.contrib import admin, messages
from django.contrib.admin.widgets import AdminFileWidget
from django.forms import ModelForm
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.urls import reverse
from apps.cases.admin.base_admin import BaseModelAdmin, BaseTabularInline
from apps.cases.models import CaseLog, CaseLogAttachment


class CaseLogAttachmentAdminFileWidget(AdminFileWidget):
    initial_text = ""
    input_text = "重新上传"
    clear_checkbox_label = "清除"

    class _DisplayValue:
        def __init__(self, file_value: object, label: str) -> None:
            self._file_value = file_value
            self.url = getattr(file_value, "url", "")
            self.label = label

        def __getattr__(self, item: str) -> object:
            return getattr(self._file_value, item)

        def __str__(self) -> str:
            return self.label

    def get_context(self, name: str, value: object, attrs: dict[str, object] | None) -> dict[str, object]:
        context = super().get_context(name, value, attrs)
        if value and getattr(value, "url", None):
            instance = getattr(value, "instance", None)
            original_filename = getattr(instance, "original_filename", None) if instance is not None else None
            if original_filename:
                context["widget"]["value"] = self._DisplayValue(value, original_filename)
        return context


class CaseLogAttachmentInlineForm(forms.ModelForm[CaseLogAttachment]):
    queue_for_case_material_binding = forms.BooleanField(
        required=False,
        label="纳入案件材料待绑定",
        help_text="勾选后，保存日志后可回到案件详情页材料区继续绑定分类。",
    )

    class Meta:
        model = CaseLogAttachment
        fields = ("file", "queue_for_case_material_binding")
        widgets = {"file": CaseLogAttachmentAdminFileWidget()}

    def save(self, commit: bool = True) -> CaseLogAttachment:
        instance = super().save(commit=False)
        uploaded_file = self.cleaned_data.get("file")
        if uploaded_file is not None and getattr(uploaded_file, "name", None):
            instance.original_filename = Path(str(uploaded_file.name)).name
        if commit:
            instance.save()
            self.save_m2m()
        return instance


class CaseLogAttachmentInline(BaseTabularInline):
    model = CaseLogAttachment
    form = CaseLogAttachmentInlineForm
    extra = 0
    fields = ("file", "queue_for_case_material_binding", "uploaded_at")
    readonly_fields = ("uploaded_at",)
    autocomplete_fields = ("log",)


class ReminderInline(BaseTabularInline):
    model = CaseLog.reminders.rel.related_model  # type: ignore[assignment]  # Reminder
    extra = 0
    fields = ("reminder_type", "content", "due_at", "include_in_important_time")
    verbose_name = "重要日期提醒"
    verbose_name_plural = "重要日期提醒"
    ordering = ("due_at",)


@admin.register(CaseLog)
class CaseLogAdmin(BaseModelAdmin):
    list_display = ("id", "case_link", "actor", "reminder_type", "reminder_time", "created_at", "updated_at")
    list_select_related = ("case", "actor")
    list_per_page = 50
    list_filter = ("created_at",)
    search_fields = ("content", "case__name")
    ordering = ("-created_at",)
    autocomplete_fields = ("case", "actor")
    exclude = ("actor", "source_subfolder")
    inlines = (ReminderInline, CaseLogAttachmentInline)
    change_form_template = "admin/cases/caselog/change_form.html"

    @admin.display(description="案件名称", ordering="case__name")
    def case_link(self, obj: CaseLog) -> str:
        url = reverse("admin:cases_case_detail", args=[obj.case_id])
        return format_html('<a href="{}">{}</a>', url, obj.case)

    def save_model(
        self,
        request: HttpRequest,
        obj: CaseLog,
        form: ModelForm[CaseLog],
        change: bool,
    ) -> None:
        if not getattr(obj, "actor_id", None):
            user_id = getattr(request.user, "id", None)
            if user_id is not None:
                obj.actor_id = user_id
        super().save_model(request, obj, form, change)

    def response_add(self, request: HttpRequest, obj: CaseLog, post_url_continue: str | None = None) -> HttpResponse:
        if "_continue" in request.POST or "_addanother" in request.POST:
            return super().response_add(request, obj, post_url_continue)
        return HttpResponseRedirect(reverse("admin:cases_case_detail", args=[obj.case_id]))

    def save_related(self, request: HttpRequest, form: ModelForm[CaseLog], formsets: list[object], change: bool) -> None:
        super().save_related(request, form, formsets, change)

        queued_count = 0
        for formset in formsets:
            if getattr(formset, "model", None) is not CaseLogAttachment:
                continue
            for inline_form in getattr(formset, "forms", []):
                cleaned_data = getattr(inline_form, "cleaned_data", None) or {}
                if not cleaned_data:
                    continue
                if cleaned_data.get("DELETE"):
                    continue
                if not cleaned_data.get("queue_for_case_material_binding"):
                    continue
                instance = getattr(inline_form, "instance", None)
                if getattr(instance, "pk", None):
                    queued_count += 1

        if queued_count:
            messages.info(
                request,
                f"已保存 {queued_count} 个日志附件。可回到案件详情页，在“案件当事人材料/非当事人材料”中继续绑定分类。",
            )


@admin.register(CaseLogAttachment)
class CaseLogAttachmentAdmin(BaseModelAdmin):
    list_display = ("id", "log", "uploaded_at")
    search_fields = ("log__case__name",)
    autocomplete_fields = ("log",)

    def get_model_perms(self, request: HttpRequest) -> dict[str, bool]:
        """隐藏 Admin 首页入口，但保留直接 URL 访问能力"""
        return {}
