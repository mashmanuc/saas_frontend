"""
Celery tasks for Solo Workspace.
"""
from datetime import timedelta
try:
    from celery import shared_task
except Exception:  # pragma: no cover
    def shared_task(*dargs, **dkwargs):
        def decorator(func):
            return func

        if dargs and callable(dargs[0]) and not dkwargs:
            return dargs[0]
        return decorator
from django.utils import timezone
from django.db.models import Q
import logging

logger = logging.getLogger('solo.tasks')


@shared_task(name='solo.generate_thumbnail')
def generate_thumbnail_task(session_id: str):
    """Async task to generate thumbnail."""
    from apps.solo.models import SoloSession
    from apps.solo.services.thumbnail import ThumbnailService
    
    try:
        session = SoloSession.objects.get(pk=session_id)
        url = ThumbnailService.generate_and_upload(session)
        logger.info(f"Generated thumbnail for session {session_id}: {url}")
        return {'status': 'success', 'url': url}
    except SoloSession.DoesNotExist:
        logger.warning(f"Session {session_id} not found for thumbnail generation")
        return {'status': 'error', 'message': 'Session not found'}
    except Exception as e:
        logger.error(f"Failed to generate thumbnail for {session_id}: {e}")
        return {'status': 'error', 'message': str(e)}


@shared_task(name='solo.cleanup_exports')
def cleanup_old_exports():
    """
    Clean up old exports.
    
    Runs daily via celery beat.
    Deletes exports older than 30 days.
    """
    from apps.solo.models import SoloExport
    from apps.solo.services.storage import SoloStorageService
    
    cutoff = timezone.now() - timedelta(days=30)
    
    old_exports = SoloExport.objects.filter(created_at__lt=cutoff)
    
    storage = SoloStorageService()
    deleted_count = 0
    
    for export in old_exports:
        # Delete from storage
        try:
            # Extract path from URL
            if export.file_url:
                path = export.file_url.split('/')[-1]
                storage.backend.delete(f"exports/{export.session_id}/{path}")
        except Exception as e:
            logger.warning(f"Failed to delete export file: {e}")
        
        export.delete()
        deleted_count += 1
    
    logger.info(f"Deleted {deleted_count} old exports")
    return f"Deleted {deleted_count} old exports"


@shared_task(name='solo.cleanup_expired_shares')
def cleanup_expired_shares():
    """
    Clean up expired share tokens.
    
    Runs daily via celery beat.
    """
    from apps.solo.models import ShareToken
    
    expired = ShareToken.objects.filter(
        Q(expires_at__lt=timezone.now()) |
        Q(is_active=False)
    )
    
    deleted_count, _ = expired.delete()
    logger.info(f"Deleted {deleted_count} expired share tokens")
    return f"Deleted {deleted_count} expired share tokens"


@shared_task(name='solo.cleanup_orphan_files')
def cleanup_orphan_files():
    """
    Clean up orphan files in storage.
    
    Runs weekly via celery beat.
    Files without corresponding DB records.
    """
    # Implementation depends on storage backend
    # Would list files and check against DB
    logger.info("Orphan file cleanup task - not implemented for local storage")
    return "Orphan cleanup skipped (not implemented for local storage)"


@shared_task(name='solo.generate_pdf_export')
def generate_pdf_export_task(session_id: str, export_id: str):
    """
    Async task to generate PDF export.
    
    Heavy operation - runs in Celery worker.
    """
    from apps.solo.models import SoloSession, SoloExport
    from apps.solo.services.storage import SoloStorageService
    
    try:
        session = SoloSession.objects.get(pk=session_id)
        export = SoloExport.objects.get(pk=export_id)
        
        # Generate PDF (placeholder - would need reportlab or similar)
        import io
        pdf_buffer = io.BytesIO()
        pdf_buffer.write(b'%PDF-1.4 placeholder')
        pdf_buffer.seek(0)
        
        # Upload to storage
        storage = SoloStorageService()
        url = storage.upload_export(str(session_id), pdf_buffer, 'pdf')
        
        # Update export record
        export.file_url = url
        export.file_size = pdf_buffer.getbuffer().nbytes
        export.save(update_fields=['file_url', 'file_size'])
        
        logger.info(f"Generated PDF export for session {session_id}")
        return {'status': 'success', 'url': url}
        
    except Exception as e:
        logger.error(f"Failed to generate PDF for {session_id}: {e}")
        raise


