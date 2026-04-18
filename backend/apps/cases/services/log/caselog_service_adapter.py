"""Adapter for the case log service."""

from __future__ import annotations

from typing import Any, cast

from django.utils.translation import gettext_lazy as _

from apps.core.interfaces import ICaseLogService


class CaseLogServiceAdapter(ICaseLogService):
    """Compatibility adapter that proxies calls to ``CaseLogService``."""

    def __init__(self, caselog_service: Any | None = None) -> None:
        self._caselog_service = caselog_service

    @property
    def caselog_service(self) -> Any:
        """Lazily resolve the concrete service."""
        if self._caselog_service is None:
            from .caselog_service import CaseLogService

            self._caselog_service = CaseLogService()
        return self._caselog_service

    def list_logs(
        self,
        case_id: int | None = None,
        contract_id: int | None = None,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> Any:
        return self.caselog_service.list_logs(
            case_id=case_id,
            contract_id=contract_id,
            user=user,
            org_access=org_access,
            perm_open_access=perm_open_access,
        )

    def get_log(
        self,
        log_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> Any:
        return self.caselog_service.get_log(
            log_id=log_id,
            user=user,
            org_access=org_access,
            perm_open_access=perm_open_access,
        )

    def create_log(
        self,
        case_id: int,
        content: str,
        stage: str | None = None,
        note: str = "",
        logged_at: Any | None = None,
        log_type: str | None = None,
        source: str | None = None,
        is_pinned: bool = False,
        user: Any | None = None,
        reminder_type: str | None = None,
        reminder_time: Any | None = None,
    ) -> Any:
        return self.caselog_service.create_log(
            case_id=case_id,
            content=content,
            stage=stage,
            note=note,
            logged_at=logged_at,
            log_type=log_type,
            source=source,
            is_pinned=is_pinned,
            user=user,
            reminder_type=reminder_type,
            reminder_time=reminder_time,
            perm_open_access=True,
        )

    def update_log(
        self,
        log_id: int,
        data: dict[str, Any],
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> Any:
        return self.caselog_service.update_log(
            log_id=log_id,
            data=data,
            user=user,
            org_access=org_access,
            perm_open_access=perm_open_access,
        )

    def delete_log(
        self,
        log_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, bool]:
        return cast(
            dict[str, bool],
            self.caselog_service.delete_log(
                log_id=log_id,
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
            ),
        )

    def upload_attachments(
        self,
        log_id: int,
        files: list[Any],
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, int]:
        return cast(
            dict[str, int],
            self.caselog_service.upload_attachments(
                log_id=log_id,
                files=files,
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
            ),
        )

    def create_log_internal(
        self,
        case_id: int,
        content: str,
        user_id: int | None = None,
        reminder_type: str | None = None,
        reminder_time: Any | None = None,
    ) -> int:
        """
        Internal helper used by cross-module callers that need a raw log id.
        """
        from apps.cases.models import Case, CaseLog
        from apps.core.exceptions import NotFoundError

        try:
            Case.objects.get(id=case_id)
        except Case.DoesNotExist:
            raise NotFoundError(_("案件 %(case_id)s 不存在") % {"case_id": case_id}) from None

        log = CaseLog.objects.create(
            case_id=case_id,
            content=content,
            actor_id=user_id,
        )
        return int(log.id)
