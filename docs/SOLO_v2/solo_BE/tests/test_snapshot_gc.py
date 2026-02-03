import json

import pytest
from django.test.utils import override_settings

from apps.solo.models import SoloSession, SoloUserStorage
from apps.solo.services.storage import SoloStorageService
from apps.solo.tasks import cleanup_old_snapshots
from apps.users.models import User


@pytest.mark.django_db
@override_settings(SOLO_STORAGE_BACKEND='local')
def test_snapshot_gc_deletes_old_revs_and_decrements_used_bytes(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path

    user = User.objects.create_user(
        email='gc-student@test.com',
        password='testpass123',
        role='student',
    )

    session = SoloSession.objects.create(
        user=user,
        name='GC Session',
        state={'pages': [{'id': 'p1'}], 'activePageId': 'p1'},
        page_count=1,
        rev=2,
    )

    storage = SoloStorageService()

    # Create 3 snapshot versions.
    sizes = []
    for rev in [0, 1, 2]:
        payload = json.dumps({'rev': rev}, separators=(',', ':')).encode('utf-8')
        meta = storage.upload_state_versioned(user_id=str(user.id), session_id=str(session.id), rev=rev, state_json=payload)
        sizes.append(int(meta.get('size') or len(payload)))

    SoloUserStorage.objects.update_or_create(
        user=user,
        defaults={'used_bytes': sum(sizes), 'quota_bytes': 10_000},
    )

    # Keep only last 1 snapshot (rev=2).
    result = cleanup_old_snapshots(keep_last=1)
    assert result['deleted_files'] == 2

    remaining = storage.list_state_revs(user_id=str(user.id), session_id=str(session.id))
    assert remaining == [2]

    row = SoloUserStorage.objects.get(user=user)
    assert row.used_bytes == sizes[2]
