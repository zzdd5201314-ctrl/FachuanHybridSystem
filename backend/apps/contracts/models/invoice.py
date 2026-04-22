"""发票模型。"""

from __future__ import annotations

import logging
from typing import ClassVar

from django.db import models
from django.utils.translation import gettext_lazy as _

from .payment import ContractPayment

logger = logging.getLogger("apps.contracts")


class Invoice(models.Model):
    """与某条收款记录关联的发票文件。"""

    id: int
    payment_id: int
    payment = models.ForeignKey(
        ContractPayment,
        on_delete=models.CASCADE,
        related_name="invoices",
        verbose_name=_("收款记录"),
    )
    file_path = models.CharField(max_length=500, verbose_name=_("文件路径"))
    original_filename = models.CharField(max_length=255, verbose_name=_("原始文件名"))
    remark = models.TextField(blank=True, default="", verbose_name=_("备注"))
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name=_("上传时间"))

    invoice_code = models.CharField(max_length=20, blank=True, default="", verbose_name=_("发票代码"))
    invoice_number = models.CharField(max_length=20, blank=True, default="", verbose_name=_("发票号码"))
    invoice_date = models.DateField(null=True, blank=True, verbose_name=_("开票日期"))
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_("金额"),
    )
    tax_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_("税额"),
    )
    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_("价税合计"),
    )

    class Meta:
        ordering: ClassVar = ["-uploaded_at"]
        verbose_name = _("发票")
        verbose_name_plural = _("发票")
        indexes: ClassVar = [
            models.Index(fields=["payment", "-uploaded_at"]),
        ]

    def __str__(self) -> str:
        return self.original_filename or f"发票 #{self.id}"

    def save(self, *args: object, **kwargs: object) -> None:
        super().save(*args, **kwargs)
        self._sync_parent_payment_summary(self.payment_id)
        self._sync_finalized_material(self.id)
        self._sync_case_log_attachment(self.id)

    def delete(self, *args: object, **kwargs: object) -> tuple[int, dict[str, int]]:
        payment_id = self.payment_id
        deleted = super().delete(*args, **kwargs)
        self._sync_parent_payment_summary(payment_id)
        self._sync_payment_case_log(payment_id)
        return deleted

    @staticmethod
    def _sync_parent_payment_summary(payment_id: int | None) -> None:
        if not payment_id:
            return

        from apps.contracts.models import ContractPayment
        from apps.contracts.services.payment.contract_payment_service import ContractPaymentService

        if not ContractPayment.objects.filter(pk=payment_id).exists():
            return

        try:
            ContractPaymentService().sync_invoice_summary(payment_id)
        except Exception:
            logger.warning("Failed to sync invoice summary for payment_id=%s", payment_id, exc_info=True)

    @staticmethod
    def _sync_finalized_material(invoice_id: int | None) -> None:
        if not invoice_id:
            return

        from apps.contracts.models import FinalizedMaterial, MaterialCategory

        invoice = (
            Invoice.objects.select_related("payment", "payment__contract")
            .filter(pk=invoice_id)
            .first()
        )
        if invoice is None:
            return

        try:
            FinalizedMaterial.objects.update_or_create(
                source_invoice=invoice,
                defaults={
                    "contract_id": invoice.payment.contract_id,
                    "file_path": invoice.file_path,
                    "original_filename": invoice.original_filename,
                    "category": MaterialCategory.INVOICE,
                    "remark": invoice.remark or "",
                },
            )
        except Exception:
            logger.warning("Failed to sync finalized material for invoice_id=%s", invoice_id, exc_info=True)

    @staticmethod
    def _sync_case_log_attachment(invoice_id: int | None) -> None:
        if not invoice_id:
            return

        from apps.contracts.services.payment import ContractPaymentCaseLogSyncService

        try:
            ContractPaymentCaseLogSyncService().sync_invoice_attachment(invoice_id=invoice_id)
        except Exception:
            logger.warning("Failed to sync case log attachment for invoice_id=%s", invoice_id, exc_info=True)

    @staticmethod
    def _sync_payment_case_log(payment_id: int | None) -> None:
        if not payment_id:
            return

        from apps.contracts.services.payment import ContractPaymentCaseLogSyncService

        try:
            ContractPaymentCaseLogSyncService().sync_payment_log(payment_id=payment_id)
        except Exception:
            logger.warning("Failed to sync payment case log for payment_id=%s", payment_id, exc_info=True)
