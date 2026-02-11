"""
Sharing service for Solo Workspace.
"""
import secrets
from datetime import timedelta
from typing import Optional

from django.utils import timezone
from django.conf import settings


class SharingService:
    """Service for managing session sharing."""
    
    @staticmethod
    def generate_token() -> str:
        """Generate a secure share token."""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def create_share(
        session,  # SoloSession
        expires_in_days: int = 7,
        max_views: Optional[int] = None,
        allow_download: bool = False,
    ):
        """Create or update share token for session."""
        from apps.solo.models import ShareToken
        
        # Delete existing token if any
        ShareToken.objects.filter(session=session).delete()
        
        expires_at = timezone.now() + timedelta(days=expires_in_days) if expires_in_days else None
        
        token = ShareToken.objects.create(
            session=session,
            token=SharingService.generate_token(),
            expires_at=expires_at,
            max_views=max_views,
            allow_download=allow_download,
        )
        
        return token
    
    @staticmethod
    def revoke_share(session) -> bool:
        """Revoke share token for session."""
        from apps.solo.models import ShareToken
        deleted, _ = ShareToken.objects.filter(session=session).delete()
        return deleted > 0
    
    @staticmethod
    def get_by_token(token: str):
        """Get share token by token string."""
        from apps.solo.models import ShareToken
        try:
            share = ShareToken.objects.select_related('session', 'session__user').get(token=token)
            if share.is_valid():
                return share
            return None
        except ShareToken.DoesNotExist:
            return None
    
    @staticmethod
    def get_public_url(share_token) -> str:
        """Get public URL for shared session."""
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        return f"{base_url}/solo/shared/{share_token.token}"
