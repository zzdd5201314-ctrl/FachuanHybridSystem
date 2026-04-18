from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from django.forms.utils import ErrorDict

from apps.cases.admin.case_forms_admin import CaseAdminForm
from apps.cases.models import Case


def _mock_model_form_clean(form: CaseAdminForm) -> dict[str, object]:
    cleaned = {
        "current_stage": "first_trial",
        "contract": SimpleNamespace(
            pk=1,
            case_type="civil",
            representation_stages=["second_trial"],
            start_date=None,
        ),
        "start_date": None,
    }
    form.cleaned_data = dict(cleaned)
    return cleaned


def test_case_admin_form_returns_field_error_when_current_stage_is_outside_representation_stages() -> None:
    form = CaseAdminForm(instance=Case(name="测试案件"))
    form._errors = ErrorDict()

    with patch("django.forms.ModelForm.clean", new=_mock_model_form_clean):
        form.clean()

    assert "current_stage" in form.errors
    assert form.errors["current_stage"] == ["当前阶段必须在合同的代理阶段范围内"]
