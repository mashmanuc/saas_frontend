/**
 * «Фігура скаче» (власник, 2026-09-24, жива дошка): увімкнув «Описане» —
 * трикутник зменшився й поїхав, вимкнув — повернувся.
 *
 * Причина: кожен render() вписував видиме поле в межі НАМАЛЬОВАНОГО, а описане
 * коло більше за трикутник. Тепер поле резервує місце під усі побудови пресета
 * (`GeoCard._reserveObjects`), тож перемикачі поле не рухають.
 *
 * Тут справжній рушій (geo2d.js + пресети + картка), не підробка: інакше тест
 * перевіряв би власну модель, а не те, що бачить учитель.
 */
import { beforeAll, describe, expect, it } from 'vitest'

type View = { cx: number; cy: number; scale: number }
type Card = {
  renderer: { view: View }
  setToggle(key: string, on: boolean): void
  setFreePoints(s: Record<string, { x: number; y: number }>): void
  preset: { toggles: Array<{ key: string }> }
}

beforeAll(async () => {
  // happy-dom не має ResizeObserver; рушій лише підписується на нього.
  ;(globalThis as any).ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} }
  await import('../vendor/geo2d')
})

function makeCard(type: string): Card {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return new (window as any).GeoCard(el, { type }) as Card
}

const snap = (v: View): View => ({ cx: v.cx, cy: v.cy, scale: v.scale })

describe('geo2d: перемикачі не рухають фігуру', () => {
  it.each(['circumcircle', 'altitudes', 'incircle', 'perpbis', 'medians'])(
    'трикутник: «%s» туди й назад — поле те саме',
    (key) => {
      const card = makeCard('triangle')
      const before = snap(card.renderer.view)
      card.setToggle(key, true)
      expect(snap(card.renderer.view)).toEqual(before)
      card.setToggle(key, false)
      expect(snap(card.renderer.view)).toEqual(before)
    },
  )

  it('тупокутний трикутник: висоти (основи поза фігурою) теж не рухають поле', () => {
    const card = makeCard('triangle')
    card.setFreePoints({ A: { x: -4, y: 0 }, B: { x: 4, y: 0 }, C: { x: -3, y: 1 } })
    const before = snap(card.renderer.view)
    for (const k of ['altitudes', 'circumcircle', 'perpbis']) card.setToggle(k, true)
    expect(snap(card.renderer.view)).toEqual(before)
  })

  it('перетягування точок поле, як і раніше, перераховує', () => {
    const card = makeCard('triangle')
    const before = snap(card.renderer.view)
    card.setFreePoints({ A: { x: -10, y: -6 }, B: { x: 10, y: -6 }, C: { x: 0, y: 9 } })
    expect(snap(card.renderer.view)).not.toEqual(before)
  })
})

describe('geo2d: усі пресети каталогу', () => {
  // Резерв поля вмикає ВСІ побудови пресета разом. Якщо котрась із них падає
  // в парі з іншою — зламається вже не одна кнопка, а вся картка. Тому
  // проганяємо кожен пресет із каталогу, а не лише трикутник.
  const presets = (): string[] => ((window as any).GEO_PRESETS as Array<{ type: string }>).map((p) => p.type)

  it('каталог не порожній', () => {
    expect(presets().length).toBeGreaterThan(5)
  })

  it('кожен пресет будується, і жоден перемикач не рухає поле', () => {
    const moved: string[] = []
    for (const type of presets()) {
      const card = makeCard(type)
      const before = snap(card.renderer.view)
      for (const t of card.preset.toggles || []) {
        card.setToggle(t.key, true)
        const now = snap(card.renderer.view)
        if (JSON.stringify(now) !== JSON.stringify(before)) moved.push(`${type}.${t.key}`)
        card.setToggle(t.key, false)
      }
    }
    expect(moved).toEqual([])
  })
})

