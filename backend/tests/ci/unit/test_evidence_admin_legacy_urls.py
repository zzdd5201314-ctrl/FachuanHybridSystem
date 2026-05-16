from __future__ import annotations

from django.urls import reverse


def test_legacy_documents_evidence_list_admin_urls_are_registered() -> None:
    assert reverse("admin:documents_evidencelist_add").endswith("/admin/documents/evidencelist/add/")
    assert reverse("admin:documents_evidencelist_changelist").endswith("/admin/documents/evidencelist/")
    assert reverse("admin:documents_evidencelist_change", args=[7]).endswith(
        "/admin/documents/evidencelist/7/change/"
    )


def test_case_detail_evidence_action_admin_urls_are_registered() -> None:
    assert reverse("admin:documents_evidencelist_merge", args=[7]).endswith(
        "/admin/documents/evidencelist/7/merge/"
    )
    assert reverse("admin:documents_evidencelist_export_list", args=[7]).endswith(
        "/admin/documents/evidencelist/7/export-list/"
    )
    assert reverse("admin:documents_evidencelist_download_pdf", args=[7]).endswith(
        "/admin/documents/evidencelist/7/download-pdf/"
    )
