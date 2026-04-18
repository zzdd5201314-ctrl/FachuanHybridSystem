"""Module for case."""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.enums import AuthorityType, CaseStage, CaseStatus, SimpleCaseType

if TYPE_CHECKING:
    from django.db.models.fields.related_descriptors import RelatedManager

    from .chat import CaseChat, ChatAuditLog
    from .log import CaseLog
    from .material import CaseFolderBinding, CaseMaterial, CaseMaterialGroupOrder
    from .party import CaseAccessGrant, CaseAssignment, CaseParty
    from .template_binding import CaseTemplateBinding


class Case(models.Model):
    id: int
    contract = models.ForeignKey(
        "contracts.Contract",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="cases",
        verbose_name=_("\u5173\u8054\u5408\u540c"),
    )
    is_archived = models.BooleanField(default=False, verbose_name=_("\u662f\u5426\u5df2\u5efa\u6863"))
    filing_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        unique=True,
        verbose_name=_("\u5efa\u6863\u7f16\u53f7"),
        help_text=_("\u683c\u5f0f: {年份}_{案件类型}_{AJ}_{序号}"),
    )
    name = models.CharField(max_length=255, verbose_name=_("\u6848\u4ef6\u540d\u79f0"))
    status = models.CharField(
        max_length=32,
        choices=CaseStatus.choices,
        default=CaseStatus.ACTIVE,
        verbose_name=_("\u6848\u4ef6\u72b6\u6001"),
    )
    start_date = models.DateField(blank=True, null=True, verbose_name=_("\u6536\u6848\u65e5\u671f"))
    effective_date = models.DateField(blank=True, null=True, verbose_name=_("\u751f\u6548\u65e5\u671f"))
    specified_date = models.DateField(blank=True, null=True, verbose_name=_("\u6307\u5b9a\u65e5\u671f"))
    cause_of_action = models.CharField(max_length=128, blank=True, null=True, verbose_name=_("\u6848\u7531"))
    target_amount = models.DecimalField(
        max_digits=14, decimal_places=2, blank=True, null=True, verbose_name=_("\u6d89\u6848\u91d1\u989d")
    )
    preservation_amount = models.DecimalField(
        max_digits=14, decimal_places=2, blank=True, null=True, verbose_name=_("\u8d22\u4ea7\u4fdd\u5168\u91d1\u989d")
    )
    case_type = models.CharField(
        max_length=32,
        choices=SimpleCaseType.choices,
        default=SimpleCaseType.CIVIL,
        blank=True,
        null=True,
        verbose_name=_("\u6848\u4ef6\u7c7b\u578b"),
    )
    current_stage = models.CharField(
        max_length=64,
        choices=CaseStage.choices,
        blank=True,
        null=True,
        verbose_name=_("\u5f53\u524d\u9636\u6bb5"),
    )

    if TYPE_CHECKING:
        case_numbers: RelatedManager[CaseNumber]
        supervising_authorities: RelatedManager[SupervisingAuthority]
        parties: RelatedManager[CaseParty]
        assignments: RelatedManager[CaseAssignment]
        access_grants: RelatedManager[CaseAccessGrant]
        logs: RelatedManager[CaseLog]
        chats: RelatedManager[CaseChat]
        chat_audit_logs: RelatedManager[ChatAuditLog]
        materials: RelatedManager[CaseMaterial]
        material_group_orders: RelatedManager[CaseMaterialGroupOrder]
        folder_binding: CaseFolderBinding
        template_bindings: RelatedManager[CaseTemplateBinding]

    class Meta:
        verbose_name = _("\u6848\u4ef6")
        verbose_name_plural = _("\u6848\u4ef6")
        indexes: ClassVar = [
            models.Index(fields=["contract"]),
            models.Index(fields=["is_archived"]),
            models.Index(fields=["filing_number"]),
            models.Index(fields=["start_date"]),
            models.Index(fields=["current_stage"]),
            models.Index(fields=["-start_date"]),
        ]

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        """Basic validation."""
        from django.core.exceptions import ValidationError

        if self.current_stage:
            valid_stages = {choice[0] for choice in CaseStage.choices}
            if self.current_stage not in valid_stages:
                raise ValidationError({"current_stage": _("\u65e0\u6548\u7684\u6848\u4ef6\u9636\u6bb5")})


