from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from apps.cases.services.case.case_command_service import CaseCommandService

pytestmark = pytest.mark.django_db


def test_create_case_uses_contract_start_date_when_missing() -> None:
    contract_service = Mock()
    contract_service.get_contract.return_value = SimpleNamespace(
        id=7,
        start_date=date(2025, 3, 6),
        case_type="civil",
        representation_stages=[],
    )
    contract_service.validate_contract_active.return_value = True

    service = CaseCommandService(contract_service=contract_service)
    service.check_authenticated = Mock()

    with patch("apps.cases.services.case.case_command_service.Case.objects.create") as create_case:
        service.create_case({"name": "测试案件", "contract_id": 7}, user=object())

    create_case.assert_called_once()
    assert create_case.call_args.kwargs["start_date"] == date(2025, 3, 6)


def test_create_case_falls_back_to_today_when_contract_has_no_start_date() -> None:
    contract_service = Mock()
    contract_service.get_contract.return_value = SimpleNamespace(
        id=7,
        start_date=None,
        case_type="civil",
        representation_stages=[],
    )
    contract_service.validate_contract_active.return_value = True

    service = CaseCommandService(contract_service=contract_service)
    service.check_authenticated = Mock()

    with (
        patch("apps.cases.services.case.case_command_service.timezone.localdate", return_value=date(2026, 4, 18)),
        patch("apps.cases.services.case.case_command_service.Case.objects.create") as create_case,
    ):
        service.create_case({"name": "测试案件", "contract_id": 7}, user=object())

    create_case.assert_called_once()
    assert create_case.call_args.kwargs["start_date"] == date(2026, 4, 18)


def test_update_case_refreshes_start_date_when_contract_changes_from_default() -> None:
    old_contract = SimpleNamespace(id=3, start_date=date(2025, 1, 2))
    case = SimpleNamespace(
        id=11,
        contract=old_contract,
        contract_id=3,
        start_date=date(2025, 1, 2),
        current_stage=None,
        save=Mock(),
    )

    contract_service = Mock()

    def get_contract(contract_id: int) -> SimpleNamespace:
        if contract_id == 5:
            return SimpleNamespace(id=5, start_date=date(2025, 8, 9), case_type="civil", representation_stages=[])
        return old_contract

    contract_service.get_contract.side_effect = get_contract
    contract_service.validate_contract_active.return_value = True

    service = CaseCommandService(contract_service=contract_service)

    queryset = Mock()
    queryset.select_related.return_value = queryset
    queryset.get.return_value = case

    with patch("apps.cases.services.case.case_command_service.get_case_queryset", return_value=queryset):
        updated = service.update_case(11, {"contract_id": 5}, perm_open_access=True)

    assert updated.start_date == date(2025, 8, 9)
    assert updated.contract_id == 5
    updated.save.assert_called_once()
