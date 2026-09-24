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
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { visibleApps, visibleInserts, allInserts, searchInserts, MASH_APPS } from '../components/sidebar/insertRegistry'

const fetchCorridorRegistry = vi.fn()
vi.mock('@/modules/intent/corridors/corridorApi', () => ({
  fetchCorridorRegistry: (...a: unknown[]) => fetchCorridorRegistry(...a),
}))

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

describe('джерело правди — сервер (INV-EV-3, INV-EV-4)', () => {
  beforeEach(() => {
    _resetEvidenceToolsGate()
    fetchCorridorRegistry.mockReset()
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
