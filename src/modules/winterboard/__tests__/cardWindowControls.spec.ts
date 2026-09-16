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
    ['theory_card', { scale: true, minimize: true, expand: false, delete: true }],
    ['nmt_task', { scale: true, minimize: true, expand: true, delete: true }],
    ['geomash_scene', { scale: false, minimize: true, expand: true, delete: true }],
    ['visual_capsule', { scale: false, minimize: true, expand: true, delete: true }],
    ['image', { scale: false, minimize: true, expand: false, delete: true }],
    ['video_player', { scale: false, minimize: false, expand: false, delete: true }],
  ])('вчитель · %s', (type, expected) => {
    expect(cardWindowActions(card(type), TEACHER, true)).toEqual(expected)
  })

  it('учень, невідомий тип і порожній вибір — жодної дії', () => {
    expect(cardWindowActions(card('visual_capsule'), STUDENT, true)).toEqual(NO_WINDOW_ACTIONS)
    expect(cardWindowActions(card('wat'), TEACHER, true)).toEqual(NO_WINDOW_ACTIONS)
    expect(cardWindowActions(null, TEACHER, true)).toEqual(NO_WINDOW_ACTIONS)
  })

  it('заблокована картка: без видалення; розгорнути можна (це лише подання)', () => {
    const actions = cardWindowActions(card('visual_capsule', { locked: true }), TEACHER, true)
    expect(actions.delete).toBe(false)
    expect(actions.expand).toBe(true)
  })

  it('replay: лише розгортання; без прапорця трею — без згортання', () => {
    expect(cardWindowActions(card('nmt_task'), { isTutor: true, mode: 'replay' }, true))
      .toEqual({ scale: false, minimize: false, expand: true, delete: false })
    expect(cardWindowActions(card('nmt_task'), TEACHER, false).minimize).toBe(false)
  })
})

// ─── Компонент ──────────────────────────────────────────────────────────────

describe('WBCardWindowControls', () => {
  const ALL = { scale: false, minimize: true, expand: true, delete: true }

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
    const w = mountControls({ scale: false, minimize: false, expand: true, delete: false }, true)
    expect(w.findAll('button').map(b => b.text())).toEqual(['⊠'])
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

  it('група стоїть у правому верхньому куті картки', () => {
    const block = canvas.slice(canvas.indexOf('const windowControlsStyle'), canvas.indexOf('function handleWindowExpand'))
    expect(block).toContain('const right = parseFloat(frame.left) + parseFloat(frame.width) - WINDOW_CONTROLS_INSET_PX')
    expect(block).toContain('const top = parseFloat(frame.top) + WINDOW_CONTROLS_INSET_PX')
    expect(block).not.toContain('frame.height')
  })

  it('дії — спільним правилом; запис — штатними шляхами', () => {
    expect(canvas).toMatch(/<WBCardWindowControls\s+v-if="windowControlsTarget"/)
    expect(canvas).toContain('@minimize="handleMinimize(windowControlsTarget)"')
    expect(canvas).toMatch(/function handleWindowDelete\(assetId: string\): void \{[\s\S]*?emit\('asset-delete', assetId\)/)
  })

  it('V1: без прапорця ні групи, ні приховування власних кнопок карток', () => {
    expect(canvas).toContain('provideHostWindowControls(() => boardTrayEnabled)')
    expect(canvas).toMatch(/const windowControlsTarget = computed<WBAsset \| null>\(\(\) => \{\n\s+if \(!boardTrayEnabled\) return null/)
  })
})
