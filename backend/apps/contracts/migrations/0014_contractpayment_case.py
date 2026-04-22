from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cases", "0016_caselog_source_payment_and_more"),
        ("contracts", "0013_alter_contractpayment_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="contractpayment",
            name="case",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="contract_payments",
                to="cases.case",
                verbose_name="关联案件",
            ),
        ),
        migrations.AddIndex(
            model_name="contractpayment",
            index=models.Index(fields=["case", "received_at"], name="contracts_c_case_id_1b1b21_idx"),
        ),
    ]
