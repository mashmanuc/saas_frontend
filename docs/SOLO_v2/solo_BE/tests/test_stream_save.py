"""
Tests for stream/beacon save API (BE29-2).
"""
import pytest
from django.urls import reverse
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.solo.models import SoloSession


@pytest.fixture
def api_client():
    with override_settings(DEBUG_PROPAGATE_EXCEPTIONS=True):
        client = APIClient()
        client.raise_request_exception = True
        yield client


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email='stream-student@test.com',
        password='testpass123',
        first_name='Stream',
        last_name='Student',
        role='student',
    )


@pytest.fixture
def solo_session(db, student_user):
    return SoloSession.objects.create(
        user=student_user,
        name='Stream Session',
        state={
            'pages': [
                {'id': 'p1', 'strokes': [], 'assets': []},
            ],
            'activePageId': 'p1',
        },
        page_count=1,
        rev=0,
    )


@pytest.mark.django_db
class TestStreamSaveAPI:
    """Tests for POST /api/v1/solo/sessions/{id}/save-stream/"""
    
    def test_stream_save_success(self, api_client, student_user, solo_session):
        """Test successful stream save with full state."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-stream-save', args=[solo_session.id])
        
        new_state = {
            'pages': [
                {
                    'id': 'p1',
                    'strokes': [{'id': 's1', 'points': []}],
                    'assets': [],
                },
            ],
            'activePageId': 'p1',
        }
        
        response = api_client.post(
            url,
            {'state': new_state},
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )
        
        assert response.status_code == status.HTTP_202_ACCEPTED
        solo_session.refresh_from_db()
        assert solo_session.rev == 1

    def test_stream_save_no_change_returns_204(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-stream-save', args=[solo_session.id])

        # First save (accepted)
        response1 = api_client.post(
            url,
            {'state': solo_session.state},
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )
        assert response1.status_code == status.HTTP_202_ACCEPTED

        # Second save with same state should be 204 and not bump rev
        solo_session.refresh_from_db()
        prev_rev = solo_session.rev
        response2 = api_client.post(
            url,
            {'state': solo_session.state, 'rev': prev_rev},
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{prev_rev}"',
        )
        assert response2.status_code == status.HTTP_204_NO_CONTENT
        solo_session.refresh_from_db()
        assert solo_session.rev == prev_rev

    def test_stream_save_idempotency_key(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-stream-save', args=[solo_session.id])

        payload = {
            'state': {'pages': [{'id': 'p1', 'strokes': [], 'assets': []}], 'activePageId': 'p1'},
            'idempotency_key': 'idem-1',
        }
        r1 = api_client.post(
            url,
            payload,
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )
        r2 = api_client.post(
            url,
            payload,
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )
        assert r1.status_code == status.HTTP_202_ACCEPTED
        assert r2.status_code == status.HTTP_202_ACCEPTED
    
    def test_stream_save_with_rev_check(self, api_client, student_user, solo_session):
        """Test stream save with optional rev check."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-stream-save', args=[solo_session.id])
        
        new_state = {
            'pages': [{'id': 'p1', 'strokes': [], 'assets': []}],
            'activePageId': 'p1',
        }
        
        # Correct rev
        response = api_client.post(
            url,
            {'state': new_state, 'rev': 0},
            format='json',
            HTTP_IF_MATCH='W/"rev:0"',
        )
        assert response.status_code == status.HTTP_202_ACCEPTED
    
    def test_stream_save_rev_mismatch(self, api_client, student_user, solo_session):
        """Test stream save with rev mismatch."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-stream-save', args=[solo_session.id])
        
        new_state = {
            'pages': [{'id': 'p1', 'strokes': [], 'assets': []}],
            'activePageId': 'p1',
        }
        
        # Wrong rev
        response = api_client.post(
            url,
            {'state': new_state, 'rev': 99},
            format='json',
            HTTP_IF_MATCH='W/"rev:99"',
        )
        assert response.status_code == status.HTTP_412_PRECONDITION_FAILED
        assert response.data['error'] == 'precondition_failed'
    
    def test_stream_save_missing_state(self, api_client, student_user, solo_session):
        """Test stream save without state returns 400."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-stream-save', args=[solo_session.id])
        
        response = api_client.post(
            url,
            {},
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['detail'] == 'state_required'


@pytest.mark.django_db
class TestBeaconSaveAPI:
    """Tests for POST /api/v1/solo/sessions/{id}/beacon/"""
    
    def test_beacon_telemetry_only_does_not_change_rev(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-beacon', args=[solo_session.id])
        
        solo_session.refresh_from_db()
        prev_rev = solo_session.rev
        response = api_client.post(url, {'client_ts': 123}, format='json')
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        solo_session.refresh_from_db()
        assert solo_session.rev == prev_rev

    def test_beacon_payload_too_large_is_413(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-beacon', args=[solo_session.id])

        big = 'x' * (70 * 1024)
        r = api_client.post(url, big, content_type='text/plain')
        assert r.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        assert r.data['error'] == 'payload_too_large'

    def test_beacon_heartbeat(self, api_client, student_user, solo_session):
        """Test beacon heartbeat (no state, just timestamp update)."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-beacon', args=[solo_session.id])
        
        solo_session.refresh_from_db()
        prev_rev = solo_session.rev
        old_write = solo_session.last_write_at
        
        response = api_client.post(
            url,
            {'heartbeat': True},
            format='json',
        )
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        solo_session.refresh_from_db()
        # Rev should not change for heartbeat
        assert solo_session.rev == prev_rev
        # But last_write_at should be updated
        assert solo_session.last_write_at != old_write or solo_session.last_write_at is not None
    
    def test_beacon_empty_body(self, api_client, student_user, solo_session):
        """Test beacon with empty body returns 204."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-beacon', args=[solo_session.id])
        
        response = api_client.post(url, content_type='application/json')
        assert response.status_code == status.HTTP_204_NO_CONTENT
