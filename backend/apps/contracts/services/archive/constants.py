"""归档检查清单常量定义

三种归档分类对应的检查清单项：
- non_litigation: 法律顾问及非诉事务 (12项)
- litigation: 诉讼/仲裁 (20项)
- criminal: 刑事案件 (18项)

序号由前端 CSS counter 自动生成，code 字段仅作为唯一标识符。
"""

from __future__ import annotations

from typing import TypedDict


class ChecklistItem(TypedDict):
    """检查清单项"""

    code: str  # 唯一标识符，如 "nl_1", "lt_1", "cr_1"
    name: str  # 名称
    template: str | None  # 对应的 DocumentArchiveSubType 值，None 表示非模板生成
    required: bool  # 是否必需
    auto_detect: str | None  # 自动检测类型，如 "supervision_card"
    source: str  # 材料来源: "template" | "contract" | "case" | "manual"


# ============================================================
# 法律顾问及非诉事务
# ============================================================
NON_LITIGATION_CHECKLIST: list[ChecklistItem] = [
    {"code": "nl_1", "name": "案卷封面", "template": "case_cover", "required": True, "auto_detect": None, "source": "template"},
    {"code": "nl_2", "name": "结案归档登记表", "template": "closing_archive_register", "required": True, "auto_detect": None, "source": "template"},
    {"code": "nl_3", "name": "案卷目录", "template": "inner_catalog", "required": True, "auto_detect": None, "source": "template"},
    {"code": "nl_4", "name": "委托合同、风险告知书", "template": None, "required": True, "auto_detect": None, "source": "contract"},
    {"code": "nl_12", "name": "授权委托证明材料", "template": None, "required": True, "auto_detect": None, "source": "case"},
    {"code": "nl_5", "name": "收费凭证", "template": None, "required": False, "auto_detect": None, "source": "contract"},
    {"code": "nl_6", "name": "律师办案工作日记", "template": "lawyer_work_log", "required": True, "auto_detect": None, "source": "template"},
    {"code": "nl_7", "name": "委托人提供的案件材料", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "nl_8", "name": "法律意见书、律师函等", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "nl_9", "name": "案件其它关联材料", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "nl_10", "name": "办案质量监督卡", "template": None, "required": True, "auto_detect": "supervision_card", "source": "manual"},
    {"code": "nl_11", "name": "办案小结", "template": "case_summary", "required": True, "auto_detect": None, "source": "template"},
]

# ============================================================
# 诉讼/仲裁
# ============================================================
LITIGATION_CHECKLIST: list[ChecklistItem] = [
    {"code": "lt_1", "name": "案卷封面", "template": "case_cover", "required": True, "auto_detect": None, "source": "template"},
    {"code": "lt_2", "name": "结案归档登记表", "template": "closing_archive_register", "required": True, "auto_detect": None, "source": "template"},
    {"code": "lt_3", "name": "案卷目录", "template": "inner_catalog", "required": True, "auto_detect": None, "source": "template"},
    {"code": "lt_4", "name": "委托合同、风险告知书", "template": None, "required": True, "auto_detect": None, "source": "contract"},
    {"code": "lt_20", "name": "授权委托证明材料", "template": None, "required": True, "auto_detect": None, "source": "case"},
    {"code": "lt_5", "name": "收费凭证", "template": None, "required": False, "auto_detect": None, "source": "contract"},
    {"code": "lt_6", "name": "律师办案工作日记", "template": "lawyer_work_log", "required": True, "auto_detect": None, "source": "template"},
    {"code": "lt_7", "name": "起诉书、上诉书或答辩书", "template": None, "required": True, "auto_detect": None, "source": "case"},
    {"code": "lt_8", "name": "阅卷笔录", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "lt_9", "name": "会见当事人谈话笔录", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "lt_10", "name": "调查材料等案件关联材料", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "lt_11", "name": "诉讼保全申请书、证据保全申请书、先行给付申请书和法院裁定书", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "lt_12", "name": "承办律师代理意见", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "lt_13", "name": "集体讨论记录", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "lt_14", "name": "出庭通知书", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "lt_15", "name": "代理词", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "lt_16", "name": "庭审笔录", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "lt_17", "name": "判决书、裁定书、调解书、上诉书", "template": None, "required": True, "auto_detect": None, "source": "case"},
    {"code": "lt_18", "name": "办案服务质量监督卡", "template": None, "required": True, "auto_detect": "supervision_card", "source": "manual"},
    {"code": "lt_19", "name": "办案小结", "template": "case_summary", "required": True, "auto_detect": None, "source": "template"},
]

