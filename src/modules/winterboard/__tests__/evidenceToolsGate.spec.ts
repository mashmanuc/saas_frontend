/**
 * «Навчальні обʼєкти» (шкала часу, карта подій) — лише акаунтам у rollout-гейті.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * Домовленість власника: шар бачить лише його акаунт. На проді 2026-09-24
 * плитка «Навчальні обʼєкти» стояла в панелі інструментів у всіх — гейта на
 * фронті не було зовсім, хоч на бекенді він є (коридори, `{40}` на проді).
 *
 * ІНВАРІАНТИ
 *   INV-EV-1  гейт закритий → ні плитки, ні вставок, ні в пошуку
 *   INV-EV-2  гейт відкритий → усе на місці
 *   INV-EV-3  список id на фронті НЕ дублюється: джерело — сервер
 *   INV-EV-4  помилка/404 → закрито (fail-closed), і сервер питаємо один раз
 *   INV-EV-5  гість, неперевірена сесія й учень сервер не питають (2026-09-27:
 *             публічний реплей із лендингу отримував 401 і показував гостю «Сесію
 *             завершено. Увійдіть знову.», протухла сесія викидала на /start, учень
 *             на уроці ловив 403 і тост «Доступ заборонено»)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { visibleApps, visibleInserts, allInserts, searchInserts, MASH_APPS } from '../components/sidebar/insertRegistry'
import { filterEvidenceCards, hideEvidenceCards } from '../board/evidenceCards'

const fetchCorridorRegistry = vi.fn()
vi.mock('@/modules/intent/corridors/corridorApi', () => ({
  fetchCorridorRegistry: (...a: unknown[]) => fetchCorridorRegistry(...a),
}))

// Хто перед гейтом — рішення INV-EV-5. За замовчуванням: вчитель, сесію перевірено.
const auth = { isAuthenticated: true, isBootstrapped: true, user: { role: 'tutor' } as { role: string } | null }
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => auth }))
function asTutor() {
  auth.isAuthenticated = true
  auth.isBootstrapped = true
  auth.user = { role: 'tutor' }
}

import { useEvidenceToolsGate, _resetEvidenceToolsGate } from '../composables/useEvidenceToolsGate'

describe('видимість «Навчальних обʼєктів»', () => {
  it('INV-EV-1: гейт закритий — плитки немає, вставок немає, пошук їх не знаходить', () => {
    const apps = visibleApps({ evidence: false })
    expect(apps.some(a => a.app === 'content')).toBe(false)
    expect(visibleInserts({ evidence: false }).some(e => e.family === 'evidence')).toBe(false)
    const found = visibleInserts({ evidence: false }, searchInserts('шкала часу'))
    expect(found).toEqual([])
  })

  it('INV-EV-2: гейт відкритий — плитка й обидві вставки на місці', () => {
    expect(visibleApps({ evidence: true })).toEqual(MASH_APPS)
    const ev = visibleInserts({ evidence: true }, allInserts()).filter(e => e.family === 'evidence')
    expect(ev.map(e => e.id).sort()).toEqual(['evidence.map', 'evidence.timeline'])
  })
})

describe('хто не може отримати відповідь — сервер не питає (INV-EV-5, 2026-09-27)', () => {
  beforeEach(() => {
    _resetEvidenceToolsGate()
    fetchCorridorRegistry.mockReset()
    asTutor()
  })

  async function expectNoRequest() {
    fetchCorridorRegistry.mockResolvedValue({ enabled: true })
    const { evidenceEnabled } = useEvidenceToolsGate()
    await Promise.resolve()
    expect(fetchCorridorRegistry).not.toHaveBeenCalled()
    expect(evidenceEnabled.value).toBe(false)
  }

  it('гість: запиту немає — інакше 401 і тост «Сесію завершено» людині, що не входила', async () => {
    auth.isAuthenticated = false
    auth.user = null
    await expectNoRequest()
  })

  it('сесію не перевірено (публічний маршрут): запиту немає — протухла сесія викинула б на /start', async () => {
    auth.isBootstrapped = false
    await expectNoRequest()
  })

  it('учень: запиту немає — інакше 403 і тост «Доступ заборонено» посеред уроку', async () => {
    auth.user = { role: 'student' }
    await expectNoRequest()
  })

  it('увійшов у тій самій вкладці — наступний виклик сервер питає', async () => {
    fetchCorridorRegistry.mockResolvedValue({ enabled: true })
    auth.isAuthenticated = false
    auth.isBootstrapped = false
    useEvidenceToolsGate()
    asTutor()
    const { evidenceEnabled } = useEvidenceToolsGate()
    await vi.waitFor(() => expect(evidenceEnabled.value).toBe(true))
    expect(fetchCorridorRegistry).toHaveBeenCalledTimes(1)
  })
})

describe('джерело правди — сервер (INV-EV-3, INV-EV-4)', () => {
  beforeEach(() => {
    _resetEvidenceToolsGate()
    fetchCorridorRegistry.mockReset()
    asTutor()
  })

  it('enabled від сервера відкриває інструменти', async () => {
    fetchCorridorRegistry.mockResolvedValue({ enabled: true, subjects: [] })
    const { evidenceEnabled } = useEvidenceToolsGate()
    await vi.waitFor(() => expect(evidenceEnabled.value).toBe(true))
  })

  it('404 (акаунт поза гейтом) → закрито', async () => {
    fetchCorridorRegistry.mockRejectedValue({ response: { status: 404 } })
    const { evidenceEnabled } = useEvidenceToolsGate()
    await vi.waitFor(() => expect(fetchCorridorRegistry).toHaveBeenCalled())
    expect(evidenceEnabled.value).toBe(false)
  })

  it('сервер питаємо один раз на вкладку, скільки б панель не відкривали', async () => {
    fetchCorridorRegistry.mockResolvedValue({ enabled: true })
    useEvidenceToolsGate(); useEvidenceToolsGate()
    const { evidenceEnabled } = useEvidenceToolsGate()
    await vi.waitFor(() => expect(evidenceEnabled.value).toBe(true))
    expect(fetchCorridorRegistry).toHaveBeenCalledTimes(1)
  })

  it('поки сервер не відповів — закрито (плитка не блимає у чужих)', async () => {
    // Свіжий модуль: перевіряємо САМЕ початкове значення, а не те, що лишив
    // `_resetEvidenceToolsGate` (інакше проба «гейт відкритий за замовчуванням»
    // проходить непоміченою).
    vi.resetModules()
    fetchCorridorRegistry.mockReturnValue(new Promise(() => {}))   // відповіді нема
    const fresh = await import('../composables/useEvidenceToolsGate')
    const { evidenceEnabled } = fresh.useEvidenceToolsGate()
    expect(evidenceEnabled.value).toBe(false)
  })

  it('на фронті немає свого списку id — лише запит до сервера', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/modules/winterboard/composables/useEvidenceToolsGate.ts', 'utf8'))
    expect(src).toContain('fetchCorridorRegistry')
    expect(src.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\b40\b/)
  })
})

// Власник 2026-09-24: «і картки теж сховати в чужих».
describe('картки шару на полотні', () => {
  const cards = [
    { id: 'a', type: 'timeline_card' },
    { id: 'b', type: 'map_card' },
    { id: 'c', type: 'theory_card' },
  ]

  it('чужий учитель у своїй дошці — карток шару немає', () => {
    const out = filterEvidenceCards(cards, { evidenceEnabled: false, isTutor: true, mode: 'edit' })
    expect(out.map(a => a.id)).toEqual(['c'])
    expect(hideEvidenceCards({ evidenceEnabled: false, isTutor: true, mode: 'edit' })).toBe(true)
  })

  it('акаунт у гейті бачить усе', () => {
    expect(filterEvidenceCards(cards, { evidenceEnabled: true, isTutor: true, mode: 'edit' }))
      .toEqual(cards)
  })

  it('учень на уроці бачить усе — інакше урок власника розвалиться', () => {
    expect(filterEvidenceCards(cards, { evidenceEnabled: false, isTutor: false, mode: 'edit' }))
      .toEqual(cards)
  })

  it('Replay показує запис як він був', () => {
    expect(filterEvidenceCards(cards, { evidenceEnabled: false, isTutor: true, mode: 'replay' }))
      .toEqual(cards)
  })

  it('ховаємо біля джерела: той самий список живить і Konva-проксі', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/modules/winterboard/components/canvas/WBCanvas.vue', 'utf8'))
    expect(src).toMatch(/const assets = computed\(\(\) => filterEvidenceCards\(/)
  })
})
