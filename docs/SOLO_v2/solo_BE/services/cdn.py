"""
CDN and signed URL service for Solo Workspace.
Supports CloudFront, Cloudflare R2, and local fallback.
"""
import hashlib
import hmac
import time
from urllib.parse import urlencode

from django.conf import settings


class CdnService:
    """Service for CDN URL generation with CORS support."""
    
    # CORS headers for Solo storage
    CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Encoding, Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, ETag',
        'Access-Control-Max-Age': '86400',
    }
    
    @classmethod
    def get_cors_headers(cls, origin: str = None) -> dict:
        """
        Get CORS headers for response.
        
        Args:
            origin: Request origin to validate against allowed origins.
        """
        allowed_origins = getattr(settings, 'SOLO_CORS_ORIGINS', ['*'])
        headers = cls.CORS_HEADERS.copy()
        
        if origin and '*' not in allowed_origins:
            if origin in allowed_origins:
                headers['Access-Control-Allow-Origin'] = origin
            else:
                headers['Access-Control-Allow-Origin'] = allowed_origins[0]
        
        return headers
    
    @staticmethod
    def get_cdn_url(storage_url: str) -> str:
        """Convert storage URL to CDN URL."""
        cdn_domain = getattr(settings, 'SOLO_CDN_DOMAIN', None) or getattr(settings, 'CDN_DOMAIN', None)
        
        if not cdn_domain:
            return storage_url
        
        # Replace S3/R2 URL with CDN
        if 's3.amazonaws.com' in storage_url or 'r2.cloudflarestorage.com' in storage_url:
            # Extract path from S3/R2 URL
            if '.com/' in storage_url:
                path = storage_url.split('.com/')[-1]
            else:
                path = storage_url.split('/')[-1]
            return f"https://{cdn_domain}/{path}"
        
        # Replace local media URL with CDN
        if storage_url.startswith('/media/'):
            path = storage_url[7:]  # Remove '/media/'
            return f"https://{cdn_domain}/{path}"
        
        # Handle s3:// URLs
        if storage_url.startswith('s3://'):
            parts = storage_url[5:].split('/', 1)
            if len(parts) == 2:
                path = parts[1]
                return f"https://{cdn_domain}/{path}"
        
        return storage_url
    
    @staticmethod
    def get_signed_cdn_url(
        path: str,
        expires_in: int = 900,
    ) -> str:
        """
        Get signed CDN URL.
        
        Supports:
        - CloudFront signed URLs
        - Cloudflare R2 presigned URLs
        - Simple token-based signing for custom CDN
        """
        cdn_domain = getattr(settings, 'SOLO_CDN_DOMAIN', None) or getattr(settings, 'CDN_DOMAIN', None)
        
        if not cdn_domain:
            # Fallback to direct S3 signed URL
            from apps.solo.services.storage import SoloStorageService
            return SoloStorageService().get_signed_url(path, expires_in)
        
        # Check for signing key
        signing_key = getattr(settings, 'SOLO_CDN_SIGNING_KEY', None)
        
        if signing_key:
            # Simple HMAC-based signing
            expires = int(time.time()) + expires_in
            message = f"{path}:{expires}"
            signature = hmac.new(
                signing_key.encode(),
                message.encode(),
                hashlib.sha256
            ).hexdigest()[:32]
            
            params = urlencode({
                'expires': expires,
                'signature': signature,
            })
            return f"https://{cdn_domain}/{path}?{params}"
        
        # No signing - return plain CDN URL
        return f"https://{cdn_domain}/{path}"
    
    @staticmethod
    def get_export_url(
        user_id: str,
        session_id: str,
        export_id: str,
        ext: str,
        expires_in: int = 3600,
    ) -> str:
        """Get signed URL for export download."""
        path = f"solo/{user_id}/{session_id}/exports/{export_id}.{ext}"
        return CdnService.get_signed_cdn_url(path, expires_in)
    
    @staticmethod
    def get_state_url(
        user_id: str,
        session_id: str,
        rev: int,
        expires_in: int = 900,
    ) -> str:
        """Get signed URL for state JSON."""
        path = f"solo/{user_id}/{session_id}/{rev}.json"
        return CdnService.get_signed_cdn_url(path, expires_in)
    
    @staticmethod
    def get_thumbnail_url(
        user_id: str,
        session_id: str,
        expires_in: int = 3600,
    ) -> str:
        """Get signed URL for thumbnail."""
        path = f"solo/{user_id}/{session_id}/thumbnail.png"
        return CdnService.get_signed_cdn_url(path, expires_in)
