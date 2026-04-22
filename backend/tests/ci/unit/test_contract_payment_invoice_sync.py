from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.cases.models import CaseLog, CaseLogAttachment
from apps.contracts.admin.contractpayment_admin import ContractPaymentAdminForm, InvoiceAdminForm
from apps.contracts.models import ContractFolderBinding, ContractPayment, FinalizedMaterial, Invoice, InvoiceStatus
from apps.contracts.services.contract.integrations.invoice_upload_service import InvoiceUploadService
from apps.testing.factories import CaseFactory, ContractFactory, LawyerFactory


pytestmark = pytest.mark.django_db


def test_invoice_changes_sync_payment_invoice_summary() -> None:
    contract = ContractFactory()
    payment = ContractPayment.objects.create(
        contract=contract,
        amount=Decimal("1000.00"),
        received_at=date(2026, 4, 22),
        invoiced_amount=Decimal("0"),
        invoice_status=InvoiceStatus.UNINVOICED,
    )

    invoice = Invoice.objects.create(
        payment=payment,
        file_path="contracts/invoices/test.pdf",
        original_filename="test.pdf",
        total_amount=Decimal("300.00"),
    )
    payment.refresh_from_db()
    assert payment.invoiced_amount == Decimal("300.00")
    assert payment.invoice_status == InvoiceStatus.INVOICED_PARTIAL

    invoice.total_amount = Decimal("1000.00")
    invoice.save()
    payment.refresh_from_db()
    assert payment.invoiced_amount == Decimal("1000.00")
    assert payment.invoice_status == InvoiceStatus.INVOICED_FULL

    invoice.delete()
    payment.refresh_from_db()
    assert payment.invoiced_amount == Decimal("0")
    assert payment.invoice_status == InvoiceStatus.UNINVOICED


def test_invoice_admin_form_save_persists_metadata_and_syncs_payment() -> None:
    contract = ContractFactory()
    payment = ContractPayment.objects.create(
        contract=contract,
        amount=Decimal("1000.00"),
        received_at=date(2026, 4, 22),
        invoiced_amount=Decimal("0"),
        invoice_status=InvoiceStatus.UNINVOICED,
    )
    upload = SimpleUploadedFile("invoice.pdf", b"pdf-content", content_type="application/pdf")
    form = InvoiceAdminForm(
        data={
            "original_filename": "识别后发票.pdf",
            "invoice_code": "A001",
            "invoice_number": "0001",
            "invoice_date": "2026-04-22",
            "amount": "100.00",
            "tax_amount": "6.00",
            "total_amount": "106.00",
            "remark": "首期发票",
        },
        files={"file": upload},
        instance=Invoice(payment=payment),
    )
    assert form.is_valid(), form.errors

    with patch(
        "apps.contracts.services.contract.integrations.invoice_upload_service.storage.save_uploaded_file",
        return_value=("contracts/invoices/1/invoice.pdf", "invoice.pdf"),
    ):
        saved = form.save()

    saved.refresh_from_db()
    payment.refresh_from_db()
    assert saved.original_filename == "识别后发票.pdf"
    assert saved.invoice_code == "A001"
    assert saved.invoice_number == "0001"
    assert saved.total_amount == Decimal("106.00")
    assert saved.remark == "首期发票"
    assert payment.invoiced_amount == Decimal("106.00")
    assert payment.invoice_status == InvoiceStatus.INVOICED_PARTIAL


def test_invoice_save_syncs_finalized_material() -> None:
    contract = ContractFactory()
    payment = ContractPayment.objects.create(
        contract=contract,
        amount=Decimal("1000.00"),
        received_at=date(2026, 4, 22),
        invoiced_amount=Decimal("0"),
        invoice_status=InvoiceStatus.UNINVOICED,
    )

    invoice = Invoice.objects.create(
        payment=payment,
        file_path="contracts/finalized/1/invoice.pdf",
        original_filename="invoice.pdf",
        total_amount=Decimal("300.00"),
        remark="自动同步",
    )

    material = FinalizedMaterial.objects.get(source_invoice=invoice)
    assert material.contract_id == contract.id
    assert material.file_path == invoice.file_path
    assert material.original_filename == "invoice.pdf"
    assert material.category == "invoice"
    assert material.remark == "自动同步"


def test_invoice_upload_service_saves_primary_file_to_bound_contract_folder(tmp_path: Path) -> None:
    contract = ContractFactory()
    ContractFolderBinding.objects.create(contract=contract, folder_path=str(tmp_path))
    payment = ContractPayment.objects.create(
        contract=contract,
        amount=Decimal("1000.00"),
        received_at=date(2026, 4, 22),
        invoiced_amount=Decimal("0"),
        invoice_status=InvoiceStatus.UNINVOICED,
    )
    upload = SimpleUploadedFile("invoice.pdf", b"pdf-content", content_type="application/pdf")

    saved = InvoiceUploadService().save_invoice_file(upload, payment.id)

    saved_path = Path(saved.file_path)
    assert saved_path.is_absolute()
    assert saved_path.exists()
    assert str(saved_path).startswith(str(tmp_path))
    assert "1-律师资料" in str(saved_path)
    assert "3-发票" in str(saved_path)

    material = FinalizedMaterial.objects.get(source_invoice=saved)
    assert material.file_path == saved.file_path


