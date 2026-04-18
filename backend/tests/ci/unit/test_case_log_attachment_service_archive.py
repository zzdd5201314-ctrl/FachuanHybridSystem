"""Unit tests for automatic case-log attachment archiving."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock, patch

from apps.cases.services.log.case_log_attachment_service import CaseLogAttachmentService


def test_upload_attachments_triggers_auto_archive_after_creation() -> None:
    query_service = Mock()
    log = SimpleNamespace(id=18, case_id=7, case=SimpleNamespace(id=7))
    query_service.get_log_internal.return_value = log
    archive_service = Mock()
    service = CaseLogAttachmentService(query_service=query_service, archive_service=archive_service)
    service._validate_attachment = Mock()
    user = SimpleNamespace(id=9)

    file_one = Mock(name="证据目录.pdf", size=1024)
    file_two = Mock(name="判决书.pdf", size=2048)
    created_one = Mock(id=101)
    created_two = Mock(id=102)

    with patch("apps.cases.services.log.case_log_attachment_service.CaseLogAttachment.objects.create") as create_attachment:
        create_attachment.side_effect = [created_one, created_two]
        result = service.upload_attachments(
            log_id=18,
            files=[file_one, file_two],
            user=user,
            perm_open_access=True,
        )

    assert result == [created_one, created_two]
    assert create_attachment.call_count == 2
    archive_service.archive_uploaded_attachments.assert_called_once_with(
        case_id=7,
        attachments=[created_one, created_two],
        user=user,
        org_access=None,
        perm_open_access=True,
    )


def test_upload_attachments_returns_created_files_even_when_auto_archive_fails() -> None:
    query_service = Mock()
    log = SimpleNamespace(id=21, case_id=11, case=SimpleNamespace(id=11))
    query_service.get_log_internal.return_value = log
    archive_service = Mock()
    archive_service.archive_uploaded_attachments.side_effect = RuntimeError("archive failed")
    service = CaseLogAttachmentService(query_service=query_service, archive_service=archive_service)
    service._validate_attachment = Mock()
    user = SimpleNamespace(id=5)

    upload = Mock(name="开庭笔录.pdf", size=4096)
    created = Mock(id=301)

    with patch("apps.cases.services.log.case_log_attachment_service.CaseLogAttachment.objects.create", return_value=created):
        result = service.upload_attachments(
            log_id=21,
            files=[upload],
            user=user,
            perm_open_access=True,
        )

    assert result == [created]
    archive_service.archive_uploaded_attachments.assert_called_once()
