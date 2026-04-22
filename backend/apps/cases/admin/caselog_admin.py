from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import admin, messages
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Prefetch, Q
from django.forms import ModelForm
from django.http import FileResponse, Http404
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import URLPattern, path, reverse
from django.utils import timezone

from apps.cases.admin.base_admin import BaseModelAdmin
from apps.cases.models import Case, CaseLog, CaseLogAttachment, CaseNumber
from apps.cases.services.log.caselog_service import CaseLogService
from apps.core.exceptions import ValidationException
from apps.organization.models import Lawyer
from apps.reminders.models import Reminder, ReminderType
from apps.reminders.services.wiring import get_reminder_service

CASE_STATUS_LABELS = {
    "active": "在办",
    "closed": "已结案",
}

CASE_STAGE_LABELS = {
    "first_trial": "一审",
    "second_trial": "二审",
    "enforcement": "执行",
    "labor_arbitration": "劳动仲裁",
    "administrative_review": "行政复议",
    "private_prosecution": "自诉",
    "investigation": "侦查",
    "prosecution_review": "审查起诉",
    "retrial_first": "重审一审",
    "retrial_second": "重审二审",
    "apply_retrial": "申请再审",
    "rehearing_first": "再审一审",
    "rehearing_second": "再审二审",
    "review": "提审",
    "death_penalty_review": "死刑复核程序",
    "petition": "申诉",
    "apply_protest": "申请抗诉",
    "petition_protest": "申诉抗诉",
}

ARCHIVE_FILTER_OPTIONS = (
    {"value": "", "label": "全部案件"},
    {"value": "active", "label": "仅未归档"},
    {"value": "archived", "label": "仅已归档"},
)

ATTACHMENT_FILTER_OPTIONS = (
    {"value": "", "label": "全部日志"},
    {"value": "with", "label": "仅有附件"},
    {"value": "without", "label": "仅无附件"},
)


MANAGED_REMINDER_SOURCE = "case_log_admin_form"

DATE_ORDER_OPTIONS = (
    {"value": "", "label": "默认排序"},
    {"value": "asc", "label": "按日期正序"},
    {"value": "desc", "label": "按日期倒序"},
)


def _build_stage_choices() -> list[tuple[str, str]]:
    choices = [("", "未设置")]
    choices.extend(
        (value, CASE_STAGE_LABELS.get(value, value))
        for value, _ in CaseLog._meta.get_field("stage").choices
    )
    return choices


def _build_reminder_type_choices() -> list[tuple[str, str]]:
    return [(str(value), str(label)) for value, label in ReminderType.choices]


def _build_case_type_options() -> list[dict[str, str]]:
    return [
        {"value": str(value), "label": str(label)}
        for value, label in Case._meta.get_field("case_type").choices
        if value
    ]


def _build_case_status_options() -> list[dict[str, str]]:
    return [
        {"value": str(value), "label": CASE_STATUS_LABELS.get(str(value), str(label))}
        for value, label in Case._meta.get_field("status").choices
        if value
    ]


def _build_case_stage_options() -> list[dict[str, str]]:
    return [
        {"value": str(value), "label": CASE_STAGE_LABELS.get(str(value), str(label))}
        for value, label in Case._meta.get_field("current_stage").choices
        if value
    ]


def _build_lawyer_options() -> list[dict[str, str]]:
    queryset = (
        Lawyer.objects.filter(case_assignments__isnull=False)
        .distinct()
        .order_by("real_name", "username", "pk")
    )
    return [
        {
            "value": str(lawyer.pk),
            "label": str(getattr(lawyer, "real_name", None) or getattr(lawyer, "username", None) or f"律师 {lawyer.pk}"),
        }
        for lawyer in queryset
    ]


def _build_stage_filter_options() -> list[dict[str, str]]:
    return [{"value": "", "label": "全部阶段"}, *[
        {"value": str(value), "label": CASE_STAGE_LABELS.get(str(value), str(label))}
        for value, label in CaseLog._meta.get_field("stage").choices
        if value
    ]]


