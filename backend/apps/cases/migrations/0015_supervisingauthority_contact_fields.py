from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cases", "0014_alter_case_start_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="supervisingauthority",
            name="handler_name",
            field=models.CharField(blank=True, default="", max_length=100, verbose_name="\u627f\u529e\u4eba"),
        ),
        migrations.AddField(
            model_name="supervisingauthority",
            name="handler_phone",
            field=models.CharField(blank=True, default="", max_length=64, verbose_name="\u8054\u7cfb\u7535\u8bdd"),
        ),
        migrations.AddField(
            model_name="supervisingauthority",
            name="remarks",
            field=models.TextField(blank=True, default="", verbose_name="\u5907\u6ce8"),
        ),
    ]
