"""工作台 Django Admin 配置"""

from __future__ import annotations

from django.contrib import admin

from ..models import WorkbenchMessage, WorkbenchSession


@admin.register(WorkbenchSession)
class WorkbenchSessionAdmin(admin.ModelAdmin):
    list_display = ["session_id", "title", "user", "llm_model", "status", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["title", "session_id"]
    readonly_fields = ["session_id", "created_at", "updated_at"]
    raw_id_fields = ["user"]


@admin.register(WorkbenchMessage)
class WorkbenchMessageAdmin(admin.ModelAdmin):
    list_display = ["id", "session", "role", "tool_name", "created_at"]
    list_filter = ["role", "created_at"]
    search_fields = ["content", "tool_name"]
    readonly_fields = ["created_at"]
    raw_id_fields = ["session"]
