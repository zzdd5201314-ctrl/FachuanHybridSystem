from __future__ import annotations

from apps.cases.models import SupervisingAuthority


def test_supervising_authority_model_declares_contact_fields_with_safe_defaults() -> None:
    fields = {field.name: field for field in SupervisingAuthority._meta.concrete_fields}

    assert fields["handler_name"].default == ""
    assert fields["handler_name"].blank is True
    assert fields["handler_name"].null is False
    assert fields["handler_phone"].default == ""
    assert fields["handler_phone"].blank is True
    assert fields["handler_phone"].null is False
    assert fields["remarks"].default == ""
    assert fields["remarks"].blank is True
    assert fields["remarks"].null is False
