"""Unit tests for case material archive enhancements."""

from __future__ import annotations

import io
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch

from apps.cases.models import CaseMaterialCategory
from apps.cases.services.material import case_material_archive_service as archive_module
from apps.cases.services.material.case_material_archive_service import CaseMaterialArchiveService


def _folders(*paths: str) -> list[dict[str, str]]:
    return [{"relative_path": path, "display_name": path or "案件根目录"} for path in paths]


class _FakeAttachmentFile:
    def __init__(self, name: str, content: bytes) -> None:
        self.name = name
        self._content = content

    def open(self, _mode: str):
        return io.BytesIO(self._content)


class _FakeAttachment:
    def __init__(self, attachment_id: int, name: str, content: bytes) -> None:
        self.id = attachment_id
        self.file = _FakeAttachmentFile(name, content)
        self.archive_relative_path = ""
        self.archived_file_path = ""
        self.archived_at = None
        self.save_calls: list[list[str]] = []

    def save(self, *, update_fields):
        self.save_calls.append(list(update_fields))


def test_suggest_archive_supports_custom_rules_and_reason() -> None:
    config_service = Mock()
    config_service.get_value.return_value = json.dumps(
        {
            "semantic_rules": [
                {
                    "keywords": ["和解协议"],
                    "folder_keywords": ["裁判结果"],
                    "exclude_keywords": [],
                    "weight": 280,
                }
            ],
            "keyword_rules": [],
        }
    )
    service = CaseMaterialArchiveService(case_service=object(), system_config_service=config_service)

    result = service.suggest_archive(
        file_name="和解协议.pdf",
        type_name="和解协议",
        available_folders=_folders("", "裁判结果", "其他材料"),
    )

    assert result["relative_path"] == "裁判结果"
    assert "自定义" in result["reason"]


def test_get_archive_config_reports_unwritable_directory(monkeypatch) -> None:
    service = CaseMaterialArchiveService(case_service=object())
    queryset = MagicMock()
    queryset.first.return_value = SimpleNamespace(folder_path="/srv/fachuan")

    monkeypatch.setattr(service, "_resolve_binding_root", lambda _path: Path("/srv/fachuan"))
    monkeypatch.setattr(service, "_check_root_writable", lambda _root: (False, "目录只读"))

    with patch.object(archive_module.CaseFolderBinding.objects, "filter", return_value=queryset):
        result = service.get_archive_config_for_case(case_id=12)

    assert result["enabled"] is True
    assert result["writable"] is False
    assert result["root_path"] == str(Path("/srv/fachuan"))
    assert result["message"] == "目录只读"


def test_rearchive_case_attachments_routes_bound_and_unbound_records() -> None:
    case_service = Mock()
    service = CaseMaterialArchiveService(case_service=case_service)
    service.get_archive_config_for_case = Mock(
        return_value={"enabled": True, "writable": True, "message": "", "folders": _folders("", "证据材料")}
    )
    service.sync_material_archive = Mock(return_value="/tmp/bound.pdf")
    service.sync_attachment_archive = Mock(return_value=None)

    bound_material = SimpleNamespace(archive_relative_path="证据材料")
    bound_attachment = SimpleNamespace(id=1, bound_material=bound_material)
    unbound_attachment = SimpleNamespace(id=2, bound_material=None, archive_relative_path="")

    queryset = MagicMock()
    queryset.select_related.return_value = queryset
    queryset.order_by.return_value = [bound_attachment, unbound_attachment]

    with patch.object(archive_module.CaseLogAttachment.objects, "filter", return_value=queryset):
        result = service.rearchive_case_attachments(case_id=7)

    case_service.get_case.assert_called_once()
    service.sync_material_archive.assert_called_once_with(
        case_id=7,
        material=bound_material,
        archive_relative_path="证据材料",
        folder_options=_folders("", "证据材料"),
        force=True,
    )
    service.sync_attachment_archive.assert_called_once_with(
        case_id=7,
        attachment=unbound_attachment,
        archive_relative_path=None,
        folder_options=_folders("", "证据材料"),
        force=True,
    )
    assert result == {
        "enabled": True,
        "message": "",
        "processed_count": 2,
        "archived_count": 1,
        "bound_count": 1,
        "unbound_count": 1,
        "skipped_count": 1,
    }


def test_suggest_archive_reason_uses_non_party_fallback() -> None:
    service = CaseMaterialArchiveService(case_service=object())

    result = service.suggest_archive(
        file_name="普通材料.pdf",
        category=CaseMaterialCategory.NON_PARTY,
        available_folders=_folders("", "法院材料", "其他"),
    )

    assert result["relative_path"] == "法院材料"
    assert "非当事人" in result["reason"]


def test_archive_uploaded_attachments_handles_duplicate_names_and_updates_status(tmp_path) -> None:
    case_service = Mock()
    service = CaseMaterialArchiveService(case_service=case_service)
    attachment_one = _FakeAttachment(1, "证据目录.pdf", b"first")
    attachment_two = _FakeAttachment(2, "证据目录.pdf", b"second")

    binding_queryset = MagicMock()
    binding_queryset.first.return_value = SimpleNamespace(folder_path=str(tmp_path))
    with patch.object(archive_module.CaseFolderBinding.objects, "filter", return_value=binding_queryset):
        result = service.archive_uploaded_attachments(case_id=18, attachments=[attachment_one, attachment_two])

    first_path = Path(attachment_one.archived_file_path)
    second_path = Path(attachment_two.archived_file_path)
    assert result["enabled"] is True
    assert result["archived_count"] == 2
    assert first_path.exists()
    assert second_path.exists()
    assert first_path.name == "证据目录.pdf"
    assert second_path.name == "证据目录_1.pdf"
    assert attachment_one.archived_at is not None
    assert attachment_two.archived_at is not None
    assert attachment_one.save_calls
    assert attachment_two.save_calls


def test_force_rearchive_overwrites_existing_file_without_dirty_duplicates(tmp_path) -> None:
    case_service = Mock()
    service = CaseMaterialArchiveService(case_service=case_service)
    archive_dir = tmp_path / "证据材料"
    archive_dir.mkdir()
    existing_path = archive_dir / "证据目录.pdf"
    existing_path.write_bytes(b"old")

    attachment = _FakeAttachment(3, "证据目录.pdf", b"new")
    attachment.archive_relative_path = "证据材料"
    attachment.archived_file_path = str(existing_path)

    binding_queryset = MagicMock()
    binding_queryset.first.return_value = SimpleNamespace(folder_path=str(tmp_path))
    with patch.object(archive_module.CaseFolderBinding.objects, "filter", return_value=binding_queryset):
        saved_path = service.sync_attachment_archive(
            case_id=19,
            attachment=attachment,
            archive_relative_path="证据材料",
            force=True,
        )

    assert saved_path == str(existing_path)
    assert existing_path.read_bytes() == b"new"
    assert not (archive_dir / "证据目录_1.pdf").exists()
