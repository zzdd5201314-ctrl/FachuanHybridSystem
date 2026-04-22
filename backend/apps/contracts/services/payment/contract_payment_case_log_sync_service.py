from __future__ import annotations

from datetime import datetime, time
from typing import Any

from django.utils import timezone

from apps.cases.models import CaseLog, CaseLogAttachment
from apps.contracts.models import ContractPayment, Invoice
from apps.organization.services import OrganizationServiceAdapter


class ContractPaymentCaseLogSyncService:
    def __init__(self, organization_service: OrganizationServiceAdapter | None = None) -> None:
        self.organization_service = organization_service or OrganizationServiceAdapter()

    def sync_payment_log(self, *, payment_id: int) -> CaseLog | None:
        payment = (
            ContractPayment.objects.select_related(
                "contract",
                "contract__log_anchor_case",
                "case",
            )
            .filter(pk=payment_id)
            .first()
        )
        if payment is None:
            return None

        existing_log = CaseLog.objects.select_related("case").filter(source_payment_id=payment_id).first()
        case_obj = payment.case or payment.contract.resolved_log_anchor_case
        if case_obj is None:
            if existing_log is not None:
                existing_log.delete()
            return None

        actor_id = self._resolve_actor_id(case_obj=case_obj, existing_log=existing_log)
        if actor_id is None:
            if existing_log is not None and existing_log.case_id != case_obj.pk:
                existing_log.delete()
                return None
            return existing_log

        log, _created = CaseLog.objects.update_or_create(
            source_payment=payment,
            defaults={
                "case_id": case_obj.pk,
                "content": self._build_content(payment),
                "stage": case_obj.current_stage or None,
                "note": self._build_note(payment),
                "logged_at": self._build_logged_at(payment.received_at),
                "actor_id": actor_id,
                "log_type": CaseLog.LogType.PROGRESS,
                "source": CaseLog.Source.CONTRACT,
                "is_pinned": False,
            },
        )
        self.sync_payment_invoice_attachments(payment_id=payment.id, log=log)
        return log

    def sync_invoice_attachment(self, *, invoice_id: int) -> CaseLogAttachment | None:
        invoice = Invoice.objects.select_related("payment", "payment__contract", "payment__case").filter(pk=invoice_id).first()
        if invoice is None:
            return None

        log = self.sync_payment_log(payment_id=invoice.payment_id)
        if log is None:
            return None
        return self._sync_invoice_attachment_to_log(log=log, invoice=invoice)

    def sync_payment_invoice_attachments(self, *, payment_id: int, log: CaseLog | None = None) -> list[CaseLogAttachment]:
        if log is None:
            log = CaseLog.objects.filter(source_payment_id=payment_id).first()
        if log is None:
            return []

        invoices = list(Invoice.objects.filter(payment_id=payment_id).order_by("id"))
        invoice_ids = [invoice.id for invoice in invoices]
        attachments: list[CaseLogAttachment] = []
        for invoice in invoices:
            attachment = self._sync_invoice_attachment_to_log(log=log, invoice=invoice)
            if attachment is not None:
                attachments.append(attachment)

        stale_qs = CaseLogAttachment.objects.filter(log=log, source_invoice__payment_id=payment_id)
        if invoice_ids:
            stale_qs = stale_qs.exclude(source_invoice_id__in=invoice_ids)
        stale_qs.delete()
        return attachments

    def _sync_invoice_attachment_to_log(self, *, log: CaseLog, invoice: Invoice) -> CaseLogAttachment | None:
        file_reference = str(invoice.file_path or "").strip()
        if not file_reference:
            return None

        attachment, _created = CaseLogAttachment.objects.update_or_create(
            source_invoice=invoice,
            defaults={
                "log": log,
                "file": file_reference,
                "archive_relative_path": "",
                "archived_file_path": "",
                "archived_at": None,
            },
        )
        return attachment

    @staticmethod
    def _build_content(payment: ContractPayment) -> str:
        return f"收到律师费 {payment.amount} 元"

    @staticmethod
    def _build_note(payment: ContractPayment) -> str:
        parts = [
            f"收款日期：{payment.received_at:%Y-%m-%d}",
            f"已开票金额：{payment.invoiced_amount} 元",
            f"开票状态：{payment.get_invoice_status_display()}",
        ]
        if payment.case_id and getattr(payment.case, "name", None):
            parts.append(f"关联合同案件：{payment.case.name}")

        note = str(payment.note or "").strip()
        if note:
            parts.append(f"备注：{note}")
        return "\n".join(parts)

    @staticmethod
    def _build_logged_at(received_at: Any) -> datetime:
        if hasattr(received_at, "year") and hasattr(received_at, "month") and hasattr(received_at, "day"):
            naive = datetime.combine(received_at, time(hour=9, minute=0))
        else:
            naive = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
        return timezone.make_aware(naive, timezone.get_current_timezone()) if timezone.is_naive(naive) else naive

    def _resolve_actor_id(self, *, case_obj: Any, existing_log: CaseLog | None) -> int | None:
        if existing_log is not None and existing_log.case_id == case_obj.pk and getattr(existing_log, "actor_id", None):
            return int(existing_log.actor_id)

        assignment = case_obj.assignments.order_by("id").values_list("lawyer_id", flat=True).first()
        if assignment:
            return int(assignment)

        default_lawyer_id = self.organization_service.get_default_lawyer_id()
        if default_lawyer_id:
            return int(default_lawyer_id)
        return None