class CaseLogCreateAdminForm(forms.Form):
    stage = forms.ChoiceField(
        required=False,
        label="阶段",
        choices=_build_stage_choices(),
        widget=forms.Select(attrs={"class": "stage-select-field"}),
    )
    logged_at = forms.DateTimeField(
        required=False,
        label="时间",
        input_formats=["%Y-%m-%dT%H:%M"],
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"}),
    )
    content = forms.CharField(
        label="日志内容",
        widget=forms.Textarea(attrs={"rows": 10}),
    )
    note = forms.CharField(
        required=False,
        label="备注",
        widget=forms.Textarea(attrs={"rows": 5}),
    )
    enable_reminder = forms.BooleanField(
        required=False,
        label="\u52a0\u5165\u65e5\u5386\u63d0\u9192",
    )
    reminder_type = forms.ChoiceField(
        required=False,
        label="\u63d0\u9192\u7c7b\u578b",
        choices=_build_reminder_type_choices(),
        initial=ReminderType.OTHER,
    )
    reminder_time = forms.DateTimeField(
        required=False,
        label="\u63d0\u9192\u65f6\u95f4",
        input_formats=["%Y-%m-%dT%H:%M"],
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"}),
    )
    reminder_content = forms.CharField(
        required=False,
        label="\u63d0\u9192\u5185\u5bb9",
        max_length=255,
        widget=forms.TextInput(attrs={"placeholder": "\u7559\u7a7a\u65f6\u4f1a\u9ed8\u8ba4\u4f7f\u7528\u65e5\u5fd7\u5185\u5bb9"}),
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        if not self.initial.get("logged_at"):
            self.initial["logged_at"] = timezone.localtime().strftime("%Y-%m-%dT%H:%M")
        reminder_time = self.initial.get("reminder_time")
        if reminder_time and hasattr(reminder_time, "strftime"):
            self.initial["reminder_time"] = timezone.localtime(reminder_time).strftime("%Y-%m-%dT%H:%M")
        if not self.initial.get("reminder_type"):
            self.initial["reminder_type"] = ReminderType.OTHER

    def clean(self) -> dict[str, Any]:
        cleaned_data = super().clean()
        if cleaned_data.get("enable_reminder") and not cleaned_data.get("reminder_time"):
            self.add_error("reminder_time", "\u8bf7\u8bbe\u7f6e\u63d0\u9192\u65f6\u95f4\u3002")
        return cleaned_data


def _get_case_numbers_text(case_obj: Case) -> str:
    numbers = [item.number for item in case_obj.case_numbers.all() if item.number]
    return " / ".join(numbers) if numbers else "未录入案号"


def _get_case_status_label(case_obj: Case) -> str:
    return CASE_STATUS_LABELS.get(case_obj.status or "", case_obj.status or "-")


def _get_case_lawyer_text(case_obj: Case) -> str:
    assignments = case_obj.assignments.all()
    names = []
    for assignment in assignments:
        lawyer = getattr(assignment, "lawyer", None)
        if lawyer is None:
            continue
        names.append(getattr(lawyer, "real_name", None) or getattr(lawyer, "username", "") or "")

    names = [name for name in names if name]
    return " / ".join(names) if names else "未指派"


def _get_lawyer_display(lawyer: Any | None) -> str:
    if lawyer is None:
        return "-"
    return str(getattr(lawyer, "real_name", None) or getattr(lawyer, "username", None) or f"律师 {lawyer.pk}")


def _get_stage_label(stage: str | None) -> str:
    if not stage:
        return "-"
    return CASE_STAGE_LABELS.get(stage, stage)


def _format_datetime(value: Any) -> str:
    if not value:
        return "-"
    try:
        return timezone.localtime(value).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return "-"


def _format_date(value: Any) -> str:
    if not value:
        return "-"
    try:
        return value.strftime("%Y-%m-%d")
    except Exception:
        return "-"


def _get_attachment_name(attachment: CaseLogAttachment) -> str:
    return attachment.display_name


def _build_case_log_archive_hint(case_obj: Case) -> dict[str, Any]:
    default_hint = {
        "enabled": False,
        "writable": False,
        "tone": "warning",
        "title": "附件归档暂不可用",
        "detail": "当前案件还没有可用的绑定目录，附件会先保存在系统上传区。",
        "root_path": "",
        "upload_path": "case_logs/",
        "folder_count": 0,
    }
    try:
        from apps.cases.services.material.case_material_archive_service import CaseMaterialArchiveService

        archive_config = CaseMaterialArchiveService().get_archive_config_for_case(case_id=int(case_obj.pk))
    except Exception:
        return {
            **default_hint,
            "detail": "归档目录信息暂时加载失败，附件会先保存在系统上传区，保存后仍会按既有逻辑尝试归档。",
        }

    enabled = bool(archive_config.get("enabled"))
    writable = bool(archive_config.get("writable"))
    root_path = str(archive_config.get("root_path") or "")
    folder_count = len(archive_config.get("folders") or [])
    message = str(archive_config.get("message") or "").strip()

    if enabled and writable:
        if folder_count > 1:
            detail = "保存时会把附件复制到案件绑定目录，并按文件名自动推荐子文件夹；未命中时会先放到案件根目录。"
        else:
            detail = "保存时会把附件复制到案件绑定目录。当前还没有可用子文件夹时，会先放到案件根目录。"
        return {
            "enabled": True,
            "writable": True,
            "tone": "ready",
            "title": "附件归档已启用",
            "detail": detail,
            "root_path": root_path,
            "upload_path": "case_logs/",
            "folder_count": folder_count,
        }

    detail = message or "当前案件还没有可用的绑定目录，附件会先保存在系统上传区。"
    return {
        "enabled": enabled,
        "writable": writable,
        "tone": "warning",
        "title": "附件归档暂不可用",
        "detail": detail,
        "root_path": root_path,
        "upload_path": "case_logs/",
        "folder_count": folder_count,
    }


def _build_existing_attachment_rows(log: CaseLog) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for attachment in log.attachments.all():
        rows.append(
            {
                "id": attachment.pk,
                "name": _get_attachment_name(attachment),
                "url": reverse("admin:cases_caselog_attachment_file", args=[attachment.pk]),
                "archive_relative_path": str(getattr(attachment, "archive_relative_path", "") or ""),
                "archived_file_path": str(getattr(attachment, "archived_file_path", "") or ""),
            }
        )
    return rows


def _get_case_log_submit_mode(request: HttpRequest) -> str:
    if "_continue" in request.POST:
        return "continue"
    if "_addanother" in request.POST:
        return "addanother"
    return "save"


def _get_case_log_success_url(*, case_id: int, log_id: int, submit_mode: str) -> str:
    if submit_mode == "continue":
        return reverse("admin:cases_caselog_edit", args=[case_id, log_id])
    if submit_mode == "addanother":
        return reverse("admin:cases_caselog_create", args=[case_id])
    return reverse("admin:cases_caselog_ledger", args=[case_id])


def _get_managed_log_reminders(log_id: int) -> list[Reminder]:
    reminders = list(Reminder.objects.filter(case_log_id=log_id).order_by("-due_at", "-id"))
    managed: list[Reminder] = []
    for reminder in reminders:
        metadata = reminder.metadata if isinstance(reminder.metadata, dict) else {}
        if metadata.get("source") == MANAGED_REMINDER_SOURCE:
            managed.append(reminder)
    return managed


def _build_managed_reminder_metadata(*, existing: Reminder | None = None, user: Any | None = None) -> dict[str, Any]:
    metadata = dict(existing.metadata) if existing and isinstance(existing.metadata, dict) else {}
    metadata["source"] = MANAGED_REMINDER_SOURCE
    metadata["managed_by"] = "case_log_admin"
    user_id = getattr(user, "id", None) if user is not None else None
    if user_id is not None:
        metadata["updated_by_user_id"] = user_id
        metadata.setdefault("created_by_user_id", user_id)
    return metadata


def _sync_managed_log_reminder(
    *,
    log: CaseLog,
    enable_reminder: bool,
    reminder_time: Any,
    reminder_type: str | None,
    reminder_content: str | None,
    user: Any | None,
    reminder_service: Any | None = None,
) -> Reminder | None:
    service = reminder_service or get_reminder_service()
    managed_reminders = _get_managed_log_reminders(int(log.pk))

    if not enable_reminder or reminder_time is None:
        for reminder in managed_reminders:
            service.delete_reminder(reminder.pk)
        return None

    normalized_type = reminder_type if reminder_type in ReminderType.values else ReminderType.OTHER
    content = (reminder_content or "").strip() or str(log.content).strip()
    content = content[:255]

    primary = managed_reminders[0] if managed_reminders else None
    extra_reminders = managed_reminders[1:] if managed_reminders else []
    metadata = _build_managed_reminder_metadata(existing=primary, user=user)

    if primary is None:
        reminder = service.create_reminder(
            case_log_id=int(log.pk),
            reminder_type=normalized_type,
            content=content,
            due_at=reminder_time,
            metadata=metadata,
        )
    else:
        reminder = service.update_reminder(
            primary.pk,
            {
                "reminder_type": normalized_type,
                "content": content,
                "due_at": reminder_time,
                "metadata": metadata,
            },
        )

    for extra in extra_reminders:
        service.delete_reminder(extra.pk)
    return reminder


def _get_managed_log_reminder_initial(log: CaseLog) -> dict[str, Any]:
    managed = _get_managed_log_reminders(int(log.pk))
    reminder = managed[0] if managed else None
    if reminder is None:
        return {
            "enable_reminder": False,
            "reminder_type": ReminderType.OTHER,
            "reminder_time": None,
            "reminder_content": "",
        }
    return {
        "enable_reminder": True,
        "reminder_type": reminder.reminder_type,
        "reminder_time": reminder.due_at,
        "reminder_content": reminder.content,
    }


def _build_case_log_summary_items(*, case_obj: Case, recorder: Any | None) -> list[dict[str, str]]:
    return [
        {"label": "案件名称", "value": str(case_obj.name or "-")},
        {"label": "案号", "value": _get_case_numbers_text(case_obj)},
        {"label": "当前阶段", "value": _get_stage_label(case_obj.current_stage)},
        {"label": "记录人", "value": _get_lawyer_display(recorder)},
    ]


def _get_default_stage_for_new_log(case_obj: Case) -> str:
    if case_obj.current_stage:
        return str(case_obj.current_stage)

    latest_stage = (
        CaseLog.objects.filter(case_id=case_obj.pk)
        .exclude(stage__isnull=True)
        .exclude(stage="")
        .order_by("-logged_at", "-created_at", "-pk")
        .values_list("stage", flat=True)
        .first()
    )
    return str(latest_stage or "")


@admin.register(CaseLog)
class CaseLogAdmin(BaseModelAdmin):
    change_list_template = "admin/cases/caselog/change_list.html"
    list_display = ("id", "case", "actor", "stage", "logged_at", "created_at")
    list_filter = ("created_at", "logged_at", "stage")
    search_fields = ("content", "case__name")
    autocomplete_fields = ("case", "actor")
    readonly_fields = ("actor", "created_at", "updated_at")
    fields = ("case", "stage", "logged_at", "content", "note", "actor", "created_at", "updated_at")
    exclude = ("log_type", "source", "is_pinned")

    def get_urls(self) -> list[URLPattern]:
        custom_urls: list[URLPattern] = [
            path(
                "case/<int:case_id>/",
                self.admin_site.admin_view(self.case_ledger_view),
                name="cases_caselog_ledger",
            ),
            path(
                "case/<int:case_id>/logs/<int:log_id>/edit/",
                self.admin_site.admin_view(self.case_log_edit_view),
                name="cases_caselog_edit",
            ),
            path(
                "case/<int:case_id>/logs/<int:log_id>/delete/",
                self.admin_site.admin_view(self.case_log_delete_view),
                name="cases_caselog_delete_log",
            ),
            path(
                "case/<int:case_id>/new/",
                self.admin_site.admin_view(self.case_log_create_view),
                name="cases_caselog_create",
            ),
            path(
                "attachments/<int:attachment_id>/file/",
                self.admin_site.admin_view(self.attachment_file_view),
                name="cases_caselog_attachment_file",
            ),
        ]
        return custom_urls + super().get_urls()

    def add_view(
        self,
        request: HttpRequest,
        form_url: str = "",
        extra_context: dict[str, Any] | None = None,
    ) -> HttpResponse:
        messages.info(request, "请先选择案件，再进入该案件的日志台账新增日志。")
        return HttpResponseRedirect(reverse("admin:cases_caselog_changelist"))

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def change_view(
        self,
        request: HttpRequest,
        object_id: str,
        form_url: str = "",
        extra_context: dict[str, Any] | None = None,
    ) -> HttpResponse:
        log = self._get_case_log_or_404(case_id=None, log_id=int(object_id))
        return HttpResponseRedirect(reverse("admin:cases_caselog_edit", args=[log.case_id, log.pk]))

    def changelist_view(
        self,
        request: HttpRequest,
        extra_context: dict[str, Any] | None = None,
    ) -> HttpResponse:
        if request.method == "POST":
            return HttpResponseRedirect(reverse("admin:cases_caselog_changelist"))

        if request.method == "POST":
            action = (request.POST.get("action") or "").strip()
            selected_ids = [value for value in request.POST.getlist("_selected_action") if value]
            if action == "delete_selected":
                if not selected_ids:
                    messages.warning(request, "请先选择要删除的案件。")
                else:
                    deleted_count = Case.objects.filter(pk__in=selected_ids).count()
                    if deleted_count:
                        Case.objects.filter(pk__in=selected_ids).delete()
                        messages.success(request, f"已删除 {deleted_count} 个案件。")
                    else:
                        messages.warning(request, "未找到可删除的案件。")
                return HttpResponseRedirect(reverse("admin:cases_caselog_changelist"))

        search_query = (request.GET.get("q") or "").strip()
        status_filter = (request.GET.get("status") or "").strip()
        case_type_filter = (request.GET.get("case_type") or "").strip()
        current_stage_filter = (request.GET.get("current_stage") or "").strip()
        archive_filter = (request.GET.get("archived") or "").strip()
        lawyer_filter = (request.GET.get("lawyer") or "").strip()
        date_order = (request.GET.get("date_order") or "").strip()
        page_number = request.GET.get("p") or 1

        queryset = (
            Case.objects.all()
            .prefetch_related(Prefetch("case_numbers", queryset=CaseNumber.objects.order_by("created_at")))
            .prefetch_related("assignments__lawyer")
        )
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query)
                | Q(filing_number__icontains=search_query)
                | Q(case_numbers__number__icontains=search_query)
            ).distinct()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if case_type_filter:
            queryset = queryset.filter(case_type=case_type_filter)
        if current_stage_filter:
            queryset = queryset.filter(current_stage=current_stage_filter)
        if archive_filter == "active":
            queryset = queryset.filter(is_archived=False)
        elif archive_filter == "archived":
            queryset = queryset.filter(is_archived=True)
        if lawyer_filter:
            queryset = queryset.filter(assignments__lawyer_id=lawyer_filter).distinct()

        if date_order == "asc":
            queryset = queryset.order_by("start_date", "id")
        elif date_order == "desc":
            queryset = queryset.order_by("-start_date", "-id")
        else:
            queryset = queryset.order_by("-id")

        paginator = Paginator(queryset, 20)
        page_obj = paginator.get_page(page_number)
        case_rows = [
            {
                "id": case_obj.id,
                "name": case_obj.name,
                "current_stage_label": _get_stage_label(case_obj.current_stage),
                "case_numbers_text": _get_case_numbers_text(case_obj),
                "lawyer_text": _get_case_lawyer_text(case_obj),
                "status_label": _get_case_status_label(case_obj),
                "status_key": case_obj.status or "",
                "start_date_text": _format_date(case_obj.start_date),
                "ledger_url": reverse("admin:cases_caselog_ledger", args=[case_obj.pk]),
                "is_archived": case_obj.is_archived,
            }
            for case_obj in page_obj.object_list
        ]

        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": "日志",
            "subtitle": "这里只显示案件列表。点击案件名称后，再进入该案件的全部日志台账。",
            "search_query": search_query,
            "status_filter": status_filter,
            "case_type_filter": case_type_filter,
            "current_stage_filter": current_stage_filter,
            "archive_filter": archive_filter,
            "lawyer_filter": lawyer_filter,
            "date_order": date_order,
            "page_obj": page_obj,
            "case_rows": case_rows,
            "case_type_options": _build_case_type_options(),
            "current_stage_options": _build_case_stage_options(),
            "status_options": _build_case_status_options(),
            "archive_options": ARCHIVE_FILTER_OPTIONS,
            "lawyer_options": _build_lawyer_options(),
            "date_order_options": DATE_ORDER_OPTIONS,
        }
        if extra_context:
            context.update(extra_context)
        return TemplateResponse(request, self.change_list_template, context)

    def case_ledger_view(self, request: HttpRequest, case_id: int) -> HttpResponse:
        case_obj = self._get_case_or_404(case_id)
        if request.method == "POST":
            action = (request.POST.get("action") or "").strip()
            selected_ids = [value for value in request.POST.getlist("_selected_action") if value]
            if action == "delete_selected_logs":
                if not selected_ids:
                    messages.warning(request, "请先选择要删除的日志。")
                else:
                    deleted_count = 0
                    log_service = CaseLogService()
                    for log_id in selected_ids:
                        try:
                            log_service.delete_log(
                                log_id=int(log_id),
                                user=request.user,
                                perm_open_access=True,
                            )
                            deleted_count += 1
                        except Exception:
                            continue
                    if deleted_count:
                        messages.success(request, f"已删除 {deleted_count} 条日志。")
                    else:
                        messages.warning(request, "未找到可删除的日志。")
                return HttpResponseRedirect(reverse("admin:cases_caselog_ledger", args=[case_obj.pk]))

        search_query = (request.GET.get("q") or "").strip()
        stage_filter = (request.GET.get("stage") or "").strip()
        attachment_filter = (request.GET.get("attachments") or "").strip()
        actor_filter = (request.GET.get("actor") or "").strip()
        time_order = (request.GET.get("time_order") or "").strip()

        logs = (
            CaseLog.objects.filter(case_id=case_obj.pk)
            .select_related("actor")
            .prefetch_related("attachments__source_invoice")
        )
        if search_query:
            logs = logs.filter(Q(content__icontains=search_query) | Q(note__icontains=search_query))
        if stage_filter:
            logs = logs.filter(stage=stage_filter)
        if attachment_filter == "with":
            logs = logs.filter(attachments__isnull=False)
        elif attachment_filter == "without":
            logs = logs.filter(attachments__isnull=True)
        if actor_filter:
            logs = logs.filter(actor_id=actor_filter)
        if time_order == "asc":
            logs = logs.order_by("logged_at", "created_at", "pk")
        elif time_order == "desc":
            logs = logs.order_by("-logged_at", "-created_at", "-pk")
        else:
            logs = logs.order_by("logged_at", "created_at", "pk")
        logs = logs.distinct()

        actor_options = [
            {"value": str(item.pk), "label": _get_lawyer_display(item)}
            for item in Lawyer.objects.filter(case_logs__case_id=case_obj.pk).distinct().order_by("real_name", "username", "pk")
        ]

        log_rows = []
        for index, log in enumerate(logs, start=1):
            attachments = [
                {
                    "id": attachment.pk,
                    "name": _get_attachment_name(attachment),
                    "url": reverse("admin:cases_caselog_attachment_file", args=[attachment.pk]),
                }
                for attachment in log.attachments.all()
            ]
            log_rows.append(
                {
                    "id": log.pk,
                    "index": index,
                    "edit_url": reverse("admin:cases_caselog_edit", args=[case_obj.pk, log.pk]),
                    "delete_url": reverse("admin:cases_caselog_delete_log", args=[case_obj.pk, log.pk]),
                    "stage_label": _get_stage_label(log.stage),
                    "content": log.content,
                    "logged_at": _format_datetime(log.logged_at or log.created_at),
                    "actor_name": _get_lawyer_display(getattr(log, "actor", None)),
                    "note": log.note or "",
                    "attachments": attachments,
                }
            )

        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": f"{case_obj.name} - 日志台账",
            "case_obj": case_obj,
            "case_numbers_text": _get_case_numbers_text(case_obj),
            "status_label": _get_case_status_label(case_obj),
            "current_stage_label": _get_stage_label(case_obj.current_stage),
            "back_url": reverse("admin:cases_caselog_changelist"),
            "create_url": reverse("admin:cases_caselog_create", args=[case_obj.pk]),
            "case_detail_url": reverse("admin:cases_case_detail", args=[case_obj.pk]),
            "log_rows": log_rows,
            "search_query": search_query,
            "stage_filter": stage_filter,
            "attachment_filter": attachment_filter,
            "actor_filter": actor_filter,
            "time_order": time_order,
            "stage_options": _build_stage_filter_options(),
            "attachment_options": ATTACHMENT_FILTER_OPTIONS,
            "actor_options": actor_options,
            "time_order_options": DATE_ORDER_OPTIONS,
        }
        return TemplateResponse(request, "admin/cases/caselog/ledger.html", context)

    def case_delete_view(self, request: HttpRequest, case_id: int) -> HttpResponse:
        if request.method != "POST":
            raise Http404("仅支持 POST 删除")

        case_obj = self._get_case_or_404(case_id)
        case_name = case_obj.name
        case_obj.delete()
        messages.success(request, f"案件“{case_name}”已删除。")
        return HttpResponseRedirect(reverse("admin:cases_caselog_changelist"))

    def case_log_delete_view(self, request: HttpRequest, case_id: int, log_id: int) -> HttpResponse:
        if request.method != "POST":
            raise Http404("仅支持 POST 删除")

        case_obj = self._get_case_or_404(case_id)
        log = self._get_case_log_or_404(case_id=case_obj.pk, log_id=log_id)
        CaseLogService().delete_log(
            log_id=log.pk,
            user=request.user,
            perm_open_access=True,
        )
        messages.success(request, "日志已删除。")
        return HttpResponseRedirect(reverse("admin:cases_caselog_ledger", args=[case_obj.pk]))

    def attachment_file_view(self, request: HttpRequest, attachment_id: int) -> FileResponse:
        if not self.has_view_permission(request):
            raise Http404

        file_path, download_name = CaseLogService().attachment_service.get_attachment_file(
            attachment_id=attachment_id,
            user=request.user,
            perm_open_access=True,
        )
        return FileResponse(file_path.open("rb"), as_attachment=False, filename=download_name)

    def case_log_create_view(self, request: HttpRequest, case_id: int) -> HttpResponse:
        case_obj = self._get_case_or_404(case_id)
        log_service = CaseLogService()
        archive_hint = _build_case_log_archive_hint(case_obj)

        if request.method == "POST":
            form = CaseLogCreateAdminForm(request.POST)
            files = request.FILES.getlist("attachments")
            if form.is_valid():
                logged_at = form.cleaned_data.get("logged_at")
                reminder_time = form.cleaned_data.get("reminder_time")
                if logged_at and timezone.is_naive(logged_at):
                    logged_at = timezone.make_aware(logged_at, timezone.get_current_timezone())
                if reminder_time and timezone.is_naive(reminder_time):
                    reminder_time = timezone.make_aware(reminder_time, timezone.get_current_timezone())

                try:
                    with transaction.atomic():
                        created = log_service.create_log(
                            case_id=case_obj.pk,
                            content=form.cleaned_data["content"],
                            stage=form.cleaned_data.get("stage") or None,
                            note=form.cleaned_data.get("note") or "",
                            logged_at=logged_at,
                            user=request.user,
                            perm_open_access=True,
                        )
                        _sync_managed_log_reminder(
                            log=created,
                            enable_reminder=bool(form.cleaned_data.get("enable_reminder")),
                            reminder_time=reminder_time,
                            reminder_type=form.cleaned_data.get("reminder_type"),
                            reminder_content=form.cleaned_data.get("reminder_content"),
                            user=request.user,
                        )
                    if files:
                        log_service.upload_attachments(
                            log_id=created.pk,
                            files=files,
                            user=request.user,
                            perm_open_access=True,
                        )
                    messages.success(request, "日志已新增。")
                    submit_mode = _get_case_log_submit_mode(request)
                    return HttpResponseRedirect(
                        _get_case_log_success_url(case_id=case_obj.pk, log_id=created.pk, submit_mode=submit_mode)
                    )
                except ValidationException as exc:
                    form.add_error(None, str(exc))
                except Exception as exc:
                    form.add_error(None, f"新增日志失败：{exc}")
        else:
            form = CaseLogCreateAdminForm(
                initial={
                    "stage": _get_default_stage_for_new_log(case_obj),
                    "reminder_type": ReminderType.OTHER,
                }
            )

        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": f"{case_obj.name} - 新增日志",
            "case_obj": case_obj,
            "case_numbers_text": _get_case_numbers_text(case_obj),
            "back_url": reverse("admin:cases_caselog_ledger", args=[case_obj.pk]),
            "form": form,
            "case_summary_items": _build_case_log_summary_items(case_obj=case_obj, recorder=request.user),
            "archive_hint": archive_hint,
        }
        return TemplateResponse(request, "admin/cases/caselog/create.html", context)

    def case_log_edit_view(self, request: HttpRequest, case_id: int, log_id: int) -> HttpResponse:
        case_obj = self._get_case_or_404(case_id)
        log = self._get_case_log_or_404(case_id=case_obj.pk, log_id=log_id)
        log_service = CaseLogService()
        archive_hint = _build_case_log_archive_hint(case_obj)

        if request.method == "POST":
            form = CaseLogCreateAdminForm(request.POST)
            files = request.FILES.getlist("attachments")
            delete_attachment_ids = request.POST.getlist("delete_attachment_ids")
            if form.is_valid():
                logged_at = form.cleaned_data.get("logged_at")
                reminder_time = form.cleaned_data.get("reminder_time")
                if logged_at and timezone.is_naive(logged_at):
                    logged_at = timezone.make_aware(logged_at, timezone.get_current_timezone())
                if reminder_time and timezone.is_naive(reminder_time):
                    reminder_time = timezone.make_aware(reminder_time, timezone.get_current_timezone())

                try:
                    with transaction.atomic():
                        updated_log = log_service.update_log(
                            log_id=log.pk,
                            data={
                                "content": form.cleaned_data["content"],
                                "stage": form.cleaned_data.get("stage") or None,
                                "note": form.cleaned_data.get("note") or "",
                                "logged_at": logged_at,
                            },
                            user=request.user,
                            perm_open_access=True,
                        )
                        _sync_managed_log_reminder(
                            log=updated_log,
                            enable_reminder=bool(form.cleaned_data.get("enable_reminder")),
                            reminder_time=reminder_time,
                            reminder_type=form.cleaned_data.get("reminder_type"),
                            reminder_content=form.cleaned_data.get("reminder_content"),
                            user=request.user,
                        )
                    for attachment_id in delete_attachment_ids:
                        if not attachment_id:
                            continue
                        log_service.delete_attachment(
                            attachment_id=int(attachment_id),
                            user=request.user,
                            perm_open_access=True,
                        )
                    if files:
                        log_service.upload_attachments(
                            log_id=log.pk,
                            files=files,
                            user=request.user,
                            perm_open_access=True,
                        )
                    messages.success(request, "日志已更新。")
                    submit_mode = _get_case_log_submit_mode(request)
                    return HttpResponseRedirect(
                        _get_case_log_success_url(case_id=case_obj.pk, log_id=log.pk, submit_mode=submit_mode)
                    )
                except ValidationException as exc:
                    form.add_error(None, str(exc))
                except Exception as exc:
                    form.add_error(None, f"修改日志失败：{exc}")
        else:
            reminder_initial = _get_managed_log_reminder_initial(log)
            form = CaseLogCreateAdminForm(
                initial={
                    "stage": log.stage or "",
                    "logged_at": timezone.localtime(log.logged_at or log.created_at).strftime("%Y-%m-%dT%H:%M"),
                    "content": log.content,
                    "note": log.note,
                    **reminder_initial,
                }
            )

        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": f"{case_obj.name} - 修改日志",
            "case_obj": case_obj,
            "case_numbers_text": _get_case_numbers_text(case_obj),
            "back_url": reverse("admin:cases_caselog_ledger", args=[case_obj.pk]),
            "delete_url": reverse("admin:cases_caselog_delete_log", args=[case_obj.pk, log.pk]),
            "form": form,
            "case_summary_items": _build_case_log_summary_items(
                case_obj=case_obj,
                recorder=getattr(log, "actor", None) or request.user,
            ),
            "log_obj": log,
            "archive_hint": archive_hint,
            "existing_attachments": _build_existing_attachment_rows(log),
        }
        return TemplateResponse(request, "admin/cases/caselog/edit.html", context)

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

    def _get_case_or_404(self, case_id: int) -> Case:
        try:
            return (
                Case.objects.prefetch_related(
                    Prefetch("case_numbers", queryset=CaseNumber.objects.order_by("created_at"))
                ).get(pk=case_id)
            )
        except Case.DoesNotExist as exc:
            raise Http404("未找到对应案件。") from exc

    def _get_case_log_or_404(self, *, case_id: int | None, log_id: int) -> CaseLog:
        try:
            queryset = CaseLog.objects.select_related("actor").prefetch_related("attachments__source_invoice")
            if case_id is not None:
                queryset = queryset.filter(case_id=case_id)
            return queryset.get(pk=log_id)
        except CaseLog.DoesNotExist as exc:
            raise Http404("未找到对应日志。") from exc


@admin.register(CaseLogAttachment)
class CaseLogAttachmentAdmin(BaseModelAdmin):
    list_display = ("id", "log", "uploaded_at")
    search_fields = ("log__case__name",)
    autocomplete_fields = ("log",)

    def get_model_perms(self, request: HttpRequest) -> dict[str, bool]:
        return {}
