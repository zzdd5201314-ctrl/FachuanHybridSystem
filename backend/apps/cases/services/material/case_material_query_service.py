"""Query helpers for case material management."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from django.db import models
from django.db.models import Prefetch

from apps.cases.models import (
    CaseLogAttachment,
    CaseMaterial,
    CaseMaterialCategory,
    CaseMaterialGroupOrder,
    CaseMaterialSide,
    CaseMaterialType,
    CaseParty,
)


class CaseMaterialQueryService:
    def __init__(self, case_service: Any | None = None, archive_service: Any | None = None) -> None:
        self._case_service = case_service
        self._archive_service = archive_service

    @property
    def case_service(self) -> Any:
        if self._case_service is None:
            raise RuntimeError("CaseMaterialQueryService.case_service not configured")
        return self._case_service

    @property
    def archive_service(self) -> Any:
        if self._archive_service is None:
            from .case_material_archive_service import CaseMaterialArchiveService

            self._archive_service = CaseMaterialArchiveService(case_service=self._case_service)
        return self._archive_service

    def list_bind_candidates(
        self,
        case_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> list[dict[str, Any]]:
        self.case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)
        archive_config = self.archive_service.get_archive_config_for_case(case_id=case_id)
        archive_folders = archive_config.get("folders") or []

        qs = (
            CaseLogAttachment.objects.filter(log__case_id=case_id)
            .select_related("log", "log__actor")
            .prefetch_related(
                Prefetch(
                    "bound_material",
                    queryset=CaseMaterial.objects.select_related("type", "supervising_authority").prefetch_related(
                        Prefetch("parties", queryset=CaseParty.objects.select_related("client"))
                    ),
                )
            )
            .order_by("uploaded_at", "id")
        )

        results: list[dict[str, Any]] = []
        for attachment in qs:
            material = getattr(attachment, "bound_material", None)
            material_payload: dict[str, Any] | None = None
            if material:
                material_payload = {
                    "id": material.id,
                    "category": material.category,
                    "type_id": material.type_id,
                    "type_name": material.type_name,
                    "side": material.side,
                    "party_ids": list(material.parties.values_list("id", flat=True)),
                    "supervising_authority_id": material.supervising_authority_id,
                    "archive_relative_path": material.archive_relative_path or "",
                    "archived_file_path": material.archived_file_path or "",
                    "archived_at": material.archived_at,
                }

            file_name = (getattr(attachment.file, "name", "") or "").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
            suggestion = self.archive_service.suggest_archive(
                file_name=file_name,
                category=material.category if material else "",
                type_name=material.type_name if material else "",
                side=material.side if material else None,
                available_folders=archive_folders,
            )

            results.append(
                {
                    "attachment_id": attachment.id,
                    "file_name": file_name,
                    "file_url": getattr(attachment.file, "url", "") or "",
                    "uploaded_at": attachment.uploaded_at,
                    "log_id": attachment.log_id,
                    "log_created_at": getattr(attachment.log, "created_at", None),
                    "actor_name": getattr(getattr(attachment.log, "actor", None), "username", "") or "",
                    "material": material_payload,
                    "archive_suggested_relative_path": suggestion.get("relative_path", ""),
                    "archive_suggested_reason": suggestion.get("reason", ""),
                    "attachment_archive_relative_path": attachment.archive_relative_path or "",
                    "attachment_archived_file_path": attachment.archived_file_path or "",
                    "attachment_archived_at": attachment.archived_at,
                }
            )
        return results

    def get_case_materials_view(
        self,
        case_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        case = self.case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)
        materials = (
            CaseMaterial.objects.filter(case_id=case_id)
            .select_related(
                "type",
                "source_attachment",
                "source_attachment__log",
                "source_attachment__log__actor",
                "supervising_authority",
            )
            .prefetch_related(Prefetch("parties", queryset=CaseParty.objects.select_related("client")))
            .order_by("created_at", "id")
        )
        group_orders_qs = (
            CaseMaterialGroupOrder.objects.filter(case_id=case_id)
            .select_related("type", "supervising_authority")
            .order_by("sort_index", "id")
        )
        order_map = self._build_group_order_map(list(group_orders_qs))

        our_statuses: list[str] = []
        opponent_statuses: list[str] = []
        for party in case.parties.select_related("client").all():
            if not party.legal_status:
                continue
            label = party.get_legal_status_display()
            if party.client and getattr(party.client, "is_our_client", False):
                our_statuses.append(label)
            else:
                opponent_statuses.append(label)

        party_payload = {
            "our": {"legal_statuses": sorted(set(our_statuses)), "groups": []},
            "opponent": {"legal_statuses": sorted(set(opponent_statuses)), "groups": []},
        }
        non_party_payload: list[dict[str, Any]] = []
        party_groups: dict[str, dict[int, dict[str, Any]]] = {
            CaseMaterialSide.OUR: {},
            CaseMaterialSide.OPPONENT: {},
        }
        non_party_groups: dict[int, dict[int, dict[str, Any]]] = {}

        for material in materials:
            if material.category == CaseMaterialCategory.PARTY:
                side = material.side or CaseMaterialSide.OUR
                type_id = material.type_id or 0
                group = party_groups.setdefault(side, {}).get(type_id)
                if not group:
                    party_groups[side][type_id] = {
                        "type_id": material.type_id,
                        "type_name": material.type_name,
                        "items": [],
                    }
                    group = party_groups[side][type_id]
                group["items"].append(self._material_item_payload(material))
            else:
                authority_id = material.supervising_authority_id
                if not authority_id:
                    continue
                type_id = material.type_id or 0
                bucket = non_party_groups.setdefault(authority_id, {})
                group = bucket.get(type_id)
                if not group:
                    bucket[type_id] = {"type_id": material.type_id, "type_name": material.type_name, "items": []}
                    group = bucket[type_id]
                group["items"].append(self._material_item_payload(material))

        party_payload["our"]["groups"] = self._sorted_groups(
            CaseMaterialCategory.PARTY,
            CaseMaterialSide.OUR,
            None,
            party_groups[CaseMaterialSide.OUR],
            order_map,
        )
        party_payload["opponent"]["groups"] = self._sorted_groups(
            CaseMaterialCategory.PARTY,
            CaseMaterialSide.OPPONENT,
            None,
            party_groups[CaseMaterialSide.OPPONENT],
            order_map,
        )

        for authority in list(case.supervising_authorities.all()):
            groups = non_party_groups.get(authority.id, {})
            non_party_payload.append(
                {
                    "supervising_authority_id": authority.id,
                    "title": str(authority),
                    "groups": self._sorted_groups(CaseMaterialCategory.NON_PARTY, None, authority.id, groups, order_map),
                }
            )

        return {"case_id": case.id, "party": party_payload, "non_party": non_party_payload}

    def get_used_type_ids(self, case_id: int) -> set[int]:
        return set(
            CaseMaterial.objects.filter(case_id=case_id, type_id__isnull=False).values_list("type_id", flat=True)
        )

    def get_material_types_by_category(
        self,
        category: str,
        law_firm_id: int | None,
        used_type_ids: set[int],
    ) -> list[dict[str, Any]]:
        qs = CaseMaterialType.objects.filter(category=category, is_active=True).filter(
            models.Q(law_firm_id=law_firm_id) | models.Q(law_firm_id__isnull=True) | models.Q(id__in=used_type_ids)
        )
        return list(qs.order_by("name").values("id", "name", "law_firm_id"))

    def _build_group_order_map(self, rows: Sequence[CaseMaterialGroupOrder]) -> dict[tuple[str, str, int], list[int]]:
        order_map: dict[tuple[str, str, int], list[int]] = {}
        for row in rows:
            key = (row.category, row.side or "", row.supervising_authority_id or 0)
            order_map.setdefault(key, []).append(row.type_id)
        return order_map

    def _sorted_groups(
        self,
        category: str,
        side: str | None,
        supervising_authority_id: int | None,
        groups_by_type_id: dict[int, dict[str, Any]],
        order_map: dict[tuple[str, str, int], list[int]],
    ) -> list[dict[str, Any]]:
        key = (category, side or "", supervising_authority_id or 0)
        ordered_ids = order_map.get(key, [])
        ordered: list[dict[str, Any]] = []
        remaining: dict[int, dict[str, Any]] = dict(groups_by_type_id)
        for type_id in ordered_ids:
            group = remaining.pop(type_id, None)
            if group:
                ordered.append(group)
        tail = list(remaining.values())
        tail.sort(key=lambda item: item.get("type_name") or "")
        ordered.extend(tail)
        return ordered

    def _material_item_payload(self, material: CaseMaterial) -> dict[str, Any]:
        attachment = material.source_attachment
        file_name = getattr(getattr(attachment, "file", None), "name", "") if attachment else ""
        file_url = getattr(getattr(attachment, "file", None), "url", "") if attachment else ""
        uploaded_at = getattr(attachment, "uploaded_at", None)
        party_labels = [party.client.name for party in material.parties.all() if party.client and party.client.name]
        return {
            "material_id": material.id,
            "attachment_id": material.source_attachment_id,
            "file_name": (file_name or "").rsplit("/", 1)[-1],
            "file_url": file_url or "",
            "uploaded_at": uploaded_at,
            "party_labels": party_labels,
        }
