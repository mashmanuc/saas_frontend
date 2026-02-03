# Solo Workspace Backend

## Overview

Backend API for Solo Workspace - a whiteboard practice tool with cloud sync and sharing capabilities.

## Features (v0.27)

- **Cloud storage** (S3/GCS/Local filesystem)
- **Session sharing** with secure tokens
- **Thumbnail generation** from canvas state
- **PDF/PNG/JSON export**
- **Rate limiting** for API protection
- **Audit logging** for observability

## API Endpoints

### Sessions (v0.26)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/solo/sessions/` | List user's sessions |
| POST | `/api/v1/solo/sessions/` | Create new session |
| GET | `/api/v1/solo/sessions/{id}/` | Get session with full state |
| PATCH | `/api/v1/solo/sessions/{id}/` | Update session (autosave) |
| DELETE | `/api/v1/solo/sessions/{id}/` | Delete session |
| POST | `/api/v1/solo/sessions/{id}/export/` | Export session |
| POST | `/api/v1/solo/sessions/{id}/duplicate/` | Duplicate session |

### Sharing (v0.27)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/solo/sessions/{id}/share/` | Get share status |
| POST | `/api/v1/solo/sessions/{id}/share/` | Create share link |
| DELETE | `/api/v1/solo/sessions/{id}/share/` | Revoke share link |
| GET | `/api/v1/solo/public/{token}/` | Access shared session (public) |
| POST | `/api/v1/solo/sessions/{id}/thumbnail/` | Regenerate thumbnail |

## Configuration

```python
# settings.py

# Storage backend: 's3', 'gcs', or 'local'
SOLO_STORAGE_BACKEND = 'local'  # Default

# AWS S3 settings (if using S3)
AWS_ACCESS_KEY_ID = '...'
AWS_SECRET_ACCESS_KEY = '...'
AWS_STORAGE_BUCKET_NAME = 'my-bucket'
AWS_S3_REGION_NAME = 'eu-central-1'

# CDN (optional)
CDN_DOMAIN = 'cdn.example.com'

# Frontend URL for share links
FRONTEND_URL = 'https://app.example.com'

# Rate limiting
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'solo_user': '100/min',
        'solo_anon': '30/min',
        'solo_export': '10/min',
    }
}
```

## Celery Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| `solo.generate_thumbnail` | On demand | Generate session thumbnail |
| `solo.generate_pdf_export` | On demand | Generate PDF export |
| `solo.generate_png_export` | On demand | Generate PNG export |
| `solo.cleanup_exports` | Daily 3:00 AM | Clean exports older than 30 days |
| `solo.cleanup_expired_shares` | Daily 3:30 AM | Clean expired share tokens |
| `solo.cleanup_orphan_files` | Weekly Sunday | Clean orphan storage files |

## Models

### SoloSession
```python
id: UUID (PK)
user: FK → User
name: CharField(255)
state: JSONField  # Canvas state with pages, strokes, shapes
page_count: PositiveIntegerField
thumbnail_url: URLField (optional)
created_at: DateTimeField
updated_at: DateTimeField
```

### SoloExport
```python
id: UUID (PK)
session: FK → SoloSession
format: CharField (png/pdf/json)
file_url: URLField
file_size: PositiveIntegerField
created_at: DateTimeField
```

### ShareToken
```python
id: UUID (PK)
session: OneToOne → SoloSession
token: CharField(64, unique)
is_active: BooleanField
expires_at: DateTimeField (optional)
max_views: PositiveIntegerField (optional)
view_count: PositiveIntegerField
allow_download: BooleanField
created_at: DateTimeField
last_accessed_at: DateTimeField
```

### ShareAccessLog
```python
id: UUID (PK)
share_token: FK → ShareToken
ip_address: GenericIPAddressField
user_agent: TextField
accessed_at: DateTimeField
```

## Development

```bash
# Run migrations
python manage.py migrate solo

# Run tests
pytest apps/solo/ -v

# Run specific test class
pytest apps/solo/tests/test_v027.py::TestSharingAPI -v

# Check coverage
pytest apps/solo/ --cov=apps/solo --cov-report=html
```

## Security

- All session endpoints require authentication
- Users can only access their own sessions
- Share tokens use cryptographically secure random generation
- Public access is rate-limited
- All access is logged for audit

## Architecture

```
apps/solo/
├── models.py           # SoloSession, SoloExport, ShareToken, ShareAccessLog
├── api/
│   ├── views.py        # API views
│   └── serializers.py  # DRF serializers
├── services/
│   ├── storage.py      # Cloud storage abstraction
│   ├── sharing.py      # Share token management
│   ├── thumbnail.py    # Thumbnail generation
│   └── cdn.py          # CDN URL generation
├── tasks.py            # Celery tasks
├── signals.py          # Django signals for observability
├── permissions.py      # Custom permissions
├── throttling.py       # Rate limiting
└── middleware.py       # Audit middleware
```