class CaseFilingNumberSequence(models.Model):
    id: int
    year = models.IntegerField(unique=True, verbose_name=_("\u5e74\u4efd"))
    next_value = models.IntegerField(default=1, verbose_name=_("\u4e0b\u4e00\u4e2a\u5e8f\u53f7"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("\u66f4\u65b0\u65f6\u95f4"))

    class Meta:
        verbose_name = _("\u6848\u4ef6\u5efa\u6863\u7f16\u53f7\u5e8f\u5217")
        verbose_name_plural = _("\u6848\u4ef6\u5efa\u6863\u7f16\u53f7\u5e8f\u5217")
        indexes: ClassVar = [models.Index(fields=["year"])]


class CaseNumber(models.Model):
    YEAR_DAYS_CHOICES: ClassVar = (
        (360, _("\u6309360\u5929")),
        (365, _("\u6309365\u5929")),
        (0, _("\u6309\u5b9e\u9645\u5929\u6570")),
    )
    DATE_INCLUSION_CHOICES: ClassVar = (
        ("both", _("\u8d77\u6b62\u65e5\u90fd\u8ba1\u5165")),
        ("start_only", _("\u4ec5\u8ba1\u5165\u5f00\u59cb\u65e5")),
        ("end_only", _("\u4ec5\u8ba1\u5165\u622a\u6b62\u65e5")),
        ("neither", _("\u8d77\u6b62\u65e5\u90fd\u4e0d\u8ba1\u5165")),
    )

    id: int
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="case_numbers", verbose_name=_("\u6848\u4ef6"))
    number = models.CharField(max_length=128, verbose_name=_("\u6848\u53f7"))
    document_name = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        verbose_name=_("\u6587\u4e66\u540d\u79f0"),
        help_text=_("\u4f8b\u5982\uff1a\u6c11\u4e8b\u5224\u51b3\u4e66\u3001\u6c11\u4e8b\u8c03\u89e3\u4e66\u3001\u6267\u884c\u88c1\u5b9a\u4e66\u7b49"),
    )
    document_file = models.FileField(
        upload_to="case_documents/%Y/%m/",
        blank=True,
        null=True,
        verbose_name=_("\u88c1\u5224\u6587\u4e66\u6587\u4ef6"),
        help_text=_("\u4e0a\u4f20PDF\u683c\u5f0f\u7684\u88c1\u5224\u6587\u4e66"),
    )
    document_content = models.TextField(
        blank=True,
        null=True,
        verbose_name=_("\u6267\u884c\u4f9d\u636e\u4e3b\u6587"),
        help_text=_("\u4ece\u88c1\u5224\u6587\u4e66\u4e2d\u63d0\u53d6\u7684\u4e3b\u6587\u5185\u5bb9"),
    )
    is_active = models.BooleanField(default=False, verbose_name=_("\u662f\u5426\u5df2\u751f\u6548"))
    execution_cutoff_date = models.DateField(
        blank=True,
        null=True,
        verbose_name=_("\u6267\u884c\u4e8b\u9879\u622a\u6b62\u65e5"),
        help_text=_("\u7533\u8bf7\u6267\u884c\u4e8b\u9879\u4e2d\u5229\u606f\u8ba1\u7b97\u7684\u622a\u6b62\u65e5\u671f"),
    )
    execution_paid_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("\u5df2\u4ed8\u6b3e\u91d1\u989d"),
        help_text=_("\u7528\u4e8e\u6267\u884c\u8ba1\u7b97\u7684\u5df2\u4ed8\u6b3e\u91d1\u989d"),
    )
    execution_use_deduction_order = models.BooleanField(
        default=False,
        verbose_name=_("\u542f\u7528\u62b5\u6263\u987a\u5e8f"),
        help_text=_("\u542f\u7528\u540e\u6309\u6587\u4e66\u4e2d\u7684\u62b5\u6263\u987a\u5e8f\u8ba1\u7b97"),
    )
    execution_year_days = models.PositiveSmallIntegerField(
        choices=YEAR_DAYS_CHOICES,
        default=360,
        verbose_name=_("\u5e74\u57fa\u51c6\u5929\u6570"),
        help_text=_("\u5229\u606f\u8ba1\u7b97\u53c2\u6570"),
    )
    execution_date_inclusion = models.CharField(
        max_length=16,
        choices=DATE_INCLUSION_CHOICES,
        default="both",
        verbose_name=_("\u65e5\u671f\u5305\u542b\u65b9\u5f0f"),
        help_text=_("\u5229\u606f\u8ba1\u7b97\u4e2d\u8d77\u6b62\u65e5\u662f\u5426\u8ba1\u5165"),
    )
    execution_manual_text = models.TextField(
        blank=True,
        null=True,
        verbose_name=_("\u7533\u8bf7\u6267\u884c\u4e8b\u9879\uff08\u624b\u5de5\u6700\u7ec8\u6587\u672c\uff09"),
        help_text=_("\u6709\u503c\u65f6\u6a21\u677f\u751f\u6210\u4f18\u5148\u4f7f\u7528\u6b64\u6587\u672c"),
    )
    remarks = models.TextField(blank=True, null=True, verbose_name=_("\u5907\u6ce8"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("\u521b\u5efa\u65f6\u95f4"))

    class Meta:
        verbose_name = _("\u6848\u4ef6\u6848\u53f7")
        verbose_name_plural = _("\u6848\u4ef6\u6848\u53f7")
        ordering: ClassVar = ["created_at"]

    def __str__(self) -> str:
        return self.number

    def get_full_number(self) -> str:
        """Get a formatted number string."""
        if self.document_name:
            return f"{self.number}《{self.document_name}》"
        return self.number


class SupervisingAuthority(models.Model):
    """Supervising authority."""

    id: int
    case = models.ForeignKey(
        Case, on_delete=models.CASCADE, related_name="supervising_authorities", verbose_name=_("\u6848\u4ef6")
    )
    name = models.CharField(max_length=255, blank=True, null=True, verbose_name=_("\u540d\u79f0"))
    authority_type = models.CharField(
        max_length=32,
        choices=AuthorityType.choices,
        default=AuthorityType.TRIAL,
        blank=True,
        null=True,
        verbose_name=_("\u6027\u8d28"),
    )
    handler_name = models.CharField(max_length=100, blank=True, default="", verbose_name=_("\u627f\u529e\u4eba"))
    handler_phone = models.CharField(max_length=64, blank=True, default="", verbose_name=_("\u8054\u7cfb\u7535\u8bdd"))
    remarks = models.TextField(blank=True, default="", verbose_name=_("\u5907\u6ce8"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("\u521b\u5efa\u65f6\u95f4"))

    if TYPE_CHECKING:
        materials: RelatedManager[CaseMaterial]
        material_group_orders: RelatedManager[CaseMaterialGroupOrder]

    class Meta:
        verbose_name = _("\u4e3b\u7ba1\u673a\u5173")
        verbose_name_plural = _("\u4e3b\u7ba1\u673a\u5173")
        ordering: ClassVar = ["created_at"]
        indexes: ClassVar = [
            models.Index(fields=["case"]),
            models.Index(fields=["authority_type"]),
        ]

    def __str__(self) -> str:
        authority_type_display = self.get_authority_type_display()
        if self.name and self.authority_type:
            return f"{authority_type_display} - {self.name}"
        if self.name:
            return self.name
        if self.authority_type:
            return str(authority_type_display)
        return f"\u4e3b\u7ba1\u673a\u5173 #{self.id}"
