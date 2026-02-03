# Generated manually for v0.29 - Diff-Save API indexes and fields
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    v0.29 Migration: Add indexes for diff-save API and export improvements.
    
    Changes:
    - Add composite index (user_id, updated_at desc) for session listing
    - Add composite index (id, rev) for optimistic locking
    - Add idempotency_key field to SoloExport
    - Add expires_at field to SoloExport
    - Add indexes for SoloExport
    """

    dependencies = [
        ('solo', '0005_alter_soloexport_status_alter_soloexport_user'),
    ]

    operations = [
        # SoloSession fields for diff-save
        migrations.AddField(
            model_name='solosession',
            name='rev',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='solosession',
            name='state_digest',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='solosession',
            name='last_write_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # SoloSession indexes for diff-save
        migrations.AddIndex(
            model_name='solosession',
            index=models.Index(
                fields=['user', '-updated_at'],
                name='solo_session_user_updated_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='solosession',
            index=models.Index(
                fields=['id', 'rev'],
                name='solo_session_id_rev_idx'
            ),
        ),
        
        # SoloExport idempotency and TTL fields
        migrations.AddField(
            model_name='soloexport',
            name='idempotency_key',
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=64,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='soloexport',
            name='expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        
        # SoloExport indexes
        migrations.AddIndex(
            model_name='soloexport',
            index=models.Index(
                fields=['session', 'status'],
                name='solo_export_session_status_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='soloexport',
            index=models.Index(
                fields=['user', 'created_at'],
                name='solo_export_user_created_idx'
            ),
        ),
    ]
