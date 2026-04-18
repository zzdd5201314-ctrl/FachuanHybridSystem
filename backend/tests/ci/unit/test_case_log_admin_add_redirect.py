from __future__ import annotations

from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.test import RequestFactory
from django.urls import reverse

from apps.cases.admin.caselog_admin import CaseLogAdmin
from apps.cases.models import CaseLog


def test_case_log_admin_add_view_redirects_to_case_log_changelist() -> None:
    factory = RequestFactory()
    request = factory.get("/admin/cases/caselog/add/")
    request.user = type("User", (), {"is_active": True, "is_staff": True, "is_authenticated": True})()
    request.session = {}
    setattr(request, "_messages", FallbackStorage(request))

    admin_obj = CaseLogAdmin(CaseLog, AdminSite())
    response = admin_obj.add_view(request)

    assert response.status_code == 302
    assert response["Location"] == reverse("admin:cases_caselog_changelist")


def test_case_log_admin_hides_global_add_permission() -> None:
    factory = RequestFactory()
    request = factory.get("/admin/cases/caselog/")
    request.user = type("User", (), {"is_active": True, "is_staff": True, "is_authenticated": True})()

    admin_obj = CaseLogAdmin(CaseLog, AdminSite())

    assert admin_obj.has_add_permission(request) is False
