"""发票上传服务层。"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from apps.core.exceptions import NotFoundError
from apps.core.services import storage_service as storage

if TYPE_CHECKING:
    from apps.contracts.models import Invoice

logger = logging.getLogger(__name__)

_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"]
_MAX_SIZE_BYTES = 20 * 1024 * 1024


class InvoiceUploadService:
    def save_invoice_file(self, uploaded_file: Any, payment_id: int) -> Invoice:
        """保存发票文件并创建 Invoice 记录。文件保存失败时抛出异常，不创建 DB 记录。"""
        from apps.contracts.models import ContractPayment, Invoice

        try:
            payment = (
                ContractPayment.objects.select_related("contract")
                .filter(pk=payment_id)
                .first()
            )
            if payment is None:
                raise NotFoundError(message=f"Payment {payment_id} not found", code="PAYMENT_NOT_FOUND")

            storage.validate_uploaded_file(
                uploaded_file,
                allowed_extensions=_ALLOWED_EXTENSIONS,
                max_size_bytes=_MAX_SIZE_BYTES,
            )
            file_path, original_filename = self._save_invoice_binary(uploaded_file=uploaded_file, payment=payment)
        except Exception:
            logger.error("发票文件保存失败 payment_id=%s", payment_id, exc_info=True)
            raise

        return Invoice.objects.create(
            payment_id=payment_id,
            file_path=file_path,
            original_filename=original_filename,
        )

    def _save_invoice_binary(self, *, uploaded_file: Any, payment: Any) -> tuple[str, str]:
        bound_saved = self._save_to_bound_contract_folder(uploaded_file=uploaded_file, payment=payment)
        if bound_saved is not None:
            return bound_saved
        return self._save_to_media(uploaded_file=uploaded_file, payment=payment)

    def _save_to_bound_contract_folder(self, *, uploaded_file: Any, payment: Any) -> tuple[str, str] | None:
        from apps.contracts.services.folder.folder_binding_service import FolderBindingService

        binding_service = FolderBindingService()
        binding = binding_service.get_binding_for_contract(int(payment.contract_id))
        if binding is None:
            return None

        original_filename = storage.sanitize_upload_filename(str(getattr(uploaded_file, "name", "") or "invoice.pdf"))
        relative_dir_parts = binding_service.path_validator.sanitize_relative_dir(
            self._build_bound_invoice_subdir(payment)
        )
        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(0)
        abs_path = binding_service.filesystem_service.save_fileobj(
            base_path=str(binding.folder_path),
            relative_dir_parts=relative_dir_parts,
            file_name=original_filename,
            file_obj=uploaded_file,
        )
        return abs_path, original_filename

    def _save_to_media(self, *, uploaded_file: Any, payment: Any) -> tuple[str, str]:
        rel_dir = self._build_media_invoice_dir(payment)
        return storage.save_uploaded_file(
            uploaded_file=uploaded_file,
            rel_dir=rel_dir,
            preferred_filename=str(getattr(uploaded_file, "name", "") or "invoice.pdf"),
            allowed_extensions=_ALLOWED_EXTENSIONS,
            max_size_bytes=_MAX_SIZE_BYTES,
            use_uuid_name=False,
        )

    def _build_media_invoice_dir(self, payment: Any) -> str:
        contract_id = int(getattr(payment, "contract_id"))
        payment_id = int(getattr(payment, "id"))
        return f"contracts/finalized/{contract_id}/1-律师资料/3-发票/收款记录{payment_id}"

    def _build_bound_invoice_subdir(self, payment: Any) -> str:
        payment_id = int(getattr(payment, "id"))
        received_at = self._normalize_received_at(getattr(payment, "received_at", None))
        date_prefix = received_at.strftime("%Y-%m-%d")
        return f"1-律师资料/3-发票/{date_prefix}-收款记录{payment_id}"

    def _normalize_received_at(self, raw_value: Any) -> date:
        if isinstance(raw_value, datetime):
            return raw_value.date()
        if isinstance(raw_value, date):
            return raw_value
        if isinstance(raw_value, str):
            normalized = raw_value.strip().replace("/", "-").replace(".", "-")
            try:
                return date.fromisoformat(normalized)
            except ValueError:
                pass
        return date.today()

    def list_invoices_by_payment(self, payment_id: int) -> Any:
        """返回指定收款的所有发票 QuerySet，payment 不存在时返回空 QuerySet。"""
        from apps.contracts.models import Invoice

        return Invoice.objects.filter(payment_id=payment_id)

    def list_invoices_by_contract(self, contract_id: int) -> dict[int, list[Any]]:
        """返回合同所有收款下的发票，按 payment_id 分组，组内按 uploaded_at 升序。"""
        from apps.contracts.models import Invoice

        qs = (
            Invoice.objects.filter(payment__contract_id=contract_id)
            .select_related("payment")
            .order_by("payment_id", "-uploaded_at")
        )
        result: dict[int, list[Any]] = {}
        for invoice in qs:
            result.setdefault(invoice.payment_id, []).append(invoice)
        return result

    def delete_invoice(self, invoice_id: int) -> None:
        """删除发票记录及物理文件。invoice 不存在时抛出 NotFoundError。"""
        from apps.contracts.models import Invoice

        try:
            invoice = Invoice.objects.get(pk=invoice_id)
        except Invoice.DoesNotExist:
            raise NotFoundError(
                message=f"Invoice {invoice_id} not found",
                code="INVOICE_NOT_FOUND",
            ) from None

        file_path = invoice.file_path
        invoice.delete()

        try:
            storage.delete_stored_file(file_path)
        except Exception:
            logger.error("删除发票物理文件失败: %s", file_path, exc_info=True)
