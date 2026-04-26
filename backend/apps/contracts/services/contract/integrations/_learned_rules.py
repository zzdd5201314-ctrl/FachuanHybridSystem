"""自动生成的归档分类学习规则。

此文件由"学习分类规则"功能自动生成，请勿手动编辑。
如需调整规则，请在 Admin 后台修改 ArchiveClassificationRule 后重新导出。

学习规则格式与 archive_classifier.py 中 _FILENAME_KEYWORD_TO_ARCHIVE_CODE 一致，
分类时优先使用学习规则，硬编码规则作为兜底。
"""
from __future__ import annotations

# 从已归档材料中学习到的文件名关键词 → archive_item_code 映射
LEARNED_FILENAME_KEYWORD_TO_ARCHIVE_CODE: dict[str, dict[str, list[str]]] = {}
