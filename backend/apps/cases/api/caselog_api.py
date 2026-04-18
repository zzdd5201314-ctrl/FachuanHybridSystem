"""
案件日志 API 层
符合三层架构规范：只做请求/响应处理，业务逻辑在 Service 层
"""

from __future__ import annotations

from typing import Any, cast

from django.http import HttpRequest
from ninja import Router

from apps.cases.schemas import CaseLogIn, CaseLogOut, CaseLogUpdate
from apps.cases.services.log.caselog_service import CaseLogService
from apps.core.dto.request_context import extract_request_context

router = Router()


def _get_caselog_service() -> CaseLogService:
    """工厂函数：创建 CaseLogService 实例"""
    return CaseLogService()


@router.get("/logs", response=list[CaseLogOut])
def list_logs(request: HttpRequest, case_id: int | None = None, contract_id: int | None = None) -> list[CaseLogOut]:
    """获取日志列表"""
    service = _get_caselog_service()
    ctx = extract_request_context(request)

    return cast(
        list[CaseLogOut],
        service.list_logs(
            case_id=case_id,
            contract_id=contract_id,
            user=ctx.user,
            org_access=ctx.org_access,
            perm_open_access=ctx.perm_open_access,
        ),
    )


@router.post("/logs", response=CaseLogOut)
def create_log(request: HttpRequest, payload: CaseLogIn) -> CaseLogOut:
    """创建日志"""
    service = _get_caselog_service()
    ctx = extract_request_context(request)

    reminder_time = service.parse_reminder_time(payload.reminder_time)  # type: ignore[attr-defined]
    logged_at = service.parse_datetime_input(payload.logged_at)

    return cast(
        CaseLogOut,
        service.create_log(
            case_id=payload.case_id,
            content=payload.content,
            stage=payload.stage,
            note=payload.note,
            logged_at=logged_at,
            log_type=payload.log_type,
            source=payload.source,
            is_pinned=payload.is_pinned,
            user=ctx.user,
            reminder_type=payload.reminder_type,  # type: ignore[attr-defined]
            reminder_time=reminder_time,
        ),
    )


@router.get("/logs/{log_id}", response=CaseLogOut)
def get_log(request: HttpRequest, log_id: int) -> CaseLogOut:
    """获取单个日志"""
    service = _get_caselog_service()
    ctx = extract_request_context(request)

    return cast(
        CaseLogOut,
        service.get_log(
            log_id=log_id,
            user=ctx.user,
            org_access=ctx.org_access,
            perm_open_access=ctx.perm_open_access,
        ),
    )


@router.put("/logs/{log_id}", response=CaseLogOut)
def update_log(request: HttpRequest, log_id: int, payload: CaseLogUpdate) -> CaseLogOut:
    """更新日志"""
    service = _get_caselog_service()
    ctx = extract_request_context(request)

    data = payload.dict(exclude_unset=True)

    if "reminder_time" in data and isinstance(data["reminder_time"], str):
        data["reminder_time"] = service.parse_reminder_time(data["reminder_time"])
    if "logged_at" in data and isinstance(data["logged_at"], str):
        data["logged_at"] = service.parse_datetime_input(data["logged_at"])

    return cast(
        CaseLogOut,
        service.update_log(
            log_id=log_id,
            data=data,
            user=ctx.user,
            org_access=ctx.org_access,
            perm_open_access=ctx.perm_open_access,
        ),
    )


@router.delete("/logs/{log_id}")
def delete_log(request: HttpRequest, log_id: int) -> Any:
    """删除日志"""
    service = _get_caselog_service()
    ctx = extract_request_context(request)

    return service.delete_log(
        log_id=log_id,
        user=ctx.user,
        org_access=ctx.org_access,
        perm_open_access=ctx.perm_open_access,
    )


@router.post("/logs/{log_id}/attachments")
def upload_log_attachments(request: HttpRequest, log_id: int) -> Any:
    """上传日志附件"""
    service = _get_caselog_service()
    ctx = extract_request_context(request)

    files = request.FILES.getlist("files") if hasattr(request, "FILES") else []

    return service.upload_attachments(
        log_id=log_id,
        files=files,
        user=ctx.user,
        org_access=ctx.org_access,
        perm_open_access=ctx.perm_open_access,
    )


@router.delete("/log-attachments/{attachment_id}")
def delete_log_attachment(request: HttpRequest, attachment_id: int) -> Any:
    """删除日志附件"""
    service = _get_caselog_service()
    ctx = extract_request_context(request)

    return service.delete_attachment(
        attachment_id=attachment_id,
        user=ctx.user,
        org_access=ctx.org_access,
        perm_open_access=ctx.perm_open_access,
    )
