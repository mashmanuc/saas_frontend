/**
 * Етап 0 MCL (0.2) — `set_geometry` більше не бреше.
 *
 * Аудит §3.2: toggles у geo2d визначені ПЕР-ПРЕСЕТ, а handler писав будь-який
 * ключ без перевірки. «Покажи медіани на трапеції» → запис у стан проходив,
 * Інтегралик звітував «показую медіани», на екрані не змінювалось нічого,
 * помилки не було ніде. Правдоподібна відповідь без дії — той самий клас
 * збою, що лікувався в чаті.
 *
 * Тести мокають бандл: реальний geo2d — side-effect IIFE на window, вантажити
 * його заради контрактної перевірки — крихко й повільно.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const updateAsset = vi.fn()

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    currentPage: {
      id: 'p1',
      assets: [
        { id: 'geo-1', type: 'geometry_2d_v2', data: { preset: 'trapezium', toggles: {} } },
        { id: 'card-1', type: 'theory_card', data: {} },
      ],
    },
    updateAsset,
  }),
}))

// Вендор не вантажимо — handler робить `await import(...)` лише щоб бандл
// осів на window; тут window.Geo2D ставлять самі тести.
vi.mock('@/modules/winterboard/vendor/geo2d', () => ({}))

import { runBoardAction } from '../boardActions'

/** Трапеція вміє середню лінію і висоту — медіан у неї НЕМАЄ. */
const TRAPEZIUM_TOGGLES = [
  { key: 'midline', label: 'Середня лінія' },
  { key: 'height', label: 'Висота' },
  { key: 'lengths', label: 'Сторони' },
]

describe('етап 0.2 — set_geometry валідує toggle проти пресета', () => {
  beforeEach(() => {
    updateAsset.mockReset()
    ;(window as any).Geo2D = {
      PRESETS: { trapezium: { toggles: TRAPEZIUM_TOGGLES } },
    }
  })
  afterEach(() => {
    delete (window as any).Geo2D
  })

  it('валідний toggle пише стан', async () => {
    await runBoardAction({
      kind: 'set_geometry',
      payload: { object_id: 'geo-1', feature: 'midline', on: true },
    })
    expect(updateAsset).toHaveBeenCalledTimes(1)
    expect(updateAsset.mock.calls[0][0].data.toggles.midline).toBe(true)
  })

  it('неможливий toggle → видима відмова зі списком умінь, НЕ тихий успіх', async () => {
    // Живий приклад з аудиту: медіани на трапеції.
    await expect(runBoardAction({
      kind: 'set_geometry',
      payload: { object_id: 'geo-1', feature: 'medians', on: true },
    })).rejects.toThrow(/Середня лінія/)
    expect(updateAsset).not.toHaveBeenCalled()
  })

  it('відмова називає, що фігура ВМІЄ — тьютор може перепросити правильно', async () => {
    const err = await runBoardAction({
      kind: 'set_geometry',
      payload: { object_id: 'geo-1', feature: 'circumcircle' },
    }).catch((e: Error) => e)
    expect(String(err)).toMatch(/Висота/)
    expect(String(err)).toMatch(/Середня лінія/)
  })

  it('бандл не завантажився → fail-open (стара поведінка), не нова відмова', async () => {
    // Фігура вже на дошці, тож бандл майже напевно є; але якщо каталог
    // недоступний — блокувати легітимний виклик означало б обміняти одну
    // тиху брехню на іншу.
    delete (window as any).Geo2D
    await runBoardAction({
      kind: 'set_geometry',
      payload: { object_id: 'geo-1', feature: 'medians' },
    })
    expect(updateAsset).toHaveBeenCalledTimes(1)
  })

  it('не-геометрія лишається чесно відхиленою', async () => {
    await expect(runBoardAction({
      kind: 'set_geometry',
      payload: { object_id: 'card-1', feature: 'midline' },
    })).rejects.toThrow(/не геометрична/)
  })
})
