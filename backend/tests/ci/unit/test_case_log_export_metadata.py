"""Tests for case log export metadata serialization."""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch

from apps.cases.services.case.case_export_serializer_service import serialize_case_obj


def test_serialize_case_obj_includes_log_metadata() -> None:
    actor = SimpleNamespace(real_name="张律师", phone="13800000000", username="zhang")
    contract = SimpleNamespace(id=18, name="顾问合同")
    case = SimpleNamespace(
        name="合同纠纷",
        filing_number="2026-001",
        status="active",
        case_type="civil",
        cause_of_action="合同纠纷",
        target_amount=None,
        preservation_amount=None,
        current_stage="first_trial",
        is_archived=False,
        effective_date=None,
        specified_date=None,
        parties=SimpleNamespace(all=lambda: []),
        assignments=SimpleNamespace(all=lambda: []),
        supervising_authorities=SimpleNamespace(all=lambda: []),
        case_numbers=SimpleNamespace(all=lambda: []),
        chats=SimpleNamespace(all=lambda: []),
        contract_id=18,
        contract=contract,
    )
    log = SimpleNamespace(
        id=7,
        case_id=31,
        case=case,
        log_type="progress",
        get_log_type_display=lambda: "进展记录",
        source="contract",
        get_source_display=lambda: "合同",
        is_pinned=True,
        content="推进合同续签沟通",
        created_at=datetime(2026, 4, 17, 10, 30, 0),
        actor=actor,
        attachments=SimpleNamespace(all=lambda: []),
    )
    case.logs = SimpleNamespace(all=lambda: [log])

    with patch(
        "apps.cases.services.case.case_export_serializer_service._export_case_log_reminders_map",
        return_value={7: []},
    ):
        data = serialize_case_obj(case)

    exported_log = data["logs"][0]
    assert exported_log["case_id"] == 31
    assert exported_log["case_name"] == "合同纠纷"
    assert exported_log["contract_id"] == 18
    assert exported_log["contract_name"] == "顾问合同"
    assert exported_log["log_type"] == "progress"
    assert exported_log["log_type_display"] == "进展记录"
    assert exported_log["source"] == "contract"
    assert exported_log["source_display"] == "合同"
    assert exported_log["is_pinned"] is True
