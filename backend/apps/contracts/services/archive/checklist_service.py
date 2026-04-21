"""归档检查清单服务

负责计算归档完成度、获取检查清单状态等业务逻辑。
"""

from __future__ import annotations

import logging
from typing import Any

from apps.contracts.models import Contract
from apps.contracts.models.finalized_material import FinalizedMaterial

from .category_mapping import ArchiveCategory, get_archive_category
from .constants import ARCHIVE_CHECKLIST, CASE_MATERIAL_KEYWORD_MAPPING, ChecklistItem

logger = logging.getLogger("apps.contracts.archive")


class ArchiveChecklistService:
    """归档检查清单服务"""

    def get_checklist_with_status(self, contract: Contract) -> dict[str, Any]:
        """
        获取合同的归档检查清单及各项完成状态。

        Args:
            contract: 合同实例

        Returns:
            {
                "archive_category": "litigation",
                "archive_category_label": "诉讼/仲裁",
                "items": [
                    {
                        "code": "lt_1",
                        "name": "案卷封面",
                        "template": "case_cover",
                        "required": True,
                        "auto_detect": None,
                        "source": "template",
                        "completed": True,
                        "material_ids": [1, 2],  # 关联的 FinalizedMaterial ID 列表
                    },
                    ...
                ],
                "completed_count": 8,
                "total_count": 18,
                "required_completed_count": 5,
                "required_total_count": 8,
                "completion_percentage": 44.4,
            }
        """
        archive_category = get_archive_category(contract.case_type)
        checklist_items = ARCHIVE_CHECKLIST.get(archive_category, [])

        # 一次性加载合同的所有归档材料
        materials = list(
            FinalizedMaterial.objects.filter(contract=contract).only(
                "id", "archive_item_code", "category"
            )
        )

        # 构建 archive_item_code → [material_id] 映射
        code_to_materials: dict[str, list[int]] = {}
        for m in materials:
            if m.archive_item_code:
                code_to_materials.setdefault(m.archive_item_code, []).append(m.id)

        # 特殊处理：合同正本/补充协议/发票归类到对应检查项
        contract_category_codes = self._map_contract_materials(
            archive_category, materials
        )
        for code, mat_ids in contract_category_codes.items():
            code_to_materials.setdefault(code, []).extend(mat_ids)

        # 特殊处理：从关联合同案件中提取授权委托材料
        case_material_codes = self._map_case_authorization_materials(
            contract, archive_category, materials
        )
        for code, mat_ids in case_material_codes.items():
            code_to_materials.setdefault(code, []).extend(mat_ids)

        # 检查 source="case" 的清单项，哪些案件中有匹配的 CaseMaterial（供前端展示"可同步"提示）
        case_material_match_codes = self._find_case_material_match_codes(contract, archive_category)

        # 构建结果
        items_with_status: list[dict[str, Any]] = []
        for item in checklist_items:
            mat_ids = code_to_materials.get(item["code"], [])
            items_with_status.append({
                **item,
                "completed": len(mat_ids) > 0,
                "material_ids": mat_ids,
                "has_case_material": item["source"] == "case" and item["code"] in case_material_match_codes,
            })

        total_count = len(items_with_status)
        completed_count = sum(1 for item in items_with_status if item["completed"])
        required_items = [item for item in items_with_status if item["required"]]
        required_total_count = len(required_items)
        required_completed_count = sum(1 for item in required_items if item["completed"])

        archive_category_label = ArchiveCategory(archive_category).label

        return {
            "archive_category": archive_category,
            "archive_category_label": archive_category_label,
            "items": items_with_status,
            "completed_count": completed_count,
            "total_count": total_count,
            "required_completed_count": required_completed_count,
            "required_total_count": required_total_count,
            "completion_percentage": round(completed_count / total_count * 100, 1) if total_count > 0 else 0,
        }

    def _map_contract_materials(
        self,
        archive_category: str,
        materials: list[FinalizedMaterial],
    ) -> dict[str, list[int]]:
        """
        将现有 MaterialCategory (合同正本/补充协议/发票) 映射到检查清单编号。

        这是为了兼容已上传的归档材料，让它们自动匹配到检查清单项。
        """
        result: dict[str, list[int]] = {}

        # 找到"委托合同"对应的 code
        contract_code = self._find_code_by_source(archive_category, "contract")
        invoice_code = self._find_code_by_name(archive_category, "收费凭证")

        for m in materials:
            # 已有 archive_item_code 的跳过
            if m.archive_item_code:
                continue

            from apps.contracts.models.finalized_material import MaterialCategory

            if m.category in (MaterialCategory.CONTRACT_ORIGINAL, MaterialCategory.SUPPLEMENTARY_AGREEMENT) and contract_code:
                result.setdefault(contract_code, []).append(m.id)
            elif m.category == MaterialCategory.INVOICE and invoice_code:
                result.setdefault(invoice_code, []).append(m.id)

        return result

    def _map_case_authorization_materials(
        self,
        contract: Contract,
        archive_category: str,
        materials: list[FinalizedMaterial],
    ) -> dict[str, list[int]]:
        """
        从关联合同案件中提取授权委托材料，映射到检查清单编号。

        检查逻辑：
        1. 已上传到合同的授权委托材料 (MaterialCategory.AUTHORIZATION_MATERIAL)
        2. 案件 CaseMaterial 中类型名称包含"授权委托"/"委托授权"的材料
        """
        result: dict[str, list[int]] = {}

        # 找到"授权委托证明材料"对应的 code
        auth_code = self._find_code_by_name(archive_category, "授权委托")
        if not auth_code:
            return result

        # 1. 检查已上传到合同的授权委托材料
        from apps.contracts.models.finalized_material import MaterialCategory

        for m in materials:
            if m.archive_item_code:
                continue
            if m.category == MaterialCategory.AUTHORIZATION_MATERIAL:
                result.setdefault(auth_code, []).append(m.id)

        # 2. 检查关联合同案件中是否有授权委托材料（仅标记状态）
        try:
            from apps.cases.models import CaseMaterial

            for case in contract.cases.all():
                if CaseMaterial.objects.filter(case=case, type_name__contains="授权").exists():
                    logger.info(
                        "案件 %s 存在授权委托材料，可提取到归档",
                        case.id,
                        extra={"contract_id": contract.id},
                    )
                    break
        except Exception as e:
            logger.warning("检查案件授权委托材料失败: %s", e)

        return result

    def get_case_material_match_map(
        self,
        contract: Contract,
    ) -> dict[str, Any]:
        """
        获取合同关联案件中 CaseMaterial → archive_item_code 的匹配映射。

        不修改数据库，仅返回匹配结果供前端展示和同步操作使用。

        Returns:
            {
                "archive_category": "litigation",
                "matches": [
                    {
                        "archive_item_code": "lt_7",
                        "archive_item_name": "起诉书、上诉书或答辩书",
                        "case_material_ids": [101, 102],
                        "already_synced": False,  # 是否已有 FinalizedMaterial 对应
                    },
                    ...
                ],
                "unmatched_case_materials": [
                    {"id": 105, "type_name": "其他材料", "category": "party"},
                    ...
                ],
                "synced_count": 3,  # 已同步到 FinalizedMaterial 的案件材料数
                "matchable_count": 8,  # 可匹配的案件材料数
            }
        """
        archive_category = get_archive_category(contract.case_type)
        keyword_map = CASE_MATERIAL_KEYWORD_MAPPING.get(archive_category, {})
        checklist_items = ARCHIVE_CHECKLIST.get(archive_category, [])

        # 收集 source="case" 的清单项
        case_source_items = {item["code"]: item for item in checklist_items if item["source"] == "case"}

        # 查询合同已有的 FinalizedMaterial（用于判断 already_synced）
        existing_codes = set(
            FinalizedMaterial.objects.filter(
                contract=contract,
                archive_item_code__in=case_source_items.keys(),
            ).values_list("archive_item_code", flat=True)
        )

        # 查询关联案件的所有 CaseMaterial
        from apps.cases.models import CaseMaterial

        case_materials = list(
            CaseMaterial.objects.filter(
                case__in=contract.cases.all(),
            ).select_related("type").only("id", "type_name", "category")
        )

        # 构建 type_name → archive_item_code 的匹配
        code_to_material_ids: dict[str, list[int]] = {}
        matched_material_ids: set[int] = set()
        for cm in case_materials:
            matched_code = self._match_type_name_to_code(cm.type_name, keyword_map)
            if matched_code:
                code_to_material_ids.setdefault(matched_code, []).append(cm.id)
                matched_material_ids.add(cm.id)

        # 构建匹配结果
        matches: list[dict[str, Any]] = []
        for code, item in case_source_items.items():
            cm_ids = code_to_material_ids.get(code, [])
            matches.append({
                "archive_item_code": code,
                "archive_item_name": item["name"],
                "case_material_ids": cm_ids,
                "already_synced": code in existing_codes,
            })

        # 未匹配的案件材料
        unmatched = [
            {"id": cm.id, "type_name": cm.type_name, "category": cm.category}
            for cm in case_materials
            if cm.id not in matched_material_ids
        ]

        synced_count = sum(1 for m in matches if m["already_synced"])
        matchable_count = len(matched_material_ids)

        return {
            "archive_category": archive_category,
            "matches": matches,
            "unmatched_case_materials": unmatched,
            "synced_count": synced_count,
            "matchable_count": matchable_count,
        }

    def sync_case_materials_to_archive(
        self,
        contract: Contract,
        archive_item_codes: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        将案件材料同步到归档材料（FinalizedMaterial）。

        根据 CaseMaterial.type_name 关键词匹配，将案件附件文件
        复制为合同的 FinalizedMaterial 并设置 archive_item_code。

        Args:
            contract: 合同实例
            archive_item_codes: 指定只同步哪些清单项，None 表示全部

        Returns:
            {
                "synced": [{"archive_item_code": "lt_7", "material_id": 1, "filename": "..."}],
                "skipped": [{"archive_item_code": "lt_7", "reason": "已有归档材料"}],
                "errors": [{"archive_item_code": "lt_7", "error": "文件不存在"}],
            }
        """
        archive_category = get_archive_category(contract.case_type)
        keyword_map = CASE_MATERIAL_KEYWORD_MAPPING.get(archive_category, {})
        checklist_items = ARCHIVE_CHECKLIST.get(archive_category, [])
        case_source_items = {item["code"]: item for item in checklist_items if item["source"] == "case"}

        # 如果指定了 codes，则只处理这些
        if archive_item_codes is not None:
            case_source_items = {
                k: v for k, v in case_source_items.items() if k in archive_item_codes
            }

        # 查询已有的 FinalizedMaterial（避免重复同步）
        existing_codes = set(
            FinalizedMaterial.objects.filter(
                contract=contract,
                archive_item_code__in=case_source_items.keys(),
            ).values_list("archive_item_code", flat=True)
        )

        # 查询关联案件的所有 CaseMaterial
        from apps.cases.models import CaseMaterial

        case_materials = list(
            CaseMaterial.objects.filter(
                case__in=contract.cases.all(),
            ).select_related("source_attachment").only(
                "id", "type_name", "category", "source_attachment_id"
            )
        )

        # 构建 type_name → archive_item_code 的匹配
        code_to_case_materials: dict[str, list[CaseMaterial]] = {}
        for cm in case_materials:
            matched_code = self._match_type_name_to_code(cm.type_name, keyword_map)
            if matched_code and matched_code in case_source_items:
                code_to_case_materials.setdefault(matched_code, []).append(cm)

        synced: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []

        for code, item in case_source_items.items():
            if code in existing_codes:
                skipped.append({
                    "archive_item_code": code,
                    "reason": "已有归档材料",
                })
                continue

            cms = code_to_case_materials.get(code, [])
            if not cms:
                skipped.append({
                    "archive_item_code": code,
                    "reason": "案件无匹配材料",
                })
                continue

            # 为每个 CaseMaterial 创建 FinalizedMaterial
            for cm in cms:
                try:
                    material = self._copy_case_material_to_finalized(
                        contract=contract,
                        case_material=cm,
                        archive_item_code=code,
                    )
                    if material:
                        synced.append({
                            "archive_item_code": code,
                            "material_id": material.id,
                            "filename": material.original_filename,
                        })
                    else:
                        errors.append({
                            "archive_item_code": code,
                            "error": "文件不存在或无法复制",
                        })
                except Exception as e:
                    logger.exception("同步案件材料失败: code=%s, cm_id=%s", code, cm.id)
                    errors.append({
                        "archive_item_code": code,
                        "error": str(e),
                    })

        return {
            "synced": synced,
            "skipped": skipped,
            "errors": errors,
        }

    def _find_case_material_match_codes(
        self,
        contract: Contract,
        archive_category: str,
    ) -> set[str]:
        """
        查找合同关联案件中有匹配 CaseMaterial 的清单项 code 集合。

        用于前端展示"可从案件材料同步"的提示，不修改数据库。
        """
        keyword_map = CASE_MATERIAL_KEYWORD_MAPPING.get(archive_category, {})
        if not keyword_map:
            return set()

        try:
            from apps.cases.models import CaseMaterial

            type_names = list(
                CaseMaterial.objects.filter(
                    case__in=contract.cases.all(),
                ).values_list("type_name", flat=True)
            )

            matched_codes: set[str] = set()
            for type_name in type_names:
                code = self._match_type_name_to_code(type_name, keyword_map)
                if code:
                    matched_codes.add(code)
            return matched_codes
        except Exception as e:
            logger.warning("查询案件材料匹配失败: %s", e)
            return set()

    def _match_type_name_to_code(
        self,
        type_name: str,
        keyword_map: dict[str, list[str]],
    ) -> str | None:
        """
        根据 CaseMaterial.type_name 匹配 archive_item_code。

        匹配规则：遍历映射表，返回第一个 type_name 包含关键词的 code。
        映射表中 code 的顺序即为优先级。

        Args:
            type_name: CaseMaterial.type_name
            keyword_map: CASE_MATERIAL_KEYWORD_MAPPING[archive_category]

        Returns:
            匹配到的 archive_item_code，无匹配返回 None
        """
        if not type_name:
            return None
        for code, keywords in keyword_map.items():
            for keyword in keywords:
                if keyword in type_name:
                    return code
        return None

    def _copy_case_material_to_finalized(
        self,
        contract: Contract,
        case_material: Any,
        archive_item_code: str,
    ) -> FinalizedMaterial | None:
        """
        将 CaseMaterial 的附件文件复制为 FinalizedMaterial。

        Args:
            contract: 合同实例
            case_material: CaseMaterial 实例（需有 source_attachment）
            archive_item_code: 归档清单编号

        Returns:
            创建的 FinalizedMaterial 实例，失败返回 None
        """
        from pathlib import Path

        from django.conf import settings as django_settings

        attachment = case_material.source_attachment
        if not attachment:
            return None

        # 获取附件文件的绝对路径
        file_field = attachment.file
        file_path = getattr(file_field, "name", "")
        if not file_path:
            return None

        # 解析为绝对路径
        abs_path = Path(django_settings.MEDIA_ROOT) / file_path
        if not abs_path.exists():
            logger.warning("案件材料文件不存在: %s", abs_path)
            return None

        # 读取文件内容
        file_content = abs_path.read_bytes()

        # 提取原始文件名
        original_filename = Path(file_path).name

        # 使用 storage_service 保存到归档目录
        from django.core.files.base import ContentFile

        from apps.core.services import storage_service as storage

        rel_path, safe_name = storage.save_uploaded_file(
            uploaded_file=ContentFile(file_content, name=original_filename),
            rel_dir=f"contracts/finalized/{contract.id}",
            allowed_extensions=[".docx", ".pdf", ".doc", ".jpg", ".jpeg", ".png", ".xlsx", ".xls"],
            max_size_bytes=50 * 1024 * 1024,
        )

        material = FinalizedMaterial.objects.create(
            contract=contract,
            file_path=rel_path,
            original_filename=safe_name,
            category="case_material",
            archive_item_code=archive_item_code,
        )

        logger.info(
            "案件材料已同步到归档: %s → %s",
            original_filename,
            archive_item_code,
            extra={
                "contract_id": contract.id,
                "case_material_id": case_material.id,
                "material_id": material.id,
            },
        )

        return material

    def _find_code_by_source(self, archive_category: str, source: str) -> str | None:
        """根据 source 类型找到对应的检查清单 code

        名称匹配说明：
        - 非诉: "委托合同、风险告知书" → 包含"委托"
        - 诉讼: "委托合同、风险告知书" → 包含"委托"
        - 刑事: "委托代理合同、风险告知书" → 包含"委托"
        统一使用"委托"关键词匹配，兼容所有分类。
        """
        checklist_items = ARCHIVE_CHECKLIST.get(archive_category, [])
        for item in checklist_items:
            if item["source"] == source and "委托" in item["name"]:
                return item["code"]
        return None

    def _find_code_by_name(self, archive_category: str, name_keyword: str) -> str | None:
        """根据名称关键词找到对应的检查清单 code"""
        checklist_items = ARCHIVE_CHECKLIST.get(archive_category, [])
        for item in checklist_items:
            if name_keyword in item["name"]:
                return item["code"]
        return None

    def get_template_items(self, archive_category: str) -> list[ChecklistItem]:
        """获取指定归档分类中需要模板生成的清单项"""
        checklist_items = ARCHIVE_CHECKLIST.get(archive_category, [])
        return [item for item in checklist_items if item["template"] is not None]

    def get_auto_detect_items(self, archive_category: str) -> list[ChecklistItem]:
        """获取指定归档分类中支持自动检测的清单项"""
        checklist_items = ARCHIVE_CHECKLIST.get(archive_category, [])
        return [item for item in checklist_items if item["auto_detect"] is not None]
