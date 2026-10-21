/**
 * Перо на мультиборді (власник 2026-10-21: «зробив 5 сторінок записів і дошка почала притормажувати — штрихи
 * запізнюватись»; панель — вбудований Android-браузер). Замір на копії його дошки (1920×1080 ×2, лише сенсор,
 * процесор ×6): ДО — прийнято 4 штрихи з 12, губилась чверть точок, затримка дотику до 0,56 с.
 * Причини, які стережуть ці тести:
 *  1) кожен шар дошки малювався в 4K;
 *  2) після кожного штриха всі штрихи сторінки згладжувались і будувались наново (запаси скидались цілком);
 *  3) мініатюри ВСІХ сторінок перемальовувались після кожного штриха;
 *  4) лічильник заповненості щотри секунди рахував розмір усієї дошки посеред письма.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { boardPixelRatio, LARGE_PANEL_MIN_CSS_WIDTH } from '../board/canvasPixelRatio'
import { changedPageIds } from '../components/pages/thumbnailDirty'
import { getSmoothedPoints, forgetSmoothedPoints, clearSmoothedCache } from '../engine/smoothing'

const CANVAS = readFileSync('src/modules/winterboard/components/canvas/WBCanvas.vue', 'utf8')
const THUMBS = readFileSync('src/modules/winterboard/components/pages/WBPageThumbnails.vue', 'utf8')

describe('1) чіткість полотен', () => {
  it('велика сенсорна панель без миші — 1×; ноутбук, планшет, телефон — як було (до 2×)', () => {
    expect(boardPixelRatio({ dpr: 2, cssWidth: 1920, touchOnly: true })).toBe(1) // мультиборд 4K
    expect(boardPixelRatio({ dpr: 2, cssWidth: 1920, touchOnly: false })).toBe(2) // монітор з мишею
    expect(boardPixelRatio({ dpr: 2, cssWidth: 1366, touchOnly: true })).toBe(2) // iPad
    expect(boardPixelRatio({ dpr: 3, cssWidth: 430, touchOnly: true })).toBe(2) // телефон — стеля 2×
    expect(boardPixelRatio({ dpr: 1, cssWidth: 1920, touchOnly: true })).toBe(1)
    expect(LARGE_PANEL_MIN_CSS_WIDTH).toBeGreaterThan(1366)
  })

  it('задається в setup (до створення шарів), а не в onMounted', () => {
    expect(CANVAS).toMatch(/\nKonva\.pixelRatio = currentBoardPixelRatio\(\)\n/)
    expect(CANVAS).not.toMatch(/Konva\.pixelRatio = Math\.min\(Math\.max\(dpr, 1\), 2\)/)
  })
})

describe('2) запас форм і згладжених точок', () => {
  afterEach(() => clearSmoothedCache())

  it('новий штрих не скидає запас усіх штрихів: скидання — лише змінених і зниклих', () => {
    const at = CANVAS.indexOf('let lastStrokeObjs')
    const block = CANVAS.slice(at, CANVAS.indexOf('\n)\n', at))
    expect(block).toContain('() => props.strokes')
    expect(block).toMatch(/if \(next\.get\(id\) !== obj\) \{\s*strokeConfigCache\.delete\(id\)\s*forgetSmoothedPoints\(id\)/)
    expect(block).not.toContain('strokeConfigCache.clear()')
    expect(block).not.toContain('clearSmoothedCache()')
  })

  it('forgetSmoothedPoints забуває один штрих, інші лишаються в запасі', () => {
    const pts = [0, 1, 2, 3, 4].map((i) => ({ x: i * 10, y: (i % 2) * 5 }))
    const a1 = getSmoothedPoints('a', 'pen', pts)
    const b1 = getSmoothedPoints('b', 'pen', pts)
    forgetSmoothedPoints('a')
    expect(getSmoothedPoints('b', 'pen', pts)).toBe(b1) // той самий масив — із запасу
    const a2 = getSmoothedPoints('a', 'pen', pts)
    expect(a2).not.toBe(a1) // перераховано
    expect(a2).toEqual(a1)
  })
})

describe('3) мініатюри сторінок', () => {
  it('перемальовуються лише сторінки, чий вміст змінився', () => {
    const prev = new Map([['p1', '10|0||'], ['p2', '5|1||']])
    expect(changedPageIds(prev, new Map([['p1', '10|0||'], ['p2', '6|1||']]))).toEqual(['p2'])
    expect(changedPageIds(prev, new Map([['p1', '10|0||'], ['p2', '5|1||'], ['p3', '0|0||']]))).toEqual(['p3'])
    expect(changedPageIds(prev, prev)).toEqual([])
  })

  it('після штриха малюються лише змінені видимі мініатюри, а не всі', () => {
    expect(THUMBS).toContain("import { changedPageIds } from './thumbnailDirty'")
    expect(THUMBS).toMatch(/for \(const id of changedPageIds\(lastSigs, next\)\) dirtyIds\.add\(id\)/)
    expect(THUMBS).toMatch(/function renderDirtyThumbnails\(\)/)
    expect(THUMBS).toMatch(/if \(renderAll\) \{[\s\S]*renderVisibleThumbnails\(\)[\s\S]*\}\s*renderDirtyThumbnails\(\)/)
  })
})

describe('4) лічильник заповненості', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules() })

  it('рахує не частіше ніж раз на 10 с і лише коли браузер вільний', async () => {
    vi.useFakeTimers()
    const idle: Array<() => void> = []
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => { idle.push(cb); return idle.length })
    const { MEASURE_INTERVAL_MS, useLessonSizeGauge } = await import('../board/lessonSizeGauge')
    expect(MEASURE_INTERVAL_MS).toBeGreaterThanOrEqual(10_000)
    const { ref, effectScope } = await import('vue')
    const getState = vi.fn(() => ({ pages: [] }))
    const seq = ref(1)
    const scope = effectScope()
    scope.run(() => useLessonSizeGauge({ enabled: ref(true), seq: () => seq.value, getState }))
    await vi.advanceTimersByTimeAsync(0)
    expect(getState).not.toHaveBeenCalled() // чекає вільної хвилини
    idle.shift()!()
    expect(getState).toHaveBeenCalledTimes(1)
    seq.value = 2
    await vi.advanceTimersByTimeAsync(MEASURE_INTERVAL_MS - 1)
    expect(idle.length).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(idle.length).toBe(1)
    scope.stop()
  })
})
