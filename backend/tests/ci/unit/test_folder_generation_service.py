from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from apps.core.models.enums import CaseType
from apps.documents.services.generation.folder_generation_service import FolderGenerationService


def test_folder_generation_service_formats_root_name_with_case_type_label() -> None:
    contract = SimpleNamespace(
        case_type=CaseType.CIVIL,
        name="测试合同",
        start_date=date(2026, 4, 26),
        specified_date=None,
    )

    result = FolderGenerationService().format_root_folder_name(contract)

    assert result == "2026.04.26-[民商事]测试合同"
