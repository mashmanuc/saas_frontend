/**
 * Індикатор запису для учня — межі, а не приклади.
 *
 * ⚠️ Навіщо цей пакет узагалі існує. Політика конфіденційності §4 і Оферта
 * учня VI **вже на проді** обіцяють учневі: «якщо тьютор активував Replay —
 * Платформа відображає ВАМ інформаційне повідомлення протягом заняття».
 * Насправді викладач бачив панель керування з таймером, а учень — нічого,
 * і його клієнт про запис навіть не знав, якщо запис почали ПІСЛЯ його
 * входу: у WS-подіях кімнати запису не було взагалі.
 *
 * Тести нижче стережуть саме цю обіцянку, а не реалізацію: подія доходить,
 * стан читається, пауза не бреше зникненням значка.
 */
import { describe, it, expect, beforeEach } from 'vitest'

/**
 * Читає файл від кореня репозиторію.
 *
 * Через cwd, а не через `new URL(..., import.meta.url)`: у vitest
 * `import.meta.url` не є file-URL, і конструктор падає з «URL must be of
 * scheme file». Перша редакція цього файлу так і впала — три тести з десяти.
 */
async function readRepoFile(rel: string): Promise<string> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  // process.cwd() === frontend/ під час прогону vitest
  return fs.readFile(path.resolve(process.cwd(), '..', rel), 'utf-8')
}

type RecState = 'idle' | 'recording' | 'paused' | 'finalized'

/**
 * Дослівна логіка `onRemoteRecordingState` з WBClassroomRoom.vue.
 *
 * Відтворена тут, а не змонтована разом із кімнатою, свідомо: кімната тягне
 * канву, WS, стор і роутер, і тест перетворився б на перевірку моків. Ціна —
 * копія логіки; вона названа, і саме тому нижче стоїть тест, який падає,
 * якщо копія розійдеться з оригіналом за формою події.
 */
function makeHandler(isStudent: boolean) {
  const state = { value: 'idle' as RecState }
  const startedAt = { value: null as string | null }
  const notices: string[] = []

  function handle(detail: unknown) {
    const d = detail as { state?: string; startedAt?: string | null }
    const next = d?.state
    if (next !== 'idle' && next !== 'recording'
        && next !== 'paused' && next !== 'finalized') return

    const was = state.value
    state.value = next
    if (next === 'recording' && d?.startedAt) startedAt.value = d.startedAt
    if (isStudent && next === 'recording' && was !== 'paused') {
      notices.push('studentStarted')
    }
  }
  return { state, startedAt, notices, handle }
}

/** Чи показувати значок — те саме `isRecordingVisibleToStudent`. */
const visible = (s: RecState) => s === 'recording' || s === 'paused'

describe('учень дізнається про запис', () => {
  let h: ReturnType<typeof makeHandler>
  beforeEach(() => { h = makeHandler(true) })

  it('🔴 головне: запис почали ПІСЛЯ входу учня — він дізнається', () => {
    // Саме цей випадок раніше лишався мовчазним: стан приходив тільки
    // гідрацією при вході, а вхід уже відбувся.
    expect(visible(h.state.value)).toBe(false)
    h.handle({ state: 'recording', startedAt: '2026-08-26T10:00:00Z' })
    expect(visible(h.state.value)).toBe(true)
    expect(h.notices).toEqual(['studentStarted'])
  })

  it('пауза НЕ ховає значок — сесія все ще записується', () => {
    h.handle({ state: 'recording', startedAt: null })
    h.handle({ state: 'paused' })
    expect(visible(h.state.value)).toBe(true)
    expect(h.state.value).toBe('paused')
  })

  it('повернення з паузи не повторює сповіщення', () => {
    h.handle({ state: 'recording', startedAt: null })
    h.handle({ state: 'paused' })
    h.handle({ state: 'recording', startedAt: null })
    // Одне на весь цикл: учень уже бачив і бачить значок.
    expect(h.notices).toEqual(['studentStarted'])
  })

  it('завершення прибирає значок', () => {
    h.handle({ state: 'recording', startedAt: null })
    h.handle({ state: 'finalized' })
    expect(visible(h.state.value)).toBe(false)
  })

  it('новий цикл запису сповіщає знову', () => {
    h.handle({ state: 'recording', startedAt: null })
    h.handle({ state: 'finalized' })
    h.handle({ state: 'recording', startedAt: null })
    expect(h.notices).toEqual(['studentStarted', 'studentStarted'])
  })

  it('сміття в події ігнорується, стан не псується', () => {
    h.handle({ state: 'recording', startedAt: null })
    h.handle({ state: 'НЕВІДОМО' })
    h.handle(undefined)
    h.handle({})
    expect(h.state.value).toBe('recording')
  })
})

describe('межі адресата', () => {
  it('🔴 викладачеві сповіщення НЕ показується — у нього є панель', () => {
    const teacher = makeHandler(false)
    teacher.handle({ state: 'recording', startedAt: null })
    expect(teacher.state.value).toBe('recording')
    expect(teacher.notices).toEqual([])
  })

  it('значок у розмітці стоїть під isStudent, не під !isTeacher', async () => {
    // Різниця не косметична: у кімнаті є третя роль (staff/адмін), і
    // `!isTeacher` показав би їй індикатор учня.
    const src = await readRepoFile(
      'frontend/src/modules/winterboard/views/WBClassroomRoom.vue')
    const i = src.indexOf('wb-rec-indicator')
    expect(i).toBeGreaterThan(0)
    const block = src.slice(Math.max(0, i - 400), i)
    expect(block).toContain('classroomRole.isStudent.value')
  })
})

describe('контракт події з бекендом', () => {
  it('kill-тест: BE шле саме ті поля, які читає FE', async () => {
    // Копія логіки вище розійшлася б із оригіналом непомітно, якби BE
    // перейменував поле. Тому звіряємось із самим BE-джерелом.
    const be = await readRepoFile('backend/apps/winterboard/api/views.py')
    const i = be.indexOf('_broadcast_recording_state')
    expect(i).toBeGreaterThan(0)
    const body = be.slice(i, i + 1800)
    expect(body).toContain("'type': 'recording.state'")
    expect(body).toContain("'state': state")
    expect(body).toContain("'startedAt'")
  })

  it('усі чотири переходи розсилаються', async () => {
    const be = await readRepoFile('backend/apps/winterboard/api/views.py')
    const calls = be.match(/_broadcast_recording_state\(session, state=/g) ?? []
    // start · resume · pause · finalize — пропустити бодай один означає, що
    // учень побачить не той стан, у якому насправді сесія.
    expect(calls.length).toBe(4)
  })
})
