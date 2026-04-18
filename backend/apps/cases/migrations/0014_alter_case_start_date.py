from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cases", "0013_caselog_logged_at_caselog_note_caselog_stage_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="case",
            name="start_date",
            field=models.DateField(blank=True, null=True, verbose_name="收案日期"),
        ),
    ]
