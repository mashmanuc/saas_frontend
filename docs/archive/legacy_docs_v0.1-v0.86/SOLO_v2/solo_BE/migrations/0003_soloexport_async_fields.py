# Generated migration for v0.28 Export API
# Adds async export support fields to SoloExport model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('solo', '0002_sharetoken_shareaccesslog'),
    ]

    operations = [
        # Add user field
        migrations.AddField(
            model_name='soloexport',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='solo_exports',
                to=settings.AUTH_USER_MODEL,
                null=True,  # Temporarily nullable for existing records
            ),
        ),
        # Add status field
        migrations.AddField(
            model_name='soloexport',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('processing', 'Processing'),
                    ('completed', 'Completed'),
                    ('failed', 'Failed'),
                ],
                default='completed',  # Existing exports are completed
                max_length=20,
            ),
        ),
        # Add error field
        migrations.AddField(
            model_name='soloexport',
            name='error',
            field=models.TextField(blank=True, null=True),
        ),
        # Add page_count field
        migrations.AddField(
            model_name='soloexport',
            name='page_count',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        # Add updated_at field
        migrations.AddField(
            model_name='soloexport',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        # Make file_url nullable (pending exports don't have URL yet)
        migrations.AlterField(
            model_name='soloexport',
            name='file_url',
            field=models.URLField(blank=True, null=True),
        ),
    ]
