from __future__ import annotations

from typing import Any, cast
from uuid import UUID

from django.http import HttpResponse
from ninja import Router
from pydantic import BaseModel

from apps.story_viz.models import StoryAnimationStatus
from apps.story_viz.services.wiring import get_story_animation_job_service

router = Router(tags=["故事可视化"])


class StoryAnimationStatusOut(BaseModel):
    id: str
    title: str
    viz_type: str
    status: str
    stage: str
    stage_display: str
    progress: int
    error_message: str
    preview_url: str
    task_id: str
    cancel_requested: bool
    created_at: str
    started_at: str
    finished_at: str
    updated_at: str
    facts_count: int
    parties_count: int
    relationships_count: int


def _build_status_out(payload: dict[str, object]) -> StoryAnimationStatusOut:
    """从 payload 构建强类型输出，确保 mypy 类型安全."""
    return StoryAnimationStatusOut(
        id=str(payload.get("id", "")),
        title=str(payload.get("title", "")),
        viz_type=str(payload.get("viz_type", "")),
        status=str(payload.get("status", "")),
        stage=str(payload.get("stage", "")),
        stage_display=str(payload.get("stage_display", "")),
        progress=int(cast(int, payload.get("progress", 0))),
        error_message=str(payload.get("error_message", "")),
        preview_url=str(payload.get("preview_url", "")),
        task_id=str(payload.get("task_id", "")),
        cancel_requested=bool(payload.get("cancel_requested", False)),
        created_at=str(payload.get("created_at", "")),
        started_at=str(payload.get("started_at", "")),
        finished_at=str(payload.get("finished_at", "")),
        updated_at=str(payload.get("updated_at", "")),
        facts_count=int(cast(int, payload.get("facts_count", 0))),
        parties_count=int(cast(int, payload.get("parties_count", 0))),
        relationships_count=int(cast(int, payload.get("relationships_count", 0))),
    )


@router.get("/animations/{animation_id}", response=StoryAnimationStatusOut)
def get_story_animation_status(request: Any, animation_id: UUID) -> StoryAnimationStatusOut:
    animation = get_story_animation_job_service().get_animation(animation_id=animation_id)
    payload = get_story_animation_job_service().build_status_payload(animation=animation)
    return _build_status_out(payload)


@router.post("/animations/{animation_id}/retry", response=StoryAnimationStatusOut)
def retry_story_animation(request: Any, animation_id: UUID) -> StoryAnimationStatusOut:
    animation = get_story_animation_job_service().retry(animation_id=animation_id)
    payload = get_story_animation_job_service().build_status_payload(animation=animation)
    return _build_status_out(payload)


@router.post("/animations/{animation_id}/cancel", response=StoryAnimationStatusOut)
def cancel_story_animation(request: Any, animation_id: UUID) -> StoryAnimationStatusOut:
    animation = get_story_animation_job_service().request_cancel(animation_id=animation_id)
    payload = get_story_animation_job_service().build_status_payload(animation=animation)
    return _build_status_out(payload)


@router.get("/animations/{animation_id}/preview")
def preview_story_animation(request: Any, animation_id: UUID) -> HttpResponse:
    animation = get_story_animation_job_service().get_animation(animation_id=animation_id)
    if animation.status != StoryAnimationStatus.COMPLETED:
        return HttpResponse("任务未完成，暂时无法预览。", status=409, content_type="text/plain; charset=utf-8")
    return HttpResponse(animation.animation_html, content_type="text/html; charset=utf-8")
