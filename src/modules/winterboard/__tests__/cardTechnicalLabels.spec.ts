/**
 * Технічні назви на картках дошки → людські (власник 2026-10-02: «пройдись і знайди на
 * картках технічні назви, такі як snap»; на таблицю перейменувань — «так акуратно»).
 *
 * Три шари:
 *   1) поведінка — панелі тригонометрії й 3D показують нові написи і не показують старих;
 *   2) меню «/» графкалькулятора знаходить шаблон за українською назвою, а англійська
 *      лишилась синонімом;
 *   3) сторожі — у шаблонах карток пакета немає видимого тексту поза t(), а в uk-перекладах
 *      цих карток немає технічних слів (snap, drag, Pitot, cyclic, ratios, Zoom, iso).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'

import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import GraphCalcInspector from '../components/sidebar/GraphCalcInspector.vue'
import TrigSolverInspector from '../components/sidebar/TrigSolverInspector.vue'
import TrigCircleInspector from '../components/sidebar/TrigCircleInspector.vue'
import Nmt3dInspector from '../components/sidebar/Nmt3dInspector.vue'
import { registerTrigSolver, __resetTrigSolverUiForTests } from '../board/state/trigSolverUiState'
import { registerTrigCircle, __resetTrigCircleUiForTests } from '../board/state/trigCircleUiState'
import { registerNmt3dWorkspace, __resetNmt3dUiStateForTests } from '../board/state/nmt3dUiState'
import {
  registerGraphCalcInspector,
  __resetGraphCalcInspectorForTests,
  type GraphCalcInspectorBridge,
} from '../board/state/graphCalcInspectorState'
import type { Nmt3dWorkspace } from '../vendor/nmt3d'
import {
  SLASH_TEMPLATES,
  filterSlashTemplates,
  type SlashTemplateId,
} from '../board/graphCalcSlashTemplates'

const i18n = (locale: 'uk' | 'en') =>
  createI18n({ legacy: false, locale, fallbackLocale: 'uk', messages: { uk, en } as never })

afterEach(() => {
  __resetTrigSolverUiForTests()
  __resetTrigCircleUiForTests()
  __resetNmt3dUiStateForTests()
})

// ─── 1. Панелі: нові написи ────────────────────────────────────────────────

function mountTrigSolver(locale: 'uk' | 'en') {
  registerTrigSolver('ts1', {
    local: { type: 'sin', rel: '<=', a: 0.5, snapSpecial: true, showGraph: true, showAllSolutions: true },
    setType: vi.fn(), setRel: vi.fn(), setA: vi.fn(), toggleOpt: vi.fn(),
  } as never)
  return mount(TrigSolverInspector, { global: { plugins: [i18n(locale)] } })
}

function mountTrigCircle(locale: 'uk' | 'en') {
  registerTrigCircle('tc1', {
    local: {
      showSin: true, showCos: true, showTan: false, showCot: false,
      showSpecialPoints: true, showRefLabels: true, showDeg: false, showRad: true,
      showExactGrid: false, showInscribed: false, showGraphs: false, snapPi12: false, speed: 0.6,
    },
    animating: false, drawMode: false,
    toggle: vi.fn(), jumpTo: vi.fn(), setSpeed: vi.fn(), toggleAnimate: vi.fn(), toggleDraw: vi.fn(),
  } as never)
  return mount(TrigCircleInspector, { global: { plugins: [i18n(locale)] } })
}

const button = (w: ReturnType<typeof mount>, text: string) =>
  w.findAll('button').find((b) => b.text().trim() === text)

describe('тригонометричні рівняння — «табличні» замість «snap»', () => {
  it('uk: «⊙ табличні» з підказкою, без «snap»', () => {
    const w = mountTrigSolver('uk')
    const b = button(w, '⊙ табличні')
    expect(b, 'кнопки «⊙ табличні» немає').toBeTruthy()
    expect(b!.attributes('title')).toBe('Притягувати a до табличних значень (½, √2/2, √3/2…)')
    expect(w.text()).not.toMatch(/snap/i)
    w.unmount()
  })
  it('en: ⊙ snap (природне англійське слово), підказка теж англійською', () => {
    const w = mountTrigSolver('en')
    expect(button(w, '⊙ snap')!.attributes('title')).toBe('Snap a to table values (½, √2/2, √3/2…)')
    w.unmount()
  })
})

describe('тригонометричне коло — «крок π/12» замість «snap π/12»', () => {
  it('uk: «крок π/12» з підказкою, без «snap»', () => {
    const w = mountTrigCircle('uk')
    const b = button(w, 'крок π/12')
    expect(b, 'кнопки «крок π/12» немає').toBeTruthy()
    expect(b!.attributes('title')).toBe('Кут змінюється кроком 15°')
    expect(w.text()).not.toMatch(/snap/i)
    w.unmount()
  })
})

describe('3D-фігури — кнопка вигляду «ізо» замість «iso»', () => {
  it('uk: «ізо» з повною назвою в підказці', () => {
    const ws = {
      template: { key: 't', name: 'Тіло', params: {}, aux: [] },
      params: {}, opts: {}, setOpt: vi.fn(), setView: vi.fn(),
    }
    registerNmt3dWorkspace('n1', ws as unknown as Nmt3dWorkspace, vi.fn())
    const w = mount(Nmt3dInspector, { global: { plugins: [i18n('uk')] } })
    const labels = w.findAll('.nmt3d-inspector__view-btn').map((b) => b.text().trim())
    expect(labels).toContain('ізо')
    expect(labels).not.toContain('iso')
    expect(button(w, 'ізо')!.attributes('title')).toBe('Ізометрія')
    w.unmount()
  })
})

describe('графкалькулятор — «Shift + тягни» замість «Shift-drag»', () => {
  function mountGc(dragParamNames: string[]) {
    __resetGraphCalcInspectorForTests()
    registerGraphCalcInspector('gc-labels', {
      paramEntries: [{ name: 'a', value: 1, min: -5, max: 5, step: 0.1 }],
      dragParamNames, paramFocus: null, paramExpanded: {},
      onSliderInput: () => {}, flushParam: () => {}, toggleParamExpand: () => {},
      onRangeMinChange: () => {}, onRangeMaxChange: () => {}, onRangeStepChange: () => {},
      displayExpressions: [{ id: 'e1', src: 'y = a*x', color: '#c05', hidden: false, isParam: false }],
      slashPopup: null, slashFilteredTemplates: [],
      onSrcInput: () => {}, onInputBlur: () => {}, onEnterPress: () => {},
      onArrowNav: () => {}, onToggleHidden: () => {}, onRemoveExpression: () => {},
      onAddExpression: () => {}, onInsertExpressions: () => [], onQuickAdd: () => {},
      applySlashTemplate: () => {}, closeSlashPopup: () => {}, setSlashSelectedIdx: () => {},
      isExpanded: false, toggleExpand: () => {},
    } as GraphCalcInspectorBridge)
    return mount(GraphCalcInspector, { global: { plugins: [i18n('uk')] } })
  }
  const paramsLabel = (w: ReturnType<typeof mount>) =>
    w.findAll('.gc-insp__section-label').find((l) => l.text().startsWith('Параметри'))!

  it('перетягування доступне: ярлик «Shift + тягни» з підказкою', () => {
    const w = mountGc(['a'])
    const hint = w.get('.gc-insp__hint')
    expect(hint.text()).toBe('Shift + тягни')
    expect(hint.attributes('title')).toBe('Shift + перетягування по графіку керує параметром')
    expect(paramsLabel(w).attributes('title')).toBeUndefined()
    w.unmount()
  })
  it('недоступне: ярлика немає, пояснення — у підказці заголовка «Параметри»', () => {
    const w = mountGc([])
    expect(w.find('.gc-insp__hint').exists()).toBe(false)
    expect(paramsLabel(w).attributes('title'))
      .toBe('Перетягування недоступне: жодна крива не залежить рівно від одного параметра')
    expect(w.text()).not.toMatch(/Shift-drag|drag/i)
    w.unmount()
  })
})

// ─── 2. Меню «/»: пошук українською ────────────────────────────────────────

/** Назва й синоніми з того самого uk.json, який бачить учитель. */
const ukText = (id: SlashTemplateId) => {
  const s = (uk as any).winterboard.graphCalc.slash[id]
  return { name: s.name as string, keywords: s.keywords as string }
}
const ids = (q: string) => filterSlashTemplates(q, ukText).map((t) => t.id)

