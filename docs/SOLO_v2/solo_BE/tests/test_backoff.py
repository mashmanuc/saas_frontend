"""
Tests for 429/Backoff and quotas (BE29-4).
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.solo.models import SoloSession
from apps.solo.api.views import SoloSessionDiffSaveView


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email='backoff-student@test.com',
        password='testpass123',
        first_name='Backoff',
        last_name='Student',
        role='student',
    )


@pytest.fixture
def solo_session(db, student_user):
    return SoloSession.objects.create(
        user=student_user,
        name='Backoff Session',
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
class TestOpsQuota:
    """Tests for operations quota limits."""
    
    def test_ops_quota_exceeded(self, api_client, student_user, solo_session):
        """Test that exceeding MAX_OPS_PER_SAVE returns 422."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])
        
        # Create more ops than allowed
        max_ops = SoloSessionDiffSaveView.MAX_OPS_PER_SAVE
        ops = [
            {
                'op': 'add',
                'kind': 'stroke',
                'value': {'id': f'stroke-{i}', 'points': []},
            }
            for i in range(max_ops + 10)
        ]
        
        payload = {
            'rev': solo_session.rev,
            'ops': ops,
        }
        
        response = api_client.patch(
            url,
            payload,
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert response.data['detail'] == 'ops_quota_exceeded'
        assert response.data['max_ops'] == max_ops
    
    def test_ops_within_quota(self, api_client, student_user, solo_session):
        """Test that ops within quota are accepted."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])
        
        # Create exactly max ops
        max_ops = SoloSessionDiffSaveView.MAX_OPS_PER_SAVE
        ops = [
            {
                'op': 'add',
                'kind': 'stroke',
                'value': {'id': f'stroke-{i}', 'points': []},
            }
            for i in range(max_ops)
        ]
        
        payload = {
            'rev': solo_session.rev,
            'ops': ops,
        }
        
        response = api_client.patch(
            url,
            payload,
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )
        
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestPayloadLimits:
    """Tests for payload size limits."""
    
    def test_diff_payload_too_large(self, api_client, student_user, solo_session):
        """Test diff-save rejects oversized payloads."""
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])
        
        # Create payload larger than limit
        limit = SoloSessionDiffSaveView.MAX_DIFF_BYTES
        large_data = 'x' * (limit + 1024)
        
        payload = {
            'rev': solo_session.rev,
            'ops': [
                {
                    'op': 'add',
                    'kind': 'stroke',
                    'value': {'id': 'huge', 'data': large_data},
                }
            ],
        }
        
        response = api_client.patch(
            url,
            payload,
            format='json',
        )
        
        assert response.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        assert response.data['detail'] == 'payload_too_large'


@pytest.mark.django_db
class TestBackoffHeaders:
    """Tests for backoff response headers (manual verification)."""
    
    def test_backoff_mixin_exists(self):
        """Verify BackoffThrottleMixin is applied to DiffSaveView."""
        from apps.solo.api.mixins import BackoffThrottleMixin
        
        assert issubclass(SoloSessionDiffSaveView, BackoffThrottleMixin)
    
    def test_quota_mixin_exists(self):
        """Verify QuotaLimitMixin is applied to DiffSaveView."""
        from apps.solo.api.mixins import QuotaLimitMixin
        
        assert issubclass(SoloSessionDiffSaveView, QuotaLimitMixin)
