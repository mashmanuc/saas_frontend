# Data migration to populate user field from session.user for existing exports

from django.db import migrations


def populate_user(apps, schema_editor):
    """Copy user from session to export for existing records."""
    SoloExport = apps.get_model('solo', 'SoloExport')
    for export in SoloExport.objects.filter(user__isnull=True):
        export.user = export.session.user
        export.save(update_fields=['user'])


def reverse_populate(apps, schema_editor):
    """Reverse migration - set user to null."""
    SoloExport = apps.get_model('solo', 'SoloExport')
    SoloExport.objects.all().update(user=None)


class Migration(migrations.Migration):

    dependencies = [
        ('solo', '0003_soloexport_async_fields'),
    ]

    operations = [
        migrations.RunPython(populate_user, reverse_populate),
    ]
