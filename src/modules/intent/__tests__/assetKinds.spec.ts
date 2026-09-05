/**
 * Етап 0 MCL — guard-тести проти «тихих брехонь» контексту Інтегралика.
 *
 * Аудит 2026-08-13 знайшов два дефекти цього файлу-джерела:
 *   §3.1 — ключ підпису `nmt_3d` НЕ збігався з реальним `asset.type='nmt3d'`
 *          → 3D-фігура їхала в контекст без назви, «пересунь піраміду»
 *          не працювало й не могло (резолвер шукає за токенами підпису);
 *   §3.3 — 8 із 15 overlay-типів не мали підпису взагалі → половина дошки
 *          для Інтегралика була безіменною.
 *
 * Обидва дефекти НЕ падають — вони мовчать. Тому їх стереже тест, а не око:
 * новий overlay-тип без підпису = падіння guard-тесту, а не тиха дірка.
 */
import { describe, it, expect } from 'vitest'
import { OVERLAY_ASSET_TYPES } from '@/modules/winterboard/components/canvas/overlayRegistry'
import { KIND_LABELS, assetParams, summarizeAsset } from '../boardActions'

/** Media-типи живуть поза overlay-реєстром, але теж мають підписи. */
const MEDIA_TYPES = ['image', 'youtube']

describe('етап 0.1/0.3 — кожен тип дошки має людський підпис', () => {
  it('усі overlay-типи покриті KIND_LABELS', () => {
    const missing = OVERLAY_ASSET_TYPES.filter((t) => !KIND_LABELS[t])
    expect(missing, `типи без підпису: ${missing.join(', ')}`).toEqual([])
  })

  it('у KIND_LABELS немає ключів-сиріт (регресія §3.1: nmt_3d ≠ nmt3d)', () => {
    // Одруківка в ключі не падає ніколи — вона просто робить об'єкт
    // невидимим. Ключ, якого немає серед реальних типів, = майбутня сирота.
    const real = new Set([...OVERLAY_ASSET_TYPES, ...MEDIA_TYPES])
    const orphans = Object.keys(KIND_LABELS).filter((k) => !real.has(k))
    expect(orphans, `ключі-сироти: ${orphans.join(', ')}`).toEqual([])
  })

  it('kind — людське слово, не сирий type', () => {
    for (const t of OVERLAY_ASSET_TYPES) {
      const { kind } = summarizeAsset({ id: 'x', type: t, data: {} })
      expect(kind, t).toBeTruthy()
      expect(kind, `${t}: kind не перекладено`).not.toBe(t)
    }
  })
})

describe('етап 0.1 — стереометрія знову видима', () => {
  it('nmt3d має kind і назву шаблону в label', () => {
    const { kind, label } = summarizeAsset({
      id: 'x', type: 'nmt3d', data: { templateKey: 'pyramid4' },
    })
    expect(kind).toBe('стереометрія')
    // Людська назва з NMT3D_TEMPLATE_LABELS — саме за нею тьютор каже
    // «пересунь піраміду», і саме за нею резолвер матчить токени.
    expect(label.toLowerCase()).toContain('пірамід')
  })

  it('невідомий шаблон не лишає обʼєкт безіменним', () => {
    const { label } = summarizeAsset({
      id: 'x', type: 'nmt3d', data: { templateKey: 'mystery' },
    })
    expect(label).toBe('mystery')   // фолбек: гірше за назву, краще за ніщо
  })
})

describe('етап 0.3 — нові підписи несуть упізнаваний вміст', () => {
  it('квадратична — коефіцієнти', () => {
    const { kind, label } = summarizeAsset({
      id: 'x', type: 'quadratic_card', data: { a: 2, b: -3, c: 1 },
    })
    expect(kind).toBe('парабола')
    // ⚠️ Літерал змінено 2026-09-05: було `y = 2x² + -3x + 1`. Тест
    // перевіряє, що підпис НЕСЕ КОЕФІЦІЄНТИ, — і цього він досі
    // перевіряє. Стара стрічка просто зафіксувала тодішній вивід разом
    // із дефектом: «плюс мінус три ікс», а при типових a=1,b=0,c=0 —
    // «один ікс квадрат плюс нуль ікс плюс нуль». Інтегралик цю назву
    // ВИМОВЛЯЄ, тому вона мусить читатись як математика.
    expect(label).toBe('y = 2x² − 3x + 1')
  })

  it('аналіз — режим і вираз', () => {
    const { label } = summarizeAsset({
      id: 'x', type: 'calculus_card', data: { mode: 'integral', expr: 'x^2' },
    })
    expect(label).toBe('первісна: x^2')
  })

  it('тригонометричне рівняння — функція, знак, права частина', () => {
    const { label } = summarizeAsset({
      id: 'x', type: 'trig_solver', data: { type: 'cos', rel: '>', a: 0.5 },
    })
    expect(label).toBe('cos(x) > 0.5')
  })

  it('GeoMASH-сцена — скільки обʼєктів', () => {
    const full = summarizeAsset({
      id: 'x', type: 'geomash_scene',
      data: { scene: { objects: [{ id: 'A' }, { id: 'B' }, { id: 'a' }] } },
    })
    expect(full.kind).toBe('геометрична сцена')
    expect(full.label).toBe("3 об'єктів")
    expect(summarizeAsset({ id: 'x', type: 'geomash_scene', data: {} }).label)
      .toBe('порожня')
  })

  it('порожні data не валять підпис жодного типу', () => {
    for (const t of OVERLAY_ASSET_TYPES) {
      expect(() => summarizeAsset({ id: 'x', type: t, data: undefined }), t)
        .not.toThrow()
    }
  })
})

