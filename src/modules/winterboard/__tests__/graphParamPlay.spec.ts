/**
 * Графкалькулятор, ТЗ 2026-10-04: кнопка ▶ «пробігання параметра» і видимі межі та крок.
 * (1) математика кроку й керування рухом — без браузера, кадри й час фейкові;
 * (2) права панель — кнопка ▶/⏸ і рядок «Мін/Макс/Крок» без кліку.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import GraphCalcInspector from '../components/sidebar/GraphCalcInspector.vue'
import {
  registerGraphCalcInspector,
  __resetGraphCalcInspectorForTests,
  type GraphCalcInspectorBridge,
} from '../board/state/graphCalcInspectorState'
import { createParamPlayer, snapToStep, stepParamPlay, PLAY_PERIOD_MS } from '../board/graphParamPlay'

const R = { min: -10, max: 10, step: 0.1 }

describe('рух параметра — математика кроку', () => {
  it('весь діапазон в один бік — за 4 с: чверть періоду — чверть діапазону', () => {
    const r = stepParamPlay({ pos: 0, dir: 1 }, R, PLAY_PERIOD_MS / 4)
    expect(r.value).toBe(5)
    expect(r.dir).toBe(1)
  })

  it('туди-назад: на максимумі розвертається і йде назад', () => {
    const r = stepParamPlay({ pos: 9, dir: 1 }, R, PLAY_PERIOD_MS / 10) // +2 → 11 → відбиття до 9
    expect(r.dir).toBe(-1)
    expect(r.value).toBe(9)
    const back = stepParamPlay({ pos: -9, dir: -1 }, R, PLAY_PERIOD_MS / 10)
    expect(back.dir).toBe(1)
    expect(back.value).toBe(-9)
  })

  it('значення стає на сітку кроку: крок 1 — лише цілі', () => {
    expect(snapToStep(0.4, { min: -10, max: 10, step: 1 })).toBe(0)
    expect(snapToStep(0.6, { min: -10, max: 10, step: 1 })).toBe(1)
    expect(snapToStep(0.30000000000000004, R)).toBe(0.3)
  })

  it('межі звузили під час руху — рух у нових межах', () => {
    const r = stepParamPlay({ pos: 8, dir: 1 }, { min: -5, max: 5, step: 0.1 }, 1)
    expect(r.value).toBeLessThanOrEqual(5)
    expect(r.value).toBeGreaterThanOrEqual(-5)
  })
})

function fakePlayer(start: { value: number; min?: number; max?: number; step?: number } | null = { value: 0 }) {
  let t = 0
  let queued: ((t: number) => void) | null = null
  const range = start ? { min: -10, max: 10, step: 0.1, ...start } : null
  const deps = {
    read: vi.fn(() => (range ? { ...range } : null)),
    setValue: vi.fn((_: string, v: number) => { if (range) range.value = v }),
    flush: vi.fn(),
    onPlayingChange: vi.fn(),
    now: () => t,
    requestFrame: vi.fn((cb: (t: number) => void) => { queued = cb; return 1 }),
    cancelFrame: vi.fn(() => { queued = null }),
  }
  const player = createParamPlayer(deps)
  const frame = (dt: number) => { t += dt; const cb = queued; queued = null; cb?.(t) }
  return { player, deps, frame, range, gone: () => { (range as any).gone = true } }
}

describe('рух параметра — керування', () => {
  it('▶ — кадри йдуть штатним шляхом (setValue), значення росте; ⏸ — останнє значення відправлено', () => {
    const { player, deps, frame } = fakePlayer()
    player.toggle('a')
    expect(deps.onPlayingChange).toHaveBeenLastCalledWith(['a'])
    frame(50); frame(50); frame(50)
    expect(deps.setValue).toHaveBeenCalled()
    const values = deps.setValue.mock.calls.map((c) => c[1] as number)
    expect(values[values.length - 1]).toBeGreaterThan(0)
    expect(values).toEqual([...values].sort((x, y) => x - y)) // туди: значення не спадає
    player.toggle('a')
    expect(deps.flush).toHaveBeenCalledTimes(1)
    expect(deps.onPlayingChange).toHaveBeenLastCalledWith([])
    const calls = deps.setValue.mock.calls.length
    frame(50)
    expect(deps.setValue.mock.calls.length).toBe(calls) // після ⏸ кадрів немає
  })

  it('стоїть на максимумі — рушає вниз', () => {
    const { player, deps, frame } = fakePlayer({ value: 10 })
    player.toggle('a')
    frame(100)
    expect(deps.setValue.mock.calls[0][1]).toBeLessThan(10)
  })

  it('параметр зник — рух стоп із відправкою останнього значення', () => {
    const { player, deps, frame } = fakePlayer()
    player.toggle('a')
    frame(50)
    deps.read.mockReturnValue(null)
    frame(50)
    expect(player.isPlaying('a')).toBe(false)
    expect(deps.flush).toHaveBeenCalledTimes(1)
  })

  it('stopAll (картку закрили, учитель узяв перо) — стоп усім', () => {
    const { player, deps } = fakePlayer()
    player.toggle('a')
    player.toggle('r')
    player.stopAll()
    expect(player.isPlaying('a') || player.isPlaying('r')).toBe(false)
    expect(deps.cancelFrame).toHaveBeenCalled()
  })

  it('довга пауза між кадрами (вкладка у фоні) не перекидає параметр через увесь діапазон', () => {
    const { player, deps, frame } = fakePlayer()
    player.toggle('a')
    frame(60_000)
    expect(Math.abs(deps.setValue.mock.calls[0][1] as number)).toBeLessThan(1)
  })
})

// ─── Права панель ───────────────────────────────────────────────────────────

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

function mountPanel(extra: Partial<GraphCalcInspectorBridge> = {}) {
  __resetGraphCalcInspectorForTests()
  const toggleParamPlay = vi.fn()
  registerGraphCalcInspector('gc-play', {
    paramEntries: [{ name: 'a', value: 1, min: -10, max: 10, step: 0.1 }],
    dragParamNames: [], paramFocus: null, paramExpanded: {},
    onSliderInput: () => {}, flushParam: () => {}, toggleParamExpand: () => {},
    onRangeMinChange: () => {}, onRangeMaxChange: () => {}, onRangeStepChange: () => {},
    displayExpressions: [{ id: 'e1', src: 'y = a*x', color: '#c05', hidden: false, isParam: false }],
    slashPopup: null, slashFilteredTemplates: [],
    onSrcInput: () => {}, onInputBlur: () => {}, onEnterPress: () => {},
    onArrowNav: () => {}, onToggleHidden: () => {}, onRemoveExpression: () => {},
    onAddExpression: () => {}, onInsertExpressions: () => [], onQuickAdd: () => {},
    applySlashTemplate: () => {}, closeSlashPopup: () => {}, setSlashSelectedIdx: () => {},
    isExpanded: false, toggleExpand: () => {},
    canPlayParams: true, playingParams: [], toggleParamPlay,
    ...extra,
  } as GraphCalcInspectorBridge)
  const w = mount(GraphCalcInspector, { global: { plugins: [i18n()] } })
  return { w, toggleParamPlay }
}

afterEach(() => __resetGraphCalcInspectorForTests())

describe('права панель: ▶ і межі', () => {
  it('▶ біля параметра; натиск — toggleParamPlay', async () => {
    const { w, toggleParamPlay } = mountPanel()
    const btn = w.get('[data-testid="gc-insp-param-play"]')
    expect(btn.text()).toBe('▶')
    expect(btn.attributes('aria-pressed')).toBe('false')
    await btn.trigger('click')
    expect(toggleParamPlay).toHaveBeenCalledWith('a')
    w.unmount()
  })

  it('параметр біжить — ⏸, натиснута', () => {
    const { w } = mountPanel({ playingParams: ['a'] })
    const btn = w.get('[data-testid="gc-insp-param-play"]')
    expect(btn.text()).toBe('⏸')
    expect(btn.attributes('aria-pressed')).toBe('true')
    w.unmount()
  })

  it('учень / Replay / перо (canPlayParams нема) — кнопки немає', () => {
    const { w } = mountPanel({ canPlayParams: false })
    expect(w.find('[data-testid="gc-insp-param-play"]').exists()).toBe(false)
    w.unmount()
  })

  it('«Мін / Макс / Крок» видно без кліку; «a =» ховає й показує', async () => {
    const { w } = mountPanel()
    expect(w.findAll('.gc-insp__range-input')).toHaveLength(3)
    await w.get('.gc-insp__param-name').trigger('click')
    expect(w.findAll('.gc-insp__range-input')).toHaveLength(0)
    await w.get('.gc-insp__param-name').trigger('click')
    expect(w.findAll('.gc-insp__range-input')).toHaveLength(3)
    w.unmount()
  })
})
