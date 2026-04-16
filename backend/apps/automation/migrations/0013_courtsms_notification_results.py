"""Add notification_results field to CourtSMS"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("automation", "0012_courtsms_dedup_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="courtsms",
            name="notification_results",
            field=models.JSONField(blank=True, default=None, null=True, verbose_name="多平台通知结果"),
        ),
    ]
