"""
Tests for diff-save API (BE29-1).
"""
import gzip
import json
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.solo.models import SoloSession
from apps.solo.services import SoloDiffService
from apps.solo.api.views import SoloSessionDiffSaveView


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email='solo-student@test.com',
        password='testpass123',
        first_name='Solo',
        last_name='Student',
        role='student',
    )


@pytest.fixture
def solo_session(db, student_user):
    return SoloSession.objects.create(
        user=student_user,
        name='Diff Session',
        state={
            'pages': [
                {'id': 'p1', 'strokes': [], 'assets': []},
            ],
            'activePageId': 'p1',
        },
        page_count=1,
    )


@pytest.mark.django_db
class TestDiffSaveAPI:
    def test_diff_save_success(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])
        payload = {
            'rev': solo_session.rev,
            'ops': [
                {
                    'op': 'add',
                    'kind': 'stroke',
                    'value': {
                        'id': 'stroke-1',
                        'points': [{'x': 0, 'y': 0}],
                        'color': '#111',
                    },
                }
            ],
        }

        response = api_client.patch(
            url,
            payload,
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['next_rev'] == solo_session.rev + 1
        solo_session.refresh_from_db()
        assert solo_session.rev == 1
        strokes = solo_session.state['pages'][0]['strokes']
        assert len(strokes) == 1
        assert strokes[0]['id'] == 'stroke-1'
        expected_digest = SoloDiffService.compute_digest(solo_session.state)
        assert response.data['digest'] == expected_digest

    def test_diff_save_rev_mismatch(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])
        payload = {
            'rev': solo_session.rev + 5,
            'ops': [
                {
                    'op': 'add',
                    'kind': 'stroke',
                    'value': {'id': 'stroke-err', 'points': []},
                }
            ],
        }

        response = api_client.patch(
            url,
            payload,
            format='json',
            HTTP_IF_MATCH='W/"rev:99"',
        )

        assert response.status_code == status.HTTP_412_PRECONDITION_FAILED
        assert response.data['error'] == 'precondition_failed'

    def test_diff_save_x_rev_fallback_mismatch_is_409(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])
        payload = {
            'rev': solo_session.rev,
            'ops': [
                {
                    'op': 'add',
                    'kind': 'stroke',
                    'value': {'id': 'stroke-xrev', 'points': []},
                }
            ],
        }

        response = api_client.patch(
            url,
            payload,
            format='json',
            HTTP_X_REV='99',
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data['error'] == 'rev_mismatch'
        assert response.data['server_rev'] == solo_session.rev

    def test_diff_save_invalid_ops(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])
        payload = {
            'rev': solo_session.rev,
            'ops': [
                {
                    'op': 'update',
                    'kind': 'stroke',
                    'id': 'missing',
                    'patch': {'color': '#fff'},
                }
            ],
        }

        response = api_client.patch(
            url,
            payload,
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert response.data['detail'] == 'invalid_ops'

    def test_diff_save_payload_too_big(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])
        over_limit = SoloSessionDiffSaveView.MAX_DIFF_BYTES + 4096
        large_value = 'x' * over_limit
        payload = {
            'rev': solo_session.rev,
            'ops': [
                {
                    'op': 'add',
                    'kind': 'stroke',
                    'value': {'id': 'huge', 'payload': large_value},
                }
            ],
        }

        response = api_client.patch(
            url,
            payload,
            format='json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
        )

        assert response.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        assert response.data['error'] == 'payload_too_large'
        assert response.data['limit'] == SoloSessionDiffSaveView.MAX_DIFF_BYTES

    def test_diff_save_gzip_post_decompress_over_limit_is_413(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])

        over_limit = SoloSessionDiffSaveView.MAX_DIFF_BYTES + 4096
        large_value = 'x' * over_limit
        payload = {
            'rev': solo_session.rev,
            'ops': [
                {
                    'op': 'add',
                    'kind': 'stroke',
                    'value': {'id': 'huge-gz', 'payload': large_value},
                }
            ],
        }
        raw = json.dumps(payload).encode('utf-8')
        gz = gzip.compress(raw)

        response = api_client.generic(
            'PATCH',
            url,
            data=gz,
            content_type='application/json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
            HTTP_CONTENT_ENCODING='gzip',
        )

        assert response.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        assert response.data['error'] == 'payload_too_large'
        assert response.data['encoding'] == 'gzip'

    def test_diff_save_br_is_415(self, api_client, student_user, solo_session):
        api_client.force_authenticate(user=student_user)
        url = reverse('solo-api:session-diff', args=[solo_session.id])

        payload = {'rev': solo_session.rev, 'ops': []}
        raw = json.dumps(payload).encode('utf-8')

        response = api_client.generic(
            'PATCH',
            url,
            data=raw,
            content_type='application/json',
            HTTP_IF_MATCH=f'W/"rev:{solo_session.rev}"',
            HTTP_CONTENT_ENCODING='br',
        )

        assert response.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
        assert response.data['error'] == 'unsupported_media_type'
