"""
Solo Workspace API views.
"""
import re
import json
import gzip
import io
import uuid
from datetime import timedelta

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import AnonRateThrottle
from rest_framework.exceptions import ValidationError
from django.conf import settings
from django.core.exceptions import RequestDataTooBig
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache

from apps.solo.models import SoloSession, SoloExport
from apps.solo.api.serializers import (
    SoloSessionListSerializer,
    SoloSessionDetailSerializer,
    SoloSessionCreateSerializer,
    SoloExportSerializer,
    SoloDiffSaveSerializer,
)
from apps.solo.services import SoloService, SoloDiffService, SoloDiffError
from apps.solo.services.sharing import SharingService
from apps.solo.services.thumbnail import ThumbnailService
from apps.solo.services.storage import SoloStorageService
from apps.diagnostics.services import LogService
from apps.solo.throttling import SoloSaveStreamThrottle, SoloBeaconThrottle, SoloDiffThrottle
from apps.solo.api.mixins import BackoffThrottleMixin, QuotaLimitMixin
from apps.solo.limits import DIFF_MAX_BYTES, STREAM_MAX_BYTES, BEACON_MAX_BYTES


_REV_HEADER_PATTERN = re.compile(r'rev:(\d+)', re.IGNORECASE)


def _request_id(request):
    return getattr(request, 'request_id', None) or str(uuid.uuid4())


def _payload_too_large_response(request, limit, encoding):
    return Response(
        {
            'detail': 'payload_too_large',
            'error': 'payload_too_large',
            'limit': limit,
            'encoding': encoding,
            'endpoint': request.path,
            'request_id': _request_id(request),
        },
        status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
    )


def _unsupported_media_type_response():
    return Response(
        {'error': 'unsupported_media_type'},
        status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    )


def _parse_if_match_rev(value):
    match = _REV_HEADER_PATTERN.search(value or '')
    if match:
        return int(match.group(1))
    candidate = (value or '').strip()
    if candidate.startswith('W/'):
        candidate = candidate[2:].strip()
    candidate = candidate.strip('"')
    return int(candidate)


def _precondition_failed_response():
    return Response(
        {'error': 'precondition_failed'},
        status=status.HTTP_412_PRECONDITION_FAILED,
    )


def _rev_mismatch_response(server_rev):
    return Response(
        {'error': 'rev_mismatch', 'server_rev': server_rev},
        status=status.HTTP_409_CONFLICT,
    )