describe('меню «/» графкалькулятора', () => {
  it('знаходить за українською назвою й синонімом', () => {
    expect(ids('парабола')).toEqual(['parabola'])
    expect(ids('квадратична')).toEqual(['parabola'])
    expect(ids('коло')).toEqual(['circle'])
    expect(ids('корінь')).toEqual(['sqrt'])
    expect(ids('пряма')).toEqual(['linear'])
    expect(ids('синус')[0]).toBe('sin')
  })
  it('англійські назви лишились синонімами', () => {
    expect(ids('parabola')).toEqual(['parabola'])
    expect(ids('circle')).toEqual(['circle'])
    expect(ids('sqrt')).toEqual(['sqrt'])
  })
  it('порожній запит — усі шаблони; чужий — жодного', () => {
    expect(ids('')).toHaveLength(SLASH_TEMPLATES.length)
    expect(ids('щосьдивне')).toEqual([])
  })
  it('кожен шаблон має назву й синоніми в uk та en (інакше меню покаже ключ)', () => {
    for (const tpl of SLASH_TEMPLATES) {
      for (const loc of [uk, en] as any[]) {
        const s = loc.winterboard.graphCalc.slash[tpl.id]
        expect(s?.name, `${tpl.id}.name`).toBeTruthy()
        expect(s?.keywords, `${tpl.id}.keywords`).toBeTruthy()
      }
    }
  })
})

