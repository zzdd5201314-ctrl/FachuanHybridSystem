"""Unit tests for case material archive auto-routing rules."""

from __future__ import annotations

import pytest

from apps.cases.models import CaseMaterialCategory, CaseMaterialSide
from apps.cases.services.material.case_material_archive_service import CaseMaterialArchiveService


def _folders(*paths: str) -> list[dict[str, str]]:
    return [{"relative_path": path, "display_name": path or "案件根目录"} for path in paths]


@pytest.mark.parametrize(
    ("file_name", "type_name", "folders", "expected"),
    [
        (
            "原告身份证明.pdf",
            "身份证明",
            _folders("", "身份证明", "委托材料", "其他材料"),
            "身份证明",
        ),
        (
            "微信聊天记录证据清单.pdf",
            "证据材料",
            _folders("", "证据材料", "其他材料"),
            "证据材料",
        ),
        (
            "财产保全申请书.pdf",
            "保全申请书",
            _folders("", "保全材料", "其他材料"),
            "保全材料",
        ),
        (
            "民事判决书.pdf",
            "判决书",
            _folders("", "执行依据及生效证明", "证据材料", "其他材料"),
            "执行依据及生效证明",
        ),
    ],
)
def test_suggest_archive_relative_path_prefers_semantic_folder(
    file_name: str,
    type_name: str,
    folders: list[dict[str, str]],
    expected: str,
) -> None:
    service = CaseMaterialArchiveService(case_service=object())

    result = service.suggest_archive_relative_path(
        file_name=file_name,
        type_name=type_name,
        available_folders=folders,
    )

    assert result == expected


def test_suggest_archive_relative_path_party_side_fallback_prefers_opponent_folder() -> None:
    service = CaseMaterialArchiveService(case_service=object())

    result = service.suggest_archive_relative_path(
        file_name="普通材料.pdf",
        category=CaseMaterialCategory.PARTY,
        side=CaseMaterialSide.OPPONENT,
        available_folders=_folders("", "我方材料", "对方材料", "其他材料"),
    )

    assert result == "对方材料"
