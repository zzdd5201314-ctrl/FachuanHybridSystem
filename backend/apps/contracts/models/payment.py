"""Payment models."""

from __future__ import annotations

import logging
from typing import ClassVar

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.services import storage_service as storage

from .contract import Contract

logger = logging.getLogger("apps.contracts")


class InvoiceStatus(models.TextChoices):
    UNINVOICED = "UNINVOICED", _("未开票")
    INVOICED_PARTIAL = "INVOICED_PARTIAL", _("部分开票")
    INVOICED_FULL = "INVOICED_FULL", _("已全部开票")


class ContractPayment(models.Model):
    id: int
    contract_id: int

    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name="payments",
        verbose_name=_("合同"),
    )
    case = models.ForeignKey(
        "cases.Case",
        on_delete=models.SET_NULL,
        related_name="contract_payments",
        null=True,
        blank=True,
        verbose_name=_("案件"),
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2, verbose_name=_("收款金额"))
    received_at = models.DateField(default=timezone.localdate, verbose_name=_("收款日期"))
    invoice_status = models.CharField(
        max_length=32,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.UNINVOICED,
        verbose_name=_("开票状态"),
    )
    invoiced_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name=_("已开票金额"))
    note = models.CharField(max_length=255, blank=True, null=True, verbose_name=_("备注"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("创建时间"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("更新时间"))

    class Meta:
        verbose_name = _("律师费收款记录")
        verbose_name_plural = _("律师费收款记录")
        indexes: ClassVar = [
            models.Index(fields=["contract", "received_at"]),
            models.Index(fields=["case", "received_at"]),
            models.Index(fields=["invoice_status"]),
        ]

    def __str__(self) -> str:
        target = self.case.name if self.case_id and getattr(self.case, "name", None) else self.contract.name
        return f"{target}-{self.amount}"

    def save(self, *args: object, **kwargs: object) -> None:
        super().save(*args, **kwargs)
        self._sync_case_log(self.pk)

    def delete(self, *args: object, **kwargs: object) -> tuple[int, dict[str, int]]:
        invoice_file_paths = list(self.invoices.values_list("file_path", flat=True))
        deleted = super().delete(*args, **kwargs)
        for file_path in {str(path or "").strip() for path in invoice_file_paths if path}:
            try:
                storage.delete_stored_file(file_path)
            except Exception:
                logger.warning("Failed to delete invoice file for payment delete: %s", file_path, exc_info=True)
        return deleted

    @staticmethod
    def _sync_case_log(payment_id: int | None) -> None:
        if not payment_id:
            return

        from apps.contracts.services.payment import ContractPaymentCaseLogSyncService

        try:
            ContractPaymentCaseLogSyncService().sync_payment_log(payment_id=int(payment_id))
        except Exception:
            pass
