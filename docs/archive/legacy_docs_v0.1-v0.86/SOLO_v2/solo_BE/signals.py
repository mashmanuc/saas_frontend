"""
Signals for Solo Workspace observability.
"""
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.solo.models import SoloSession, SoloExport, ShareToken

logger = logging.getLogger('solo.events')


@receiver(post_save, sender=SoloSession)
def log_session_saved(sender, instance, created, **kwargs):
    """Log session save events."""
    action = 'created' if created else 'updated'
    logger.info(
        f"SOLO_SESSION_{action.upper()} | "
        f"session_id={instance.id} | "
        f"user_id={instance.user_id} | "
        f"name={instance.name} | "
        f"page_count={instance.page_count}"
    )


@receiver(post_delete, sender=SoloSession)
def log_session_deleted(sender, instance, **kwargs):
    """Log session delete events."""
    logger.info(
        f"SOLO_SESSION_DELETED | "
        f"session_id={instance.id} | "
        f"user_id={instance.user_id}"
    )


@receiver(post_save, sender=SoloExport)
def log_export_created(sender, instance, created, **kwargs):
    """Log export events."""
    if created:
        logger.info(
            f"SOLO_EXPORT_CREATED | "
            f"export_id={instance.id} | "
            f"session_id={instance.session_id} | "
            f"format={instance.format}"
        )


@receiver(post_save, sender=ShareToken)
def log_share_created(sender, instance, created, **kwargs):
    """Log share token events."""
    if created:
        logger.info(
            f"SOLO_SHARE_CREATED | "
            f"session_id={instance.session_id} | "
            f"expires_at={instance.expires_at} | "
            f"max_views={instance.max_views}"
        )


@receiver(post_delete, sender=ShareToken)
def log_share_deleted(sender, instance, **kwargs):
    """Log share token revocation."""
    logger.info(
        f"SOLO_SHARE_REVOKED | "
        f"session_id={instance.session_id} | "
        f"view_count={instance.view_count}"
    )
