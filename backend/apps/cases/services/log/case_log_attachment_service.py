"""Business logic services."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from django.core.files.uploadedfile import UploadedFile
from django.utils.translation import gettext_lazy as _

from apps.cases.models import CaseLogAttachment
from apps.cases.utils import validate_case_log_attachment
from apps.core.exceptions import NotFoundError, ValidationException
from apps.core.services import storage_service as storage

from .case_log_query_service import CaseLogQueryService

logger = logging.getLogger("apps.cases")


class CaseLogAttachmentService:
    def __init__(self, query_service: CaseLogQueryService | None = None, archive_service: Any | None = None) -> None:
        self.query_service = query_service or CaseLogQueryService()
        self._archive_service = archive_service

    @property
    def archive_service(self) -> Any:
        if self._archive_service is None:
            from apps.cases.services.material.case_material_archive_service import CaseMaterialArchiveService

            self._archive_service = CaseMaterialArchiveService()
        return self._archive_service

    def upload_attachments(
        self,
        *,
        log_id: int,
        files: list[UploadedFile],
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> list[CaseLogAttachment]:
        log = self.query_service.get_log_internal(log_id=log_id)

        if not perm_open_access:
            self.query_service.access_policy.ensure_access(
                case_id=log.case_id,
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
                case=log.case,
                message=_("无权限上传附件"),
            )

        created = []
        for f in files:
            self._validate_attachment(f)
            created.append(CaseLogAttachment.objects.create(log=log, file=f))

        if created:
            try:
                self.archive_service.archive_uploaded_attachments(
                    case_id=log.case_id,
                    attachments=created,
                    user=user,
                    org_access=org_access,
                    perm_open_access=perm_open_access,
                )
            except Exception:
                logger.exception(
                    "case_log_attachment_auto_archive_failed",
                    extra={"log_id": int(log.id), "case_id": int(log.case_id), "attachment_count": len(created)},
                )

        return created

    def delete_attachment(
        self,
        *,
        attachment_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, bool]:
        attachment = self.get_attachment(
            attachment_id=attachment_id,
            user=user,
            org_access=org_access,
            perm_open_access=perm_open_access,
        )

        if attachment.source_invoice_id:
            raise ValidationException(_("该附件来源于律师费收款发票，请在律师费收款记录中维护。"))

        if not attachment.source_invoice_id:
            self.archive_service.cleanup_attachment_archive(attachment=attachment, save=False)
            attachment.file.delete(save=False)

        attachment.delete()
        return {"success": True}

    def get_attachment(
        self,
        *,
        attachment_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> CaseLogAttachment:
        try:
            attachment = CaseLogAttachment.objects.select_related("log__case", "source_invoice").get(id=attachment_id)
        except CaseLogAttachment.DoesNotExist:
            raise NotFoundError(_("附件 %(attachment_id)s 不存在") % {"attachment_id": attachment_id}) from None

        if not perm_open_access:
            self.query_service.access_policy.ensure_access(
                case_id=attachment.log.case_id,
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
                case=attachment.log.case,
                message=_("无权限访问此附件"),
            )

        return attachment

    def get_attachment_file(
        self,
        *,
        attachment_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> tuple[Path, str]:
        attachment = self.get_attachment(
            attachment_id=attachment_id,
            user=user,
            org_access=org_access,
            perm_open_access=perm_open_access,
        )

        file_reference = attachment.resolved_file_reference
        if not file_reference:
            raise NotFoundError(_("附件文件不存在"))

        file_path = storage.resolve_stored_file_path(file_reference)
        if not file_path.exists() or not file_path.is_file():
            raise NotFoundError(_("附件文件不存在"))

        return file_path, attachment.display_name

    def _validate_attachment(self, file: UploadedFile) -> None:
        name = getattr(file, "name", "")
        size = getattr(file, "size", 0)
        ok, error = validate_case_log_attachment(name, size)
        if not ok:
            raise ValidationException(_("附件校验失败"), errors={"file": error or _("附件校验失败")})
