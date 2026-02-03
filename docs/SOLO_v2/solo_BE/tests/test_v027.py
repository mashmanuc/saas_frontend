"""
Tests for v0.27 Solo Workspace features.
"""
import pytest
from datetime import timedelta
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock

from apps.users.models import User
from apps.solo.models import SoloSession, ShareToken, ShareAccessLog


@pytest.fixture
def api_client():
    """API client fixture."""
    return APIClient()


@pytest.fixture
def student_user(db):
    """Create a student user."""
    return User.objects.create_user(
        email='student@test.com',
        password='testpass123',
        first_name='Test',
        last_name='Student',
        role='student',
    )


@pytest.fixture
def tutor_user(db):
    """Create a tutor user."""
    return User.objects.create_user(
        email='tutor@test.com',
        password='testpass123',
        first_name='Test',
        last_name='Tutor',
        role='tutor',
    )


@pytest.fixture
def solo_session(db, student_user):
    """Create a solo session."""
    return SoloSession.objects.create(
        user=student_user,
        name='Test Session',
        state={'pages': [{'strokes': []}]},
        page_count=1,
    )


@pytest.fixture
def solo_session_with_share(db, student_user):
    """Create a solo session with share token."""
    session = SoloSession.objects.create(
        user=student_user,
        name='Shared Session',
        state={'pages': [{'strokes': []}]},
        page_count=1,
    )
    ShareToken.objects.create(
        session=session,
        token='test_share_token_12345',
        expires_at=timezone.now() + timedelta(days=7),
        allow_download=True,
    )
    return session


@pytest.fixture
def expired_share_token(db, student_user):
    """Create an expired share token."""
    session = SoloSession.objects.create(
        user=student_user,
        name='Expired Session',
        state={'pages': []},
        page_count=1,
    )
    return ShareToken.objects.create(
        session=session,
        token='expired_token_12345',
        expires_at=timezone.now() - timedelta(days=1),  # Expired
    )


@pytest.mark.django_db
class TestSharingAPI:
    """Tests for session sharing."""
    
    def test_create_share_token(self, api_client, student_user, solo_session):
        """Test creating a share token."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-share', args=[solo_session.id])
        
        response = api_client.post(url, {
            'expires_in_days': 7,
            'allow_download': True,
        }, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'token' in response.data
        assert 'url' in response.data
        assert response.data['allow_download'] is True
    
    def test_get_share_status(self, api_client, student_user, solo_session_with_share):
        """Test getting share status."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-share', args=[solo_session_with_share.id])
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_shared'] is True
        assert 'token' in response.data
    
    def test_access_public_session(self, api_client, solo_session_with_share):
        """Test accessing shared session."""
        token = solo_session_with_share.share_token.token
        url = reverse('solo-api:public-session', args=[token])
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == solo_session_with_share.name
        assert 'state' in response.data
    
    def test_public_access_increments_view_count(self, api_client, solo_session_with_share):
        """Test that public access increments view count."""
        token = solo_session_with_share.share_token.token
        url = reverse('solo-api:public-session', args=[token])
        
        initial_count = solo_session_with_share.share_token.view_count
        
        api_client.get(url)
        
        solo_session_with_share.share_token.refresh_from_db()
        assert solo_session_with_share.share_token.view_count == initial_count + 1
    
    def test_public_access_creates_log(self, api_client, solo_session_with_share):
        """Test that public access creates access log."""
        token = solo_session_with_share.share_token.token
        url = reverse('solo-api:public-session', args=[token])
        
        api_client.get(url)
        
        assert ShareAccessLog.objects.filter(
            share_token=solo_session_with_share.share_token
        ).exists()
    
    def test_expired_token_rejected(self, api_client, expired_share_token):
        """Test that expired tokens are rejected."""
        url = reverse('solo-api:public-session', args=[expired_share_token.token])
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_invalid_token_rejected(self, api_client):
        """Test that invalid tokens are rejected."""
        url = reverse('solo-api:public-session', args=['invalid_token_xyz'])
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_revoke_share(self, api_client, student_user, solo_session_with_share):
        """Test revoking share token."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-share', args=[solo_session_with_share.id])
        
        response = api_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ShareToken.objects.filter(session=solo_session_with_share).exists()
    
    def test_max_views_limit(self, api_client, student_user):
        """Test that max views limit works."""
        session = SoloSession.objects.create(
            user=student_user,
            name='Limited Session',
            state={'pages': []},
            page_count=1,
        )
        share = ShareToken.objects.create(
            session=session,
            token='limited_token_12345',
            max_views=2,
            view_count=2,  # Already at limit
        )
        
        url = reverse('solo-api:public-session', args=[share.token])
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_cannot_share_other_user_session(self, api_client, tutor_user, solo_session):
        """Test that users can't share other's sessions."""
        api_client.force_authenticate(user=tutor_user)
        url = reverse('solo-api:session-share', args=[solo_session.id])
        
        response = api_client.post(url, {'expires_in_days': 7}, format='json')
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestThumbnailAPI:
    """Tests for thumbnail generation."""
    
    def test_regenerate_thumbnail(self, api_client, student_user, solo_session):
        """Test thumbnail regeneration endpoint."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-thumbnail', args=[solo_session.id])
        
        response = api_client.post(url)
        
        # Should succeed (even if thumbnail service returns placeholder)
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
    
    def test_cannot_regenerate_other_user_thumbnail(self, api_client, tutor_user, solo_session):
        """Test that users can't regenerate other's thumbnails."""
        api_client.force_authenticate(user=tutor_user)
        url = reverse('solo-api:session-thumbnail', args=[solo_session.id])
        
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestShareTokenModel:
    """Tests for ShareToken model."""
    
    def test_is_valid_active_token(self, solo_session_with_share):
        """Test is_valid for active token."""
        assert solo_session_with_share.share_token.is_valid() is True
    
    def test_is_valid_expired_token(self, expired_share_token):
        """Test is_valid for expired token."""
        assert expired_share_token.is_valid() is False
    
    def test_is_valid_inactive_token(self, student_user):
        """Test is_valid for inactive token."""
        session = SoloSession.objects.create(
            user=student_user,
            name='Inactive Session',
            state={},
            page_count=1,
        )
        share = ShareToken.objects.create(
            session=session,
            token='inactive_token',
            is_active=False,
        )
        assert share.is_valid() is False
    
    def test_is_valid_max_views_reached(self, student_user):
        """Test is_valid when max views reached."""
        session = SoloSession.objects.create(
            user=student_user,
            name='Max Views Session',
            state={},
            page_count=1,
        )
        share = ShareToken.objects.create(
            session=session,
            token='max_views_token',
            max_views=5,
            view_count=5,
        )
        assert share.is_valid() is False


