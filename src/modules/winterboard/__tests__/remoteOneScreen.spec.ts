/**
 * Маніфест пульта П7 · LAW §9 v1.58 «один екран без дублів» (власник 2026-10-25: «завалений кнопками… вони
 * дублюються… і сценарії, і окремо»; на пропозицію — «роби і покажи на стенді»).
 *
 *   — з новим ноутбуком (`objects`) окремої кнопки «📋 Сценарій» немає: список відкриває назва поточного об'єкта;
 *   — «Сценарій» — лише вибір: жодних кнопок об'єкта, дотик — поточний і список закрито; на сторінці на екрані — усі
 *     її об'єкти (і задачі, і вирізки), на інших — пункти «Сценарію»;
 *   — сторінка без об'єктів — «📋 Сценарій · N» на місці назви; «Фото | Відео | Диктант» — одним рядком;
 *   — старий ноутбук (без `objects`) — як до v1.58.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { derivePair } from '../remote/remotePair'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)

vi.mock('../composables/usePresence', () => ({ usePresence: () => ({}) }))

const channelState = ref<'idle' | 'connected'>('idle')
const send = vi.fn((_data: Record<string, unknown>) => true)
let onStateCb: ((s: any) => void) | null = null

vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      onStateCb = opts.onState
      return {
        state: channelState, lastError: ref(null), sessionId: ref(null),
        connect: vi.fn(async () => { channelState.value = 'connected' }), disconnect: vi.fn(), retry: vi.fn(), send,
      }
    },
  }
})
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: () => ({ supported: true, listening: ref(false), press: vi.fn(), release: vi.fn() }),
}))
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 7, email: 'teacher@m4sh.local' }, forceLogout: vi.fn() }),
}))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({ fetchCorridorRegistry: vi.fn(async () => null) }))
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    getActiveRemoteSession: vi.fn(async () => ({ session_id: SID, name: 'Урок', ts: 1 })),
    searchVideos: vi.fn(), lookupVideo: vi.fn(),
  },
}))

import WBRemoteView from '../views/WBRemoteView.vue'

const mounted: Array<{ unmount: () => void }> = []
async function mountWith(state: Record<string, unknown>) {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  // attachTo: isVisible() бачить display:none аркуша лише в документі
  const w = mount(WBRemoteView, { attachTo: document.body, global: { plugins: [i18n], stubs: { RouterLink: true, RemoteBoardMirror: true } } })
  mounted.push(w)
  await flushPromises()
  onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 2, ...state })
  await nextTick()
  return w
}
const cmds = () => send.mock.calls.map((c) => c[0] as any).filter((m) => m.type === 'remote.command')

// Сторінка 1 на екрані: задача з банку, вирізка з PDF, відео; на сторінці 2 — пісня.
const OBJS = [
  { id: 'task', kind: 'task', n: 1, hw: true, presenting: false },
  { id: 'cut', kind: 'cut', n: 1, hw: true, presenting: false },
  { id: 'yt', kind: 'video', n: 1, hw: false, presenting: false },
]
const SCN = {
  focusId: null,
  items: [
    { objectId: 'yt', kind: 'video', title: 'Досліди з маятником', pageIndex: 0, minimized: false, state: 'paused', volume: 60 },
    { objectId: 'snd', kind: 'audio', title: 'Пісня', pageIndex: 1, minimized: false },
  ],
}
const NEW = { caps: ['photo', 'video', 'scenario', 'objects', 'dictation'], scenario: SCN, objects: OBJS, currentId: 'task' }
const sheetVisible = (w: any) => w.find('[data-testid="scenario-sheet"]').isVisible()

describe('маніфест пульта П7 · один екран без дублів (LAW §9 v1.58)', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    onStateCb = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  it('окремої кнопки «Сценарій» немає — список відкриває назва поточного об\'єкта', async () => {
    const w = await mountWith(NEW)
    expect(w.find('[data-testid="open-scenario"]').exists()).toBe(false)
    expect(w.get('[data-testid="object-label"]').text()).toBe('Задача 1 · 1 з 3')
    expect(sheetVisible(w)).toBe(false)
    await w.get('[data-testid="object-pick"]').trigger('click')
    await nextTick()
    expect(sheetVisible(w)).toBe(true)
  })

  it('«Сценарій» — лише вибір: на сторінці на екрані всі об\'єкти (і задача, і вирізка), жодної кнопки об\'єкта', async () => {
    const w = await mountWith(NEW)
    const sheet = w.get('[data-testid="scenario-sheet"]')
    const titles = sheet.findAll('.wb-scn__group--current .wb-scn__title').map((e) => e.text())
    expect(titles).toEqual(['Задача 1', 'Вирізка 1', 'Досліди з маятником'])
    // кнопки в списку: три пункти сторінки на екрані + «Пісня» + «Відкрити» сторінку 2 — і більше нічого
    const buttons = sheet.findAll('button').map((b) => b.attributes('data-testid')).sort()
    expect(buttons).toEqual(['scenario-name-cut', 'scenario-name-snd', 'scenario-name-task', 'scenario-name-yt', 'scenario-open-1'])
    expect(sheet.find('.wb-obj').exists()).toBe(false)
    // кнопки відео (і шкала) — на головному екрані, під поточним об'єктом, коли обрано відео
    expect(w.find('[data-testid="context"] .wb-obj').exists()).toBe(false)   // зараз поточна задача
  })

  it('дотик у списку — поточний, список закрито; інша сторінка — спершу перехід (ті самі команди)', async () => {
    const w = await mountWith(NEW)
    await w.get('[data-testid="object-pick"]').trigger('click')
    send.mockClear()
    await w.get('[data-testid="scenario-name-yt"]').trigger('click')
    await nextTick()
    expect(cmds()).toEqual([expect.objectContaining({ cmd: 'object.select', args: { object_id: 'yt' } })])
    expect(sheetVisible(w)).toBe(false)
    expect(w.get('[data-testid="object-label"]').text()).toBe('Відео 1 · 3 з 3')
    await w.get('[data-testid="object-pick"]').trigger('click')
    send.mockClear()
    await w.get('[data-testid="scenario-name-snd"]').trigger('click')
    await nextTick()
    expect(cmds()).toEqual([
      expect.objectContaining({ cmd: 'page.goto', args: { index: 1 } }),
      expect.objectContaining({ cmd: 'object.select', args: { object_id: 'snd' } }),
    ])
    expect(sheetVisible(w)).toBe(false)
  })

  it('сторінка без об\'єктів — «📋 Сценарій · N» на місці назви, над рядком «Додати»', async () => {
    const w = await mountWith({ ...NEW, objects: [], currentId: undefined })
    expect(w.find('[data-testid="object-pick"]').exists()).toBe(false)
    const slot = w.get('[data-testid="scenario-slot"]')
    expect(slot.text()).toContain('· 2')
    expect(slot.element.nextElementSibling?.getAttribute('data-testid')).toBe('add-row')
  })

  it('«Фото», «Відео», «Диктант» — одним рядком', async () => {
    const w = await mountWith(NEW)
    const row = w.get('[data-testid="add-row"]')
    expect(row.findAll('button').map((b) => b.attributes('data-testid'))).toEqual(['open-photo', 'open-video', 'open-dictation'])
  })

  it('старий ноутбук (без objects) — як до v1.58: кнопка «Сценарій» є, назва не кнопка', async () => {
    const w = await mountWith({ caps: ['scenario', 'photo'], scenario: SCN, objects: OBJS, currentId: 'task' })
    expect(w.find('[data-testid="object-pick"]').exists()).toBe(false)
    expect(w.find('[data-testid="open-scenario"]').exists()).toBe(true)
  })
})
