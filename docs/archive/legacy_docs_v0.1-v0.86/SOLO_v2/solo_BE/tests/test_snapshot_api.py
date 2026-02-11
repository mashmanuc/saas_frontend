"""
Tests for snapshot API (v0.30 stretch).
"""

import pytest
from django.urls import reverse
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.solo.models import SoloSession, SoloUserStorage


@pytest.fixture
def api_client():
    with override_settings(DEBUG_PROPAGATE_EXCEPTIONS=True):
        client = APIClient()
        client.raise_request_exception = True
        yield client


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email='snapshot-student@test.com',
        password='testpass123',
        first_name='Snap',
        last_name='Student',
        role='student',
    )


@pytest.fixture
def solo_session(db, student_user):
    return SoloSession.objects.create(
        user=student_user,
        name='Snapshot Session',
        state={'pages': [{'id': 'p1', 'strokes': [], 'assets': []}], 'activePageId': 'p1'},
        page_count=1,
        rev=0,
    )


@pytest.mark.django_db
class TestSnapshotAPI:
    def test_snapshot_latest_404_when_missing(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-snapshot-latest', args=[solo_session.id])
        r = api_client.get(url)
        assert r.status_code == status.HTTP_404_NOT_FOUND
        assert r.data['error'] == 'not_found'

    def test_snapshot_create_and_latest(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        create_url = reverse('solo-api:session-snapshot-create', args=[solo_session.id])
        latest_url = reverse('solo-api:session-snapshot-latest', args=[solo_session.id])

        r1 = api_client.post(create_url)
        assert r1.status_code == status.HTTP_201_CREATED
        assert r1.data['rev'] == solo_session.rev
        assert 'url' in r1.data

        r2 = api_client.get(latest_url)
        assert r2.status_code == status.HTTP_200_OK
        assert r2.data['rev'] == solo_session.rev
        assert 'url' in r2.data

    def test_snapshot_idempotency_key(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        create_url = reverse('solo-api:session-snapshot-create', args=[solo_session.id])

        r1 = api_client.post(create_url, HTTP_IDEMPOTENCY_KEY='idem-1')
        r2 = api_client.post(create_url, HTTP_IDEMPOTENCY_KEY='idem-1')
        assert r1.status_code == status.HTTP_201_CREATED
        assert r2.status_code == status.HTTP_201_CREATED
        assert r1.data == r2.data

    def test_snapshot_quota_exceeded(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        create_url = reverse('solo-api:session-snapshot-create', args=[solo_session.id])

        # Set a very small quota so current session.state JSON won't fit.
        SoloUserStorage.objects.update_or_create(
            user=student_user,
            defaults={'used_bytes': 5, 'quota_bytes': 10},
        )

        r = api_client.post(create_url)
        assert r.status_code == status.HTTP_403_FORBIDDEN
        assert r.data['error'] == 'quota_exceeded'
        assert r.data['used'] == 5
        assert r.data['quota'] == 10
        assert r.data['remaining'] == 5
