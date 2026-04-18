"""Unit tests for case-log admin reminder helpers."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.urls import reverse
from django.utils import timezone

from apps.cases.admin.caselog_admin import MANAGED_REMINDER_SOURCE, _sync_managed_log_reminder
from apps.reminders.admin.reminder_admin import _get_calendar_event_destination
from apps.reminders.models import ReminderType


def test_sync_managed_log_reminder_creates_managed_reminder() -> None:
    log = SimpleNamespace(pk=18, content="准备起诉材料")
    service = Mock()
    user = SimpleNamespace(id=9)
    reminder_time = timezone.now()

    with patch("apps.cases.admin.caselog_admin._get_managed_log_reminders", return_value=[]):
        _sync_managed_log_reminder(
            log=log,
            enable_reminder=True,
            reminder_time=reminder_time,
            reminder_type=ReminderType.OTHER,
            reminder_content="",
            user=user,
            reminder_service=service,
        )

    service.create_reminder.assert_called_once()
    kwargs = service.create_reminder.call_args.kwargs
    assert kwargs["case_log_id"] == 18
    assert kwargs["reminder_type"] == ReminderType.OTHER
    assert kwargs["content"] == "准备起诉材料"
    assert kwargs["metadata"]["source"] == MANAGED_REMINDER_SOURCE
    assert kwargs["metadata"]["created_by_user_id"] == 9


def test_sync_managed_log_reminder_updates_primary_and_cleans_duplicates() -> None:
    log = SimpleNamespace(pk=26, content="收到立案通知")
    primary = SimpleNamespace(pk=5, metadata={"source": MANAGED_REMINDER_SOURCE, "created_by_user_id": 3})
    duplicate = SimpleNamespace(pk=6, metadata={"source": MANAGED_REMINDER_SOURCE})
    service = Mock()
    reminder_time = timezone.now()

    with patch("apps.cases.admin.caselog_admin._get_managed_log_reminders", return_value=[primary, duplicate]):
        _sync_managed_log_reminder(
            log=log,
            enable_reminder=True,
            reminder_time=reminder_time,
            reminder_type=ReminderType.HEARING,
            reminder_content="开庭前一天提醒",
            user=SimpleNamespace(id=12),
            reminder_service=service,
        )

    service.update_reminder.assert_called_once()
    update_args = service.update_reminder.call_args.args
    update_kwargs = service.update_reminder.call_args.args[1]
    assert update_args[0] == 5
    assert update_kwargs["reminder_type"] == ReminderType.HEARING
    assert update_kwargs["content"] == "开庭前一天提醒"
    assert update_kwargs["metadata"]["source"] == MANAGED_REMINDER_SOURCE
    service.delete_reminder.assert_called_once_with(6)


def test_sync_managed_log_reminder_deletes_managed_reminders_when_disabled() -> None:
    log = SimpleNamespace(pk=31, content="补充证据材料")
    existing = [
        SimpleNamespace(pk=8, metadata={"source": MANAGED_REMINDER_SOURCE}),
        SimpleNamespace(pk=9, metadata={"source": MANAGED_REMINDER_SOURCE}),
    ]
    service = Mock()

    with patch("apps.cases.admin.caselog_admin._get_managed_log_reminders", return_value=existing):
        result = _sync_managed_log_reminder(
            log=log,
            enable_reminder=False,
            reminder_time=None,
            reminder_type=ReminderType.OTHER,
            reminder_content="",
            user=None,
            reminder_service=service,
        )

    assert result is None
    assert service.delete_reminder.call_count == 2
    service.delete_reminder.assert_any_call(8)
    service.delete_reminder.assert_any_call(9)


def test_case_log_calendar_event_destination_points_to_log_edit_page() -> None:
    reminder = SimpleNamespace(case_log_id=11, case_log=SimpleNamespace(case_id=7))

    url, label = _get_calendar_event_destination(reminder, fallback_url="/fallback/")

    assert url == reverse("admin:cases_caselog_edit", args=[7, 11])
    assert "日志" in label


def test_non_log_calendar_event_destination_keeps_fallback_url() -> None:
    reminder = SimpleNamespace(case_log_id=None, case_log=None)

    url, label = _get_calendar_event_destination(reminder, fallback_url="/fallback/")

    assert url == "/fallback/"
    assert label
