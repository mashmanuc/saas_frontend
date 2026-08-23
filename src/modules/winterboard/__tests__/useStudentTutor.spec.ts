// 8b-2 — канал учня: історія на клієнті, помилки за класами, reveal gate.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import winterboardApi from '../api/winterboardApi'
import {
  resetTutorGate,
  useStudentTutor,
  useTutorRevealGate,
} from '../composables/useStudentTutor'

vi.mock('../api/winterboardApi', () => ({
  default: { copilotReply: vi.fn() },
}))

const reply = (over: Record<string, unknown> = {}) => ({
  reply: 'Подумай про знак.', stage: 1, action: 'HINT', ...over,
})

describe('useStudentTutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTutorGate()
    ;(winterboardApi.copilotReply as any).mockResolvedValue(reply())
  })

  it('send: репліка учня і відповідь AI потрапляють в історію', async () => {
    const t = useStudentTutor('sess-1')
    t.draft.value = 'не виходить 2x'
    await t.send()
    expect(t.messages.value.map(m => m.role)).toEqual(['student', 'ai'])
    expect(t.messages.value[1].text).toBe('Подумай про знак.')
    expect(t.draft.value).toBe('')
    expect(winterboardApi.copilotReply).toHaveBeenCalledWith('sess-1', 'не виходить 2x')
  })

  it('порожнє не шлеться', async () => {
    const t = useStudentTutor('sess-1')
    t.draft.value = '   '
    expect(await t.send()).toBe(false)
    expect(winterboardApi.copilotReply).not.toHaveBeenCalled()
  })

  it('429 → throttled, НЕ failed; репліка учня лишається видимою', async () => {
    ;(winterboardApi.copilotReply as any).mockRejectedValueOnce({ response: { status: 429 } })
    const t = useStudentTutor('sess-1')
    t.draft.value = 'а'
    await t.send()
    expect(t.throttled.value).toBe(true)
    expect(t.failed.value).toBe(false)
    expect(t.disabled.value).toBe(false)
  })

  it('403 (прапорець вимкнули) → канал disabled і гейт відпущено', async () => {
    const t = useStudentTutor('sess-1')
    t.activateGate()
    ;(winterboardApi.copilotReply as any).mockRejectedValueOnce({ response: { status: 403 } })
    t.draft.value = 'а'
    await t.send()
    expect(t.disabled.value).toBe(true)
    // гейт більше не тримає reveal — режим уроку з engine скінчився
    const allowed = useTutorRevealGate(() => 'task-x')
    expect(allowed.value).toBe(true)
  })

  it('мережевий збій → failed, можна повторити', async () => {
    ;(winterboardApi.copilotReply as any).mockRejectedValueOnce(new Error('net'))
    const t = useStudentTutor('sess-1')
    t.draft.value = 'а'
    expect(await t.send()).toBe(false)
    expect(t.failed.value).toBe(true)
    expect(t.disabled.value).toBe(false)
  })

  it('clearHistory чистить усе (сервер тексту й так не тримає)', async () => {
    const t = useStudentTutor('sess-1')
    t.draft.value = 'x=1'
    await t.send()
    expect(t.messages.value.length).toBe(2)
    t.clearHistory()
    expect(t.messages.value).toEqual([])
  })

  it('markUnclear шле фіксовану фразу тим самим каналом', async () => {
    const t = useStudentTutor('sess-1')
    await t.markUnclear('Я не зрозумів, поясни ще раз')
    expect(winterboardApi.copilotReply)
      .toHaveBeenCalledWith('sess-1', 'Я не зрозумів, поясни ще раз')
  })
})

describe('reveal gate (ескіз §6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTutorGate()
    ;(winterboardApi.copilotReply as any).mockResolvedValue(reply())
  })

  it('без активного каналу reveal дозволено (тьютора не чіпаємо)', () => {
    const allowed = useTutorRevealGate(() => 'task-1')
    expect(allowed.value).toBe(true)
  })

  it('канал активний + стадія < 3 → замкнено', async () => {
    const t = useStudentTutor('sess-1')
    t.activateGate()
    t.watchTask('task-1')
    const allowed = useTutorRevealGate(() => 'task-1')
    expect(allowed.value).toBe(false)
    t.draft.value = 'підкажи'
    await t.send()                       // stage 1
    expect(allowed.value).toBe(false)
  })

  it('стадія 3 відчиняє reveal (v0 — сесійно)', async () => {
    ;(winterboardApi.copilotReply as any).mockResolvedValue(reply({ stage: 3 }))
    const t = useStudentTutor('sess-1')
    t.activateGate()
    t.watchTask('task-1')
    const allowed = useTutorRevealGate(() => 'task-1')
    expect(allowed.value).toBe(false)
    t.draft.value = 'все одно не виходить'
    await t.send()
    expect(allowed.value).toBe(true)
    // і задача, яку рендерер зареєструє ПІЗНІШЕ, теж відчинена
    t.watchTask('task-2')
    expect(useTutorRevealGate(() => 'task-2').value).toBe(true)
  })

  it('kill-тест wiring: рендерер справді питає гейт', () => {
    // Прибрали `revealAllowed` із NmtTaskRenderer — цей тест падає.
    const src = readFileSync(
      resolve(__dirname, '../components/board/objects/NmtTaskRenderer.vue'),
      'utf8',
    )
    expect(src).toContain('useTutorRevealGate')
    expect(src).toMatch(/hasAnswerToShow && revealAllowed/)
    expect(src).toMatch(/data\.solution && revealAllowed/)
  })
})
