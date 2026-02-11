"""
Solo API mixins for rate limiting and backoff.
"""
from rest_framework.response import Response
from rest_framework import status


class BackoffThrottleMixin:
    """
    Mixin that adds backoff headers to 429 responses.
    
    When throttled, returns:
    - 429 Too Many Requests
    - Retry-After header (seconds)
    - X-Backoff-Ms header (milliseconds)
    - X-RateLimit-Limit header
    - X-RateLimit-Remaining header
    """
    
    def throttled(self, request, wait):
        """
        Override to add backoff headers to throttle response.
        """
        wait_seconds = int(wait) if wait else 60
        wait_ms = int(wait * 1000) if wait else 60000
        
        response = Response(
            {
                'error': 'rate_limited',
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
        response['Retry-After'] = str(wait_seconds)
        response['X-Backoff-Ms'] = str(wait_ms)
        
        # Add rate limit info if available
        throttle = self._get_throttle_info()
        if throttle:
            response['X-RateLimit-Limit'] = str(throttle.get('limit', 0))
            response['X-RateLimit-Remaining'] = str(throttle.get('remaining', 0))
        
        return response
    
    def _get_throttle_info(self):
        """Get throttle info from the first throttle class."""
        if not hasattr(self, 'throttle_classes') or not self.throttle_classes:
            return None
        
        try:
            throttle = self.throttle_classes[0]()
            if hasattr(throttle, 'rate'):
                rate = throttle.rate
                if rate:
                    num_requests, duration = throttle.parse_rate(rate)
                    return {
                        'limit': num_requests,
                        'remaining': 0,  # Unknown at this point
                    }
        except Exception:
            pass
        return None


class QuotaLimitMixin:
    """
    Mixin for enforcing operation quotas.
    
    Limits:
    - max_ops_per_save: Maximum diff operations per save
    - max_saves_per_minute: Maximum saves per minute per user
    - max_body_size: Maximum request body size
    """
    
    MAX_OPS_PER_SAVE = 100
    MAX_BODY_SIZE = 512 * 1024  # 512 KB default
    
    def check_ops_quota(self, ops):
        """Check if operations count exceeds quota."""
        if len(ops) > self.MAX_OPS_PER_SAVE:
            return Response(
                {
                    'detail': 'ops_quota_exceeded',
                    'max_ops': self.MAX_OPS_PER_SAVE,
                    'your_ops': len(ops),
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return None
    
    def check_body_size(self, request):
        """Check if body size exceeds quota."""
        content_length = request.META.get('CONTENT_LENGTH')
        if content_length:
            try:
                if int(content_length) > self.MAX_BODY_SIZE:
                    return Response(
                        {
                            'detail': 'payload_too_large',
                            'max_bytes': self.MAX_BODY_SIZE,
                        },
                        status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    )
            except (TypeError, ValueError):
                pass
        return None


class SoloAPIViewMixin(BackoffThrottleMixin, QuotaLimitMixin):
    """Combined mixin for Solo API views with backoff and quotas."""
    pass
