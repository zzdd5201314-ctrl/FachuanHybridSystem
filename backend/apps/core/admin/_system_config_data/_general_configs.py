"""通用、数据库、Redis、文件存储、日志、通知等配置数据"""

from typing import Any

__all__ = ["get_general_configs"]


def get_general_configs() -> list[dict[str, Any]]:
    """获取通用配置项"""
    return [
        {
            "key": "CASE_MATERIAL_ARCHIVE_RULES_JSON",
            "category": "general",
            "description": (
                "案件材料自动归档规则(JSON)。格式示例："
                '{"semantic_rules":[{"keywords":["和解协议"],"folder_keywords":["裁判结果"],"exclude_keywords":[],"weight":260}],"keyword_rules":[]}'
            ),
            "value": '{"semantic_rules":[],"keyword_rules":[]}',
            "is_secret": False,
        }
    ]
