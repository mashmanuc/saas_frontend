"""
Cloud storage service for Solo Workspace.
Supports S3, GCS, and local filesystem fallback.
"""
import io
import os
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO, Optional

from django.conf import settings


class StorageBackend(ABC):
    """Abstract storage backend."""
    
    @abstractmethod
    def upload(self, file: BinaryIO, path: str, content_type: str) -> str:
        """Upload file and return URL."""
        pass
    
    @abstractmethod
    def download(self, path: str) -> BinaryIO:
        """Download file."""
        pass
    
    @abstractmethod
    def delete(self, path: str) -> bool:
        """Delete file."""
        pass
    
    @abstractmethod
    def get_signed_url(self, path: str, expires_in: int = 900) -> str:
        """Get signed URL (default 15 min)."""
        pass


class S3StorageBackend(StorageBackend):
    """AWS S3/R2 storage backend with versioning support."""
    
    def __init__(self):
        try:
            import boto3
            # Support both AWS S3 and Cloudflare R2
            endpoint_url = getattr(settings, 'AWS_S3_ENDPOINT_URL', None)
            self.s3 = boto3.client(
                's3',
                aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', None),
                aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', None),
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'eu-central-1'),
                endpoint_url=endpoint_url,
            )
            self.bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'solo-workspace')
            self.cdn_domain = getattr(settings, 'SOLO_CDN_DOMAIN', None)
        except ImportError:
            raise ImportError("boto3 is required for S3 storage backend")
    
    def upload(self, file: BinaryIO, path: str, content_type: str) -> str:
        self.s3.upload_fileobj(
            file,
            self.bucket,
            path,
            ExtraArgs={'ContentType': content_type}
        )
        return f"s3://{self.bucket}/{path}"
    
    def upload_versioned(self, file: BinaryIO, path: str, content_type: str, 
                         metadata: Optional[dict] = None) -> dict:
        """
        Upload file with versioning metadata.
        Returns dict with url, version_id, etag.
        """
        extra_args = {'ContentType': content_type}
        if metadata:
            extra_args['Metadata'] = {k: str(v) for k, v in metadata.items()}
        
        self.s3.upload_fileobj(
            file,
            self.bucket,
            path,
            ExtraArgs=extra_args
        )
        
        # Get version info
        try:
            head = self.s3.head_object(Bucket=self.bucket, Key=path)
            return {
                'url': f"s3://{self.bucket}/{path}",
                'version_id': head.get('VersionId'),
                'etag': head.get('ETag', '').strip('"'),
                'size': head.get('ContentLength', 0),
            }
        except Exception:
            return {'url': f"s3://{self.bucket}/{path}"}
    
    def download(self, path: str) -> BinaryIO:
        buffer = io.BytesIO()
        self.s3.download_fileobj(self.bucket, path, buffer)
        buffer.seek(0)
        return buffer
    
    def delete(self, path: str) -> bool:
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=path)
            return True
        except Exception:
            return False
    
    def get_signed_url(self, path: str, expires_in: int = 900) -> str:
        url = self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': path},
            ExpiresIn=expires_in
        )
        # Replace with CDN domain if configured
        if self.cdn_domain:
            import urllib.parse
            parsed = urllib.parse.urlparse(url)
            url = url.replace(f"{parsed.scheme}://{parsed.netloc}", f"https://{self.cdn_domain}")
        return url
    
    def head(self, path: str) -> Optional[dict]:
        """Get object metadata without downloading."""
        try:
            head = self.s3.head_object(Bucket=self.bucket, Key=path)
            return {
                'size': head.get('ContentLength', 0),
                'content_type': head.get('ContentType'),
                'etag': head.get('ETag', '').strip('"'),
                'last_modified': head.get('LastModified'),
                'version_id': head.get('VersionId'),
            }
        except Exception:
            return None


class LocalStorageBackend(StorageBackend):
    """Local filesystem fallback with versioning simulation."""
    
    def __init__(self):
        media_root = getattr(settings, 'MEDIA_ROOT', Path('media'))
        if isinstance(media_root, str):
            media_root = Path(media_root)
        self.base_path = media_root / 'solo'
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def upload(self, file: BinaryIO, path: str, content_type: str) -> str:
        full_path = self.base_path / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(full_path, 'wb') as f:
            f.write(file.read())
        
        return f"/media/solo/{path}"
    
    def upload_versioned(self, file: BinaryIO, path: str, content_type: str,
                         metadata: Optional[dict] = None) -> dict:
        """Upload with versioning simulation."""
        import hashlib
        full_path = self.base_path / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        content = file.read()
        with open(full_path, 'wb') as f:
            f.write(content)
        
        etag = hashlib.md5(content).hexdigest()
        return {
            'url': f"/media/solo/{path}",
            'version_id': None,
            'etag': etag,
            'size': len(content),
        }
    
    def download(self, path: str) -> BinaryIO:
        full_path = self.base_path / path
        return open(full_path, 'rb')
    
    def delete(self, path: str) -> bool:
        try:
            (self.base_path / path).unlink()
            return True
        except Exception:
            return False
    
    def get_signed_url(self, path: str, expires_in: int = 900) -> str:
        # Local doesn't support signed URLs, return direct path
        return f"/media/solo/{path}"
    
    def head(self, path: str) -> Optional[dict]:
        """Get file metadata."""
        import hashlib
        from datetime import datetime
        full_path = self.base_path / path
        if not full_path.exists():
            return None
        
        stat = full_path.stat()
        with open(full_path, 'rb') as f:
            etag = hashlib.md5(f.read()).hexdigest()
        
        return {
            'size': stat.st_size,
            'content_type': 'application/octet-stream',
            'etag': etag,
            'last_modified': datetime.fromtimestamp(stat.st_mtime),
            'version_id': None,
        }


