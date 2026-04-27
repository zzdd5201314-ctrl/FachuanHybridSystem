"""仪表盘统计服务，聚合四项核心指标。

遵循四层架构：不跨模块直接导入 Model，通过 apps.get_model() 延迟获取。
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal

from django.apps import apps as django_apps
from django.db.models import Count, Sum
from django.utils import timezone

logger = logging.getLogger(__name__)


class DashboardService:
    """仪表盘统计服务，聚合跨模块核心指标。"""

    def get_dashboard_stats(self) -> dict[str, int | Decimal]:
        """返回四项统计数据。

        Returns:
            dict: 包含 our_client_count, active_contract_count,
                  active_case_count, monthly_fee_total
        """
        today = timezone.localdate()

        our_client_count = self._get_our_client_count()
        active_contract_count = self._get_active_contract_count()
        active_case_count = self._get_active_case_count()
        monthly_fee_total = self._get_monthly_fee_total(today)

        return {
            "our_client_count": our_client_count,
            "active_contract_count": active_contract_count,
            "active_case_count": active_case_count,
            "monthly_fee_total": monthly_fee_total,
        }

    def _get_our_client_count(self) -> int:
        Client = django_apps.get_model("client", "Client")  # noqa: N806
        return int(Client.objects.filter(is_our_client=True).count())

    def _get_active_contract_count(self) -> int:
        Contract = django_apps.get_model("contracts", "Contract")  # noqa: N806
        return int(Contract.objects.filter(status="active").count())

    def _get_active_case_count(self) -> int:
        Case = django_apps.get_model("cases", "Case")  # noqa: N806
        return int(Case.objects.filter(status="active").count())

    def _get_monthly_fee_total(self, today: date) -> Decimal:
        ContractPayment = django_apps.get_model("contracts", "ContractPayment")  # noqa: N806
        result = ContractPayment.objects.filter(
            received_at__year=today.year,
            received_at__month=today.month,
        ).aggregate(total=Sum("amount"))
        return result["total"] or Decimal("0")
