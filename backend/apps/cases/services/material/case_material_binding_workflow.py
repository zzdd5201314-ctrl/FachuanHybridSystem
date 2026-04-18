"""Workflow helpers for binding uploaded attachments into case materials."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from django.db import models, transaction
from django.utils.translation import gettext_lazy as _

from apps.cases.models import (
    CaseLogAttachment,
    CaseMaterial,
    CaseMaterialCategory,
    CaseMaterialGroupOrder,
    CaseMaterialSide,
    CaseMaterialType,
    CaseParty,
    SupervisingAuthority,
)
from apps.core.exceptions import NotFoundError, ValidationException


class CaseMaterialBindingWorkflow:
    def __init__(self, case_service: Any | None = None, archive_service: Any | None = None) -> None:
        self._case_service = case_service
        self._archive_service = archive_service

    @property
    def case_service(self) -> Any:
        if self._case_service is None:
            raise RuntimeError("CaseMaterialBindingWorkflow.case_service not configured")
        return self._case_service

    @property
    def archive_service(self) -> Any:
        if self._archive_service is None:
            from .case_material_archive_service import CaseMaterialArchiveService

            self._archive_service = CaseMaterialArchiveService(case_service=self._case_service)
        return self._archive_service

    def bind_materials(
        self,
        case_id: int,
        items: Sequence[dict[str, Any]],
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        self.case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)
        attachment_ids = [int(item["attachment_id"]) for item in items if item.get("attachment_id") is not None]
        attachments = {
            attachment.id: attachment
            for attachment in CaseLogAttachment.objects.filter(log__case_id=case_id, id__in=attachment_ids).select_related(
                "log"
            )
        }
        missing = [attachment_id for attachment_id in attachment_ids if attachment_id not in attachments]
        if missing:
            raise NotFoundError(_("部分附件不存在或不属于该案件"))

        parties_by_id = {
            party.id: party for party in CaseParty.objects.filter(case_id=case_id).select_related("client").all()
        }
        authorities_by_id = {
            authority.id: authority for authority in SupervisingAuthority.objects.filter(case_id=case_id).all()
        }
        law_firm_id = getattr(user, "law_firm_id", None) if user else None
        type_cache: dict[str, CaseMaterialType] = {}
        saved: list[CaseMaterial] = []
        archived_count = 0
        archive_folders = self.archive_service.get_archive_config_for_case(case_id=case_id).get("folders") or []

        with transaction.atomic():
            for payload in items:
                attachment_id = int(payload.get("attachment_id") or 0)
                category = (payload.get("category") or "").strip()
                type_id = payload.get("type_id")
                type_name = (payload.get("type_name") or "").strip()
                side = payload.get("side")
                party_ids = payload.get("party_ids") or []
                supervising_authority_id = payload.get("supervising_authority_id")
                archive_relative_path = payload.get("archive_relative_path")

                if category not in {CaseMaterialCategory.PARTY, CaseMaterialCategory.NON_PARTY}:
                    raise ValidationException(message=_("材料大类不合法"), errors={"category": category})
                if not type_name:
                    raise ValidationException(message=_("类型名称不能为空"), errors={"type_name": "required"})

                if category == CaseMaterialCategory.PARTY:
                    if side not in {CaseMaterialSide.OUR, CaseMaterialSide.OPPONENT}:
                        raise ValidationException(message=_("当事人方向不合法"), errors={"side": side})
                    supervising_authority_id = None
                else:
                    side = None
                    if not supervising_authority_id:
                        raise ValidationException(
                            message=_("必须选择主管机关"),
                            errors={"supervising_authority_id": "required"},
                        )
                    supervising_authority_id = int(supervising_authority_id)
                    if supervising_authority_id not in authorities_by_id:
                        raise ValidationException(
                            message=_("主管机关不属于该案件"),
                            errors={"supervising_authority_id": supervising_authority_id},
                        )

                resolved_type = self._resolve_type_cached(
                    cache=type_cache,
                    category=category,
                    type_id=type_id,
                    type_name=type_name,
                    law_firm_id=law_firm_id,
                )
                material, _created = CaseMaterial.objects.update_or_create(
                    source_attachment=attachments[attachment_id],
                    defaults={
                        "case_id": case_id,
                        "category": category,
                        "type": resolved_type,
                        "type_name": resolved_type.name,
                        "side": side,
                        "supervising_authority_id": supervising_authority_id,
                    },
                )

                if category == CaseMaterialCategory.PARTY:
                    validated_party_ids = self._validate_party_ids(party_ids, parties_by_id, side)
                    material.parties.set(validated_party_ids)
                else:
                    material.parties.clear()

                archived_path = self.archive_service.sync_material_archive(
                    case_id=case_id,
                    material=material,
                    archive_relative_path=archive_relative_path,
                    folder_options=archive_folders,
                )
                if archived_path:
                    archived_count += 1
                saved.append(material)

        if saved:
            self._ensure_group_orders(case_id, saved)

        return {"materials": saved, "archived_count": archived_count}

    def _ensure_group_orders(self, case_id: int, saved: list[CaseMaterial]) -> None:
        group_order_map: dict[tuple[str, str | None, int | None], list[int]] = {}
        for material in saved:
            if not material.type_id:
                continue
            key = (material.category, material.side, material.supervising_authority_id)
            if material.type_id not in group_order_map.get(key, []):
                group_order_map.setdefault(key, []).append(material.type_id)

        existing_orders = CaseMaterialGroupOrder.objects.filter(case_id=case_id)
        existing_max_index: dict[tuple[str, str | None, int | None], int] = {}
        for order in existing_orders:
            key = (order.category, order.side, order.supervising_authority_id)
            existing_max_index[key] = max(existing_max_index.get(key, -1), order.sort_index)

        for (category, side, authority_id), type_ids in group_order_map.items():
            existing_type_ids = set(
                CaseMaterialGroupOrder.objects.filter(
                    case_id=case_id,
                    category=category,
                    side=side,
                    supervising_authority_id=authority_id,
                ).values_list("type_id", flat=True)
            )
            next_index = existing_max_index.get((category, side, authority_id), -1) + 1
            for type_id in type_ids:
                if type_id in existing_type_ids:
                    continue
                CaseMaterialGroupOrder.objects.update_or_create(
                    case_id=case_id,
                    category=category,
                    side=side,
                    supervising_authority_id=authority_id,
                    type_id=type_id,
                    defaults={"sort_index": next_index},
                )
                next_index += 1

    def _resolve_type_cached(
        self,
        cache: dict[str, CaseMaterialType],
        *,
        category: str,
        type_id: int | None,
        type_name: str,
        law_firm_id: int | None,
    ) -> CaseMaterialType:
        cache_key = f"id:{type_id}" if type_id else f"name:{category}:{type_name}:{law_firm_id}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        resolved = self._resolve_type(category=category, type_id=type_id, type_name=type_name, law_firm_id=law_firm_id)
        cache[cache_key] = resolved
        return resolved

    def _resolve_type(
        self,
        *,
        category: str,
        type_id: int | None,
        type_name: str,
        law_firm_id: int | None,
    ) -> CaseMaterialType:
        if type_id:
            try:
                return CaseMaterialType.objects.get(id=int(type_id), category=category, is_active=True)
            except CaseMaterialType.DoesNotExist:
                raise ValidationException(message=_("材料类型不存在"), errors={"type_id": type_id}) from None

        qs = CaseMaterialType.objects.filter(category=category, name=type_name, is_active=True).order_by(
            models.Case(
                models.When(law_firm_id=law_firm_id, then=0),
                models.When(law_firm_id=None, then=1),
                default=2,
                output_field=models.IntegerField(),
            )
        )
        resolved: CaseMaterialType | None = qs.first()  # type: ignore[assignment]
        if resolved is not None:
            return resolved
        return CaseMaterialType.objects.create(
            category=category,
            name=type_name,
            law_firm_id=law_firm_id,
            is_active=True,
        )

    def _validate_party_ids(
        self,
        party_ids: Sequence[Any],
        parties_by_id: dict[int, CaseParty],
        side: str,
    ) -> list[int]:
        validated: list[int] = []
        for party_id in party_ids:
            try:
                parsed_party_id = int(party_id)
            except (TypeError, ValueError):
                continue
            party = parties_by_id.get(parsed_party_id)
            if not party:
                raise ValidationException(message=_("包含无效当事人"), errors={"party_ids": parsed_party_id})
            is_our = bool(getattr(getattr(party, "client", None), "is_our_client", False))
            if side == CaseMaterialSide.OUR and not is_our:
                raise ValidationException(message=_("当事人不属于我方"), errors={"party_ids": parsed_party_id})
            if side == CaseMaterialSide.OPPONENT and is_our:
                raise ValidationException(message=_("当事人不属于对方"), errors={"party_ids": parsed_party_id})
            validated.append(parsed_party_id)
        return validated