def get_storage_backend() -> StorageBackend:
    """Factory function to get configured storage backend."""
    backend_type = getattr(settings, 'SOLO_STORAGE_BACKEND', 'local')
    
    if backend_type == 's3':
        return S3StorageBackend()
    elif backend_type == 'gcs':
        # TODO: Implement GCS backend
        raise NotImplementedError("GCS backend not implemented")
    else:
        return LocalStorageBackend()


class SoloStorageService:
    """
    High-level storage service for Solo Workspace.
    
    Key patterns:
    - State: solo/{user_id}/{session_id}/{rev}.json
    - Exports: solo/{user_id}/{session_id}/exports/{export_id}.{ext}
    - Thumbnails: solo/{user_id}/{session_id}/thumbnail.png
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.backend = get_storage_backend()
        return cls._instance
    
    def upload_export(self, session_id: str, file: BinaryIO, 
                      format: str, page: int = 0, user_id: str = None,
                      export_id: str = None) -> str:
        """Upload an export file."""
        ext = format.lower()
        export_id = export_id or str(uuid.uuid4())
        
        if user_id:
            # New versioned path pattern
            path = f"solo/{user_id}/{session_id}/exports/{export_id}.{ext}"
        else:
            # Legacy path
            path = f"exports/{session_id}/{export_id}.{ext}"
        
        content_type = {
            'png': 'image/png',
            'pdf': 'application/pdf',
            'json': 'application/json',
        }.get(ext, 'application/octet-stream')
        
        return self.backend.upload(file, path, content_type)
    
    def upload_thumbnail(self, session_id: str, file: BinaryIO, 
                         user_id: str = None) -> str:
        """Upload a thumbnail."""
        if user_id:
            path = f"solo/{user_id}/{session_id}/thumbnail.png"
        else:
            path = f"thumbnails/{session_id}/thumbnail.png"
        return self.backend.upload(file, path, 'image/png')
    
    def upload_state_versioned(self, user_id: str, session_id: str, rev: int,
                               state_json: bytes) -> dict:
        """
        Upload session state with versioning.
        Path: solo/{user_id}/{session_id}/{rev}.json
        """
        path = f"solo/{user_id}/{session_id}/{rev}.json"
        file = io.BytesIO(state_json)
        
        if hasattr(self.backend, 'upload_versioned'):
            return self.backend.upload_versioned(
                file, path, 'application/json',
                metadata={'rev': str(rev), 'session_id': session_id}
            )
        else:
            url = self.backend.upload(file, path, 'application/json')
            return {'url': url}
    
    def get_signed_url(self, path: str, expires_in: int = 900) -> str:
        """Get signed URL for file access."""
        return self.backend.get_signed_url(path, expires_in)
    
    def get_export_signed_url(self, user_id: str, session_id: str, 
                              export_id: str, ext: str, 
                              expires_in: int = 3600) -> str:
        """Get signed URL for export download."""
        path = f"solo/{user_id}/{session_id}/exports/{export_id}.{ext}"
        return self.backend.get_signed_url(path, expires_in)
    
    def head(self, path: str) -> Optional[dict]:
        """Get object metadata (HEAD request)."""
        if hasattr(self.backend, 'head'):
            return self.backend.head(path)
        return None

    def list_state_revs(self, user_id: str, session_id: str) -> list[int]:
        prefix = f"solo/{user_id}/{session_id}/"

        if isinstance(self.backend, LocalStorageBackend):
            base = self.backend.base_path / prefix
            if not base.exists():
                return []
            revs: list[int] = []
            for child in base.iterdir():
                if not child.is_file():
                    continue
                if child.suffix != '.json':
                    continue
                try:
                    revs.append(int(child.stem))
                except ValueError:
                    continue
            return sorted(revs)

        if isinstance(self.backend, S3StorageBackend):
            revs: list[int] = []
            continuation_token = None
            while True:
                kwargs = {
                    'Bucket': self.backend.bucket,
                    'Prefix': prefix,
                    'MaxKeys': 1000,
                }
                if continuation_token:
                    kwargs['ContinuationToken'] = continuation_token
                resp = self.backend.s3.list_objects_v2(**kwargs)
                for item in resp.get('Contents', []) or []:
                    key = item.get('Key') or ''
                    if not key.endswith('.json'):
                        continue
                    name = key.split('/')[-1]
                    if not name.endswith('.json'):
                        continue
                    try:
                        revs.append(int(name[:-5]))
                    except ValueError:
                        continue
                if resp.get('IsTruncated'):
                    continuation_token = resp.get('NextContinuationToken')
                    continue
                break
            return sorted(revs)

        return []

    def delete_state_version(self, user_id: str, session_id: str, rev: int) -> int:
        path = f"solo/{user_id}/{session_id}/{int(rev)}.json"
        meta = self.head(path)
        size = int((meta or {}).get('size') or 0)
        try:
            ok = self.backend.delete(path)
        except Exception:
            ok = False
        if not ok:
            return 0
        return size
    
    def delete_session_files(self, session_id: str, user_id: str = None) -> None:
        """Delete all files for a session."""
        if user_id:
            # New path pattern
            self.backend.delete(f"solo/{user_id}/{session_id}")
        else:
            # Legacy paths
            self.backend.delete(f"exports/{session_id}")
            self.backend.delete(f"thumbnails/{session_id}")