@shared_task(name='solo.generate_png_export')
def generate_png_export_task(session_id: str, export_id: str, page: int = 0):
    """
    Async task to generate PNG export.
    """
    from apps.solo.models import SoloSession, SoloExport
    from apps.solo.services.storage import SoloStorageService
    from apps.solo.services.thumbnail import ThumbnailService
    
    try:
        session = SoloSession.objects.get(pk=session_id)
        export = SoloExport.objects.get(pk=export_id)
        
        # Generate PNG using thumbnail service (full size)
        png_buffer = ThumbnailService.generate_from_state(session.state)
        
        # Upload
        storage = SoloStorageService()
        url = storage.upload_export(str(session_id), png_buffer, 'png', page=page)
        
        # Update
        export.file_url = url
        export.file_size = png_buffer.getbuffer().nbytes
        export.save(update_fields=['file_url', 'file_size'])
        
        logger.info(f"Generated PNG export for session {session_id}")
        return {'status': 'success', 'url': url}
        
    except Exception as e:
        logger.error(f"Failed to generate PNG for {session_id}: {e}")
        raise


@shared_task(name='solo.upload_state_versioned')
def upload_state_versioned_task(user_id: str, session_id: str, rev: int):
    """Persist session state to versioned storage path solo/{user_id}/{session_id}/{rev}.json."""
    from apps.solo.models import SoloSession
    from apps.solo.services.storage import SoloStorageService

    try:
        session = SoloSession.objects.get(pk=session_id)
    except SoloSession.DoesNotExist:
        logger.warning(f"Session {session_id} not found for versioned state upload")
        return {'status': 'error', 'message': 'Session not found'}

    try:
        state_json = session.state or {}
        payload = __import__('json').dumps(state_json, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        storage = SoloStorageService()
        result = storage.upload_state_versioned(user_id=str(user_id), session_id=str(session_id), rev=int(rev), state_json=payload)
        return {'status': 'success', 'result': result}
    except Exception as e:
        logger.error(f"Failed to upload versioned state for session {session_id}: {e}")
        return {'status': 'error', 'message': str(e)}


@shared_task(name='solo.cleanup_snapshots')
def cleanup_old_snapshots(keep_last: int | None = None):
    """Retention/GC for Solo snapshots.

    Deletes older versioned state files at solo/{user_id}/{session_id}/{rev}.json,
    keeping only the last N revs per session.

    The function also decrements SoloUserStorage.used_bytes based on deleted object sizes.
    """
    from django.conf import settings
    from django.db import transaction

    from apps.solo.models import SoloSession, SoloUserStorage
    from apps.solo.services.storage import SoloStorageService

    keep_last = int(
        keep_last
        if keep_last is not None
        else getattr(settings, 'SOLO_SNAPSHOT_RETENTION_KEEP_LAST', 20)
    )
    if keep_last < 0:
        keep_last = 0

    storage = SoloStorageService()
    deleted_files = 0
    freed_bytes_total = 0

    for session in SoloSession.objects.only('id', 'user_id').iterator():
        revs = storage.list_state_revs(user_id=str(session.user_id), session_id=str(session.id))
        if len(revs) <= keep_last:
            continue

        to_delete = revs[:-keep_last] if keep_last > 0 else revs
        freed = 0
        for rev in to_delete:
            size = storage.delete_state_version(user_id=str(session.user_id), session_id=str(session.id), rev=int(rev))
            if size > 0:
                freed += size
                deleted_files += 1

        if freed <= 0:
            continue

        freed_bytes_total += freed

        with transaction.atomic():
            storage_row, _ = SoloUserStorage.objects.select_for_update().get_or_create(
                user_id=session.user_id,
                defaults={'used_bytes': 0, 'quota_bytes': 0},
            )
            used = int(storage_row.used_bytes or 0)
            storage_row.used_bytes = max(0, used - freed)
            storage_row.save(update_fields=['used_bytes', 'updated_at'])

    logger.info(
        f"Deleted {deleted_files} old snapshots, freed {freed_bytes_total} bytes (keep_last={keep_last})"
    )
    return {
        'deleted_files': deleted_files,
        'freed_bytes': freed_bytes_total,
        'keep_last': keep_last,
    }
