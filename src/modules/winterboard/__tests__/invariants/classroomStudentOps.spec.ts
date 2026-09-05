/**
 * P0 classroom student ops (2026-09-05) — учнівський штрих у класній кімнаті.
 *
 * Що доведено живим прогоном у двох сесіях (учитель `localhost:5182`,
 * учень `[::1]:5182`, кімната classroom/136, сесія 9f92ea15…):
 *
 *   1. Учитель і учень онлайн → учень малює → WS `stroke.broadcast` → учитель
 *      echo-записує через `store.addStroke(remote, {skipHistory:true})` →
 *      REST /replay/batch/ → БД seq 2 (user = вчитель) → після F5 учня
 *      штрих на місці (3/3).
 *   2. Учитель вийшов із кімнати → учень малює → кадр летить у порожнечу,
 *      `opsSync.pendingOps` = 0, БД без змін → після F5 штрих ЗНИК (4→3).
 *      Учень при цьому НЕ заблокований і бачить «Незбережені зміни».
 *
 * Механізм (INV-SINGLE-WRITER, 2026-06-14 — `singleWriter.spec.ts`):
 *   useClassroomRole.ts:76   isWriter = role ∈ {owner, host}
 *   WBClassroomRoom.vue:728  isRecording = store.mode==='edit' && isWriter → enabled рекордера
 *   useReplayRecorder.ts:187 `if (options.enabled && !options.enabled.value) return`
 *                            — вихід ДО opsSync.record(), без логу й телеметрії.
 *
 * Цей файл фіксує ЯДРО на рівні сторів і композаблів (без mount в'юхи — той
 * самий підхід, що в singleWriter.spec.ts): реальні useWBStore, useOpsSyncStore,
 * useReplayRecorder, useClassroomRole; замокано лише REST-транспорт.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../../board/state/boardStore'
import { useOpsSyncStore } from '../../stores/opsSyncStore'
import { useReplayRecorder } from '../../composables/useReplayRecorder'
import { useClassroomRole } from '../../composables/useClassroomRole'
import type { WBStroke } from '../../types/winterboard'
import { isStudentDrawingBlocked, drawingBlockReason } from '../../composables/classroomDrawingGate'

vi.mock('../../api/replay', () => ({
  recordOperationsBatch: vi.fn(),
  createSnapshot: vi.fn(),
  PROTOCOL_VERSION: 'v3',
}))
vi.mock('@/utils/apiClient', () => ({
  isCircuitBreakerOpen: vi.fn(() => false),
}))
import { recordOperationsBatch, createSnapshot } from '../../api/replay'

const mockBatch = recordOperationsBatch as ReturnType<typeof vi.fn>
const mockSnapshot = createSnapshot as ReturnType<typeof vi.fn>

const SID = '9f92ea15-3b12-425f-a196-b0a88f7df484'

function makeStroke(id: string): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#000000',
    size: 2,
    opacity: 1,
    points: [{ x: 10, y: 10 }, { x: 60, y: 40 }],
  } as WBStroke
}

/**
 * Точна копія wiring-у WBClassroomRoom:
 *   opsSync.bootstrap-ed (mode SYNC) → recorder з enabled = isWriter → connectToStore(store).
 */
function wireRoom(role: 'owner' | 'host' | 'student' | 'viewer') {
  const store = useWBStore()
  const opsSync = useOpsSyncStore()
  opsSync.sessionId = SID
  opsSync.mode = 'SYNC'

  const classroomRole = useClassroomRole(ref(SID))
  classroomRole.setRole(role)

  // WBClassroomRoom.vue:728
  const isRecording = computed(() => store.mode === 'edit' && classroomRole.isWriter.value)
  const recorder = useReplayRecorder({
    sessionId: ref<string | null>(SID),
    getBoardState: () => store.getSnapshotState(),
    enabled: isRecording,
  })
  const unsub = recorder.connectToStore(store)
  return { store, opsSync, recorder, classroomRole, unsub }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockSnapshot.mockResolvedValue(undefined)
  mockBatch.mockResolvedValue({ recorded: 1, total_operations: 1, last_seq: 1 })
})

