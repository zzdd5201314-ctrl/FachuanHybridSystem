"""Unit tests for case material attachment cleanup during deletion flows."""

from __future__ import annotations

from contextlib import nullcontext
from unittest.mock import MagicMock, Mock, patch

from apps.cases.models import CaseMaterialCategory
from apps.cases.services.material import case_material_service as material_service_module
from apps.cases.services.material.case_material_service import CaseMaterialService


def test_delete_attachment_record_cleans_archive_and_deletes_attachment() -> None:
    archive_service = Mock()
    case_service = Mock()
    service = CaseMaterialService(
        case_service=case_service,
        archive_service=archive_service,
    )

    attachment_file = Mock()
    attachment_file.delete.side_effect = RuntimeError("file delete failed")
    attachment = Mock(id=12, file=attachment_file)

    service._delete_attachment_record(attachment=attachment)

    archive_service.cleanup_attachment_archive.assert_called_once_with(attachment=attachment, save=False)
    attachment_file.delete.assert_called_once_with(save=False)
    attachment.delete.assert_called_once_with()


def test_delete_material_uses_attachment_cleanup_helper() -> None:
    case_service = Mock()
    service = CaseMaterialService(case_service=case_service, archive_service=Mock())
    service._delete_attachment_record = Mock()

    attachment = Mock(id=21)
    material = Mock(id=7, source_attachment_id=21, source_attachment=attachment)
    queryset = MagicMock()
    queryset.get.return_value = material

    with patch.object(material_service_module.CaseMaterial.objects, "select_related", return_value=queryset):
        result = service.delete_material(case_id=3, material_id=7)

    case_service.get_case.assert_called_once()
    material.delete.assert_called_once_with()
    service._delete_attachment_record.assert_called_once_with(attachment=attachment)
    assert result == {"material_id": 7, "deleted": True}


def test_delete_all_materials_uses_attachment_cleanup_helper_for_each_attachment() -> None:
    case_service = Mock()
    service = CaseMaterialService(case_service=case_service, archive_service=Mock())
    service._delete_attachment_record = Mock()

    attachment_one = Mock(id=31)
    attachment_two = Mock(id=32)
    materials = [
        Mock(source_attachment=attachment_one),
        Mock(source_attachment=attachment_two),
    ]
    queryset = MagicMock()
    queryset.filter.return_value = materials
    group_order_queryset = MagicMock()

    with patch.object(material_service_module.CaseMaterial.objects, "select_related", return_value=queryset):
        with patch.object(material_service_module.CaseMaterialGroupOrder.objects, "filter", return_value=group_order_queryset):
            with patch.object(material_service_module.transaction, "atomic", return_value=nullcontext()):
                result = service.delete_all_materials(case_id=5, category=CaseMaterialCategory.PARTY)

    case_service.get_case.assert_called_once()
    for material in materials:
        material.delete.assert_called_once_with()
    assert service._delete_attachment_record.call_count == 2
    service._delete_attachment_record.assert_any_call(attachment=attachment_one)
    service._delete_attachment_record.assert_any_call(attachment=attachment_two)
    group_order_queryset.delete.assert_called_once_with()
    assert result == {"category": CaseMaterialCategory.PARTY, "deleted_count": 2}
