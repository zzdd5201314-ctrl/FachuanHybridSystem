from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from apps.cases.api.folder_generation_api import build_case_folder_root_name


def test_build_case_folder_root_name_includes_case_type_stage_and_name() -> None:
    case = SimpleNamespace(
        case_type="civil",
        current_stage="first_trial",
        name="张三合同纠纷",
        get_current_stage_display=lambda: "一审",
    )

    result = build_case_folder_root_name(case, current_date=date(2026, 4, 18))

    assert result == "2026.04.18-[民商事]-[一审]-张三合同纠纷"


def test_build_case_folder_root_name_falls_back_when_stage_is_missing() -> None:
    case = SimpleNamespace(
        case_type="civil",
        current_stage=None,
        name="李四借款纠纷",
        get_current_stage_display=lambda: "",
    )

    result = build_case_folder_root_name(case, current_date=date(2026, 4, 18))

    assert result == "2026.04.18-[民商事]-[未设置阶段]-李四借款纠纷"