# ============================================================
# 刑事案件
# ============================================================
CRIMINAL_CHECKLIST: list[ChecklistItem] = [
    {"code": "cr_1", "name": "案卷封面", "template": "case_cover", "required": True, "auto_detect": None, "source": "template"},
    {"code": "cr_2", "name": "结案归档登记表", "template": "closing_archive_register", "required": True, "auto_detect": None, "source": "template"},
    {"code": "cr_3", "name": "案卷目录", "template": "inner_catalog", "required": True, "auto_detect": None, "source": "template"},
    {"code": "cr_4", "name": "委托代理合同、风险告知书", "template": None, "required": True, "auto_detect": None, "source": "contract"},
    {"code": "cr_18", "name": "授权委托证明材料", "template": None, "required": True, "auto_detect": None, "source": "case"},
    {"code": "cr_5", "name": "收费凭证", "template": None, "required": False, "auto_detect": None, "source": "contract"},
    {"code": "cr_6", "name": "律师办案工作日记", "template": "lawyer_work_log", "required": True, "auto_detect": None, "source": "template"},
    {"code": "cr_7", "name": "会见被告人、委托人、证人笔录", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "cr_8", "name": "调查材料等案件关联材料", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "cr_9", "name": "承办人提出的辩护或代理意见", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "cr_10", "name": "集体讨论记录", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "cr_11", "name": "起诉书、上诉书", "template": None, "required": True, "auto_detect": None, "source": "case"},
    {"code": "cr_12", "name": "辩护词或代理词", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "cr_13", "name": "出庭通知书", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "cr_14", "name": "裁定书、判决书", "template": None, "required": True, "auto_detect": None, "source": "case"},
    {"code": "cr_15", "name": "上诉书、抗诉书", "template": None, "required": False, "auto_detect": None, "source": "case"},
    {"code": "cr_16", "name": "办案服务质量监督卡", "template": None, "required": True, "auto_detect": "supervision_card", "source": "manual"},
    {"code": "cr_17", "name": "办案小结", "template": "case_summary", "required": True, "auto_detect": None, "source": "template"},
]

# 按归档分类组织的完整检查清单
ARCHIVE_CHECKLIST: dict[str, list[ChecklistItem]] = {
    "non_litigation": NON_LITIGATION_CHECKLIST,
    "litigation": LITIGATION_CHECKLIST,
    "criminal": CRIMINAL_CHECKLIST,
}


# ============================================================
# CaseMaterial.type_name 关键词 → archive_item_code 映射
# ============================================================
# 用于将案件材料自动匹配到归档检查清单项。
# key: CaseMaterial.type_name 中需包含的关键词（模糊匹配）
# value: 对应的 archive_item_code
#
# 匹配规则：对每个归档分类，遍历 source="case" 的清单项，
# 将该清单项的 archive_item_code 与下方映射表中的关键词匹配。
# 如果 CaseMaterial.type_name 包含映射表中的任一关键词，则自动关联。
#
# 映射表按归档分类组织，同一分类内优先匹配更具体的关键词（列表靠前的优先）。
CASE_MATERIAL_KEYWORD_MAPPING: dict[str, dict[str, list[str]]] = {
    # key: archive_item_code, value: type_name 中需包含的关键词列表
    "non_litigation": {
        "nl_12": ["授权", "委托书"],
        "nl_7": ["委托人提供", "当事人提供", "我方材料"],
        "nl_8": ["法律意见书", "律师函"],
        "nl_9": ["其他", "其它", "关联材料"],
    },
    "litigation": {
        "lt_20": ["授权", "委托书"],
        "lt_7": ["起诉书", "起诉状", "上诉书", "上诉状", "答辩书", "答辩状"],
        "lt_8": ["阅卷"],
        "lt_9": ["会见", "谈话笔录", "询问笔录"],
        "lt_10": ["调查", "取证"],
        "lt_11": ["保全", "先行给付"],
        "lt_12": ["代理意见", "律师意见"],
        "lt_13": ["集体讨论", "讨论记录"],
        "lt_14": ["出庭通知", "开庭通知"],
        "lt_15": ["代理词"],
        "lt_16": ["庭审笔录", "开庭笔录", "审理笔录"],
        "lt_17": ["判决书", "裁定书", "调解书", "判决", "裁定", "调解"],
    },
    "criminal": {
        "cr_18": ["授权", "委托书"],
        "cr_7": ["会见", "谈话笔录", "询问笔录"],
        "cr_8": ["调查", "取证"],
        "cr_9": ["辩护意见", "代理意见"],
        "cr_10": ["集体讨论", "讨论记录"],
        "cr_11": ["起诉书", "起诉状", "上诉书", "上诉状"],
        "cr_12": ["辩护词", "代理词"],
        "cr_13": ["出庭通知", "开庭通知"],
        "cr_14": ["裁定书", "判决书", "判决", "裁定"],
        "cr_15": ["上诉书", "抗诉书"],
    },
}
