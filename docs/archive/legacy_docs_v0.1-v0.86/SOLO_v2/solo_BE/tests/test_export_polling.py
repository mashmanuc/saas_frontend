"""
Tests for export polling API (BE29-3).
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.solo.models import SoloSession, SoloExport


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email='export-student@test.com',
        password='testpass123',
        first_name='Export',
        last_name='Student',
        role='student',
    )


@pytest.fixture
def solo_session(db, student_user):
    return SoloSession.objects.create(
        user=student_user,
        name='Export Session',
        state={
            'pages': [
                {'id': 'p1', 'strokes': [], 'assets': []},
            ],
            'activePageId': 'p1',
        },
        page_count=1,
    )


@pytest.mark.django_db
class TestExportCreation:
    """Tests for export creation with idempotency."""
    
    def test_create_export_json(self, api_client, student_user, solo_session):
        """Test creating JSON export."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-export', args=[solo_session.id])
        
        response = api_client.post(url, {'format': 'json'}, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['format'] == 'json'
        assert 'id' in response.data
        assert response.data['status'] in ['pending', 'completed']
    
    def test_create_export_png(self, api_client, student_user, solo_session):
        """Test creating PNG export."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-export', args=[solo_session.id])
        
        response = api_client.post(url, {'format': 'png'}, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['format'] == 'png'
    
    def test_idempotency_key_returns_existing(self, api_client, student_user, solo_session):
        """Test that same idempotency key returns existing export."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-export', args=[solo_session.id])
        idempotency_key = 'unique-key-12345'
        
        # First request
        response1 = api_client.post(
            url,
            {'format': 'json'},
            format='json',
            HTTP_IDEMPOTENCY_KEY=idempotency_key,
        )
        assert response1.status_code == status.HTTP_201_CREATED
        export_id = response1.data['id']
        
        # Second request with same key
        response2 = api_client.post(
            url,
            {'format': 'json'},
            format='json',
            HTTP_IDEMPOTENCY_KEY=idempotency_key,
        )
        # Should return 200 (existing) not 201 (new)
        assert response2.status_code == status.HTTP_200_OK
        assert response2.data['id'] == export_id
    
    def test_different_idempotency_keys_create_new(self, api_client, student_user, solo_session):
        """Test that different idempotency keys create new exports."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-export', args=[solo_session.id])
        
        response1 = api_client.post(
            url,
            {'format': 'json'},
            format='json',
            HTTP_IDEMPOTENCY_KEY='key-1',
        )
        response2 = api_client.post(
            url,
            {'format': 'json'},
            format='json',
            HTTP_IDEMPOTENCY_KEY='key-2',
        )
        
        assert response1.data['id'] != response2.data['id']


@pytest.mark.django_db
class TestExportPolling:
    """Tests for export status polling."""
    
    def test_poll_export_status(self, api_client, student_user, solo_session):
        """Test polling export status."""
        api_client.force_authenticate(user=student_user)
        
        # Create export
        export = SoloExport.objects.create(
            session=solo_session,
            user=student_user,
            format='json',
            status='completed',
            file_url='https://example.com/export.json',
            file_size=1024,
        )
        
        url = reverse('solo-api:export-detail', args=[export.id])
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'completed'
        assert response.data['file_url'] == 'https://example.com/export.json'
        assert response.data['file_size'] == 1024
    
    def test_poll_pending_export(self, api_client, student_user, solo_session):
        """Test polling pending export."""
        api_client.force_authenticate(user=student_user)
        
        export = SoloExport.objects.create(
            session=solo_session,
            user=student_user,
            format='png',
            status='pending',
        )
        
        url = reverse('solo-api:export-detail', args=[export.id])
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'pending'
        assert response.data['file_url'] is None
    
    def test_poll_failed_export(self, api_client, student_user, solo_session):
        """Test polling failed export."""
        api_client.force_authenticate(user=student_user)
        
        export = SoloExport.objects.create(
            session=solo_session,
            user=student_user,
            format='pdf',
            status='failed',
            error='PDF generation not available',
        )
        
        url = reverse('solo-api:export-detail', args=[export.id])
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'failed'
        assert 'PDF' in response.data['error']


@pytest.mark.django_db
class TestExportExpiry:
    """Tests for export TTL/expiry."""
    
    def test_export_has_expires_at(self, api_client, student_user, solo_session):
        """Test that new exports have expires_at set."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-export', args=[solo_session.id])
        
        response = api_client.post(url, {'format': 'json'}, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data.get('expires_at') is not None
    
    def test_is_expired_property(self, db, student_user, solo_session):
        """Test is_expired property on SoloExport."""
        from django.utils import timezone
        from datetime import timedelta
        
        # Not expired
        export = SoloExport.objects.create(
            session=solo_session,
            user=student_user,
            format='json',
            status='completed',
            expires_at=timezone.now() + timedelta(hours=1),
        )
        assert not export.is_expired
        
        # Expired
        export.expires_at = timezone.now() - timedelta(hours=1)
        export.save()
        assert export.is_expired