describe('етап 2 READ — поточні значення параметрів', () => {
  it('графік віддає вирази, параметри, масштаб і точки', () => {
    const p = assetParams({
      id: 'g', type: 'graph_calculator',
      data: {
        state: {
          expressions: [{ src: 'a*x^2 + b' }],
          params: { a: { value: -2, min: -5, max: 5, step: 0.1 } },
          viewport: { cx: 0, cy: 0, scale: 38 },
          points: { P: { x: 2, y: -5, mode: 'free' } },
        },
      },
    })
    expect(p.expressions).toEqual(['a*x^2 + b'])
    expect(p.params).toEqual({ a: -2 })     // саме ЗНАЧЕННЯ, не вся конфігурація
    expect(p.viewport).toEqual({ cx: 0, cy: 0, scale: 38 })
    expect(p.points).toEqual(['P(2; -5)'])
  })

  it('парабола — коефіцієнти, якими тьютор оперує словами', () => {
    expect(assetParams({ id: 'q', type: 'quadratic_card', data: { a: 2, b: -3, c: 1 } }))
      .toEqual({ a: 2, b: -3, c: 1 })
  })

  it('планіметрія — які побудови ЗАРАЗ увімкнені', () => {
    const p = assetParams({
      id: 'g2', type: 'geometry_2d_v2',
      data: { preset: 'triangle', toggles: { medians: true, altitudes: false } },
    })
    expect(p.preset).toBe('triangle')
    expect(p.shown).toEqual(['medians'])    // вимкнені не згадуємо — це шум
  })

  it('GeoMASH — імена об\'єктів, якими їх називає тьютор', () => {
    const p = assetParams({
      id: 's', type: 'geomash_scene',
      data: { scene: { objects: [{ id: 'A' }, { id: 'B' }, { id: 'a' }] } },
    })
    expect(p.objects).toEqual(['A', 'B', 'a'])   // без рушія — фолбек на імена
  })

  it('GeoMASH — ЗНАЧЕННЯ, коли рушій доступний (жива дошка)', () => {
    // Прогін власника 2026-08-15: «яка градусна міра кута» → «координати й
    // кути у стані не вказані». Чесно, але марно: значення були на екрані.
    // Рахує їх сам рушій (getValue) — другої реалізації градусної міри тут
    // бути не повинно, інакше вони розійдуться і ніхто не помітить.
    const scene = { objects: [{ id: 'D' }, { id: 'α' }] }
    ;(globalThis as any).window.GeoEngine = {
      deserialize: (s: any) => ({ objects: s.objects }),
      getValue: (_o: any, id: string) =>
        (id === 'D' ? 'D = (-5.00, -5.00)' : 'α = 47.3°'),
    }
    try {
      expect(assetParams({ id: 's', type: 'geomash_scene', data: { scene } }).objects)
        .toEqual(['D = (-5.00, -5.00)', 'α = 47.3°'])
    } finally {
      delete (globalThis as any).window.GeoEngine
    }
  })

  it('зламаний рушій не валить контекст — відкочується на імена', () => {
    ;(globalThis as any).window.GeoEngine = {
      deserialize: () => { throw new Error('чужий формат сцени') },
      getValue: () => '',
    }
    try {
      expect(assetParams({
        id: 's', type: 'geomash_scene',
        data: { scene: { objects: [{ id: 'A' }] } },
      }).objects).toEqual(['A'])
    } finally {
      delete (globalThis as any).window.GeoEngine
    }
  })

  it('порожні/відсутні значення не потрапляють у контекст', () => {
    // Кожен зайвий ключ множиться на кількість об'єктів у кожному запиті.
    expect(assetParams({ id: 'x', type: 'trig_solver', data: { type: 'sin' } }))
      .toEqual({ type: 'sin' })
    expect(assetParams({ id: 'x', type: 'theory_card', data: { title: 'T' } })).toEqual({})
  })

  it('жоден тип не валиться на порожніх data', () => {
    for (const t of OVERLAY_ASSET_TYPES) {
      expect(() => assetParams({ id: 'x', type: t, data: undefined }), t).not.toThrow()
    }
  })
})
