/**
 * Рекордер відкритої дошки і вихід (ТЗ спільного екрана, R7; рецензія пакета A, знахідка 4).
 *
 * Було: вихід бачив лише копії у сховищі (пишуться з секундною затримкою), а після ЯВНОГО
 * відкидання вчителем черга з пам'яті знову лягала у сховище — при смерті сесії
 * (`destroy` → `_persistBackup`) і на `beforeunload`. Дії попереднього вчителя лишались у
 * спільному браузері. Тепер рекордер реєструє наявні дії стору: `persistQueue` і `reset`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

vi.mock('../api/replay', () => ({
  recordOperationsBatch: vi.fn(),
  createSnapshot: vi.fn(),
  checkOps: vi.fn(),
  PROTOCOL_VERSION: 'v3',
}))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/utils/apiClient', () => ({
  default: { get: vi.fn() },
  isCircuitBreakerOpen: vi.fn(() => false),
}))

import { useOpsSyncStore } from '../stores/opsSyncStore'
import { useReplayRecorder } from '../composables/useReplayRecorder'
import { abandonOpenBoardQueue, persistOpenBoardQueue } from '@/modules/auth/logout/openBoardQueue'

const SID = 'session-uuid-123'
const backupKeys = () =>
  Object.keys(localStorage).filter(key => key.startsWith(`wb_ops_backup_v2_${SID}`))

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useOpsSyncStore()
  store.sessionId = SID
  store.mode = 'SYNC'
})

function openBoardWithQueue() {
  const recorder = useReplayRecorder({
    sessionId: ref<string | null>(SID),
    getBoardState: () => ({ pages: [] }),
    enabled: ref(true),
  })
  const store = useOpsSyncStore()
  store.pendingOps = [{ op_id: 'op-1', op_type: 'stroke_add', page_id: 'p1', payload: {} }] as never
  return { recorder, store }
}

describe('рекордер · черга відкритої дошки для виходу', () => {
  it('persist: черга лягає у сховище одразу, а не за секундним таймером', () => {
    const { recorder } = openBoardWithQueue()
    expect(backupKeys()).toEqual([])
    persistOpenBoardQueue()
    expect(backupKeys()).toHaveLength(1)
    recorder.destroy()
  })

  it('abandon: після явного відкидання знищення рекордера нічого не записує знову', () => {
    const { recorder, store } = openBoardWithQueue()
    abandonOpenBoardQueue([SID])
    expect(store.pendingCount + store.inFlightCount).toBe(0)
    recorder.destroy()
    expect(backupKeys()).toEqual([])
  })

  it('чужу дошку не відкидає; після destroy реєстрації немає', () => {
    const { recorder, store } = openBoardWithQueue()
    abandonOpenBoardQueue(['other-board'])
    expect(store.pendingCount).toBe(1)
    recorder.destroy()
    // destroy записав свою копію — так і має бути без відкидання.
    expect(backupKeys()).toHaveLength(1)
    localStorage.clear()
    abandonOpenBoardQueue([SID])
    persistOpenBoardQueue()
    expect(backupKeys()).toEqual([])
  })
})
