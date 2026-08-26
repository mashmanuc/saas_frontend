// C3 — двигун заговорив сам: репліка приходить WS-ом, а не у відповідь.
//
// Стережеться те, що ламається тихо: підписка. Перша редакція реєструвала
// слухача в `onMounted`, а композабл викликають і поза компонентом — там
// `onMounted` мовчки не спрацьовує, слухач не з'являється, і жодна помилка
// не виникає. Тест нижче падав би саме на цьому.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useStudentTutor, { resetTutorGate, useTutorRevealGate } from '../composables/useStudentTutor'

vi.mock('../api/winterboardApi', () => ({
  default: { copilotReply: vi.fn().mockResolvedValue({ reply: 'ок', stage: 1 }) },
}))

function push(detail: unknown) {
  window.dispatchEvent(new CustomEvent('wb:tutor-message', { detail }))
}

describe('useStudentTutor — ініційована репліка', () => {
  let t: ReturnType<typeof useStudentTutor>

  beforeEach(() => {
    resetTutorGate()
    t = useStudentTutor('sess-1')
  })

  afterEach(() => {
    t.stopListening()
  })

  it('WS-повідомлення потрапляє в ту саму історію', () => {
    push({ type: 'tutor.message', text: 'Спробуй через трикутник', stage: 1 })
    expect(t.messages.value).toHaveLength(1)
    expect(t.messages.value[0].role).toBe('ai')
    expect(t.messages.value[0].text).toBe('Спробуй через трикутник')
  })

  it('порожній текст не створює повідомлення', () => {
    push({ type: 'tutor.message', text: '   ' })
    push({ type: 'tutor.message' })
    expect(t.messages.value).toHaveLength(0)
  })

  it('вимкнений канал не оживає від пізнього повідомлення', () => {
    // 403 посеред уроку ховає панель; повідомлення, що прилетіло після,
    // не має її повернути.
    t.disabled.value = true
    push({ type: 'tutor.message', text: 'привіт' })
    expect(t.messages.value).toHaveLength(0)
  })

  it('стадія 3 відчиняє reveal так само, як у відповіді на запит', () => {
    t.activateGate()
    t.watchTask('task-9')
    const allowed = useTutorRevealGate(() => 'task-9')
    expect(allowed.value).toBe(false)
    push({ type: 'tutor.message', text: 'Розбір: …', stage: 3 })
    expect(allowed.value).toBe(true)
  })

  it('після stopListening повідомлення більше не доходять', () => {
    t.stopListening()
    push({ type: 'tutor.message', text: 'пізно' })
    expect(t.messages.value).toHaveLength(0)
  })

  it('репліка учня і ініційована лягають в одну розмову по порядку', async () => {
    await t.send('не розумію')
    push({ type: 'tutor.message', text: 'підказка' })
    expect(t.messages.value.map(m => m.role)).toEqual(['student', 'ai', 'ai'])
  })
})