// ─── 3. Сторожі ────────────────────────────────────────────────────────────

/** Текстові вузли й статичні title/placeholder/aria-label шаблону (як у GraphCalculatorI18n). */
function visibleLiterals(file: string, allowed: string[]): string[] {
  const src = fs.readFileSync(path.resolve(__dirname, file), 'utf-8')
  const tpl = src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>'))
    .replace(/<!--[\s\S]*?-->/g, '')
  const out: string[] = []
  for (const m of tpl.matchAll(/>([^<>]+)</g)) {
    const text = m[1].replace(/\{\{[\s\S]*?\}\}/g, '').trim()
    if (text) out.push(text)
  }
  for (const m of tpl.matchAll(/\s(title|placeholder|aria-label)="([^"]+)"/g)) out.push(m[2])
  const ok = new Set(allowed)
  return out.filter((s) => /\p{L}{2,}/u.test(s) && !ok.has(s))
}

describe('сторож: картки пакета без видимого тексту поза t()', () => {
  // Дозволено лише мовно-нейтральне: назви функцій і нотацію.
  const FILES: Array<[string, string[]]> = [
    ['../components/board/objects/TrigSolverRenderer.vue', []],
    ['../components/sidebar/TrigSolverInspector.vue', []],
    ['../components/board/objects/TrigCircleRenderer.vue', []],
    ['../components/sidebar/TrigCircleInspector.vue', []],
    ['../components/board/objects/Geometry2DRenderer.vue', []],
    ['../components/sidebar/Nmt3dInspector.vue', []],
    ['../components/board/objects/AudioPlayerObject.vue', []],
    ['../components/board/SolidCardRenderer.vue', []],
  ]
  for (const [file, allowed] of FILES) {
    it(path.basename(file), () => {
      expect(visibleLiterals(file, allowed)).toEqual([])
    })
  }

  it('Nmt3dInspector: підписи кнопок вигляду не захардкоджені словами', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../components/sidebar/Nmt3dInspector.vue'), 'utf-8')
    const literals = [...src.matchAll(/\blabel:\s*'([^']*)'/g)].map((m) => m[1])
    expect(literals.filter((s) => /\p{L}{2,}/u.test(s) && s !== '3D')).toEqual([])
  })
})

describe('сторож: uk-переклади цих карток без технічних слів', () => {
  const TECH = /\b(snap|drag|pitot|cyclic|ratios|zoom|iso)\b/i
  /** Усі рядки під гілкою перекладу (рекурсивно). */
  const strings = (node: unknown, at: string): Array<[string, string]> =>
    typeof node === 'string' ? [[at, node]]
      : node && typeof node === 'object'
        ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => strings(v, `${at}.${k}`))
        : []
  const wb = (uk as any).winterboard
  const BRANCHES = ['trigSolver', 'trigCircle', 'graphCalc', 'geo2dV2', 'solidToolbar', 'audio']
  it.each(BRANCHES)('winterboard.%s', (branch) => {
    expect(strings(wb[branch], branch).filter(([, v]) => TECH.test(v))).toEqual([])
  })
  it.each(['trigSolver', 'trigCircle', 'graphCalc'])('winterboard.widget.%s', (branch) => {
    expect(strings(wb.widget[branch], `widget.${branch}`).filter(([, v]) => TECH.test(v))).toEqual([])
  })
  it('winterboard.nmt3d (кнопки вигляду)', () => {
    expect(wb.nmt3d.viewIsoShort).toBe('ізо')
  })
})
