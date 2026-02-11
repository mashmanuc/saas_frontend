"""Solo Workspace services."""
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
from apps.solo.services.solo import SoloService, SoloDiffService, SoloDiffError


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
    'SoloDiffError',
]
