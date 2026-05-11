from __future__ import annotations

from django import forms
from django.contrib import admin
from django.forms import ModelForm
from django.http import HttpRequest
from django.urls import reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from apps.cases.admin.base_admin import BaseModelAdmin, BaseTabularInline
from apps.cases.models import CaseLog, CaseLogAttachment


class CaseLogAttachmentInlineForm(forms.ModelForm[CaseLogAttachment]):
    file = forms.FileField(
        required=False,
        label=_("上传文件"),
        help_text=_("留空表示不替换现有文件。"),
    )
    target_subdir = forms.CharField(
        required=False,
        label=_("保存子目录"),
        help_text=_("文件会先归属到案件业务文件夹，再保存到这里填写的子目录；留空时系统会自动推荐。"),
    )

    class Meta:
        model = CaseLogAttachment
        fields = ("file", "target_subdir")

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk and self.instance.subdir_path:
            self.fields["target_subdir"].initial = self.instance.subdir_path

    def _has_existing_file(self) -> bool:
        return bool(
            str(getattr(self.instance, "file", "") or "").strip()
            or str(getattr(self.instance, "relative_file_path", "") or "").strip()
            or str(getattr(self.instance, "original_filename", "") or "").strip()
        )

    def _has_uploaded_file(self) -> bool:
        if not hasattr(self, "files") or self.files is None:
            return False
        try:
            return bool(self.files.get(self.add_prefix("file")))
        except Exception:
            return False

    def has_changed(self) -> bool:
        changed = super().has_changed()
        if not changed:
            return False
        if self._has_existing_file() or self._has_uploaded_file():
            return True
        return False

    def save(self, commit: bool = True) -> CaseLogAttachment:
        instance = super().save(commit=False)
        uploaded_file = self.cleaned_data.get("file")
        target_subdir = str(self.cleaned_data.get("target_subdir") or "").strip()
        has_existing_file = self._has_existing_file()

        from apps.cases.services.log.case_log_attachment_storage_service import CaseLogAttachmentStorageService

        storage_service = CaseLogAttachmentStorageService()
        if uploaded_file:
            from apps.cases.utils import CASE_LOG_ALLOWED_EXTENSIONS, CASE_LOG_MAX_FILE_SIZE

            saved = storage_service.save_attachment(
                uploaded_file,
                case_id=instance.log.case_id,
                target_subdir=target_subdir,
                log=instance.log,
                allowed_extensions=list(CASE_LOG_ALLOWED_EXTENSIONS),
                max_size_bytes=int(CASE_LOG_MAX_FILE_SIZE),
            )
            instance.file = saved.legacy_file_path
            instance.storage_root_type = saved.root_type
            instance.subdir_path = saved.subdir_path
            instance.relative_file_path = saved.relative_file_path
            instance.original_filename = saved.original_filename
        elif (
            instance.pk
            and has_existing_file
            and target_subdir
            and target_subdir != str(instance.subdir_path or "").strip()
        ):
            moved = storage_service.move_attachment(
                instance,
                case_id=instance.log.case_id,
                target_subdir=target_subdir,
            )
            instance.file = moved.legacy_file_path
            instance.storage_root_type = moved.root_type
            instance.subdir_path = moved.subdir_path
            instance.relative_file_path = moved.relative_file_path
            if not instance.original_filename:
                instance.original_filename = moved.original_filename

        if commit:
            instance.save()
        return instance


class CaseLogAttachmentInline(BaseTabularInline):
    model = CaseLogAttachment
    form = CaseLogAttachmentInlineForm
    extra = 1
    fields = ("file", "target_subdir", "file_link", "uploaded_at")
    readonly_fields = ("file_link", "uploaded_at")
    autocomplete_fields = ("log",)

    @admin.display(description=_("当前文件"))
    def file_link(self, obj: CaseLogAttachment) -> str:
        if obj.pk and obj.log_id and obj.case_id and obj.original_filename:
            url = reverse("admin:cases_case_preview_log_attachment", args=[obj.case_id, obj.pk])
            return format_html('<a href="{}" target="_blank">{}</a>', url, obj.original_filename)
        return obj.original_filename or "-"


class ReminderInline(BaseTabularInline):
    model = CaseLog.reminders.rel.related_model  # type: ignore[assignment]
    extra = 0
    fields = ("reminder_type", "content", "due_at")
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


@admin.register(CaseLogAttachment)
class CaseLogAttachmentAdmin(BaseModelAdmin):
    list_display = ("id", "log", "uploaded_at")
    search_fields = ("log__case__name",)
    autocomplete_fields = ("log",)

    def get_model_perms(self, request: HttpRequest) -> dict[str, bool]:
        """隐藏 Admin 首页入口，但保留直接 URL 访问能力。"""
        return {}
