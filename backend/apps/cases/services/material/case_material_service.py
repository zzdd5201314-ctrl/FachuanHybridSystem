"""Application service for case material workflows."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, cast

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
)
from apps.core.exceptions import NotFoundError, ValidationException

if TYPE_CHECKING:
    from apps.cases.services.case.case_query_service import CaseQueryService

logger = logging.getLogger(__name__)


class CaseMaterialService:
    def __init__(
        self,
        case_service: CaseQueryService | None = None,
        query_service: Any | None = None,
        binding_workflow: Any | None = None,
        archive_service: Any | None = None,
    ) -> None:
        if case_service is None:
            raise RuntimeError("CaseMaterialService.case_service not configured")
        self._case_service = case_service
        self._query_service = query_service
        self._binding_workflow = binding_workflow
        self._archive_service = archive_service

    @property
    def query_service(self) -> Any:
        if self._query_service is None:
            from .case_material_query_service import CaseMaterialQueryService

            self._query_service = CaseMaterialQueryService(case_service=self._case_service)
        return self._query_service

    @property
    def binding_workflow(self) -> Any:
        if self._binding_workflow is None:
            from .case_material_binding_workflow import CaseMaterialBindingWorkflow

            self._binding_workflow = CaseMaterialBindingWorkflow(
                case_service=self._case_service,
                archive_service=self.archive_service,
            )
        return self._binding_workflow

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
        return cast(
            list[dict[str, Any]],
            self.query_service.list_bind_candidates(
                case_id=case_id,
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
            ),
        )

    def bind_materials(
        self,
        case_id: int,
        items: Sequence[dict[str, Any]],
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            self.binding_workflow.bind_materials(
                case_id=case_id,
                items=items,
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
            ),
        )

    def get_archive_config(
        self,
        case_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            self.archive_service.get_archive_config(
                case_id=case_id,
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
            ),
        )

    def archive_uploaded_attachments(
        self,
        case_id: int,
        attachments: Sequence[CaseLogAttachment],
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            self.archive_service.archive_uploaded_attachments(
                case_id=case_id,
                attachments=list(attachments),
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
            ),
        )

    def rearchive_case_attachments(
        self,
        case_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            self.archive_service.rearchive_case_attachments(
                case_id=case_id,
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
            ),
        )

    def get_case_materials_view(
        self,
        case_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            self.query_service.get_case_materials_view(
                case_id=case_id,
                user=user,
                org_access=org_access,
                perm_open_access=perm_open_access,
            ),
        )

    def get_used_type_ids(self, case_id: int) -> set[int]:
        return cast(set[int], self.query_service.get_used_type_ids(case_id=case_id))

    def get_material_types_by_category(
        self,
        category: str,
        law_firm_id: int | None,
        used_type_ids: set[int],
    ) -> list[dict[str, Any]]:
        return cast(
            list[dict[str, Any]],
            self.query_service.get_material_types_by_category(
                category=category,
                law_firm_id=law_firm_id,
                used_type_ids=used_type_ids,
            ),
        )

    def save_group_order(
        self,
        case_id: int,
        category: str,
        ordered_type_ids: Sequence[int],
        side: str | None = None,
        supervising_authority_id: int | None = None,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> None:
        self._case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)

        category = (category or "").strip()
        if category not in {CaseMaterialCategory.PARTY, CaseMaterialCategory.NON_PARTY}:
            raise ValidationException(message=_("材料大类不合法"), errors={"category": category})

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

        types = {
            item.id
            for item in CaseMaterialType.objects.filter(
                id__in=list(ordered_type_ids),
                category=category,
                is_active=True,
            )
        }
        missing = [type_id for type_id in ordered_type_ids if type_id not in types]
        if missing:
            raise ValidationException(message=_("包含无效的材料类型"), errors={"type_ids": missing})

        with transaction.atomic():
            for idx, type_id in enumerate(ordered_type_ids):
                CaseMaterialGroupOrder.objects.update_or_create(
                    case_id=case_id,
                    category=category,
                    side=side,
                    supervising_authority_id=supervising_authority_id,
                    type_id=type_id,
                    defaults={"sort_index": idx},
                )

    def _resolve_type(
        self,
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
        existing = qs.first()  # type: ignore[assignment]
        if existing:
            return existing

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

    def _delete_attachment_record(
        self,
        *,
        attachment: CaseLogAttachment | None,
        warning_event: str = "delete_attachment_file_failed",
        cleanup_archive: bool = True,
    ) -> None:
        if not attachment:
            return

        attachment_id = getattr(attachment, "id", None)
        if cleanup_archive:
            try:
                self.archive_service.cleanup_attachment_archive(attachment=attachment, save=False)
            except Exception:
                logger.warning("delete_attachment_archive_cleanup_failed attachment_id=%s", attachment_id, exc_info=True)

        attachment_file = getattr(attachment, "file", None)
        if attachment_file:
            try:
                attachment_file.delete(save=False)
            except Exception:
                logger.warning("%s attachment_id=%s", warning_event, attachment_id)

        attachment.delete()

    def replace_material_file(
        self,
        case_id: int,
        material_id: int,
        new_attachment_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        self._case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)

        try:
            material = CaseMaterial.objects.select_related("source_attachment").get(id=material_id, case_id=case_id)
        except CaseMaterial.DoesNotExist:
            raise NotFoundError(_("材料不存在")) from None

        old_attachment_id = material.source_attachment_id
        if old_attachment_id == new_attachment_id:
            raise ValidationException(
                message=_("新附件与当前附件相同"),
                errors={"new_attachment_id": new_attachment_id},
            )

        try:
            new_attachment = CaseLogAttachment.objects.select_related("log").get(
                id=new_attachment_id,
                log__case_id=case_id,
            )
        except CaseLogAttachment.DoesNotExist:
            raise NotFoundError(_("新附件不存在或不属于该案件")) from None

        existing = CaseMaterial.objects.filter(source_attachment_id=new_attachment_id).first()
        if existing and existing.id != material_id:
            raise ValidationException(
                message=_("新附件已被其他材料绑定"),
                errors={"new_attachment_id": new_attachment_id},
            )

        old_attachment = material.source_attachment
        old_attachment_id_val = material.source_attachment_id

        material.source_attachment = new_attachment
        material.save(update_fields=["source_attachment"])

        if material.archived_file_path:
            self.archive_service.sync_material_archive(
                case_id=case_id,
                material=material,
                archive_relative_path=material.archive_relative_path,
                force=True,
            )

        if old_attachment:
            self._delete_attachment_record(
                attachment=old_attachment,
                warning_event="delete_old_attachment_file_failed",
            )
            logger.info("old_attachment_deleted attachment_id=%s", old_attachment_id_val)

        logger.info(
            "material_attachment_replaced material_id=%s old_attachment_id=%s new_attachment_id=%s",
            material_id,
            old_attachment_id_val,
            new_attachment_id,
        )
        return {
            "material_id": material.id,
            "old_attachment_id": old_attachment_id_val,
            "new_attachment_id": new_attachment_id,
        }

    def rename_group(
        self,
        case_id: int,
        type_id: int,
        new_type_name: str,
        update_global: bool = False,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        self._case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)

        new_type_name = new_type_name.strip()
        if not new_type_name:
            raise ValidationException(message=_("类型名称不能为空"), errors={"new_type_name": "required"})

        try:
            material_type = CaseMaterialType.objects.get(id=type_id)
        except CaseMaterialType.DoesNotExist:
            raise NotFoundError(_("材料类型不存在")) from None

        old_type_name = material_type.name
        if old_type_name == new_type_name:
            return {"type_id": type_id, "old_type_name": old_type_name, "new_type_name": new_type_name}

        with transaction.atomic():
            updated_count = CaseMaterial.objects.filter(case_id=case_id, type_id=type_id).update(type_name=new_type_name)
            if update_global:
                material_type.name = new_type_name
                material_type.save(update_fields=["name"])
                CaseMaterial.objects.filter(type_id=type_id).exclude(type_name=new_type_name).update(
                    type_name=new_type_name
                )

        logger.info(
            "material_group_renamed type_id=%s old_name=%s new_name=%s update_global=%s updated_count=%s",
            type_id,
            old_type_name,
            new_type_name,
            update_global,
            updated_count,
        )
        return {"type_id": type_id, "old_type_name": old_type_name, "new_type_name": new_type_name}

    def delete_material(
        self,
        case_id: int,
        material_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        self._case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)

        try:
            material = CaseMaterial.objects.select_related("source_attachment").get(id=material_id, case_id=case_id)
        except CaseMaterial.DoesNotExist:
            raise NotFoundError(_("材料不存在")) from None

        material_id_val = material.id
        attachment_id_val = material.source_attachment_id
        attachment = material.source_attachment

        material.delete()
        if attachment:
            self._delete_attachment_record(attachment=attachment)
            logger.info("attachment_deleted attachment_id=%s", attachment_id_val)

        logger.info(
            "material_deleted material_id=%s case_id=%s attachment_id=%s",
            material_id_val,
            case_id,
            attachment_id_val,
        )
        return {"material_id": material_id_val, "deleted": True}

    def delete_all_materials(
        self,
        case_id: int,
        category: str,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        self._case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)

        category = (category or "").strip()
        if category not in {CaseMaterialCategory.PARTY, CaseMaterialCategory.NON_PARTY}:
            raise ValidationException(message=_("材料大类不合法"), errors={"category": category})

        materials = list(CaseMaterial.objects.select_related("source_attachment").filter(case_id=case_id, category=category))
        if not materials:
            return {"category": category, "deleted_count": 0}

        deleted_count = 0
        with transaction.atomic():
            for material in materials:
                attachment = material.source_attachment
                material.delete()
                if attachment:
                    self._delete_attachment_record(attachment=attachment)
                deleted_count += 1

        CaseMaterialGroupOrder.objects.filter(case_id=case_id, category=category).delete()
        logger.info(
            "bulk_material_delete_completed case_id=%s category=%s deleted_count=%s",
            case_id,
            category,
            deleted_count,
        )
        return {"category": category, "deleted_count": deleted_count}
