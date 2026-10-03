/**
 * Власник 2026-10-03: у російській мові панелі тригонометричних карток показували українські
 * написи. Секції `winterboard.trigSolver` у ru не було зовсім, у `winterboard.trigCircle`
 * бракувало 14 рядків, і vue-i18n брав запасну мову (uk). `npm run i18n:check` ru не бачить,
 * тому сторож — тут.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import ru from '../../../i18n/locales/ru.json'
import TrigSolverInspector from '../components/sidebar/TrigSolverInspector.vue'
import TrigCircleInspector from '../components/sidebar/TrigCircleInspector.vue'
import { registerTrigSolver, __resetTrigSolverUiForTests } from '../board/state/trigSolverUiState'
import { registerTrigCircle, __resetTrigCircleUiForTests } from '../board/state/trigCircleUiState'

type Dict = Record<string, unknown>
const section = (root: unknown, name: string): Dict => (((root as Dict).winterboard as Dict)?.[name] ?? {}) as Dict
// Літери, яких у російській немає: їхня поява — скопійований український рядок.
const UK_ONLY = /[іїєґІЇЄҐ]/

const i18nRu = () => createI18n({ legacy: false, locale: 'ru', fallbackLocale: 'uk', messages: { uk, ru } as never })

afterEach(() => {
  __resetTrigSolverUiForTests()
  __resetTrigCircleUiForTests()
})

describe('російська мова: панелі тригонометрії мають власні написи', () => {
  it.each(['trigSolver', 'trigCircle'])('winterboard.%s — кожен рядок uk є в ru, і він російський', (name) => {
    const u = section(uk, name)
    const r = section(ru, name)
    const missing = Object.keys(u).filter((k) => typeof r[k] !== 'string' || !(r[k] as string).trim())
    expect(missing).toEqual([])
    const ukrainian = Object.entries(r).filter(([, v]) => typeof v === 'string' && UK_ONLY.test(v)).map(([k]) => k)
    expect(ukrainian).toEqual([])
  })

  it('панель рівнянь російською — без українських підписів', () => {
    registerTrigSolver('ts-ru', {
      local: { type: 'sin', rel: '<=', a: 0.5, snapSpecial: true, showGraph: true, showAllSolutions: true },
      setType: vi.fn(), setRel: vi.fn(), setA: vi.fn(), toggleOpt: vi.fn(),
    } as never)
    const w = mount(TrigSolverInspector, { global: { plugins: [i18nRu()] } })
    expect(w.text()).toContain('Функция')
    expect(w.text()).not.toMatch(UK_ONLY)
    w.unmount()
  })

  it('панель кола російською — без українських підписів', () => {
    registerTrigCircle('tc-ru', {
      local: {
        showSin: true, showCos: true, showTan: false, showCot: false,
        showSpecialPoints: true, showRefLabels: true, showDeg: false, showRad: true,
        showExactGrid: false, showInscribed: false, showGraphs: false, snapPi12: false, speed: 0.6,
      },
      animating: false, drawMode: false,
      toggle: vi.fn(), jumpTo: vi.fn(), setSpeed: vi.fn(), toggleAnimate: vi.fn(), toggleDraw: vi.fn(),
    } as never)
    const w = mount(TrigCircleInspector, { global: { plugins: [i18nRu()] } })
    expect(w.text()).toContain('Функции')
    expect(w.text()).not.toMatch(UK_ONLY)
    w.unmount()
  })
})
