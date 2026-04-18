"""Tests for case log service adapter metadata passthrough."""

from __future__ import annotations

from unittest.mock import Mock

from apps.cases.services.log.caselog_service_adapter import CaseLogServiceAdapter


def test_case_log_service_adapter_passes_contract_filter_to_list_logs() -> None:
    caselog_service = Mock()
    caselog_service.list_logs.return_value = ["log"]
    adapter = CaseLogServiceAdapter(caselog_service=caselog_service)

    result = adapter.list_logs(case_id=5, contract_id=9)

    assert result == ["log"]
    caselog_service.list_logs.assert_called_once_with(
        case_id=5,
        contract_id=9,
        user=None,
        org_access=None,
        perm_open_access=False,
    )


def test_case_log_service_adapter_passes_metadata_to_create_log() -> None:
    caselog_service = Mock()
    caselog_service.create_log.return_value = {"id": 3}
    adapter = CaseLogServiceAdapter(caselog_service=caselog_service)

    result = adapter.create_log(
        case_id=5,
        content="测试日志",
        log_type="progress",
        source="contract",
        is_pinned=True,
    )

    assert result == {"id": 3}
    caselog_service.create_log.assert_called_once_with(
        case_id=5,
        content="测试日志",
        log_type="progress",
        source="contract",
        is_pinned=True,
        user=None,
        reminder_type=None,
        reminder_time=None,
        perm_open_access=True,
    )
