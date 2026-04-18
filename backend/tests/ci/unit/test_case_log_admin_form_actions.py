from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from django.test import RequestFactory
from django.urls import reverse

from apps.cases.admin.caselog_admin import (
    _build_case_log_archive_hint,
    _get_case_log_submit_mode,
    _get_case_log_success_url,
)


def test_get_case_log_submit_mode_defaults_to_save() -> None:
    request = RequestFactory().post("/admin/cases/caselog/case/7/new/", {})

    assert _get_case_log_submit_mode(request) == "save"


def test_get_case_log_submit_mode_detects_continue_and_addanother() -> None:
    continue_request = RequestFactory().post("/admin/cases/caselog/case/7/new/", {"_continue": "1"})
    addanother_request = RequestFactory().post("/admin/cases/caselog/case/7/new/", {"_addanother": "1"})

    assert _get_case_log_submit_mode(continue_request) == "continue"
    assert _get_case_log_submit_mode(addanother_request) == "addanother"


def test_get_case_log_success_url_routes_to_expected_pages() -> None:
    assert _get_case_log_success_url(case_id=7, log_id=21, submit_mode="save") == reverse(
        "admin:cases_caselog_ledger", args=[7]
    )
    assert _get_case_log_success_url(case_id=7, log_id=21, submit_mode="continue") == reverse(
        "admin:cases_caselog_edit", args=[7, 21]
    )
    assert _get_case_log_success_url(case_id=7, log_id=21, submit_mode="addanother") == reverse(
        "admin:cases_caselog_create", args=[7]
    )


def test_build_case_log_archive_hint_when_archive_is_ready() -> None:
    case_obj = SimpleNamespace(pk=5)

    with patch(
        "apps.cases.services.material.case_material_archive_service.CaseMaterialArchiveService.get_archive_config_for_case",
        return_value={
            "enabled": True,
            "writable": True,
            "root_path": "/srv/cases/case-5",
            "folders": [{"relative_path": "", "display_name": "案件根目录"}],
        },
    ):
        hint = _build_case_log_archive_hint(case_obj)

    assert hint["enabled"] is True
    assert hint["writable"] is True
    assert hint["tone"] == "ready"
    assert hint["root_path"] == "/srv/cases/case-5"
    assert "自动推荐子文件夹" in hint["detail"] or "案件根目录" in hint["detail"]


def test_build_case_log_archive_hint_falls_back_when_service_errors() -> None:
    case_obj = SimpleNamespace(pk=9)

    with patch(
        "apps.cases.services.material.case_material_archive_service.CaseMaterialArchiveService.get_archive_config_for_case",
        side_effect=RuntimeError("boom"),
    ):
        hint = _build_case_log_archive_hint(case_obj)

    assert hint["enabled"] is False
    assert hint["tone"] == "warning"
    assert hint["upload_path"] == "case_logs/"
    assert "系统上传区" in hint["detail"]
