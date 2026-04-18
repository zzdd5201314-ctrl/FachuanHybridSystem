"""Tests for contract-to-case workflow log anchor behavior."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock

from apps.contracts.services.contract.admin.workflows.case_creation_workflow import ContractCaseCreationWorkflow


def test_create_case_from_contract_sets_log_anchor_case_when_missing() -> None:
    case_service = Mock()
    case_service.create_case.return_value = SimpleNamespace(id=88)

    contract = Mock()
    contract.contract_parties.all.return_value = []
    contract.assignments.all.return_value = []
    contract.log_anchor_case_id = None

    workflow = ContractCaseCreationWorkflow(case_service=case_service)

    result = workflow.create_case_from_contract(contract=contract, case_data={"name": "测试案件"})

    assert result.id == 88
    assert contract.log_anchor_case_id == 88
    contract.save.assert_called_once_with(update_fields=["log_anchor_case"])


def test_create_case_from_contract_keeps_existing_log_anchor_case() -> None:
    case_service = Mock()
    case_service.create_case.return_value = SimpleNamespace(id=99)

    contract = Mock()
    contract.contract_parties.all.return_value = []
    contract.assignments.all.return_value = []
    contract.log_anchor_case_id = 12

    workflow = ContractCaseCreationWorkflow(case_service=case_service)

    result = workflow.create_case_from_contract(contract=contract, case_data={"name": "测试案件"})

    assert result.id == 99
    assert contract.log_anchor_case_id == 12
    contract.save.assert_not_called()