describe('P0 classroom student ops — сценарій 1: учитель і учень онлайн', () => {
  it('учень: власний штрих НЕ йде в REST — pendingOps=0, batch не викликано, а isDirty=true (індикатор каже «незбережено»)', async () => {
    const { store, opsSync, recorder, unsub } = wireRoom('student')

    expect(store.mode).toBe('edit')            // у класрумі mode=edit і в учня
    expect(opsSync.mode).toBe('SYNC')          // не DESYNC і не BOOTSTRAP
    expect(opsSync.pendingOps.length).toBe(0)

    store.addStroke(makeStroke('student-stroke-1'))

    // Штрих у локальному сторі є …
    expect(store.pages[0].strokes.map((s) => s.id)).toContain('student-stroke-1')
    // … стор позначений брудним (саме звідси «Незбережені зміни» у шапці, WBClassroomRoom.vue:1358) …
    expect(store.isDirty).toBe(true)
    // … але op НЕ дійшов до opsSync: рекордер вийшов на useReplayRecorder.ts:187 (enabled=false).
    expect(opsSync.pendingOps.length).toBe(0)

    await recorder.flush()
    expect(mockBatch).not.toHaveBeenCalled()
    unsub()
  })

  it('учитель (writer): чужий штрих, застосований як у onRemoteStroke (addStroke + skipHistory), стає op у opsSync і йде одним REST-батчем', async () => {
    const { store, opsSync, recorder, unsub } = wireRoom('owner')

    // WBClassroomRoom.vue onRemoteStroke → store.addStroke(detail.stroke, { skipHistory: true })
    store.addStroke(makeStroke('student-stroke-1'), { skipHistory: true })

    expect(opsSync.pendingOps.length).toBe(1)
    expect(opsSync.pendingOps[0].op_type).toBe('stroke_add')
    expect((opsSync.pendingOps[0].payload as any)?.stroke?.id).toBe('student-stroke-1')

    await recorder.flush()

    expect(mockBatch).toHaveBeenCalledOnce()
    // recordOperationsBatch(sessionId, seq, ops) → POST /sessions/<sid>/replay/batch/ { seq, ops }
    const [sentSid, sentSeq, ops] = mockBatch.mock.calls[0]
    expect(sentSid).toBe(SID)
    expect(typeof sentSeq).toBe('number')
    expect(ops.map((o: any) => o.op_type)).toEqual(['stroke_add'])
    // Після успіху черга порожня — саме це бачив живий прогін: localSeq 1→2, pending 0.
    expect(opsSync.pendingOps.length).toBe(0)
    unsub()
  })

  it('host (co-tutor) теж writer; viewer — ні (мапінг INV-SINGLE-WRITER без змін)', () => {
    expect(wireRoom('host').classroomRole.isWriter.value).toBe(true)
    setActivePinia(createPinia())
    expect(wireRoom('viewer').classroomRole.isWriter.value).toBe(false)
  })
})

describe('P0 classroom student ops — сценарій 2: учитель відключився', () => {
  it('сьогоднішня поведінка (зафіксовано, НЕ бажана): без writer-а штрих учня лишається лише локально — isDirty=true, pendingOps=0, batch не викликано → після F5 зникне', async () => {
    // «Учитель офлайн» на рівні сторів не представлений: гейт малювання живе у
    // WBClassroomRoom.vue:1196 (isDrawingDisabled) і НЕ знає про присутність
    // writer-а. Тому для учня цей сценарій на рівні сторів НЕВІДРІЗНИМИЙ від
    // сценарію 1 — і саме в цьому суть втрати: жоден шар не бачить, що
    // echo-записати цей штрих нікому.
    const { store, opsSync, recorder, unsub } = wireRoom('student')
    store.addStroke(makeStroke('student-stroke-lost'))
    expect(store.pages[0].strokes.map((s) => s.id)).toContain('student-stroke-lost')
    expect(store.isDirty).toBe(true)
    expect(opsSync.pendingOps.length).toBe(0)
    await recorder.flush()
    expect(mockBatch).not.toHaveBeenCalled()
    unsub()
  })

  // Бажана поведінка (рішення власника 2026-09-05): учитель відключився →
  // учневі заблоковано малювання, нічого не губиться. Предикат винесено у чистий
  // helper composables/classroomDrawingGate.ts; WBClassroomRoom.isDrawingDisabled
  // лише викликає його з {isWriter, frozen, locked, canDraw, writerOnline}, де
  // writerOnline = presence.isConnected && connectedTeacher.is_online.
  const student = { isWriter: false, frozen: false, locked: false, canDraw: true }
  const teacher = { isWriter: true, frozen: false, locked: false, canDraw: true }

  it('учень + writer офлайн → малювання ЗАБЛОКОВАНО, причина writer_offline (індикатор каже «учитель офлайн»)', () => {
    const input = { ...student, writerOnline: false }
    expect(isStudentDrawingBlocked(input)).toBe(true)
    expect(drawingBlockReason(input)).toBe('writer_offline')
  })

  it('учень + writer онлайн → малювання дозволено (сценарій 1 не регресує)', () => {
    const input = { ...student, writerOnline: true }
    expect(isStudentDrawingBlocked(input)).toBe(false)
    expect(drawingBlockReason(input)).toBeNull()
  })

  it('writer сам ніколи не блокується через writerOnline (для нього connectedTeacher = null)', () => {
    expect(isStudentDrawingBlocked({ ...teacher, writerOnline: false })).toBe(false)
  })

  it('порядок причин збережено з WBClassroomRoom: frozen → locked → no_permission → writer_offline', () => {
    expect(drawingBlockReason({ ...student, writerOnline: false, frozen: true })).toBe('frozen')
    expect(drawingBlockReason({ ...student, writerOnline: false, locked: true })).toBe('locked')
    expect(drawingBlockReason({ ...teacher, writerOnline: false, locked: true })).toBeNull() // замок не б'є по writer-у
    expect(drawingBlockReason({ ...student, writerOnline: true, canDraw: false })).toBe('no_permission')
  })
})