def test_contract_payment_admin_form_requires_case_for_multi_case_contract() -> None:
    contract = ContractFactory()
    CaseFactory(contract=contract)
    CaseFactory(contract=contract)

    form = ContractPaymentAdminForm(
        data={
            "contract": str(contract.id),
            "case": "",
            "amount": "5000.00",
            "received_at": "2026-04-23",
            "invoiced_amount": "0",
            "invoice_status": InvoiceStatus.UNINVOICED,
            "note": "",
        }
    )

    assert not form.is_valid()
    assert "case" in form.errors


def test_contract_payment_admin_form_auto_selects_single_case() -> None:
    contract = ContractFactory()
    case = CaseFactory(contract=contract)

    form = ContractPaymentAdminForm(
        data={
            "contract": str(contract.id),
            "case": "",
            "amount": "5000.00",
            "received_at": "2026-04-23",
            "invoiced_amount": "0",
            "invoice_status": InvoiceStatus.UNINVOICED,
            "note": "",
        }
    )

    assert form.is_valid(), form.errors
    payment = form.save()
    assert payment.case_id == case.id


def test_payment_and_invoice_sync_to_explicit_case_log_and_attachment() -> None:
    contract = ContractFactory()
    anchor_case = CaseFactory(contract=contract, current_stage="first_trial", name="锚点案件")
    selected_case = CaseFactory(contract=contract, current_stage="second_trial", name="实际落点案件")
    contract.log_anchor_case = anchor_case
    contract.save(update_fields=["log_anchor_case"])

    anchor_lawyer = LawyerFactory()
    selected_lawyer = LawyerFactory()
    anchor_case.assignments.create(lawyer=anchor_lawyer)
    selected_case.assignments.create(lawyer=selected_lawyer)

    payment = ContractPayment.objects.create(
        contract=contract,
        case=selected_case,
        amount=Decimal("1000.00"),
        received_at=date(2026, 4, 22),
        invoiced_amount=Decimal("0"),
        invoice_status=InvoiceStatus.UNINVOICED,
        note="首期律师费",
    )

    log = CaseLog.objects.get(source_payment=payment)
    assert log.case_id == selected_case.id
    assert log.actor_id == selected_lawyer.id
    assert log.source == CaseLog.Source.CONTRACT
    assert log.log_type == CaseLog.LogType.PROGRESS
    assert log.content == "收到律师费 1000.00 元"
    assert "关联合同案件：实际落点案件" in log.note
    assert "首期律师费" in log.note

    invoice = Invoice.objects.create(
        payment=payment,
        file_path="contracts/finalized/1/invoice.pdf",
        original_filename="invoice.pdf",
        total_amount=Decimal("300.00"),
    )

    attachment = CaseLogAttachment.objects.get(source_invoice=invoice)
    assert attachment.log_id == log.id
    assert attachment.resolved_file_reference == "contracts/finalized/1/invoice.pdf"
    assert attachment.display_name == "invoice.pdf"

    invoice.delete()

    assert not CaseLogAttachment.objects.filter(log=log, source_invoice_id=invoice.id).exists()
    assert CaseLog.objects.filter(pk=log.pk).exists()


def test_delete_payment_removes_records_and_bound_invoice_file(tmp_path: Path) -> None:
    contract = ContractFactory()
    case = CaseFactory(contract=contract, current_stage="first_trial")
    contract.log_anchor_case = case
    contract.save(update_fields=["log_anchor_case"])
    lawyer = LawyerFactory()
    case.assignments.create(lawyer=lawyer)
    ContractFolderBinding.objects.create(contract=contract, folder_path=str(tmp_path))

    payment = ContractPayment.objects.create(
        contract=contract,
        case=case,
        amount=Decimal("1000.00"),
        received_at=date(2026, 4, 23),
        invoiced_amount=Decimal("0"),
        invoice_status=InvoiceStatus.UNINVOICED,
        note="删除验证",
    )
    invoice = InvoiceUploadService().save_invoice_file(
        SimpleUploadedFile("delete-check.pdf", b"pdf-content", content_type="application/pdf"),
        payment.id,
    )
    log = CaseLog.objects.get(source_payment=payment)
    attachment = CaseLogAttachment.objects.get(source_invoice=invoice)
    material = FinalizedMaterial.objects.get(source_invoice=invoice)
    stored_file = Path(invoice.file_path)
    assert stored_file.exists()

    payment.delete()

    assert not ContractPayment.objects.filter(pk=payment.pk).exists()
    assert not Invoice.objects.filter(pk=invoice.pk).exists()
    assert not CaseLog.objects.filter(pk=log.pk).exists()
    assert not CaseLogAttachment.objects.filter(pk=attachment.pk).exists()
    assert not FinalizedMaterial.objects.filter(pk=material.pk).exists()
    assert not stored_file.exists()
