"""Django admin configuration."""

from __future__ import annotations

import logging
from typing import Any, ClassVar

from django import forms
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.cases.domain.validators import normalize_stages
from apps.cases.models import Case, CaseParty, CaseStage, SupervisingAuthority


class CaseAdminForm(forms.ModelForm[Case]):
    current_stage = forms.ChoiceField(
        choices=[("", "---------")] + list(CaseStage.choices),
        required=False,
        label=_("\u5f53\u524d\u9636\u6bb5"),
    )

    class Meta:
        model = Case
        fields: str = "__all__"
        widgets: ClassVar[dict[str, Any]] = {
            "cause_of_action": forms.TextInput(
                attrs={
                    "class": "vTextField js-cause-autocomplete",
                    "placeholder": _("\u8bf7\u8f93\u5165\u6848\u7531\u5173\u952e\u8bcd..."),
                    "autocomplete": "off",
                }
            ),
        }

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        if "start_date" in self.fields:
            self.fields["start_date"].required = False
            self.fields["start_date"].help_text = _(
                "\u7559\u7a7a\u65f6\u4f1a\u4f18\u5148\u4f7f\u7528\u7ed1\u5b9a\u5408\u540c\u7684\u5f00\u59cb\u65e5\u671f\uff1b"
                "\u6ca1\u6709\u7ed1\u5b9a\u5408\u540c\u65f6\u81ea\u52a8\u53d6\u4eca\u5929\u3002"
            )

    def clean(self) -> dict[str, Any]:
        logger = logging.getLogger(__name__)

        cleaned: dict[str, Any] = super().clean() or {}
        logger.info("[CaseAdminForm.clean] start validation, errors so far: %s", self.errors)

        cur = cleaned.get("current_stage")
        contract = cleaned.get("contract")
        start_date = cleaned.get("start_date")
        ctype = getattr(contract, "case_type", None) if contract else None
        rep = getattr(contract, "representation_stages", []) if contract else []
        old_contract = getattr(self.instance, "contract", None) if getattr(self.instance, "pk", None) else None
        old_contract_start_date = getattr(old_contract, "start_date", None) if old_contract else None

        logger.info("[CaseAdminForm.clean] cur=%s, ctype=%s, rep=%s", cur, ctype, rep)

        try:
            _normalized_representation_stages, cur2 = normalize_stages(ctype, rep, cur, strict=False)
            cleaned["current_stage"] = cur2
        except ValueError as e:
            code = str(e)
            logger.error("[CaseAdminForm.clean] normalize_stages error: %s", code)
            if code == "invalid_cur":
                self.add_error("current_stage", _("\u5f53\u524d\u9636\u6bb5\u4e0d\u5728\u53ef\u9009\u8303\u56f4\u5185"))
            elif code == "cur_not_in_rep":
                self.add_error("current_stage", _("\u5f53\u524d\u9636\u6bb5\u5fc5\u987b\u5728\u5408\u540c\u7684\u4ee3\u7406\u9636\u6bb5\u8303\u56f4\u5185"))
            elif code == "stages_not_applicable":
                self.add_error("current_stage", _("\u8be5\u6848\u4ef6\u7c7b\u578b\u4e0d\u652f\u6301\u9636\u6bb5\u8bbe\u7f6e"))
            elif code.startswith("invalid_rep:"):
                invalid_stages = code.split(":", 1)[1]
                self.add_error("current_stage", _("\u4ee3\u7406\u9636\u6bb5\u5305\u542b\u65e0\u6548\u503c: %s") % invalid_stages)
            else:
                logger.error("unhandled case validation error: %s", code)
                self.add_error(None, _("\u6848\u4ef6\u6570\u636e\u6821\u9a8c\u5931\u8d25: %s") % code)

        if not start_date:
            if contract and getattr(contract, "start_date", None):
                cleaned["start_date"] = contract.start_date
            elif getattr(self.instance, "start_date", None):
                cleaned["start_date"] = self.instance.start_date
            else:
                cleaned["start_date"] = timezone.localdate()
        elif (
            getattr(self.instance, "pk", None)
            and contract
            and getattr(contract, "pk", None) != getattr(old_contract, "pk", None)
            and getattr(self.instance, "start_date", None) == old_contract_start_date
        ):
            cleaned["start_date"] = getattr(contract, "start_date", None) or timezone.localdate()

        logger.info("[CaseAdminForm.clean] validation done, final errors: %s", self.errors)
        return cleaned


class CasePartyInlineForm(forms.ModelForm[CaseParty]):
    class Meta:
        model = CaseParty
        fields: str = "__all__"
        widgets: ClassVar[dict[str, Any]] = {
            "client": forms.Select(
                attrs={
                    "class": "contract-party-client-select",
                    "data-contract-party-filter": "true",
                }
            ),
        }


class SupervisingAuthorityInlineForm(forms.ModelForm[SupervisingAuthority]):
    class Meta:
        model = SupervisingAuthority
        fields: str = "__all__"
        widgets: ClassVar[dict[str, Any]] = {
            "name": forms.TextInput(
                attrs={
                    "class": "vTextField js-court-autocomplete",
                    "placeholder": _("\u8bf7\u8f93\u5165\u6cd5\u9662/\u673a\u5173\u540d\u79f0..."),
                    "autocomplete": "off",
                }
            ),
            "handler_name": forms.TextInput(
                attrs={
                    "class": "vTextField",
                    "placeholder": _("\u8bf7\u8f93\u5165\u627f\u529e\u4eba/\u8054\u7cfb\u4eba"),
                }
            ),
            "handler_phone": forms.TextInput(
                attrs={
                    "class": "vTextField",
                    "placeholder": _("\u8bf7\u8f93\u5165\u8054\u7cfb\u7535\u8bdd"),
                }
            ),
            "remarks": forms.Textarea(
                attrs={
                    "rows": 2,
                    "placeholder": _("\u8bb0\u5f55\u6c9f\u901a\u60c5\u51b5\u3001\u7279\u6b8a\u8981\u6c42\u6216\u5176\u4ed6\u5907\u6ce8"),
                }
            ),
        }
