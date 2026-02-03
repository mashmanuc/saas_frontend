"""
Tests for Solo Workspace API.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.solo.models import SoloSession


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


@pytest.mark.django_db
class TestSoloSessionAPI:
    """Tests for solo session endpoints."""
    
    def test_create_session(self, api_client, student_user):
        """Test creating a new session."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-list')
        
        data = {
            'name': 'Test Session',
            'state': {'pages': []},
            'page_count': 1,
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Test Session'
    
    def test_list_sessions(self, api_client, student_user, solo_session):
        """Test listing user's sessions."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-list')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] >= 1
    
    def test_get_session_detail(self, api_client, student_user, solo_session):
        """Test getting session details."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-detail', args=[solo_session.id])
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Test Session'
        assert 'state' in response.data
    
    def test_update_session(self, api_client, student_user, solo_session):
        """Test updating session (autosave)."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-detail', args=[solo_session.id])
        
        data = {
            'state': {'pages': [{'strokes': [{'x': 1, 'y': 2}]}]},
        }
        
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_delete_session(self, api_client, student_user, solo_session):
        """Test deleting session."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-detail', args=[solo_session.id])
        
        response = api_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not SoloSession.objects.filter(pk=solo_session.id).exists()
    
    def test_cannot_access_other_user_session(self, api_client, student_user, tutor_user, solo_session):
        """Test that users can't access other's sessions."""
        # solo_session belongs to student_user
        api_client.force_authenticate(user=tutor_user)
        url = reverse('solo-api:session-detail', args=[solo_session.id])
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_export_session_json(self, api_client, student_user, solo_session):
        """Test exporting session as JSON."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-export', args=[solo_session.id])
        
        response = api_client.post(url, {'format': 'json'}, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['format'] == 'json'
        assert 'file_url' in response.data
    
    def test_export_invalid_format(self, api_client, student_user, solo_session):
        """Test exporting with invalid format."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-export', args=[solo_session.id])
        
        response = api_client.post(url, {'format': 'invalid'}, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_duplicate_session(self, api_client, student_user, solo_session):
        """Test duplicating a session."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-duplicate', args=[solo_session.id])
        
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Test Session (Copy)'
        assert SoloSession.objects.filter(user=student_user).count() == 2
    
    def test_unauthenticated_access(self, api_client):
        """Test that unauthenticated users can't access API."""
        url = reverse('solo-api:session-list')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_list_sessions_response_format(self, api_client, student_user, solo_session):
        """Test that list endpoint returns correct format {count, results}."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-list')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        # Verify response structure matches frontend expectations
        assert 'count' in response.data
        assert 'results' in response.data
        assert isinstance(response.data['count'], int)
        assert isinstance(response.data['results'], list)
        assert response.data['count'] == len(response.data['results'])
