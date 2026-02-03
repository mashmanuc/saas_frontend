"""
Middleware for Solo Workspace.
"""
import gzip
import logging
import uuid
import io

from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger('solo.audit')


class SoloAuditMiddleware:
    """Log all solo API access for audit."""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Log solo API access
        if '/api/v1/solo/' in request.path:
            user_id = getattr(request.user, 'id', 'anon') if hasattr(request, 'user') else 'anon'
            logger.info(
                f"SOLO_ACCESS | "
                f"user={user_id} | "
                f"method={request.method} | "
                f"path={request.path} | "
                f"status={response.status_code} | "
                f"ip={request.META.get('REMOTE_ADDR')}"
            )
        
        return response


class BodySizeLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _get_request_id(request):
        return getattr(request, 'request_id', None) or str(uuid.uuid4())

    @staticmethod
    def _match_solo_limit(request):
        if not request.path.startswith('/api/v1/solo/sessions/'):
            return None

        if request.method == 'PATCH' and request.path.endswith('/diff/'):
            from apps.solo.limits import DIFF_MAX_BYTES
            return DIFF_MAX_BYTES

        if request.method == 'POST' and request.path.endswith('/save-stream/'):
            from apps.solo.limits import STREAM_MAX_BYTES
            return STREAM_MAX_BYTES

        if request.method == 'POST' and request.path.endswith('/beacon/'):
            from apps.solo.limits import BEACON_MAX_BYTES
            return BEACON_MAX_BYTES

        return None

    def __call__(self, request):
        limit = self._match_solo_limit(request)
        if limit is None:
            return self.get_response(request)

        encoding = (request.headers.get('Content-Encoding') or '').strip().lower()
        if encoding == 'br':
            return Response(
                {'error': 'unsupported_media_type'},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        content_length = request.META.get('CONTENT_LENGTH')
        if content_length:
            try:
                if int(content_length) > limit:
                    return Response(
                        {
                            'detail': 'payload_too_large',
                            'error': 'payload_too_large',
                            'limit': limit,
                            'encoding': 'gzip' if encoding == 'gzip' else 'raw',
                            'endpoint': request.path,
                            'request_id': self._get_request_id(request),
                        },
                        status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    )
            except (TypeError, ValueError):
                pass

        body = request.body or b''
        if not encoding or encoding == 'identity':
            if len(body) > limit:
                return Response(
                    {
                        'detail': 'payload_too_large',
                        'error': 'payload_too_large',
                        'limit': limit,
                        'encoding': 'raw',
                        'endpoint': request.path,
                        'request_id': self._get_request_id(request),
                    },
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )
            return self.get_response(request)

        if encoding != 'gzip':
            return Response(
                {'error': 'unsupported_media_type'},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        try:
            gz = gzip.GzipFile(fileobj=io.BytesIO(body))
            decompressed = gz.read(limit + 1)
        except OSError:
            return self.get_response(request)

        if len(decompressed) > limit:
            return Response(
                {
                    'detail': 'payload_too_large',
                    'error': 'payload_too_large',
                    'limit': limit,
                    'encoding': 'gzip',
                    'endpoint': request.path,
                    'request_id': self._get_request_id(request),
                },
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        return self.get_response(request)
