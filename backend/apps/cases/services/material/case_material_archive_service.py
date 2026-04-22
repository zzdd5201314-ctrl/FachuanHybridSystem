"""Archive uploaded case materials into the bound case folder."""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any

from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.cases.models import CaseFolderBinding, CaseLogAttachment, CaseMaterial, CaseMaterialCategory, CaseMaterialSide
from apps.cases.services.case.case_access_policy import CaseAccessPolicy
from apps.cases.services.case.case_query_service import CaseQueryService
from apps.core.filesystem import FolderFilesystemService, FolderPathValidator
from apps.core.services.system_config_service import SystemConfigService

logger = logging.getLogger("apps.cases")


class CaseMaterialArchiveService:
    CONFIG_KEY_CUSTOM_RULES = "CASE_MATERIAL_ARCHIVE_RULES_JSON"
    ROOT_DISPLAY_NAME = "案件根目录"
    MAX_DEPTH = 5
    MAX_FOLDERS = 300
    _GENERIC_FOLDER_KEYWORDS: tuple[str, ...] = ("其他", "其它", "杂项", "待整理", "临时", "misc", "other", "temp")
    _IGNORED_TOKENS: tuple[str, ...] = ("pdf", "doc", "docx", "jpg", "jpeg", "png", "zip", "rar", "7z")
    _KEYWORD_RULES: tuple[tuple[tuple[str, ...], tuple[str, ...], int], ...] = (
        (("身份证", "营业执照", "主体资格", "法定代表人", "户口簿", "护照", "结婚证", "出生证明"), ("身份证明", "主体", "身份", "证照"), 120),
        (("授权委托", "委托书", "所函", "律师证", "执业证", "介绍信", "授权书"), ("委托材料", "委托", "授权", "所函", "律师"), 120),
        (("起诉状", "答辩状", "上诉状", "申请书", "立案", "证据目录", "证据清单", "证据", "保全"), ("立案", "证据", "材料", "保全"), 100),
        (("庭审", "质证", "代理词", "答辩意见", "开庭"), ("庭审", "开庭", "质证"), 100),
        (("判决", "裁定", "调解书", "决定书", "裁判"), ("判决", "裁定", "裁判", "结果"), 110),
        (("执行", "终本", "恢复执行", "执行申请", "执行裁定"), ("执行",), 110),
    )
    _SEMANTIC_RULES: tuple[tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...], int], ...] = (
        (("身份证明", "身份证", "营业执照", "主体资格", "法定代表人身份证明", "自然人身份证明", "申请人身份证明"), ("身份证明", "身份材料", "主体资格", "主体材料", "证照", "营业执照", "法定代表人"), ("授权委托书", "委托书", "证据目录"), 220),
        (("授权委托书", "委托书", "所函", "律师证", "执业证", "介绍信", "授权书", "代理手续"), ("委托材料", "授权委托", "授权", "委托", "所函", "律师", "代理手续"), ("身份证明", "证据目录"), 220),
        (("起诉状", "诉状", "答辩状", "上诉状", "再审申请书", "立案材料", "立案", "诉前材料"), ("立案", "起诉", "诉状", "答辩", "程序材料"), ("证据目录", "执行申请书"), 200),
        (("证据目录", "证据清单", "证据明细", "证据材料", "聊天记录", "转账记录", "录音", "录像", "照片", "截图"), ("证据", "举证", "质证", "证据材料"), ("身份证明", "授权委托书"), 220),
        (("保全申请书", "财产保全", "诉前保全", "诉讼保全", "保全担保", "保函", "查封", "冻结", "扣押"), ("保全", "担保", "查封", "冻结"), ("执行申请书",), 230),
        (("传票", "开庭传票", "举证通知书", "应诉通知书", "受理通知书", "送达地址确认书", "程序性材料", "管辖异议"), ("程序", "送达", "通知", "立案", "开庭"), (), 180),
        (("代理词", "质证意见", "庭审提纲", "开庭笔录", "庭审笔录", "答辩意见", "庭审"), ("庭审", "开庭", "质证", "代理"), (), 210),
        (("判决书", "裁定书", "调解书", "决定书", "生效证明", "执行依据", "裁判文书", "生效法律文书"), ("判决", "裁定", "调解", "裁判", "结果", "执行依据", "生效"), ("执行申请书",), 230),
        (("执行申请书", "申请执行书", "强制执行申请书", "恢复执行申请书", "终本", "财产线索", "网络查控", "被执行"), ("执行", "财产线索", "查控", "终本"), (), 240),
    )

    def __init__(
        self,
        *,
        case_service: CaseQueryService | None = None,
        filesystem_service: FolderFilesystemService | None = None,
        path_validator: FolderPathValidator | None = None,
        system_config_service: SystemConfigService | None = None,
    ) -> None:
        self._case_service = case_service or CaseQueryService(access_policy=CaseAccessPolicy())
        self._filesystem_service = filesystem_service or FolderFilesystemService()
        self._path_validator = path_validator or FolderPathValidator()
        self._system_config_service = system_config_service

    @property
    def case_service(self) -> CaseQueryService:
        return self._case_service

    @property
    def filesystem_service(self) -> FolderFilesystemService:
        return self._filesystem_service

    @property
    def path_validator(self) -> FolderPathValidator:
        return self._path_validator

    @property
    def system_config_service(self) -> SystemConfigService:
        if self._system_config_service is None:
            self._system_config_service = SystemConfigService()
        return self._system_config_service

    def get_archive_config(
        self,
        *,
        case_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        self.case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)
        return self.get_archive_config_for_case(case_id=case_id)

    def get_archive_config_for_case(self, *, case_id: int) -> dict[str, Any]:
        binding = CaseFolderBinding.objects.filter(case_id=case_id).first()
        if not binding:
            return {"enabled": False, "writable": False, "root_path": "", "message": str(_("未绑定案件文件夹，当前只保存材料分类，不会自动归档。")), "folders": []}

        root = self._resolve_binding_root(binding.folder_path)
        if root is None:
            return {"enabled": False, "writable": False, "root_path": binding.folder_path or "", "message": str(_("绑定的案件文件夹暂时不可访问，无法自动归档。")), "folders": []}

        writable, writable_message = self._check_root_writable(root)
        return {"enabled": True, "writable": writable, "root_path": str(root), "message": writable_message, "folders": self._build_folder_options(root)}

    def suggest_archive(
        self,
        *,
        file_name: str,
        category: str = "",
        type_name: str = "",
        side: str | None = None,
        available_folders: list[dict[str, str]] | None = None,
    ) -> dict[str, str]:
        folders = available_folders or []
        if not folders:
            return {"relative_path": "", "reason": ""}

        normalized_name = self._normalize_text(file_name)
        normalized_type = self._normalize_text(type_name)
        best_relative_path = ""
        best_score = -1
        for folder in folders:
            relative_path = str(folder.get("relative_path") or "")
            score = self._score_folder(relative_path=relative_path, file_name=normalized_name, type_name=normalized_type, category=category, side=side)
            if score > best_score or (score == best_score and self._prefer_more_specific(relative_path, best_relative_path)):
                best_relative_path = relative_path
                best_score = score

        if best_score > 0:
            return {"relative_path": best_relative_path, "reason": self._build_suggestion_reason(relative_path=best_relative_path, file_name=normalized_name, type_name=normalized_type, category=category, side=side, used_fallback=False)}

        fallback = self._fallback_relative_path(folders=folders, category=category, side=side)
        if fallback is not None:
            return {"relative_path": fallback, "reason": self._build_suggestion_reason(relative_path=fallback, file_name=normalized_name, type_name=normalized_type, category=category, side=side, used_fallback=True)}
        return {"relative_path": "", "reason": ""}

    def suggest_archive_relative_path(
        self,
        *,
        file_name: str,
        category: str = "",
        type_name: str = "",
        side: str | None = None,
        available_folders: list[dict[str, str]] | None = None,
    ) -> str:
        return self.suggest_archive(file_name=file_name, category=category, type_name=type_name, side=side, available_folders=available_folders).get("relative_path", "")

    def archive_uploaded_attachments(
        self,
        *,
        case_id: int,
        attachments: list[CaseLogAttachment],
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        self.case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)
        archive_config = self.get_archive_config_for_case(case_id=case_id)
        if not archive_config.get("enabled") or not archive_config.get("writable"):
            return {"enabled": False, "archived_count": 0, "attachment_ids": []}

        folder_options = archive_config.get("folders") or []
        archived_ids: list[int] = []
        for attachment in attachments:
            if getattr(attachment, "source_invoice_id", None):
                continue
            archived_path = self.sync_attachment_archive(case_id=case_id, attachment=attachment, archive_relative_path=None, folder_options=folder_options)
            if archived_path:
                archived_ids.append(int(attachment.id))

        return {"enabled": True, "archived_count": len(archived_ids), "attachment_ids": archived_ids}

    def rearchive_case_attachments(
        self,
        *,
        case_id: int,
        user: Any | None = None,
        org_access: dict[str, Any] | None = None,
        perm_open_access: bool = False,
    ) -> dict[str, Any]:
        self.case_service.get_case(case_id, user=user, org_access=org_access, perm_open_access=perm_open_access)
        archive_config = self.get_archive_config_for_case(case_id=case_id)
        if not archive_config.get("enabled") or not archive_config.get("writable"):
            return {"enabled": False, "message": str(archive_config.get("message") or ""), "processed_count": 0, "archived_count": 0, "bound_count": 0, "unbound_count": 0, "skipped_count": 0}

        folder_options = archive_config.get("folders") or []
        attachments = CaseLogAttachment.objects.filter(log__case_id=case_id).select_related("log", "bound_material").order_by("uploaded_at", "id")
        processed_count = 0
        archived_count = 0
        bound_count = 0
        unbound_count = 0
        for attachment in attachments:
            if getattr(attachment, "source_invoice_id", None):
                continue
            processed_count += 1
            material = getattr(attachment, "bound_material", None)
            if material is not None:
                bound_count += 1
                saved_path = self.sync_material_archive(case_id=case_id, material=material, archive_relative_path=(material.archive_relative_path or None), folder_options=folder_options, force=True)
            else:
                unbound_count += 1
                saved_path = self.sync_attachment_archive(case_id=case_id, attachment=attachment, archive_relative_path=(attachment.archive_relative_path or None), folder_options=folder_options, force=True)
            if saved_path:
                archived_count += 1

        return {"enabled": True, "message": "", "processed_count": processed_count, "archived_count": archived_count, "bound_count": bound_count, "unbound_count": unbound_count, "skipped_count": max(processed_count - archived_count, 0)}

    def sync_attachment_archive(
        self,
        *,
        case_id: int,
        attachment: CaseLogAttachment,
        archive_relative_path: str | None,
        folder_options: list[dict[str, str]] | None = None,
        force: bool = False,
        category: str = "",
        type_name: str = "",
        side: str | None = None,
    ) -> str | None:
        if getattr(attachment, "source_invoice_id", None):
            return None

        binding = CaseFolderBinding.objects.filter(case_id=case_id).first()
        if not binding:
            return None

        root = self._resolve_binding_root(binding.folder_path)
        if root is None:
            return None

        writable, _message = self._check_root_writable(root)
        if not writable:
            return None

        attachment_file = getattr(attachment, "file", None)
        if not attachment_file:
            return None

        target_relative_path = archive_relative_path
        if target_relative_path is None:
            target_relative_path = self.suggest_archive(file_name=self._attachment_file_name(attachment_file), category=category, type_name=type_name, side=side, available_folders=folder_options or self._build_folder_options(root)).get("relative_path", "")
        normalized_relative_path = self._normalize_relative_path(target_relative_path)

        current_archived_path = str(getattr(attachment, "archived_file_path", "") or "").strip()
        current_relative_path = str(getattr(attachment, "archive_relative_path", "") or "")
        if not force and current_archived_path and current_relative_path == normalized_relative_path and self._file_exists(current_archived_path):
            return current_archived_path

        overwrite_path = None
        if force and current_archived_path and current_relative_path == normalized_relative_path:
            try:
                overwrite_candidate = Path(current_archived_path).expanduser().resolve()
            except (OSError, RuntimeError):
                overwrite_candidate = None
            if overwrite_candidate is not None and self._is_within_root(root, overwrite_candidate):
                overwrite_path = str(overwrite_candidate)

        with attachment_file.open("rb") as fh:
            saved_path = self.filesystem_service.save_fileobj(
                base_path=str(root),
                relative_dir_parts=self._relative_dir_parts(normalized_relative_path),
                file_name=self._attachment_file_name(attachment_file),
                file_obj=fh,
                overwrite_path=overwrite_path,
            )

        self._cleanup_previous_archived_file(root=root, previous_path=current_archived_path, new_path=str(saved_path))
        attachment.archive_relative_path = normalized_relative_path
        attachment.archived_file_path = str(saved_path)
        attachment.archived_at = timezone.now()
        attachment.save(update_fields=["archive_relative_path", "archived_file_path", "archived_at"])
        return str(saved_path)

    def cleanup_attachment_archive(self, *, attachment: CaseLogAttachment, save: bool = False) -> None:
        if getattr(attachment, "source_invoice_id", None):
            return

        archived_path = str(getattr(attachment, "archived_file_path", "") or "").strip()
        if archived_path:
            try:
                archived_file = Path(archived_path).expanduser().resolve()
            except (OSError, RuntimeError):
                archived_file = None
            if archived_file and archived_file.exists() and archived_file.is_file():
                try:
                    archived_file.unlink()
                except OSError:
                    logger.warning("case_material_attachment_archive_cleanup_failed", extra={"path": archived_path})

        if save and getattr(attachment, "pk", None):
            attachment.archive_relative_path = ""
            attachment.archived_file_path = ""
            attachment.archived_at = None
            attachment.save(update_fields=["archive_relative_path", "archived_file_path", "archived_at"])

    def sync_material_archive(
        self,
        *,
        case_id: int,
        material: CaseMaterial,
        archive_relative_path: str | None,
        folder_options: list[dict[str, str]] | None = None,
        force: bool = False,
    ) -> str | None:
        attachment = material.source_attachment
        if not attachment:
            return None

        previous_material_path = str(material.archived_file_path or "").strip()
        saved_path = self.sync_attachment_archive(case_id=case_id, attachment=attachment, archive_relative_path=archive_relative_path, folder_options=folder_options, force=force, category=material.category, type_name=material.type_name, side=material.side)
        if not saved_path:
            return None

        binding = CaseFolderBinding.objects.filter(case_id=case_id).first()
        root = self._resolve_binding_root(binding.folder_path) if binding else None
        if root is not None:
            self._cleanup_previous_archived_file(root=root, previous_path=previous_material_path, new_path=str(saved_path))

        material.archive_relative_path = str(attachment.archive_relative_path or "")
        material.archived_file_path = str(attachment.archived_file_path or "")
        material.archived_at = attachment.archived_at
        material.save(update_fields=["archive_relative_path", "archived_file_path", "archived_at"])
        return str(saved_path)

    def _build_folder_options(self, root: Path) -> list[dict[str, str]]:
        options: list[dict[str, str]] = [{"relative_path": "", "display_name": self.ROOT_DISPLAY_NAME}]
        count = 1
        for current_root, dir_names, _file_names in os.walk(root):
            current_path = Path(current_root)
            dir_names[:] = sorted([name for name in dir_names if not name.startswith(".")], key=str.lower)
            try:
                relative_parts = current_path.relative_to(root).parts
            except ValueError:
                continue

            depth = len(relative_parts)
            if depth > 0:
                options.append({"relative_path": "/".join(relative_parts), "display_name": " / ".join(relative_parts)})
                count += 1
                if count >= self.MAX_FOLDERS:
                    break
            if depth >= self.MAX_DEPTH:
                dir_names[:] = []
        return options

    def _score_folder(self, *, relative_path: str, file_name: str, type_name: str, category: str, side: str | None) -> int:
        normalized_path = self._normalize_text(relative_path)
        if not normalized_path:
            return 1

        score = 0
        segments = [self._normalize_text(part) for part in relative_path.split("/") if part]
        folder_tail = segments[-1] if segments else normalized_path
        combined_text = " ".join(part for part in (file_name, type_name) if part)
        meaningful_tokens = self._meaningful_tokens(combined_text)

        if type_name:
            if type_name in normalized_path:
                score += 180
            for token in self._split_tokens(type_name):
                if len(token) >= 2 and token in normalized_path:
                    score += 35

        for file_keywords, folder_keywords, exclude_keywords, weight, _source in self._semantic_rule_entries():
            if not self._contains_any(combined_text, file_keywords):
                continue
            if exclude_keywords and self._contains_any(combined_text, exclude_keywords):
                continue
            if self._contains_any(normalized_path, folder_keywords):
                score += weight
                if self._contains_any(folder_tail, folder_keywords):
                    score += 50

        for file_keywords, folder_keywords, weight, _source in self._keyword_rule_entries():
            if (self._contains_any(file_name, file_keywords) or self._contains_any(type_name, file_keywords)) and self._contains_any(normalized_path, folder_keywords):
                score += weight

        if folder_tail and folder_tail in file_name:
            score += 40
        for token in segments:
            if len(token) >= 2 and token in file_name:
                score += 12
        for token in meaningful_tokens:
            if token == folder_tail:
                score += 55
            elif token in normalized_path:
                score += 10

        if category == CaseMaterialCategory.PARTY:
            if self._contains_any(normalized_path, ("当事人", "材料", "身份证明", "委托")):
                score += 12
            if side == CaseMaterialSide.OUR and self._contains_any(normalized_path, ("我方", "原告", "申请人")):
                score += 18
            if side == CaseMaterialSide.OPPONENT and self._contains_any(normalized_path, ("对方", "被告", "被申请人", "被上诉人", "被执行人")):
                score += 18

        if category == CaseMaterialCategory.NON_PARTY and self._contains_any(normalized_path, ("法院", "法庭", "仲裁", "机关", "庭审", "证据", "材料", "保全")):
            score += 14

        if self._contains_any(normalized_path, self._GENERIC_FOLDER_KEYWORDS):
            score -= 25

        score += min(len(segments), 6)
        return score

    def _fallback_relative_path(self, *, folders: list[dict[str, str]], category: str, side: str | None) -> str | None:
        folder_paths = [str(folder.get("relative_path") or "") for folder in folders]
        preferred_groups: list[tuple[str, ...]] = []
        if category == CaseMaterialCategory.PARTY:
            if side == CaseMaterialSide.OUR:
                preferred_groups.append(("我方", "原告", "申请人"))
            elif side == CaseMaterialSide.OPPONENT:
                preferred_groups.append(("对方", "被告", "被申请人", "被上诉人", "被执行人"))
            preferred_groups.extend([("当事人", "身份证明", "委托材料", "材料"), ("其他",)])
        elif category == CaseMaterialCategory.NON_PARTY:
            preferred_groups.extend([("法院", "法庭", "仲裁", "机关"), ("证据", "庭审", "材料"), ("其他",)])

        for keywords in preferred_groups:
            matched = self._find_folder_by_keywords(folder_paths, keywords)
            if matched is not None:
                return matched
        return ""

    def _find_folder_by_keywords(self, folder_paths: list[str], keywords: tuple[str, ...]) -> str | None:
        for folder_path in folder_paths:
            if self._contains_any(self._normalize_text(folder_path), keywords):
                return folder_path
        return None

    @staticmethod
    def _resolve_binding_root(folder_path: str) -> Path | None:
        raw = str(folder_path or "").strip()
        if not raw:
            return None
        try:
            resolved = Path(raw).expanduser().resolve()
        except (OSError, RuntimeError):
            return None
        if not resolved.exists() or not resolved.is_dir():
            return None
        return resolved

    def _check_root_writable(self, root: Path) -> tuple[bool, str]:
        probe = root / f".fachuan_archive_probe_{uuid.uuid4().hex}"
        try:
            with open(str(probe), "wb") as fh:
                fh.write(b"")
            probe.unlink(missing_ok=True)
            return True, ""
        except OSError:
            try:
                if probe.exists():
                    probe.unlink()
            except OSError:
                pass
            return False, str(_("绑定目录当前可读但不可写，无法自动归档。"))

    def _cleanup_previous_archived_file(self, *, root: Path, previous_path: str, new_path: str) -> None:
        if not previous_path or previous_path == new_path:
            return
        try:
            old_file = Path(previous_path).expanduser().resolve()
        except (OSError, RuntimeError):
            return
        if not old_file.exists() or not old_file.is_file():
            return
        if not self._is_within_root(root, old_file):
            return
        try:
            old_file.unlink()
        except OSError:
            logger.warning("case_material_archive_cleanup_failed", extra={"path": previous_path})

    def _normalize_relative_path(self, relative_path: str | None) -> str:
        raw = str(relative_path or "").strip()
        if not raw:
            return ""
        return self.path_validator.normalize_relative_path(raw)

    def _relative_dir_parts(self, relative_path: str) -> list[str]:
        if not relative_path:
            return []
        return self.path_validator.normalize_relative_path(relative_path).split("/")

    def _attachment_file_name(self, attachment_file: Any) -> str:
        original_name = str(getattr(attachment_file, "name", "") or "")
        original_name = original_name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        return self.path_validator.sanitize_file_name(original_name or "attachment")

    @staticmethod
    def _normalize_text(value: str | None) -> str:
        return str(value or "").strip().lower()

    @staticmethod
    def _split_tokens(value: str) -> list[str]:
        return [token for token in re.split(r"[\s_\-./\\()\[\]{}（）【】]+", value) if token]

    def _meaningful_tokens(self, value: str) -> list[str]:
        tokens: list[str] = []
        for token in self._split_tokens(value):
            normalized = self._normalize_text(token)
            if len(normalized) < 2 or normalized.isdigit() or normalized in self._IGNORED_TOKENS:
                continue
            tokens.append(normalized)
        return tokens

    @staticmethod
    def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
        lowered = text.lower()
        return any(keyword.lower() in lowered for keyword in keywords)

    @staticmethod
    def _prefer_more_specific(candidate: str, current: str) -> bool:
        candidate_depth = len([part for part in str(candidate or "").split("/") if part])
        current_depth = len([part for part in str(current or "").split("/") if part])
        if candidate_depth != current_depth:
            return candidate_depth > current_depth
        return len(candidate) > len(current)

    @staticmethod
    def _file_exists(path: str) -> bool:
        try:
            return Path(path).exists()
        except OSError:
            return False

    @staticmethod
    def _is_within_root(root: Path, target: Path) -> bool:
        try:
            return os.path.commonpath([str(root), str(target)]) == str(root)
        except ValueError:
            return False

    def _semantic_rule_entries(self) -> list[tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...], int, str]]:
        entries: list[tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...], int, str]] = []
        configured = self._load_custom_rule_entries().get("semantic_rules", [])
        entries.extend([(tuple(item["keywords"]), tuple(item["folder_keywords"]), tuple(item["exclude_keywords"]), int(item["weight"]), "configured") for item in configured])
        entries.extend([(*rule, "builtin") for rule in self._SEMANTIC_RULES])
        return entries

    def _keyword_rule_entries(self) -> list[tuple[tuple[str, ...], tuple[str, ...], int, str]]:
        entries: list[tuple[tuple[str, ...], tuple[str, ...], int, str]] = []
        configured = self._load_custom_rule_entries().get("keyword_rules", [])
        entries.extend([(tuple(item["keywords"]), tuple(item["folder_keywords"]), int(item["weight"]), "configured") for item in configured])
        entries.extend([(*rule, "builtin") for rule in self._KEYWORD_RULES])
        return entries

    def _load_custom_rule_entries(self) -> dict[str, list[dict[str, Any]]]:
        try:
            raw = self.system_config_service.get_value(self.CONFIG_KEY_CUSTOM_RULES, "")
        except Exception:
            logger.warning("case_material_archive_rules_unavailable", extra={"key": self.CONFIG_KEY_CUSTOM_RULES})
            return {"semantic_rules": [], "keyword_rules": []}
        if not raw.strip():
            return {"semantic_rules": [], "keyword_rules": []}
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("case_material_archive_rules_parse_failed", extra={"key": self.CONFIG_KEY_CUSTOM_RULES})
            return {"semantic_rules": [], "keyword_rules": []}
        if isinstance(parsed, list):
            parsed = {"semantic_rules": parsed, "keyword_rules": []}
        if not isinstance(parsed, dict):
            return {"semantic_rules": [], "keyword_rules": []}
        return {"semantic_rules": self._normalize_rule_items(parsed.get("semantic_rules"), needs_exclude=True), "keyword_rules": self._normalize_rule_items(parsed.get("keyword_rules"), needs_exclude=False)}

    def _normalize_rule_items(self, raw_items: Any, *, needs_exclude: bool) -> list[dict[str, Any]]:
        if not isinstance(raw_items, list):
            return []
        normalized: list[dict[str, Any]] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            keywords = self._normalize_rule_strings(item.get("keywords"))
            folder_keywords = self._normalize_rule_strings(item.get("folder_keywords"))
            if not keywords or not folder_keywords:
                continue
            exclude_keywords = self._normalize_rule_strings(item.get("exclude_keywords")) if needs_exclude else []
            try:
                weight = int(item.get("weight", 240 if needs_exclude else 120))
            except (TypeError, ValueError):
                weight = 240 if needs_exclude else 120
            normalized.append({"keywords": keywords, "folder_keywords": folder_keywords, "exclude_keywords": exclude_keywords, "weight": max(1, min(weight, 500))})
        return normalized

    @staticmethod
    def _normalize_rule_strings(raw: Any) -> list[str]:
        if not isinstance(raw, list):
            return []
        return [str(item or "").strip() for item in raw if str(item or "").strip()]

    def _build_suggestion_reason(self, *, relative_path: str, file_name: str, type_name: str, category: str, side: str | None, used_fallback: bool) -> str:
        if not relative_path:
            return ""

        normalized_path = self._normalize_text(relative_path)
        display_name = relative_path or self.ROOT_DISPLAY_NAME
        combined_text = " ".join(part for part in (file_name, type_name) if part)
        if type_name and type_name in normalized_path:
            return f"根据材料类型“{type_name}”优先匹配到“{display_name}”。"

        for file_keywords, folder_keywords, exclude_keywords, _weight, source in self._semantic_rule_entries():
            if not self._contains_any(combined_text, file_keywords):
                continue
            if exclude_keywords and self._contains_any(combined_text, exclude_keywords):
                continue
            if not self._contains_any(normalized_path, folder_keywords):
                continue
            keyword = self._first_matching_keyword(combined_text, file_keywords)
            folder_keyword = self._first_matching_keyword(normalized_path, folder_keywords)
            prefix = "命中自定义归档规则" if source == "configured" else "命中文件语义规则"
            if keyword and folder_keyword:
                return f"{prefix}“{keyword}”，并匹配目录关键词“{folder_keyword}”，推荐归档到“{display_name}”。"
            return f"{prefix}，推荐归档到“{display_name}”。"

        for file_keywords, folder_keywords, _weight, source in self._keyword_rule_entries():
            if not (self._contains_any(file_name, file_keywords) or self._contains_any(type_name, file_keywords)):
                continue
            if not self._contains_any(normalized_path, folder_keywords):
                continue
            keyword = self._first_matching_keyword(f"{file_name} {type_name}", file_keywords)
            folder_keyword = self._first_matching_keyword(normalized_path, folder_keywords)
            prefix = "命中自定义关键词规则" if source == "configured" else "命中文件名关键词"
            if keyword and folder_keyword:
                return f"{prefix}“{keyword}”，并匹配目录关键词“{folder_keyword}”，推荐归档到“{display_name}”。"
            return f"{prefix}，推荐归档到“{display_name}”。"

        if category == CaseMaterialCategory.PARTY and side == CaseMaterialSide.OUR and self._contains_any(
            normalized_path, ("我方", "原告", "申请人")
        ):
            return f"结合我方当事人材料的归档方向，优先推荐到“{display_name}”。"

        if category == CaseMaterialCategory.PARTY and side == CaseMaterialSide.OPPONENT and self._contains_any(
            normalized_path, ("对方", "被告", "被申请人", "被上诉人", "被执行人")
        ):
            return f"结合对方当事人材料的归档方向，优先推荐到“{display_name}”。"

        if category == CaseMaterialCategory.NON_PARTY and self._contains_any(
            normalized_path, ("法院", "法庭", "仲裁", "机关", "材料")
        ):
            return f"结合非当事人材料的归档方向，优先推荐到“{display_name}”。"

        for token in self._meaningful_tokens(combined_text):
            if token in normalized_path:
                return f"文件名与目录共同包含“{token}”，推荐归档到“{display_name}”。"

        if used_fallback:
            if category == CaseMaterialCategory.PARTY and side == CaseMaterialSide.OUR:
                return f"未命中更具体规则，按我方材料兜底归档到“{display_name}”。"
            if category == CaseMaterialCategory.PARTY and side == CaseMaterialSide.OPPONENT:
                return f"未命中更具体规则，按对方材料兜底归档到“{display_name}”。"
            if category == CaseMaterialCategory.NON_PARTY:
                return f"未命中更具体规则，按非当事人材料兜底归档到“{display_name}”。"
            return f"未命中更具体规则，先推荐到“{display_name}”。"

        return f"系统根据文件名和目录结构推荐归档到“{display_name}”。"

    @staticmethod
    def _first_matching_keyword(text: str, keywords: tuple[str, ...]) -> str:
        lowered = text.lower()
        for keyword in keywords:
            if keyword.lower() in lowered:
                return keyword
        return ""
