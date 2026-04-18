"""API schemas and serializers."""

from __future__ import annotations

from typing import ClassVar

from pydantic import Field

from .base import Schema, datetime


class CaseMaterialBindingOut(Schema):
    id: int
    category: str
    type_id: int | None = None
    type_name: str
    side: str | None = None
    party_ids: ClassVar[list[int]] = []
    supervising_authority_id: int | None = None
    archive_relative_path: str = ""
    archived_file_path: str = ""
    archived_at: datetime | None = None


class CaseMaterialBindCandidateOut(Schema):
    attachment_id: int
    file_name: str
    file_url: str
    uploaded_at: datetime
    log_id: int
    log_created_at: datetime | None = None
    actor_name: str
    material: CaseMaterialBindingOut | None = None
    archive_suggested_relative_path: str = ""
    archive_suggested_reason: str = ""
    attachment_archive_relative_path: str = ""
    attachment_archived_file_path: str = ""
    attachment_archived_at: datetime | None = None


class CaseMaterialBindItemIn(Schema):
    attachment_id: int
    category: str
    type_id: int | None = None
    type_name: str
    side: str | None = None
    party_ids: ClassVar[list[int]] = []
    supervising_authority_id: int | None = None
    archive_relative_path: str | None = None


class CaseMaterialBindIn(Schema):
    items: list[CaseMaterialBindItemIn]


class CaseMaterialArchiveFolderOut(Schema):
    relative_path: str = ""
    display_name: str


class CaseMaterialArchiveConfigOut(Schema):
    enabled: bool = False
    writable: bool = False
    root_path: str = ""
    message: str = ""
    folders: list[CaseMaterialArchiveFolderOut] = Field(default_factory=list)


class CaseMaterialGroupOrderIn(Schema):
    category: str
    ordered_type_ids: list[int]
    side: str | None = None
    supervising_authority_id: int | None = None


class CaseMaterialUploadOut(Schema):
    log_id: int
    attachment_ids: list[int]
    archived_count: int = 0
    archive_enabled: bool = False


class CaseMaterialRearchiveOut(Schema):
    enabled: bool = False
    message: str = ""
    processed_count: int = 0
    archived_count: int = 0
    bound_count: int = 0
    unbound_count: int = 0
    skipped_count: int = 0


class CaseMaterialReplaceIn(Schema):
    """替换材料文件请求"""

    new_attachment_id: int


class CaseMaterialReplaceOut(Schema):
    """替换材料文件响应"""

    material_id: int
    old_attachment_id: int
    new_attachment_id: int


class CaseMaterialGroupRenameIn(Schema):
    """重命名材料分组请求"""

    type_id: int
    new_type_name: str
    update_global: bool = False


class CaseMaterialGroupRenameOut(Schema):
    """重命名材料分组响应"""

    type_id: int
    old_type_name: str
    new_type_name: str


class CaseMaterialDeleteOut(Schema):
    """删除材料响应"""

    material_id: int
    deleted: bool


class CaseMaterialDeleteAllIn(Schema):
    """按分类批量删除材料请求"""

    category: str


class CaseMaterialDeleteAllOut(Schema):
    """按分类批量删除材料响应"""

    category: str
    deleted_count: int


__all__: list[str] = [
    "CaseMaterialArchiveConfigOut",
    "CaseMaterialArchiveFolderOut",
    "CaseMaterialBindCandidateOut",
    "CaseMaterialBindIn",
    "CaseMaterialBindItemIn",
    "CaseMaterialBindingOut",
    "CaseMaterialDeleteAllIn",
    "CaseMaterialDeleteAllOut",
    "CaseMaterialDeleteOut",
    "CaseMaterialGroupOrderIn",
    "CaseMaterialGroupRenameIn",
    "CaseMaterialGroupRenameOut",
    "CaseMaterialRearchiveOut",
    "CaseMaterialReplaceIn",
    "CaseMaterialReplaceOut",
    "CaseMaterialUploadOut",
]