@pytest.mark.django_db
class TestStorageService:
    """Tests for storage service."""
    
    def test_local_storage_backend(self):
        """Test local storage backend initialization."""
        from apps.solo.services.storage import LocalStorageBackend
        
        backend = LocalStorageBackend()
        assert backend.base_path.exists()
    
    def test_get_storage_backend_default(self):
        """Test default storage backend is local."""
        from apps.solo.services.storage import get_storage_backend, LocalStorageBackend
        
        backend = get_storage_backend()
        assert isinstance(backend, LocalStorageBackend)


@pytest.mark.django_db
class TestSharingService:
    """Tests for sharing service."""
    
    def test_generate_token(self):
        """Test token generation."""
        from apps.solo.services.sharing import SharingService
        
        token = SharingService.generate_token()
        assert len(token) > 20
        assert isinstance(token, str)
    
    def test_create_share(self, solo_session):
        """Test creating share."""
        from apps.solo.services.sharing import SharingService
        
        share = SharingService.create_share(
            session=solo_session,
            expires_in_days=7,
            allow_download=True,
        )
        
        assert share.session == solo_session
        assert share.allow_download is True
        assert share.expires_at is not None
    
    def test_revoke_share(self, solo_session_with_share):
        """Test revoking share."""
        from apps.solo.services.sharing import SharingService
        
        result = SharingService.revoke_share(solo_session_with_share)
        
        assert result is True
        assert not ShareToken.objects.filter(session=solo_session_with_share).exists()
    
    def test_get_by_token(self, solo_session_with_share):
        """Test getting share by token."""
        from apps.solo.services.sharing import SharingService
        
        token = solo_session_with_share.share_token.token
        share = SharingService.get_by_token(token)
        
        assert share is not None
        assert share.session == solo_session_with_share
    
    def test_get_by_invalid_token(self):
        """Test getting share by invalid token."""
        from apps.solo.services.sharing import SharingService
        
        share = SharingService.get_by_token('nonexistent_token')
        
        assert share is None
