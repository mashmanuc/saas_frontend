"""Solo Workspace core services (exports, diff handling)."""
from __future__ import annotations

import copy
import hashlib
import json
import io
from typing import Any, Dict, List, Optional

from apps.solo.services.storage import (
    StorageBackend,
    S3StorageBackend,
    LocalStorageBackend,
    get_storage_backend,
    SoloStorageService,
)
from apps.solo.services.sharing import SharingService
from apps.solo.services.thumbnail import ThumbnailService
from apps.solo.services.cdn import CdnService


class SoloDiffError(Exception):
    """Raised when diff operations cannot be applied."""


class SoloDiffService:
    """Utility helpers for applying diff operations to solo session state."""

    SUPPORTED_KINDS = {'stroke', 'asset', 'meta'}

    @staticmethod
    def compute_digest(state: Dict[str, Any]) -> str:
        """Return SHA256 digest of the session state."""
        normalized = json.dumps(state or {}, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

    @classmethod
    def apply_diff(cls, state: Dict[str, Any], operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Apply diff operations to a copy of the provided state."""
        new_state = copy.deepcopy(state or {})
        pages = new_state.setdefault('pages', [])
        if not pages:
            pages.append({'id': new_state.get('activePageId') or 'page-1', 'strokes': [], 'assets': []})
        for page in pages:
            page.setdefault('strokes', [])
            page.setdefault('assets', [])
        new_state.setdefault('activePageId', pages[0].get('id'))

        for op in operations:
            cls._apply_single_op(new_state, op)

        return new_state

    @classmethod
    def _apply_single_op(cls, state: Dict[str, Any], op: Dict[str, Any]) -> None:
        op_type = op.get('op')
        kind = op.get('kind')
        if op_type not in {'add', 'update', 'remove'}:
            raise SoloDiffError(f"Unsupported op '{op_type}'")
        if kind not in cls.SUPPORTED_KINDS:
            raise SoloDiffError(f"Unsupported kind '{kind}'")

        if kind == 'meta':
            cls._apply_meta_op(state, op)
        else:
            cls._apply_collection_op(state, op_type, kind, op)

    @classmethod
    def _apply_meta_op(cls, state: Dict[str, Any], op: Dict[str, Any]) -> None:
        meta = state.setdefault('meta', {})
        if op['op'] == 'remove':
            key = op.get('id')
            if key in meta:
                meta.pop(key, None)
            return
        patch = op.get('patch') or op.get('value')
        if not isinstance(patch, dict):
            raise SoloDiffError('Meta op requires dict payload')
        meta.update(patch)

    @classmethod
    def _apply_collection_op(
        cls,
        state: Dict[str, Any],
        op_type: str,
        kind: str,
        op: Dict[str, Any],
    ) -> None:
        page = cls._resolve_page(state, op)
        collection = page['strokes'] if kind == 'stroke' else page['assets']

        if op_type == 'add':
            value = op.get('value')
            if not isinstance(value, dict):
                raise SoloDiffError('Add op requires "value" dict')
            item_id = value.get('id')
            if not item_id:
                raise SoloDiffError('Add op value must include id')
            if any(item.get('id') == item_id for item in collection):
                raise SoloDiffError(f'Item {item_id} already exists')
            collection.append(value)
            return

        item_id = op.get('id')
        if not item_id:
            raise SoloDiffError('Update/remove ops require id')

        item = cls._find_item(collection, item_id)
        if item is None:
            raise SoloDiffError(f'Item {item_id} not found')

        if op_type == 'remove':
            collection.remove(item)
            return

        patch = op.get('patch') or op.get('value')
        if not isinstance(patch, dict):
            raise SoloDiffError('Update requires patch/value dict')
        for k, v in patch.items():
            if k == 'id':
                continue
            item[k] = v

    @staticmethod
    def _find_item(collection: List[Dict[str, Any]], item_id: str) -> Optional[Dict[str, Any]]:
        for item in collection:
            if item.get('id') == item_id:
                return item
        return None

    @staticmethod
    def _resolve_page(state: Dict[str, Any], op: Dict[str, Any]) -> Dict[str, Any]:
        target_page_id = op.get('page_id') or op.get('value', {}).get('page_id') or state.get('activePageId')
        pages = state.setdefault('pages', [])
        for page in pages:
            if page.get('id') == target_page_id:
                return page
        if not pages:
            pages.append({'id': target_page_id or 'page-1', 'strokes': [], 'assets': []})
            return pages[-1]
        return pages[0]


class SoloService:
    """Solo workspace service for exports and utilities."""
    
    # Export TTL in hours
    EXPORT_TTL_HOURS = 24

    @staticmethod
    def create_export(session, format_type: str, user, idempotency_key: str = None):
        """
        Create an export request.

        For JSON: synchronous processing (immediate completion)
        For PNG/PDF: async processing via Celery task (if available)
        
        Args:
            session: SoloSession instance
            format_type: 'png', 'pdf', or 'json'
            user: User requesting the export
            idempotency_key: Optional key for duplicate detection
        """
        from datetime import timedelta
        from django.utils import timezone
        from apps.solo.models import SoloExport
        
        # Calculate expiry
        expires_at = timezone.now() + timedelta(hours=SoloService.EXPORT_TTL_HOURS)

        export = SoloExport.objects.create(
            session=session,
            user=user,
            format=format_type,
            status='pending',
            idempotency_key=idempotency_key,
            expires_at=expires_at,
        )

        if format_type == 'json':
            SoloService._process_json_export(export)
        else:
            try:
                from apps.solo.tasks import process_export_task

                process_export_task.delay(str(export.id))
            except Exception:
                SoloService._process_export_sync(export)

        export.refresh_from_db()
        return export

    @staticmethod
    def _process_json_export(export):
        """Process JSON export synchronously."""
        session = export.session

        content = json.dumps(
            {
                'id': str(session.id),
                'name': session.name,
                'state': session.state,
                'page_count': session.page_count,
                'created_at': session.created_at.isoformat(),
                'updated_at': session.updated_at.isoformat(),
            },
            indent=2,
            ensure_ascii=False,
        )

        file_size = len(content.encode('utf-8'))

        try:
            storage = get_storage_backend()
            file_path = f"exports/{export.user.id}/{export.id}.json"
            payload_bytes = content.encode('utf-8')
            if hasattr(storage, 'upload_content'):
                file_url = storage.upload_content(
                    payload_bytes,
                    file_path,
                    content_type='application/json',
                )
            else:
                file_url = storage.upload(
                    io.BytesIO(payload_bytes),
                    file_path,
                    content_type='application/json',
                )

            export.file_url = file_url
            export.file_size = file_size
            export.status = 'completed'
        except Exception as exc:
            export.status = 'failed'
            export.error = str(exc)

        export.save()

    @staticmethod
    def _process_export_sync(export):
        """Fallback synchronous processing for PNG/PDF."""
        export.status = 'processing'
        export.save()

        try:
            if export.format == 'png':
                export.status = 'failed'
                export.error = 'PNG export requires client-side rendering. Use stage.toDataURL() in frontend.'
            elif export.format == 'pdf':
                export.status = 'failed'
                export.error = 'PDF export not yet implemented. Install reportlab for server-side PDF generation.'
            else:
                export.status = 'failed'
                export.error = f'Unknown format: {export.format}'
        except Exception as exc:
            export.status = 'failed'
            export.error = str(exc)

        export.save()

    @staticmethod
    def duplicate_session(session):
        """Create a copy of a session."""
        from apps.solo.models import SoloSession

        new_session = SoloSession.objects.create(
            user=session.user,
            name=f"{session.name} (Copy)",
            state=session.state,
            page_count=session.page_count,
        )

        return new_session

    @staticmethod
    def get_recent_sessions(user, limit: int = 5):
        """Get user's recent sessions."""
        from apps.solo.models import SoloSession

        return SoloSession.objects.filter(user=user)[:limit]


__all__ = [
    'StorageBackend',
    'S3StorageBackend',
    'LocalStorageBackend',
    'get_storage_backend',
    'SoloStorageService',
    'SharingService',
    'ThumbnailService',
    'CdnService',
    'SoloService',
    'SoloDiffService',
]
