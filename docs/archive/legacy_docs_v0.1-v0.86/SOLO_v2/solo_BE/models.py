"""
Solo Workspace models.
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class SoloSession(models.Model):
    """
    A saved solo practice session.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='solo_sessions'
    )
    name = models.CharField(max_length=255, default='Untitled')
    
    # JSON state of all pages
    state = models.JSONField(default=dict)
    
    # Metadata
    page_count = models.PositiveIntegerField(default=1)
    thumbnail_url = models.URLField(blank=True, null=True)
    rev = models.PositiveIntegerField(default=0)
    state_digest = models.CharField(max_length=64, blank=True, default='')
    last_write_at = models.DateTimeField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'solo_session'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.name} ({self.user.email})"


class SoloExport(models.Model):
    """
    Exported PNG/PDF from a solo session.
    Supports async export with status polling.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        SoloSession,
        on_delete=models.CASCADE,
        related_name='exports'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='solo_exports'
    )
    
    FORMAT_CHOICES = [
        ('png', 'PNG Image'),
        ('pdf', 'PDF Document'),
        ('json', 'JSON Data'),
    ]
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES)
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    file_url = models.URLField(blank=True, null=True)
    file_size = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True, null=True)
    
    # Metadata
    page_count = models.PositiveIntegerField(null=True, blank=True)  # for PDF
    
    # Idempotency key for duplicate request detection
    idempotency_key = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    
    # TTL for cleanup
    expires_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'solo_export'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session', 'status']),
            models.Index(fields=['user', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.session.name} - {self.format} ({self.status})"
    
    @property
    def is_expired(self) -> bool:
        """Check if export has expired."""
        if not self.expires_at:
            return False
        return self.expires_at < timezone.now()


class ShareToken(models.Model):
    """
    Token for sharing a solo session publicly.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.OneToOneField(
        SoloSession,
        on_delete=models.CASCADE,
        related_name='share_token'
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    
    # Access control
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    max_views = models.PositiveIntegerField(null=True, blank=True)
    view_count = models.PositiveIntegerField(default=0)
    
    # Permissions
    allow_download = models.BooleanField(default=False)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    last_accessed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'solo_share_token'
    
    def __str__(self):
        return f"Share: {self.session.name} ({self.token[:8]}...)"
    
    def is_valid(self) -> bool:
        """Check if token is still valid."""
        if not self.is_active:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        if self.max_views and self.view_count >= self.max_views:
            return False
        return True
    
    def record_access(self, ip_address: str = None, user_agent: str = ''):
        """Record an access to this shared session."""
        self.view_count += 1
        self.last_accessed_at = timezone.now()
        self.save(update_fields=['view_count', 'last_accessed_at'])
        
        # Create audit log
        ShareAccessLog.objects.create(
            share_token=self,
            ip_address=ip_address,
            user_agent=user_agent,
        )


class ShareAccessLog(models.Model):
    """Audit log for share token access."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    share_token = models.ForeignKey(
        ShareToken,
        on_delete=models.CASCADE,
        related_name='access_logs'
    )
    ip_address = models.GenericIPAddressField(null=True)
    user_agent = models.TextField(blank=True)
    accessed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'solo_share_access_log'
        ordering = ['-accessed_at']
    
    def __str__(self):
        return f"Access: {self.share_token.token[:8]}... at {self.accessed_at}"


class SoloUserStorage(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='solo_storage',
    )
    used_bytes = models.BigIntegerField(default=0)
    quota_bytes = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'solo_user_storage'

    @property
    def remaining_bytes(self) -> int:
        return max(0, int(self.quota_bytes) - int(self.used_bytes))
