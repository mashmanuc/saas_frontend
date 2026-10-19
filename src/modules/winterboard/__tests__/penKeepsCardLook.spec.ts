/**
 * Олівець не змінює вигляд карток (власник 2026-10-19): «картинка ніби скаче і відволікає учня… коли картинка
 * виділена — можна нормально працювати», «фон лишається як і був», характеристики в правій панелі — як були.
 *
 * З травня з олівцем (`.is-readonly`) картки ставали прозорими й ховали заголовок і кнопки — малюнок
 * зсувався при кожному перемиканні інструмента. Тепер:
 *   - прозорий фон і сховані заголовок/кнопки — ЛИШЕ в перегляді (повтор уроку, публічне посилання),
 *     через клас обгортки `.wb-overlay--view-only` (WBOverlayLayer ставить його, коли дошка не в режимі уроку);
 *   - з олівцем заголовок і кнопки видно, але дотик іде крізь них (pointer-events: none) — лінія лягає
 *     поверх картки (WBCanvas малює лінії олівця над картками).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../components')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')
const style = (src: string) => src.slice(src.indexOf('<style'))

/** Кожне правило CSS: [селектор, тіло]. */
function rules(css: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clean))) out.push([m[1].trim(), m[2]])
  return out
}

const RENDERERS = [
  'board/objects/Geometry2DRenderer.vue',
  'board/objects/CalculusRenderer.vue',
  'board/objects/HelixRenderer.vue',
  'board/objects/TrigCircleRenderer.vue',
  'board/objects/QuadraticRenderer.vue',
  'board/objects/NumberLineRenderer.vue',
  'board/objects/TrigSolverRenderer.vue',
  'board/objects/GraphCalculatorRenderer.vue',
  'board/objects/HistoryCardRenderer.vue',
  'board/objects/TheoryCardRenderer.vue',
]

describe('олівець не змінює вигляд картки', () => {
  it('обгортка позначає «лише перегляд» тоді й лише тоді, коли дошка не в режимі уроку', () => {
    expect(read('canvas/WBOverlayLayer.vue')).toContain("'wb-overlay--view-only': wbStore.mode !== 'edit',")
  })

  for (const file of RENDERERS) {
    it(`${file}: сховати чи прозорити картку можна лише в перегляді`, () => {
      const offenders = rules(style(read(file)))
        .flatMap(([sel, body]) => sel.split(',').map((s) => [s.trim(), body] as const))
        .filter(([sel, body]) => sel.includes('.is-readonly')
          && /display:\s*none|background:\s*(transparent|rgba\([^)]*,\s*0(\.0)?\))/.test(body))
        .filter(([sel]) => !sel.startsWith('.wb-overlay--view-only '))
        .map(([sel]) => sel)
      expect(offenders).toEqual([])
    })
  }

  // 2026-10-19 (власник: «поверх карток було видно штрихи незалежно від вибраного інструмента»):
  // сам шар штрихів Konva — над HTML-картками (z 4–5) за будь-якого інструмента й режиму, без копії-дзеркала.
  it('лінії олівця — завжди над картками й не ловлять натискань', () => {
    const src = read('canvas/WBCanvas.vue')
    expect(src).toContain("strokesCanvas.style.zIndex = String(linesZ.value)")
    expect(src).toContain("strokesCanvas.style.pointerEvents = 'none'")
    expect(src).not.toMatch(/wb-strokes-overlay|mirrorStrokesLayer/)
  })

  // 2026-10-19 (власник «роби 2»): лінії — і над відео (z 20), і над розгорнутою карткою (z 50);
  // живий слід пера — над лініями; з олівцем відео не ловить дотик.
  it('лінії й слід пера — над відео та розгорнутою карткою; відео з олівцем пропускає дотик', () => {
    const src = read('canvas/WBCanvas.vue')
    expect(src).toContain('const linesZ = computed(() => (wbStore.expandedAssetId ? 51 : 21))')
    expect(src).toContain(':style="{ zIndex: String(linesZ + 1) }"')
    const media = rules(style(src)).find(([sel]) =>
      sel.includes('.wb-media-overlay:not(.wb-media-overlay--selectable):not(.wb-media-overlay--show) :deep(*)'))
    expect(media?.[1] ?? '').toMatch(/pointer-events:\s*none/)
  })

  // 2026-10-19 (власник «роби 1»): кнопки геометрії — лише в правій панелі; у картці рядка немає ніколи,
  // тож при виділенні малюнок не стрибає.
  it('геометрія: рядок кнопок у картці прихований завжди', () => {
    const hit = rules(style(read('board/objects/Geometry2DRenderer.vue'))).find(([sel]) => sel === '.geo2dv2-toolbar-host')
    expect(hit?.[1] ?? '').toMatch(/display:\s*none/)
  })

  it('з олівцем кнопки картки видно, але дотик іде крізь них', () => {
    const inert: Record<string, string> = {
      'board/objects/CalculusRenderer.vue': '.calculus-renderer.is-readonly .calculus-toolbar :deep(*)',
      'board/objects/HelixRenderer.vue': '.helix-renderer.is-readonly .helix-toolbar :deep(*)',
      'board/objects/TrigCircleRenderer.vue': '.trig-circle-renderer.is-readonly .trig-toolbar :deep(*)',
      'board/objects/TrigSolverRenderer.vue': '.trig-slv.is-readonly .trig-slv-tools :deep(*)',
      'board/objects/GraphCalculatorRenderer.vue': '.graph-calc-renderer.is-readonly .gc-panel :deep(*)',
    }
    for (const [file, sel] of Object.entries(inert)) {
      const hit = rules(style(read(file))).find(([s]) => s.split(',').map((x) => x.trim()).includes(sel))
      expect(hit?.[1] ?? '', `${file} · ${sel}`).toMatch(/pointer-events:\s*none/)
    }
  })
})
