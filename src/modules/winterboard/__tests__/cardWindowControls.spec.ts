/**
 * TLV2-05B.2 · віконні дії картки: «— Згорнути · ⛶ Розгорнути · × Видалити» у правому верхньому куті.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * У 05B «Згорнути» стояла окремою плашкою ПІД карткою — не там, де її шукають у
 * будь-якому вікні. А ⛶ і × кожна картка малювала сама, у різних місцях шапки.
 * Тепер одна спільна група в правому верхньому куті, а картки свої ⛶/× не малюють.
 *
 * ІНВАРІАНТИ
 *   INV-WIN-1  дії — за можливостями стандарту; учень і невідомий тип — жодної
 *   INV-WIN-2  заблокована картка не отримує видалення; replay — лише розгортання
 *   INV-WIN-3  порядок кнопок: — ⛶ ×
 *   INV-WIN-4  натискання не спливає: не починає drag і не доходить до сцени картки
 *   INV-WIN-5  у режимі спільних дій картки не малюють власних ⛶/×; без нього (V1) — малюють
 *   INV-WIN-6  полотно ставить групу в правий верхній кут; нижньої кнопки немає
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { NO_WINDOW_ACTIONS, cardWindowActions } from '../board/windowActions'
import { provideHostWindowControls } from '../composables/boardWindowControls'
import WBCardWindowControls from '../components/canvas/WBCardWindowControls.vue'
import VisualCapsuleAssetRenderer from '../components/board/objects/VisualCapsuleAssetRenderer.vue'
import type { WBAsset } from '../types/winterboard'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8')
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const TEACHER = { isTutor: true, mode: 'edit' }
const STUDENT = { isTutor: false, mode: 'edit' }

function card(type: string, extra: Record<string, unknown> = {}): WBAsset {
  return {
    id: `${type}-1`, type, src: '', x: 100, y: 100, w: 400, h: 300, rotation: 0, locked: false,
    data: { version: 1, visual_id: 'visual.triangles.congruence.overlay', capsule_version: 1, mode: 'full' },
    ...extra,
  } as unknown as WBAsset
}

// ─── Правило ────────────────────────────────────────────────────────────────

describe('INV-WIN-1/2 · які дії показати', () => {
  it.each([
    ['theory_card', { scale: true, minimize: true, expand: false, delete: true, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }],
    ['nmt_task', { scale: true, minimize: true, expand: true, delete: true, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }],
    ['geomash_scene', { scale: false, minimize: true, expand: true, delete: true, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }],
    ['visual_capsule', { scale: false, minimize: true, expand: true, delete: true, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }],
    ['image', { scale: false, minimize: true, expand: false, delete: true, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }],
    // Медіа згортаються з 2026-09-28 (рішення власника, ТЗ «Сценарій» §4.1) — свідома зміна
    ['video_player', { scale: false, minimize: true, expand: false, delete: true, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }],
    ['youtube_player', { scale: false, minimize: true, expand: false, delete: true, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }],
    ['audio_player', { scale: false, minimize: true, expand: false, delete: true, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }],
  ])('вчитель · %s', (type, expected) => {
    expect(cardWindowActions(card(type), TEACHER)).toEqual(expected)
  })

  it('учень, невідомий тип і порожній вибір — жодної дії', () => {
    expect(cardWindowActions(card('visual_capsule'), STUDENT)).toEqual(NO_WINDOW_ACTIONS)
    expect(cardWindowActions(card('wat'), TEACHER)).toEqual(NO_WINDOW_ACTIONS)
    expect(cardWindowActions(null, TEACHER)).toEqual(NO_WINDOW_ACTIONS)
  })

  it('заблокована картка: без видалення; розгорнути можна (це лише подання)', () => {
    const actions = cardWindowActions(card('visual_capsule', { locked: true }), TEACHER)
    expect(actions.delete).toBe(false)
    expect(actions.expand).toBe(true)
  })

  it('replay: лише розгортання', () => {
    expect(cardWindowActions(card('nmt_task'), { isTutor: true, mode: 'replay' }))
      .toEqual({ scale: false, minimize: false, expand: true, delete: false, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false })
  })
})

// ─── Компонент ──────────────────────────────────────────────────────────────

describe('WBCardWindowControls', () => {
  const ALL = { scale: false, minimize: true, expand: true, delete: true, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }

  function mountControls(actions = ALL, isExpanded = false) {
    return mount(WBCardWindowControls, { props: { actions, isExpanded }, global: { plugins: [i18n()] } })
  }

  it('INV-WIN-3 · порядок: — ⛶ ×', () => {
    const w = mountControls()
    expect(w.findAll('button').map(b => b.attributes('data-testid'))).toEqual([
      'wb-card-window-minimize', 'wb-card-window-expand', 'wb-card-window-delete',
    ])
    expect(w.findAll('button').map(b => b.text())).toEqual(['—', '⛶', '×'])
  })

  it('показує лише дозволені дії; розгорнута картка — кнопка згортання ⊠', () => {
    const w = mountControls({ scale: false, minimize: false, expand: true, delete: false, handwrite: false, handwriteSolves: false, fitHeight: false, taskHelp: false }, true)
    expect(w.findAll('button').map(b => b.text())).toEqual(['⊠'])
  })

  it("✍: позначка Інтегралика лише коли розв'язує він; поки працює — думає, значок не пульсує (власник 18.10)", () => {
    const hw = { ...ALL, handwrite: true }
    const ready = mount(WBCardWindowControls, { props: { actions: hw, isExpanded: false }, global: { plugins: [i18n()] } })
    expect(ready.find('[data-testid="integralyk-thinking"]').exists()).toBe(false)
    const solves = { ...hw, handwriteSolves: true }
    const idle = mount(WBCardWindowControls, { props: { actions: solves, isExpanded: false }, global: { plugins: [i18n()] } })
    expect(idle.get('[data-testid="wb-card-window-handwrite"] [data-testid="integralyk-thinking"]').classes())
      .not.toContain('itg-thinking--on')
    const busy = mount(WBCardWindowControls, {
      props: { actions: solves, isExpanded: false, handwriteBusy: true }, global: { plugins: [i18n()] },
    })
    const btn = busy.get('[data-testid="wb-card-window-handwrite"]')
    expect(btn.get('[data-testid="integralyk-thinking"]').classes()).toContain('itg-thinking--on')
    expect(btn.classes()).not.toContain('wb-card-window-controls__btn--busy')
    // Готовий розв'язок банку — як і було: пульсує сам значок.
    const busyReady = mount(WBCardWindowControls, {
      props: { actions: hw, isExpanded: false, handwriteBusy: true }, global: { plugins: [i18n()] },
    })
    expect(busyReady.get('[data-testid="wb-card-window-handwrite"]').classes()).toContain('wb-card-window-controls__btn--busy')
  })

  it('LAW §9 v1.35 · ✍ 💡 ⚠ — окремою плашкою під рядком вікна, не поруч із «×» (прохід «очима вчителя», 19.10)', () => {
    const task = { ...ALL, scale: true, handwrite: true, taskHelp: true }
    const w = mount(WBCardWindowControls, { props: { actions: task, isExpanded: false }, global: { plugins: [i18n()] } })
    const row = w.get('.wb-card-window-controls__row')
    const group = w.get('[data-testid="wb-card-window-task"]')
    expect(row.findAll('button').map(b => b.text())).toEqual(['A−', '100%', 'A+', '—', '⛶', '×'])
    expect(group.findAll('button').map(b => b.text())).toEqual(['✍', '💡', '⚠'])
    // Плашка задачі йде ПІСЛЯ рядка вікна (стовпчиком — нижче), а не всередині нього
    expect(row.element.nextElementSibling).toBe(group.element)
    // Без ✍ 💡 ⚠ плашки немає зовсім
    expect(mountControls().find('[data-testid="wb-card-window-task"]').exists()).toBe(false)
  })

  it('LAW §9 v1.35 · розміри: шапка 24 px, ✍ 💡 ⚠ 32 px; на дотику 32 і 44 px', () => {
    const css = read('modules/winterboard/components/canvas/WBCardWindowControls.vue').split('<style scoped>')[1]
    const rule = (selector: string, from = css) => {
      const at = from.indexOf(`${selector} {`)
      expect(at, selector).toBeGreaterThanOrEqual(0)
      return from.slice(at, from.indexOf('}', at))
    }
    // LAW §9 v1.44 (власник 2026-10-21, «одна панелька»): один рядок, ✍ 💡 ⚠ зліва — не плашкою під рядком вікна
    expect(css).toMatch(/\.wb-card-window-controls\s*\{[^}]*flex-direction: row-reverse/)
    expect(rule('.wb-card-window-controls--header .wb-card-window-controls__row .wb-card-window-controls__btn')).toMatch(/width: 24px;[\s\S]*height: 24px;/)
    expect(rule('.wb-card-window-controls__task .wb-card-window-controls__btn')).toMatch(/width: 32px;[\s\S]*height: 32px;/)
    const touch = css.slice(css.indexOf('@media (any-pointer: coarse) {'))
    expect(touch.length).toBeGreaterThan(30)
    expect(rule('.wb-card-window-controls__task .wb-card-window-controls__btn', touch)).toMatch(/width: 44px;[\s\S]*height: 44px;/)
    expect(rule('.wb-card-window-controls--header .wb-card-window-controls__row .wb-card-window-controls__btn', touch)).toMatch(/width: 32px;[\s\S]*height: 32px;/)
  })

  it('кнопки емітять свої дії', async () => {
    const w = mountControls()
    await w.get('[data-testid="wb-card-window-minimize"]').trigger('click')
    await w.get('[data-testid="wb-card-window-expand"]').trigger('click')
    await w.get('[data-testid="wb-card-window-delete"]').trigger('click')
    expect([w.emitted('minimize'), w.emitted('expand'), w.emitted('delete')].map(e => e?.length)).toEqual([1, 1, 1])
  })

  it('INV-WIN-4 · натискання не спливає до полотна чи сцени картки', async () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const w = mount(WBCardWindowControls, {
      props: { actions: ALL, isExpanded: false },
      global: { plugins: [i18n()] },
      attachTo: parent,
    })
    let bubbled = 0
    for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick']) {
      parent.addEventListener(type, () => { bubbled += 1 })
    }
    for (const id of ['minimize', 'expand', 'delete']) {
      const btn = w.get(`[data-testid="wb-card-window-${id}"]`)
      await btn.trigger('pointerdown')
      await btn.trigger('mousedown')
      await btn.trigger('click')
      await btn.trigger('dblclick')
    }
    expect(bubbled).toBe(0)
    w.unmount()
    parent.remove()
  })
})

// ─── Картки ─────────────────────────────────────────────────────────────────

describe('INV-WIN-5 · картки не дублюють ⛶ / ×', () => {
  const capsule = card('visual_capsule')

  function mountCapsule(hostControls: boolean | null) {
    const inner = () => h(VisualCapsuleAssetRenderer, { asset: capsule, isSelected: true, interactive: true })
    const Host = defineComponent({
      setup() {
        if (hostControls !== null) provideHostWindowControls(() => hostControls)
        return inner
      },
    })
    return mount(Host, { global: { plugins: [i18n()], stubs: { Geometry2DRenderer: true } } })
  }

  it('режим спільних дій: капсула не малює власних ⛶ і ×', () => {
    const w = mountCapsule(true)
    expect(w.find('.vcap-card__expand').exists()).toBe(false)
    expect(w.find('.vcap-card__delete').exists()).toBe(false)
    w.unmount()
  })

  it('V1 (без провайдера або вимкнено): капсула малює свої, як раніше', () => {
    for (const mode of [null, false]) {
      const w = mountCapsule(mode)
      expect(w.find('.vcap-card__expand').exists()).toBe(true)
      expect(w.find('.vcap-card__delete').exists()).toBe(true)
      w.unmount()
    }
  })

  const RENDERERS: Record<string, string[]> = {
    'SolidCardRenderer.vue': ['solid-delete'],
    'objects/CalculusRenderer.vue': ['calculus-delete'],
    'objects/FormulaCardRenderer.vue': ['formula-card-renderer__btn formula-card-renderer__btn--delete'],
    'objects/GeomashRenderer.vue': ['gm-expand', 'gm-delete'],
    'objects/Geometry2DRenderer.vue': ['geo2dv2-delete'],
    'objects/GraphCalculatorRenderer.vue': ['gc-expand-btn', 'gc-delete'],
    'objects/Graphmash3dRenderer.vue': ['gm3d-expand-btn', 'gm3d-delete'],
    'objects/HelixRenderer.vue': ['helix-expand', 'helix-delete'],
    'objects/MashSceneRenderer.vue': ['msc-delete'],
    'objects/Nmt3dRenderer.vue': ['nmt3d-expand-btn', 'nmt3d-delete'],
    'objects/NmtTaskRenderer.vue': ['nmt-task__delete-btn'],
    'objects/QuadraticRenderer.vue': ['quad-delete'],
    'objects/TheoryCardRenderer.vue': ['theory-card__delete-btn'],
    'objects/TrigCircleRenderer.vue': ['trig-circle-expand', 'trig-circle-delete'],
    'objects/TrigSolverRenderer.vue': ['trig-slv-delete'],
    'objects/VisualCapsuleAssetRenderer.vue': ['vcap-card__btn vcap-card__expand', 'vcap-card__btn vcap-card__delete'],
  }

  it.each(Object.entries(RENDERERS))('%s: власні ⛶/× — лише поза режимом спільних дій', (file, classes) => {
    const src = read(`modules/winterboard/components/board/${file}`).replace(/\r\n/g, '\n')
    expect(src).toContain('const hostWindowControls = useHostWindowControls()')
    for (const cls of classes) {
      const at = src.indexOf(`class="${cls}"`)
      const tag = src.slice(src.lastIndexOf('<button', at), at)
      expect(tag, `${file} · ${cls}`).toMatch(/v-if="!hostWindowControls( && \(|")/)
    }
  })

  it('усі 16 overlay-рендерерів із реєстру перевірено', () => {
    expect(Object.keys(RENDERERS)).toHaveLength(16)
  })
})

// ─── Полотно ────────────────────────────────────────────────────────────────

describe('INV-WIN-6 · полотно: одна група, правий верхній кут', () => {
  const canvas = read('modules/winterboard/components/canvas/WBCanvas.vue').replace(/\r\n/g, '\n')

  it('нижньої кнопки «Згорнути» більше немає', () => {
    expect(canvas).not.toContain('wb-card-minimize')
    expect(canvas).not.toContain('minimizeButtonStyle')
  })

  it('група прив’язана до правого верхнього кута картки — через windowControlsPlacement', () => {
    // FIRST USER GATE 2026-09-23: той самий кут, але зовні (кнопки лягали на графік).
    const block = canvas.slice(canvas.indexOf('const windowControlsStyle'), canvas.indexOf('function handleWindowExpand'))
    expect(block).toContain('windowControlsPlacement(')
    expect(block).not.toContain('frame.height')
  })

  it('дії — спільним правилом; запис — штатними шляхами', () => {
    expect(canvas).toMatch(/<Teleport\s+v-if="windowControlsTarget"[^>]+:disabled="!windowControlsDocked && !windowControlsOverlayHost"/)
    expect(canvas).toContain('<WBCardWindowControls')
    expect(canvas).toContain('@minimize="handleMinimize(windowControlsTarget)"')
    expect(canvas).toMatch(/function handleWindowDelete\(assetId: string\): void \{[\s\S]*?emit\('asset-delete', assetId\)/)
  })

  it('TLV2-RC1: група віконних дій — звичайна поведінка полотна, без build-прапорця', () => {
    expect(canvas).toContain('provideHostWindowControls(() => true)')
    expect(canvas).not.toContain('boardTrayEnabled')
  })
})

describe('✍ на картці «Підказка» й теоретичних — немає (власник 19.10)', () => {
  const SOLVER = { isTutor: true, mode: 'edit', canSolve: true }
  const theory = (preset?: string) => ({
    id: 'tc-1', type: 'theory_card', src: '', x: 0, y: 0, w: 400, h: 300, rotation: 0, locked: false,
    data: { version: 1, title: 'Коми підряд', body: 'Запиши коми одну під одною.', ...(preset ? { preset } : {}) },
  }) as unknown as WBAsset

  it('«Підказка», «Типова помилка», правило — ні ✍, ні 💡/⚠; картка без позначки й «Приклад» — ✍ є', () => {
    for (const p of ['tip', 'common mistake', 'rule']) {
      const a = cardWindowActions(theory(p), SOLVER)
      expect([a.handwrite, a.handwriteSolves, a.taskHelp], p).toEqual([false, false, false])
    }
    for (const p of [undefined, 'example']) {
      const a = cardWindowActions(theory(p), SOLVER)
      expect([a.handwrite, a.handwriteSolves], String(p)).toEqual([true, true])
    }
  })

  it('кнопки ✍ на картці «Підказка» справді немає, а на картці без позначки — є', () => {
    const at = (asset: WBAsset) => mount(WBCardWindowControls, {
      props: { actions: cardWindowActions(asset, SOLVER), isExpanded: false }, global: { plugins: [i18n()] },
    })
    expect(at(theory('tip')).find('[data-testid="wb-card-window-handwrite"]').exists()).toBe(false)
    expect(at(theory()).find('[data-testid="wb-card-window-handwrite"]').exists()).toBe(true)
  })
})

// LAW §9 v1.44 — одна панель (власник 2026-10-21: «Чому не можна зробити в одну панельку? У нас на карті є одна
// панель, яка вскривається. Одна панель, яка згортає і хрестик. І ще третя у нас получилась панель» → «Роби»).
describe('одна панель кнопок картки', () => {
  const canvas = read('modules/winterboard/components/canvas/WBCanvas.vue').replace(/\r\n/g, '\n')
  const mountControls = (actions: Record<string, boolean>) => mount(WBCardWindowControls, {
    props: { actions: { ...NO_WINDOW_ACTIONS, minimize: true, expand: true, delete: true, ...actions } as never, isExpanded: false },
    global: { plugins: [i18n()] },
  })

  it('✍ 💡 ⚠ у тому ж рядку, що й вікно, і в розмітці після нього (row-reverse ставить їх зліва, «×» — справа)', () => {
    const w = mountControls({ handwrite: true, taskHelp: true })
    const root = w.get('[data-testid="wb-card-window-controls"]')
    expect(root.classes()).toContain('wb-card-window-controls--with-task')
    const kids = [...root.element.children].map((el) => (el as HTMLElement).className)
    expect(kids[0]).toContain('wb-card-window-controls__row')
    expect(kids[1]).toContain('wb-card-window-controls__task')
  })

  it('полотно: є панель виділення — група стає в неї, без «×» (там є 🗑) і без резерву в шапці картки', () => {
    expect(canvas).toContain(":to=\"windowControlsDocked ? cardControlsDock?.el : (windowControlsOverlayHost ?? 'body')\"")
    expect(canvas).toContain("'wb-card-window-controls--docked': windowControlsDocked,")
    expect(canvas).toContain(':actions="windowControlsDocked ? { ...windowControlsActions, delete: false } : windowControlsActions"')
    expect(canvas).toMatch(/if \(windowControlsDocked\.value\) return \{ assetId: null, width: 0 \}/)
  })

  it('панель виділення дає місце лише для одного виділеного об’єкта', () => {
    const toolbar = read('modules/winterboard/components/canvas/WBSelectionToolbar.vue')
    expect(toolbar).toMatch(/v-if="selectedIds\.length === 1"\s+ref="cardDockRef"/)
    expect(toolbar).toContain('setCardControlsDock({ el, assetId: id })')
  })
})

describe('cardControlsDock', () => {
  it('група в панелі — лише для тієї самої картки, не розгорнутої, і поки місце в документі', async () => {
    const { isDockedFor, setCardControlsDock, useCardControlsDock } = await import('../composables/cardControlsDock')
    const el = document.createElement('span')
    document.body.appendChild(el)
    setCardControlsDock({ el, assetId: 'a' })
    const dock = useCardControlsDock()
    expect(isDockedFor(dock.value, 'a', false)).toBe(true)
    expect(isDockedFor(dock.value, 'b', false)).toBe(false)
    expect(isDockedFor(dock.value, 'a', true)).toBe(false)
    const other = document.createElement('span')
    setCardControlsDock(null, other)                    // чуже місце не забирає
    expect(dock.value?.el).toBe(el)
    el.remove()
    expect(isDockedFor(dock.value, 'a', false)).toBe(false)
    setCardControlsDock(null, el)
    expect(dock.value).toBeNull()
  })
})
