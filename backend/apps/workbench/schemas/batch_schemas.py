"""批量分析任务 Schema"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class BatchItemOut(BaseModel):
    id: UUID
    file_name: str
    status: str
    result: str
    error: str
    duration_ms: float | None

    model_config = {"from_attributes": True}


class BatchJobOut(BaseModel):
    id: UUID
    session_id: int
    job_type: str
    status: str
    prompt: str
    llm_model: str
    total_items: int
    completed_items: int
    failed_items: int
    progress: int
    summary: str
    summary_file: str = ""
    error_message: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator("summary_file", mode="before")
    @classmethod
    def _resolve_summary_file(cls, v: object) -> str:
        if v and hasattr(v, "url"):
            try:
                return str(v.url)  # type: ignore[union-attr]
            except ValueError:
                return ""
        return ""


class BatchProgressOut(BaseModel):
    job: BatchJobOut
    items: list[BatchItemOut]
