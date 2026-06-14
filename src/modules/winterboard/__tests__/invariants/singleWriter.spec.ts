/**
 * INV-SINGLE-WRITER (2026-06-14) — у класрумі ops у REST /replay/batch/ пише ТІЛЬКИ
 * writer (tutor: owner|host). Студент/viewer — broadcast-only (WS stroke.broadcast);
 * їхні штрихи персистить writer через onRemoteStroke echo-record.
 *
 * Контекст (prod-репро classroom/82): recorder gate був `isRecording = mode==='edit'`
 * БЕЗ role-перевірки. У класрумі mode='edit' і у вчителя, і в учня (read-only учня = лише
 * canvas-prop, store.mode не чіпається) → recorder учня теж активний → ДВА writer'и на
 * одну сесію → постійний 409 SEQ_MISMATCH storm (BE має один session.last_op_seq,
 * ops_apply_service.py:512). Def-1 auto-resync маскував (без втрати даних), але 2× записів,
 * BE-навантаження, telemetry 429, роздутий ops-log.
 *
 * SSOT: OPS_SYNC_SSOT.md §1778 «Single writer (tutor / session owner)».
 *
 * Fix: WBClassroomRoom isRecording = (store.mode === 'edit') && classroomRole.isWriter.value.
 *
 * Цей тест фіксує role→writer мапінг (ЯДРО інваріанту). Wiring у WBClassroomRoom
 * (isRecording AND classroomRole.isWriter) — review у PR diff, не покрито тут (повний
 * mount в'юхи = надмірні моки; recorder enabled-контракт уже покритий useReplayRecorder.spec).
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useClassroomRole } from '../../composables/useClassroomRole'

const FAKE_SID = '00000000-0000-0000-0000-000000000001'

function _roleWith(role: 'owner' | 'host' | 'student' | 'viewer') {
  const r = useClassroomRole(ref(FAKE_SID))
  r.setRole(role)
  return r
}

describe('INV-SINGLE-WRITER: isWriter role mapping', () => {
  it('owner (tutor-власник сесії) → writer', () => {
    expect(_roleWith('owner').isWriter.value).toBe(true)
  })

  it('host (co-tutor) → writer', () => {
    expect(_roleWith('host').isWriter.value).toBe(true)
  })

  it('student → NOT writer (broadcast-only, штрихи персистить вчитель)', () => {
    expect(_roleWith('student').isWriter.value).toBe(false)
  })

  it('viewer → NOT writer', () => {
    expect(_roleWith('viewer').isWriter.value).toBe(false)
  })

  it('роль ще не завантажена (null) → NOT writer (fail-safe: не пишемо поки не підтверджено tutor)', () => {
    const r = useClassroomRole(ref(null))
    expect(r.isWriter.value).toBe(false)
  })
})
