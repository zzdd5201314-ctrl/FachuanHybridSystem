from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cases", "0009_rename_log_chat_verbose"),
    ]

    operations = [
        migrations.AddField(
            model_name="casematerial",
            name="archive_relative_path",
            field=models.CharField(blank=True, default="", max_length=500, verbose_name="归档相对目录"),
        ),
        migrations.AddField(
            model_name="casematerial",
            name="archived_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="归档时间"),
        ),
        migrations.AddField(
            model_name="casematerial",
            name="archived_file_path",
            field=models.CharField(blank=True, default="", max_length=1000, verbose_name="归档文件路径"),
        ),
    ]
