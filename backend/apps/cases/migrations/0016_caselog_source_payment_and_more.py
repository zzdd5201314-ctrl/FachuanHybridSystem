from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("contracts", "0013_alter_contractpayment_options_and_more"),
        ("cases", "0015_supervisingauthority_contact_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="caselog",
            name="source_payment",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="case_log",
                to="contracts.contractpayment",
                verbose_name="来源律师费收款记录",
            ),
        ),
        migrations.AddField(
            model_name="caselogattachment",
            name="source_invoice",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="case_log_attachment",
                to="contracts.invoice",
                verbose_name="来源发票",
            ),
        ),
    ]
