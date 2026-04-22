"""Module for case logs."""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, ClassVar

from django.core.files.uploadedfile import UploadedFile
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.cases.utils import CASE_LOG_ALLOWED_EXTENSIONS, CASE_LOG_MAX_FILE_SIZE
from apps.core.filesystem.storage import KeepOriginalNameStorage
from apps.core.models.enums import CaseStage

from .case import Case

if TYPE_CHECKING:
    from django.db.models.fields.related_descriptors import RelatedManager

_SENTINEL = object()

case_log_storage = KeepOriginalNameStorage()
logger = logging.getLogger(__name__)


def validate_log_attachment(file: UploadedFile) -> None:
    """Validate a case log attachment."""
    name = str(getattr(file, "name", ""))
    size: int = int(getattr(file, "size", 0) or 0)
    ext = Path(name).suffix.lower()
    if ext not in CASE_LOG_ALLOWED_EXTENSIONS:
        from django.core.exceptions import ValidationError

        raise ValidationError(_("不支持的文件类型"))
    if size and size > CASE_LOG_MAX_FILE_SIZE:
        from django.core.exceptions import ValidationError

        raise ValidationError(_("文件大小超过50MB限制"))


class CaseLog(models.Model):
    class LogType(models.TextChoices):
        MANUAL = "manual", _("人工记录")
        PROGRESS = "progress", _("进展记录")
        MATERIAL = "material", _("材料记录")
        REMINDER = "reminder", _("提醒记录")
        DOCUMENT = "document", _("文书记录")
        SYSTEM = "system", _("系统记录")

    class Source(models.TextChoices):
        CASE = "case", _("案件")
        CONTRACT = "contract", _("合同")
        MATERIAL = "material", _("材料")
        REMINDER = "reminder", _("提醒")
        AUTOMATION = "automation", _("自动化")
        SYSTEM = "system", _("系统")

    id: int
    log_type = models.CharField(
        max_length=24,
        choices=LogType.choices,
        default=LogType.MANUAL,
        verbose_name=_("日志类型"),
    )
    source = models.CharField(
        max_length=24,
        choices=Source.choices,
        default=Source.CASE,
        verbose_name=_("日志来源"),
    )
    is_pinned = models.BooleanField(default=False, verbose_name=_("是否置顶"))
    stage = models.CharField(
        max_length=64,
        choices=CaseStage.choices,
        blank=True,
        null=True,
        verbose_name=_("审理阶段"),
    )
    logged_at = models.DateTimeField(default=timezone.now, verbose_name=_("日志时间"))
    note = models.TextField(blank=True, default="", verbose_name=_("备注"))
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="logs", verbose_name=_("案件"))
    content = models.TextField(verbose_name=_("日志内容"))
    actor = models.ForeignKey(
        "organization.Lawyer",
        on_delete=models.PROTECT,
        related_name="case_logs",
        verbose_name=_("操作人"),
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("创建日期"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("修改日期"))

    source_payment = models.OneToOneField(
        "contracts.ContractPayment",
        on_delete=models.CASCADE,
        related_name="case_log",
        null=True,
        blank=True,
        verbose_name=_("来源律师费收款记录"),
    )

    if TYPE_CHECKING:
        attachments: RelatedManager[CaseLogAttachment]
        versions: RelatedManager[CaseLogVersion]

    class Meta:
        verbose_name = _("日志")
        verbose_name_plural = _("日志")
        indexes: ClassVar = [
            models.Index(fields=["case", "-is_pinned", "-created_at"]),
            models.Index(fields=["case", "-logged_at", "-created_at"]),
            models.Index(fields=["actor"]),
            models.Index(fields=["log_type"]),
            models.Index(fields=["source"]),
        ]

    def __str__(self) -> str:
        return f"{self.case_id}-{self.actor_id}-{self.created_at}"

    @property
    def contract(self) -> Any | None:
        return getattr(self.case, "contract", None)

    def _exported_reminders(self) -> list[dict[str, Any]]:
        cached = getattr(self, "_cached_exported_reminders", _SENTINEL)
        if cached is not _SENTINEL:
            return cached
        if not getattr(self, "id", None):
            self._cached_exported_reminders = []
            return []

        reminders: list[dict[str, Any]]
        try:
            from apps.core.interfaces import ServiceLocator

            reminder_service = ServiceLocator.get_reminder_service()
            reminders = reminder_service.export_case_log_reminders_internal(case_log_id=int(self.id))
        except Exception:
            logger.exception("case_log_export_reminders_failed", extra={"case_log_id": int(self.id)})
            reminders = []
        self._cached_exported_reminders = reminders
        return reminders

    @property
    def reminder_entries(self) -> list[dict[str, Any]]:
        return self._exported_reminders()

    @property
    def has_reminders(self) -> bool:
        return bool(self._exported_reminders())

    @property
    def reminder_count(self) -> int:
        return len(self._exported_reminders())

    @property
    def _latest_reminder(self) -> Any | None:
        """Return the latest reminder with memoization to avoid duplicate queries."""
        cached = getattr(self, "_cached_latest_reminder", _SENTINEL)
        if cached is not _SENTINEL:
            return cached
        if not getattr(self, "id", None):
            self._cached_latest_reminder = None
            return None

        reminder: dict[str, Any] | None = None
        try:
            from apps.core.interfaces import ServiceLocator

            reminder_service = ServiceLocator.get_reminder_service()
            reminder = reminder_service.get_latest_case_log_reminder_internal(case_log_id=int(self.id))
        except Exception:
            logger.exception("case_log_latest_reminder_failed", extra={"case_log_id": int(self.id)})
            reminders = self._exported_reminders()
            reminder = reminders[-1] if reminders else None

        self._cached_latest_reminder = reminder
        return reminder

    @property
    def reminder_type(self) -> str | None:
        """Get the latest reminder type."""
        reminder = self._latest_reminder
        if reminder is None:
            return None
        if isinstance(reminder, dict):
            return str(reminder.get("reminder_type") or "")
        return str(getattr(reminder, "reminder_type", ""))

    @property
    def reminder_time(self) -> datetime | None:
        """Get the latest reminder due time."""
        reminder = self._latest_reminder
        if reminder is None:
            return None
        due_at = reminder.get("due_at") if isinstance(reminder, dict) else getattr(reminder, "due_at", None)
        return due_at if isinstance(due_at, datetime) else None


class CaseLogAttachment(models.Model):
    source_invoice = models.OneToOneField(
        "contracts.Invoice",
        on_delete=models.CASCADE,
        related_name="case_log_attachment",
        null=True,
        blank=True,
        verbose_name=_("来源发票"),
    )
    id: int
    log = models.ForeignKey(CaseLog, on_delete=models.CASCADE, related_name="attachments", verbose_name=_("日志"))
    file = models.FileField(
        upload_to="case_logs/",
        storage=case_log_storage,
        validators=[validate_log_attachment],
        verbose_name=_("相关文书"),
    )
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name=_("上传时间"))
    archive_relative_path = models.CharField(max_length=500, blank=True, default="", verbose_name=_("归档相对目录"))
    archived_file_path = models.CharField(max_length=1000, blank=True, default="", verbose_name=_("归档文件路径"))
    archived_at = models.DateTimeField(null=True, blank=True, verbose_name=_("归档时间"))

    class Meta:
        verbose_name = _("日志附件")
        verbose_name_plural = _("日志附件")


    @property
    def is_invoice_reference(self) -> bool:
        return bool(self.source_invoice_id)

    @property
    def resolved_file_reference(self) -> str:
        if self.source_invoice_id and getattr(self, "source_invoice", None) is not None:
            return str(getattr(self.source_invoice, "file_path", "") or "")
        return str(getattr(self.file, "name", "") or "")

    @property
    def display_name(self) -> str:
        if self.source_invoice_id and getattr(self, "source_invoice", None) is not None:
            original_filename = str(getattr(self.source_invoice, "original_filename", "") or "").strip()
            if original_filename:
                return original_filename
            source_path = str(getattr(self.source_invoice, "file_path", "") or "").strip()
            if source_path:
                return Path(source_path).name

        file_name = str(getattr(self.file, "name", "") or "").strip()
        if file_name:
            return Path(file_name).name
        return f"附件 {self.pk}"

class CaseLogVersion(models.Model):
    id: int
    log = models.ForeignKey(CaseLog, on_delete=models.CASCADE, related_name="versions", verbose_name=_("日志"))
    content = models.TextField(verbose_name=_("历史内容"))
    version_at = models.DateTimeField(auto_now_add=True, verbose_name=_("版本时间"))
    actor = models.ForeignKey(
        "organization.Lawyer",
        on_delete=models.PROTECT,
        related_name="case_log_versions",
        verbose_name=_("操作人"),
    )

    class Meta:
        verbose_name = _("案件日志版本")
        verbose_name_plural = _("案件日志版本")

    def __str__(self) -> str:
        return f"{self.log_id}-{self.version_at}"