def _read_body_with_limit(request, max_bytes):
    body = request.body or b''
    encoding = (request.headers.get('Content-Encoding') or '').strip().lower()
    if not encoding or encoding == 'identity':
        if len(body) > max_bytes:
            return None, _payload_too_large_response(request, max_bytes, 'raw')
        return body, None
    if encoding != 'gzip':
        return None, _unsupported_media_type_response()

    try:
        gz = gzip.GzipFile(fileobj=io.BytesIO(body))
        decompressed = gz.read(max_bytes + 1)
    except OSError:
        return None, Response(
            {'detail': 'invalid_gzip'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(decompressed) > max_bytes:
        return None, _payload_too_large_response(request, max_bytes, 'gzip')
    return decompressed, None


class SoloSessionListView(APIView):
    """
    GET /api/v1/solo/sessions/
    POST /api/v1/solo/sessions/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """List user's solo sessions."""
        sessions = SoloSession.objects.filter(user=request.user)
        serializer = SoloSessionListSerializer(sessions, many=True)
        return Response({
            'count': sessions.count(),
            'results': serializer.data
        })
    
    def post(self, request):
        """Create new solo session."""
        serializer = SoloSessionCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        session = serializer.save()
        
        return Response(
            SoloSessionDetailSerializer(session).data,
            status=status.HTTP_201_CREATED
        )


class SoloSessionDetailView(APIView):
    """
    GET /api/v1/solo/sessions/{id}/
    PATCH /api/v1/solo/sessions/{id}/
    DELETE /api/v1/solo/sessions/{id}/
    """
    permission_classes = [IsAuthenticated]
    
    def get_object(self, pk, user):
        return get_object_or_404(SoloSession, pk=pk, user=user)
    
    def get(self, request, pk):
        """Get session details with full state."""
        session = self.get_object(pk, request.user)
        serializer = SoloSessionDetailSerializer(session)
        return Response(serializer.data)
    
    def patch(self, request, pk):
        """Update session (autosave)."""
        session = self.get_object(pk, request.user)
        serializer = SoloSessionCreateSerializer(
            session,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(SoloSessionDetailSerializer(session).data)
    
    def delete(self, request, pk):
        """Delete session."""
        session = self.get_object(pk, request.user)
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SoloSessionExportView(APIView):
    """
    POST /api/v1/solo/sessions/{id}/export/
    
    Export session as PNG/PDF/JSON.
    Creates an export request and returns immediately.
    Frontend should poll GET /api/v1/exports/{id}/ for status.
    
    Supports idempotency via Idempotency-Key header.
    """
    permission_classes = [IsAuthenticated]
    MAX_EXPORT_SIZE = 10 * 1024 * 1024  # 10 MB state limit
    
    def post(self, request, pk):
        session = get_object_or_404(SoloSession, pk=pk, user=request.user)
        
        format_type = request.data.get('format', 'png')
        if format_type not in ['png', 'pdf', 'json']:
            return Response(
                {'error': 'Invalid format. Use: png, pdf, json'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check state size limit
        import json
        state_size = len(json.dumps(session.state or {}))
        if state_size > self.MAX_EXPORT_SIZE:
            return Response(
                {
                    'detail': 'session_too_large',
                    'max_bytes': self.MAX_EXPORT_SIZE,
                    'state_bytes': state_size,
                },
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        
        # Check idempotency key
        idempotency_key = request.headers.get('Idempotency-Key') or request.headers.get('X-Idempotency-Key')
        if idempotency_key:
            existing = SoloExport.objects.filter(
                session=session,
                user=request.user,
                idempotency_key=idempotency_key,
            ).first()
            if existing:
                serializer = SoloExportSerializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Create export request (async processing)
        export = SoloService.create_export(
            session, format_type, request.user,
            idempotency_key=idempotency_key,
        )
        
        serializer = SoloExportSerializer(export)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SoloSessionDuplicateView(APIView):
    """
    POST /api/v1/solo/sessions/{id}/duplicate/
    
    Duplicate a session.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        session = get_object_or_404(SoloSession, pk=pk, user=request.user)
        
        new_session = SoloService.duplicate_session(session)
        
        serializer = SoloSessionDetailSerializer(new_session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ============================================================ v0.27 Sharing Views

class SessionShareView(APIView):
    """
    POST /api/v1/solo/sessions/{id}/share/
    DELETE /api/v1/solo/sessions/{id}/share/
    GET /api/v1/solo/sessions/{id}/share/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        """Get current share status."""
        session = get_object_or_404(SoloSession, pk=pk, user=request.user)
        
        try:
            share_token = session.share_token
            return Response({
                'is_shared': True,
                'token': share_token.token,
                'url': SharingService.get_public_url(share_token),
                'expires_at': share_token.expires_at,
                'max_views': share_token.max_views,
                'view_count': share_token.view_count,
                'allow_download': share_token.allow_download,
                'is_valid': share_token.is_valid(),
            })
        except SoloSession.share_token.RelatedObjectDoesNotExist:
            return Response({'is_shared': False})
    
    def post(self, request, pk):
        """Create share token."""
        session = get_object_or_404(SoloSession, pk=pk, user=request.user)
        
        expires_in_days = request.data.get('expires_in_days', 7)
        max_views = request.data.get('max_views')
        allow_download = request.data.get('allow_download', False)
        
        share_token = SharingService.create_share(
            session=session,
            expires_in_days=expires_in_days,
            max_views=max_views,
            allow_download=allow_download,
        )
        
        return Response({
            'token': share_token.token,
            'url': SharingService.get_public_url(share_token),
            'expires_at': share_token.expires_at,
            'max_views': share_token.max_views,
            'allow_download': share_token.allow_download,
        }, status=status.HTTP_201_CREATED)
    
    def delete(self, request, pk):
        """Revoke share token."""
        session = get_object_or_404(SoloSession, pk=pk, user=request.user)
        SharingService.revoke_share(session)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicSessionView(APIView):
    """
    GET /api/v1/solo/public/{token}/
    
    Public access to shared session (read-only).
    """
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]
    
    def get(self, request, token):
        share = SharingService.get_by_token(token)
        
        if not share:
            return Response(
                {'error': 'Invalid or expired share link'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Record access
        ip = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        share.record_access(ip_address=ip, user_agent=user_agent)
        
        # Return session data (read-only)
        session = share.session
        data = {
            'id': str(session.id),
            'name': session.name,
            'state': session.state,
            'page_count': session.page_count,
            'owner': session.user.get_full_name() or session.user.email,
            'allow_download': share.allow_download,
            'created_at': session.created_at,
            'thumbnail_url': session.thumbnail_url,
        }
        
        return Response(data)


class ThumbnailRegenerateView(APIView):
    """
    POST /api/v1/solo/sessions/{id}/thumbnail/
    
    Regenerate session thumbnail.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        session = get_object_or_404(SoloSession, pk=pk, user=request.user)
        
        url = ThumbnailService.generate_and_upload(session)
        
        if url:
            return Response({
                'thumbnail_url': url,
                'status': 'success',
            })
        else:
            return Response(
                {'error': 'Failed to generate thumbnail'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================ v0.28 Export Views

class ExportDetailView(APIView):
    """
    GET /api/v1/exports/{id}/
    
    Get export status for polling.
    Frontend polls this endpoint to check if export is ready.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        """Get export status by ID."""
        export = get_object_or_404(SoloExport, pk=pk, user=request.user)
        serializer = SoloExportSerializer(export)
        return Response(serializer.data)


class SessionExportsListView(APIView):
    """
    GET /api/v1/solo/sessions/{id}/exports/
    
    List all exports for a session.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        """List exports for a session."""
        session = get_object_or_404(SoloSession, pk=pk, user=request.user)
        exports = SoloExport.objects.filter(session=session, user=request.user)
        serializer = SoloExportSerializer(exports, many=True)
        return Response({
            'count': exports.count(),
            'results': serializer.data
        })


class SoloSessionDiffSaveView(BackoffThrottleMixin, QuotaLimitMixin, APIView):
    """
    PATCH /api/v1/solo/sessions/{id}/diff

    Apply incremental diff operations with optimistic locking via rev.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [SoloDiffThrottle]
    REV_HEADER_PATTERN = re.compile(r'rev:(\d+)', re.IGNORECASE)
    MAX_DIFF_BYTES = DIFF_MAX_BYTES
    MAX_OPS_PER_SAVE = 100

    def patch(self, request, pk):
        limit_error = self._check_payload_limit(request)
        if limit_error:
            return limit_error

        body_bytes, body_error = _read_body_with_limit(request, self.MAX_DIFF_BYTES)
        if body_error:
            return body_error
        try:
            parsed = json.loads(body_bytes.decode('utf-8')) if body_bytes else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            parsed = request.data

        serializer = SoloDiffSaveSerializer(data=parsed)
        serializer.is_valid(raise_exception=True)
        ops = serializer.validated_data['ops']
        client_ts = serializer.validated_data.get('client_ts')

        if not ops:
            raise ValidationError({'ops': 'At least one operation is required'})

        # Check ops quota
        ops_error = self.check_ops_quota(ops)
        if ops_error:
            return ops_error

        with transaction.atomic():
            session = self._get_session_for_update(pk, request.user)

            if_match = request.headers.get('If-Match')
            if if_match:
                try:
                    if_match_rev = _parse_if_match_rev(if_match)
                except Exception:
                    return _precondition_failed_response()
                if session.rev != if_match_rev:
                    return _precondition_failed_response()
            else:
                x_rev = request.headers.get('X-Rev') or request.headers.get('X-Revision')
                if not x_rev:
                    return _rev_mismatch_response(session.rev)
                try:
                    x_rev_int = int(x_rev)
                except (TypeError, ValueError):
                    return _rev_mismatch_response(session.rev)
                if session.rev != x_rev_int:
                    return _rev_mismatch_response(session.rev)

            try:
                new_state = SoloDiffService.apply_diff(session.state, ops)
            except SoloDiffError as exc:
                return Response(
                    {'detail': 'invalid_ops', 'message': str(exc)},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            digest = SoloDiffService.compute_digest(new_state)
            new_page_count = max(1, len(new_state.get('pages') or []))
            write_ts = timezone.now()
            prev_rev = session.rev
            next_rev = prev_rev + 1

            session.state = new_state
            session.rev = next_rev
            session.state_digest = digest
            session.page_count = new_page_count
            session.last_write_at = write_ts
            session.save(update_fields=['state', 'rev', 'state_digest', 'page_count', 'last_write_at', 'updated_at'])

        response_data = {
            'server_ts': write_ts.isoformat(),
            'next_rev': next_rev,
            'digest': digest,
        }
        response = Response(response_data, status=status.HTTP_200_OK)
        response['ETag'] = f'W/"rev:{next_rev}"'
        self._log_diff_event(request, session, prev_rev, next_rev, len(ops), digest, client_ts, write_ts)
        return response

    @classmethod
    def _parse_if_match_header(cls, value):
        match = cls.REV_HEADER_PATTERN.search(value or '')
        if match:
            return int(match.group(1))
        candidate = value.strip()
        if candidate.startswith('W/'):
            candidate = candidate[2:].strip()
        candidate = candidate.strip('"')
        try:
            return int(candidate)
        except ValueError as exc:
            raise ValidationError({'If-Match': 'invalid format'}) from exc

    @staticmethod
    def _parse_int_header(value, header_name):
        try:
            return int(value)
        except ValueError as exc:
            raise ValidationError({header_name: 'must be integer'}) from exc

    def _extract_client_rev(self, request, body_rev):
        header_value = request.headers.get('If-Match')
        if header_value:
            return self._parse_if_match_header(header_value)
        x_rev = request.headers.get('X-Rev') or request.headers.get('X-Revision')
        if x_rev:
            return self._parse_int_header(x_rev, 'X-Rev')
        return body_rev

    def _get_session_for_update(self, pk, user):
        queryset = SoloSession.objects.select_for_update().filter(pk=pk, user=user)
        return get_object_or_404(queryset)

    @staticmethod
    def _rev_mismatch_response(expected_rev, client_rev):
        return Response(
            {
                'detail': 'rev_mismatch',
                'expected_rev': expected_rev,
                'your_rev': client_rev,
            },
            status=status.HTTP_409_CONFLICT,
        )

    def _log_diff_event(self, request, session, prev_rev, next_rev, ops_count, digest, client_ts, write_ts):
        try:
            LogService.log_backend_event(
                level='INFO',
                service='solo',
                message='diff_save',
                user_id=request.user.id,
                extra={
                    'session_id': str(session.id),
                    'prev_rev': prev_rev,
                    'next_rev': next_rev,
                    'ops_count': ops_count,
                    'digest': digest,
                    'client_ts': client_ts.isoformat() if client_ts else None,
                    'server_ts': write_ts.isoformat(),
                },
            )
        except Exception:
            pass

    def _check_payload_limit(self, request):
        limit = getattr(self, 'MAX_DIFF_BYTES', None)
        if not limit:
            return None

        content_length = request.META.get('CONTENT_LENGTH')
        if content_length:
            try:
                if int(content_length) > limit:
                    return _payload_too_large_response(request, limit, 'raw')
            except (TypeError, ValueError):
                pass

        try:
            body = request.body
        except RequestDataTooBig:
            return self._payload_too_large_response()
        if body and len(body) > limit:
            return _payload_too_large_response(request, limit, 'raw')
        encoding = (request.headers.get('Content-Encoding') or '').strip().lower()
        if encoding == 'gzip':
            _, err = _read_body_with_limit(request, limit)
            if err:
                return err
        return None

    @staticmethod
    def _payload_too_large_response():
        return Response(
            {'detail': 'payload_too_large'},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )


# ============================================================ v0.29 Beacon/Stream Save

class SoloSessionStreamSaveView(BackoffThrottleMixin, APIView):
    """
    POST /api/v1/solo/sessions/{id}/save-stream

    Chunked/gzip upload for worker-friendly saves.
    Accepts full state or partial state with rev.
    Returns 202 Accepted or 204 No Content.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [SoloSaveStreamThrottle]
    MAX_STREAM_BYTES = STREAM_MAX_BYTES

    def post(self, request, pk):
        limit_error = self._check_payload_limit(request)
        if limit_error:
            return limit_error

        # Accept JSON state or raw binary
        content_type = request.content_type or ''
        if 'application/json' in content_type:
            body_bytes, body_error = _read_body_with_limit(request, self.MAX_STREAM_BYTES)
            if body_error:
                return body_error
            try:
                parsed = json.loads(body_bytes.decode('utf-8')) if body_bytes else {}
            except (json.JSONDecodeError, UnicodeDecodeError):
                parsed = request.data

            state_data = parsed.get('state') if isinstance(parsed, dict) else None
            client_ts = parsed.get('client_ts') if isinstance(parsed, dict) else None
            idempotency_key = parsed.get('idempotency_key') if isinstance(parsed, dict) else None
        else:
            # Raw body as state JSON
            try:
                body = request.body
                state_data = json.loads(body) if body else None
                client_ts = None
                idempotency_key = None
            except (json.JSONDecodeError, ValueError):
                return Response(
                    {'detail': 'invalid_json'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not state_data:
            return Response(
                {'detail': 'state_required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Idempotency (best-effort) for keepalive fetch.
        # Keyed by user+session+idempotency_key.
        if idempotency_key:
            idem_cache_key = f"solo:stream:idem:{request.user.id}:{pk}:{idempotency_key}"
            cached = cache.get(idem_cache_key)
            if cached:
                return Response(cached, status=status.HTTP_202_ACCEPTED)

        session = get_object_or_404(SoloSession, pk=pk, user=request.user)

        if_match = request.headers.get('If-Match')
        if if_match:
            try:
                if_match_rev = _parse_if_match_rev(if_match)
            except Exception:
                return _precondition_failed_response()
        else:
            if_match_rev = None

        if if_match_rev is None:
            x_rev = request.headers.get('X-Rev') or request.headers.get('X-Revision')
            if not x_rev:
                return _rev_mismatch_response(session.rev)
            try:
                x_rev_int = int(x_rev)
            except (TypeError, ValueError):
                return _rev_mismatch_response(session.rev)
            if session.rev != x_rev_int:
                return _rev_mismatch_response(session.rev)
        else:
            if session.rev != if_match_rev:
                return _precondition_failed_response()

        response_payload = None
        with transaction.atomic():
            session = SoloSession.objects.select_for_update().get(pk=pk, user=request.user)

            new_digest = SoloDiffService.compute_digest(state_data)
            if session.state_digest and session.state_digest == new_digest:
                # No change: avoid extra work.
                session.last_write_at = timezone.now()
                session.save(update_fields=['last_write_at', 'updated_at'])
                response_payload = {'detail': 'no_change', 'rev': session.rev, 'digest': session.state_digest}
            else:
                session.state = state_data
                session.rev += 1
                session.state_digest = new_digest
                session.page_count = max(1, len(state_data.get('pages') or []))
                session.last_write_at = timezone.now()
                session.save(update_fields=['state', 'rev', 'state_digest', 'page_count', 'last_write_at', 'updated_at'])
                response_payload = {'detail': 'accepted', 'rev': session.rev, 'digest': session.state_digest}

            try:
                if idempotency_key and response_payload:
                    cache.set(idem_cache_key, response_payload, timeout=60)
            except Exception:
                pass

            # Best-effort: persist versioned snapshot async (do not block response).
            try:
                from apps.solo.tasks import upload_state_versioned_task
                if response_payload and response_payload.get('detail') == 'accepted':
                    upload_state_versioned_task.delay(str(request.user.id), str(session.id), int(session.rev))
            except Exception:
                pass

            self._log_stream_save(request, session)
            if response_payload and response_payload.get('detail') == 'no_change':
                return Response(status=status.HTTP_204_NO_CONTENT)
            return Response(response_payload or {}, status=status.HTTP_202_ACCEPTED)

    def _check_payload_limit(self, request):
        limit = self.MAX_STREAM_BYTES
        content_length = request.META.get('CONTENT_LENGTH')
        if content_length:
            try:
                if int(content_length) > limit:
                    return _payload_too_large_response(request, limit, 'raw')
            except (TypeError, ValueError):
                pass
        body = request.body
        if body and len(body) > limit:
            return _payload_too_large_response(request, limit, 'raw')
        encoding = (request.headers.get('Content-Encoding') or '').strip().lower()
        if encoding == 'gzip':
            _, err = _read_body_with_limit(request, limit)
            if err:
                return err
        return None

    def _log_stream_save(self, request, session):
        try:
            LogService.log_backend_event(
                level='INFO',
                service='solo',
                message='stream_save',
                user_id=request.user.id,
                extra={
                    'session_id': str(session.id),
                    'rev': session.rev,
                    'digest': session.state_digest,
                },
            )
        except Exception:
            pass


class SoloSessionBeaconSaveView(BackoffThrottleMixin, APIView):
    """
    POST /api/v1/solo/sessions/{id}/beacon

    Keepalive-friendly endpoint for navigator.sendBeacon().
    Max 64KB, text/plain or application/json.
    Returns 204 No Content immediately.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [SoloBeaconThrottle]
    MAX_BEACON_BYTES = BEACON_MAX_BYTES

    def post(self, request, pk):
        limit_error = self._check_payload_limit(request)
        if limit_error:
            return limit_error

        session = get_object_or_404(SoloSession, pk=pk, user=request.user)

        # Parse beacon payload
        content_type = request.content_type or ''
        body_bytes, body_error = _read_body_with_limit(request, self.MAX_BEACON_BYTES)
        if body_error:
            return body_error
        body = body_bytes

        if not body:
            return Response(status=status.HTTP_204_NO_CONTENT)

        try:
            if 'application/json' in content_type:
                data = json.loads(body.decode('utf-8')) if body else {}
            else:
                # text/plain - try JSON parse
                data = json.loads(body.decode('utf-8'))
        except (json.JSONDecodeError, ValueError, UnicodeDecodeError):
            return Response(
                {'detail': 'invalid_payload'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_ts = data.get('client_ts') if isinstance(data, dict) else None

        # Fast log - do not fail request.
        try:
            LogService.log_backend_event(
                level='INFO',
                service='solo',
                message='beacon_received',
                user_id=request.user.id,
                extra={
                    'session_id': str(session.id),
                    'size': len(body) if body else 0,
                    'client_ts': client_ts,
                },
            )
        except Exception:
            pass

        session.last_write_at = timezone.now()
        session.save(update_fields=['last_write_at', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _check_payload_limit(self, request):
        limit = self.MAX_BEACON_BYTES
        content_length = request.META.get('CONTENT_LENGTH')
        if content_length:
            try:
                if int(content_length) > limit:
                    return _payload_too_large_response(request, limit, 'raw')
            except (TypeError, ValueError):
                pass
        body = request.body
        if body and len(body) > limit:
            return _payload_too_large_response(request, limit, 'raw')
        encoding = (request.headers.get('Content-Encoding') or '').strip().lower()
        if encoding == 'gzip':
            _, err = _read_body_with_limit(request, limit)
            if err:
                return err
        return None


class SoloSessionSnapshotCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        session = get_object_or_404(SoloSession, pk=pk, user=request.user)

        idempotency_key = request.headers.get('Idempotency-Key')
        if idempotency_key:
            cache_key = f"solo:snapshot:idem:{request.user.id}:{pk}:{idempotency_key}"
            cached = cache.get(cache_key)
            if cached:
                return Response(cached, status=status.HTTP_201_CREATED)

        rev = int(session.rev)
        path = f"solo/{request.user.id}/{session.id}/{rev}.json"

        payload = json.dumps(session.state or {}, ensure_ascii=False, separators=(',', ':')).encode('utf-8')

        storage = SoloStorageService()
        existing_head = storage.head(path)
        existing_size = int((existing_head or {}).get('size') or 0)
        delta_bytes = max(0, len(payload) - existing_size)

        from apps.solo.models import SoloUserStorage

        with transaction.atomic():
            storage_row, _ = SoloUserStorage.objects.select_for_update().get_or_create(
                user_id=request.user.id,
                defaults={'used_bytes': 0, 'quota_bytes': 0},
            )
            quota = int(storage_row.quota_bytes or 0)
            used = int(storage_row.used_bytes or 0)
            if quota > 0 and used + delta_bytes > quota:
                remaining = max(0, quota - used)
                return Response(
                    {
                        'error': 'quota_exceeded',
                        'used': used,
                        'quota': quota,
                        'remaining': remaining,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            storage_row.used_bytes = used + delta_bytes
            storage_row.save(update_fields=['used_bytes', 'updated_at'])

        storage.upload_state_versioned(
            user_id=str(request.user.id),
            session_id=str(session.id),
            rev=rev,
            state_json=payload,
        )
        url = storage.get_signed_url(path, expires_in=900)

        response_payload = {
            'rev': rev,
            'url': url,
        }

        if idempotency_key:
            try:
                cache.set(cache_key, response_payload, timeout=60)
            except Exception:
                pass

        return Response(response_payload, status=status.HTTP_201_CREATED)


class SoloSessionSnapshotLatestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        session = get_object_or_404(SoloSession, pk=pk, user=request.user)
        rev = int(session.rev)
        path = f"solo/{request.user.id}/{session.id}/{rev}.json"
        storage = SoloStorageService()

        head = storage.head(path)
        if head is None:
            return Response({'error': 'not_found'}, status=status.HTTP_404_NOT_FOUND)

        url = storage.get_signed_url(path, expires_in=900)
        return Response({'rev': rev, 'url': url}, status=status.HTTP_200_OK)
