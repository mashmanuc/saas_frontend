/**
 * TLV2-06R · вставка рецепта через чинні шляхи (ТЗ 43 §7, §9.5–9.8).
 *
 *   • `addAtPosition(BOARD_RECIPE_MIME)` → один builder → рівно один `onAssetAdd` чинного типу;
 *   • справжній стор: один `asset_add`; replay цього op відтворює той самий об'єкт;
 *   • gap / невідомий / битий payload — видима причина, жодної картки;
 *   • Інтегралик: `add_tool(tpl.*)` резолвить той самий рецепт і йде тим самим
 *     `m4sh:wb-insert` → `addAtPosition`; для gap — людська помилка без події;
 *   • змонтовані ЧИННІ рендерери: паралелограм тягнеться (A, B, D), капсула — V-D3.1.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'

vi.mock('@/modules/learning-content', () => ({
  learningContentApi: { getBySlug: vi.fn() },
  renderContentToSvgDataUrl: vi.fn(),
}))
vi.mock('@/utils/notify', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, notifyError: vi.fn() }
})
vi.mock('../board/preparedBoardRecipes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../board/preparedBoardRecipes')>()
  return { ...actual, buildBoardRecipeAsset: vi.fn(actual.buildBoardRecipeAsset) }
})

import { notifyError } from '@/utils/notify'
import { useContentDrop } from '../composables/useContentDrop'
import {
  BOARD_RECIPE_MIME,
  buildBoardRecipeAsset,
  PREPARED_BOARD_RECIPES,
} from '../board/preparedBoardRecipes'
import { useWBStore } from '../board/state/boardStore'
import { cancelPendingUpdates } from '../board/state/assetUpdateBatcher'
import { applyReplayOperation, type ReplayStoreApi } from '../engine/applyReplayOperation'
import Geometry2DRenderer from '../components/board/objects/Geometry2DRenderer.vue'
import VisualCapsuleAssetRenderer from '../components/board/objects/VisualCapsuleAssetRenderer.vue'
import type { BoardOperation, RecordOperationRequest } from '../types/replay'
import type { WBAsset } from '../types/winterboard'

const builder = vi.mocked(buildBoardRecipeAsset)
const SUPPORTED = PREPARED_BOARD_RECIPES.filter((r) => r.status === 'supported')
const GAPS = PREPARED_BOARD_RECIPES.filter((r) => r.status === 'gap')
const payload = (recipeId: unknown) => JSON.stringify({ recipeId })
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

function makeDrop() {
  const onAssetAdd = vi.fn()
  const drop = useContentDrop({
    sessionId: ref('s-1'),
    canDraw: ref(true),
    onAssetAdd,
    screenToCanvas: (x, y) => ({ x, y }),
  })
  return { ...drop, onAssetAdd }
}

beforeAll(async () => {
  await import('../vendor/geo2d')
})

beforeEach(() => {
  builder.mockClear()
  vi.mocked(notifyError).mockClear()
})

describe('TLV2-06R · addAtPosition рецепта', () => {
  it.each(SUPPORTED.map((r) => [r.id, r.targetType]))('%s → один асет %s через builder рецепта', (id, type) => {
    const drop = makeDrop()
    drop.addAtPosition(BOARD_RECIPE_MIME, payload(id), { x: 700, y: 500 })
    expect(builder).toHaveBeenCalledTimes(1)
    expect(builder).toHaveBeenCalledWith(id, { x: 700, y: 500 })
    expect(drop.onAssetAdd).toHaveBeenCalledTimes(1)
    const asset = drop.onAssetAdd.mock.calls[0][0] as WBAsset
    expect(asset.type).toBe(type)
    expect(asset.x + asset.w / 2).toBe(700)
    expect(notifyError).not.toHaveBeenCalled()
  })

  it.each([
    ...GAPS.map((r) => [r.id, 'gap', r.id] as const),
    ['tpl.unknown', 'unknown_recipe', 'tpl.unknown'] as const,
  ])('%s: жодної картки, видима причина (%s)', (id, code, shownId) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const drop = makeDrop()
    drop.addAtPosition(BOARD_RECIPE_MIME, payload(id), { x: 1, y: 1 })
    expect(drop.onAssetAdd).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledTimes(1)
    const message = String(vi.mocked(notifyError).mock.calls[0][0])
    expect(message).toContain(shownId)
    if (code === 'gap') expect(message).toContain('фіксовані')
    errors.mockRestore()
  })

  it('битий payload — теж контрольована відмова, не виняток і не картка', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const drop = makeDrop()
    expect(() => drop.addAtPosition(BOARD_RECIPE_MIME, '{not json', { x: 1, y: 1 })).not.toThrow()
    expect(drop.onAssetAdd).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledTimes(1)
    errors.mockRestore()
  })
})

describe('TLV2-06R · штатний ops-шлях: asset_add → replay', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    cancelPendingUpdates()
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>))
  })
  afterEach(() => {
    cancelPendingUpdates()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it.each(SUPPORTED.map((r) => r.id))('%s: одна вставка = один asset_add; replay op відтворює той самий асет', (id) => {
    const store = useWBStore()
    store.pages = [{ id: 'page-1', name: '1', strokes: [], assets: [] }]
    store.currentPageIndex = 0
    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))
    const drop = useContentDrop({
      sessionId: ref('s-1'),
      canDraw: ref(true),
      onAssetAdd: (asset: WBAsset) => store.addAsset(asset, 'page-1'),
      screenToCanvas: (x, y) => ({ x, y }),
    })
    drop.addAtPosition(BOARD_RECIPE_MIME, payload(id), { x: 500, y: 400 })
    vi.advanceTimersByTime(20)
    unsub()
    expect(ops.map((o) => o.op_type)).toEqual(['asset_add'])
    const added = JSON.parse(JSON.stringify(store.pages[0].assets[0]))

    setActivePinia(createPinia())
    const replayStore = useWBStore()
    replayStore.pages = [{ id: 'page-1', name: '1', strokes: [], assets: [] }]
    replayStore.currentPageIndex = 0
    applyReplayOperation(replayStore as unknown as ReplayStoreApi, { ...ops[0], seq: 1 } as unknown as BoardOperation)
    const replayed = JSON.parse(JSON.stringify(replayStore.pages[0].assets[0]))
    if (added.type === 'graph_calculator') {
      // meta — BE-managed: replay штатно проставляє seq op-а, решта даних та сама
      expect(replayed.data.meta).toEqual({ last_snapshot_seq: 1 })
      delete replayed.data.meta
      delete added.data.meta
    }
    expect(replayed).toEqual(added)
  })
})

describe('TLV2-06R · Інтегралик — той самий рецепт, без власного списку й writer-а', () => {
  async function addTool(insertId: string) {
    const { runBoardAction } = await import('@/modules/intent/boardActions')
    const seen: Array<{ mime: string; payload: string }> = []
    const listener = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener('m4sh:wb-insert', listener)
    let error: unknown = null
    try {
      await runBoardAction({ kind: 'add_tool', payload: { insert_id: insertId } })
    } catch (err) {
      error = err
    } finally {
      window.removeEventListener('m4sh:wb-insert', listener)
    }
    return { seen, error }
  }

  it.each(SUPPORTED.map((r) => [r.id, r.targetType]))('add_tool(%s) → m4sh:wb-insert рецепта → addAtPosition → один %s', async (id, type) => {
    const { seen, error } = await addTool(id)
    expect(error).toBeNull()
    expect(seen).toEqual([{ mime: BOARD_RECIPE_MIME, payload: payload(id) }])
    const drop = makeDrop()
    drop.addAtPosition(seen[0].mime, seen[0].payload, { x: 10, y: 10 })
    expect(drop.onAssetAdd).toHaveBeenCalledTimes(1)
    expect((drop.onAssetAdd.mock.calls[0][0] as WBAsset).type).toBe(type)
  })

  it.each(GAPS.map((r) => r.id))('add_tool(%s) gap → людська причина, жодної події', async (id) => {
    const { seen, error } = await addTool(id)
    expect(seen).toEqual([])
    expect(String((error as Error).message)).toContain('поки не підтримується')
  })

  it('невідомий id — як і раніше fail-closed; чинні інструменти не змінились', async () => {
    const unknown = await addTool('tpl.nope')
    expect(unknown.seen).toEqual([])
    expect(String((unknown.error as Error).message)).toContain('Такого інструмента')
    const tool = await addTool('planimetry.parallelogram')
    expect(tool.error).toBeNull()
    expect(tool.seen).toEqual([{ mime: 'application/x-geo2d', payload: JSON.stringify({ preset: 'parallelogram' }) }])
  })

  it('parse-каталог Інтегралика = видимі інструменти + рівно 4 supported рецепти; gap і Tools — без змін', async () => {
    const { buildToolCatalog } = await import('@/modules/intent/boardActions')
    const { allInserts } = await import('../components/sidebar/insertRegistry')
    const catalog = (await buildToolCatalog()) as Array<{ id: string; label: string; desc: string }>
    const recipeIds = catalog.filter((e) => e.id.startsWith('tpl.')).map((e) => e.id)
    expect(recipeIds).toEqual(SUPPORTED.map((r) => r.id))
    for (const gap of GAPS) expect(catalog.some((e) => e.id === gap.id)).toBe(false)
    // перша частина — рівно видимі інструменти (sidebar читає лише insertRegistry)
    const visible = allInserts().map((e) => e.id)
    expect(visible.filter((id) => id.startsWith('tpl.'))).toEqual([])
    expect(catalog.slice(0, visible.length).map((e) => e.id)).toEqual(visible)
    // межі BE `_tools_catalog_text`: ≤ 80 записів, label ≤ 60, desc ≤ 100 — рецепт не обрізається
    expect(catalog.length).toBeLessThanOrEqual(80)
    for (const e of catalog.filter((x) => x.id.startsWith('tpl.'))) {
      expect(e.label.length, e.id).toBeLessThanOrEqual(60)
      expect(e.desc.length, e.id).toBeLessThanOrEqual(100)
      expect(e.desc.startsWith('[готовий матеріал · '), e.id).toBe(true)
    }
  })

  /**
   * Parse-smoke з mock моделі. Контракт BE (`apps/intent/ai/parser.py`): модель бачить рядки
   * `- id: label — desc` (MAX_TOOLS = 80, label ≤ 60, desc ≤ 100) і повертає `add_tool.insert_id`,
   * який BE ВАЛІДУЄ проти надісланого каталогу. Mock обирає рядок із найбільшим перетином слів —
   * без жодного знання про конкретні id: доводить, що опис каталогу розрізняє рецепти.
   */
  async function mockParse(phrase: string) {
    const { buildToolCatalog } = await import('@/modules/intent/boardActions')
    const catalog = (await buildToolCatalog()) as Array<{ id: string; label: string; desc: string }>
    const words = (s: string) => new Set(s.toLowerCase().replace(/[−–]/g, '-').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 || /\d/.test(w)))
    const asked = words(phrase)
    const lines = catalog.slice(0, 80).map((t) => ({ id: t.id.slice(0, 60), text: `${t.label.slice(0, 60)} ${t.desc.slice(0, 100)}` }))
    let best = { id: '', score: 0 }
    for (const line of lines) {
      const score = [...words(line.text)].filter((w) => asked.has(w)).length
      if (score > best.score) best = { id: line.id, score }
    }
    // BE `_r_add_tool`: insert_id має бути в надісланому каталозі (fail-closed)
    expect(catalog.some((t) => t.id === best.id)).toBe(true)
    return { status: 'board_action', action: { kind: 'add_tool', payload: { insert_id: best.id } } }
  }

  it.each([
    ['покажи анімацію накладання рівних трикутників ABC і EDF', 'tpl.g7-l16-abc-edf', 'visual_capsule'],
    ['побудуй рівняння кола (x − 3)² + (y + 2)² = 16', 'tpl.g9-l27-c3-m2-r4', 'graph_calculator'],
    ['рівняння кола з центром (−2; 5) і R = 3', 'tpl.g9-l27-cm2-5-r3', 'graph_calculator'],
    ['паралелограм ABCD: сторони сталі, кут змінюється', 'tpl.g8-l04-abcd', 'geometry_2d_v2'],
  ])('фраза «%s» → parse обирає %s → add_tool → m4sh:wb-insert → один %s', async (phrase, expectedId, type) => {
    const parsed = await mockParse(phrase)
    expect(parsed.action.payload.insert_id).toBe(expectedId)
    const { seen, error } = await addTool(parsed.action.payload.insert_id)
    expect(error).toBeNull()
    const drop = makeDrop()
    drop.addAtPosition(seen[0].mime, seen[0].payload, { x: 10, y: 10 })
    expect(drop.onAssetAdd).toHaveBeenCalledTimes(1)
    expect((drop.onAssetAdd.mock.calls[0][0] as WBAsset).type).toBe(type)
  })
})

describe('TLV2-06R · змонтовані чинні рендерери цільових типів', () => {
  it('паралелограм рецепта: GeoCard preset parallelogram, A/B/D тягнуться, точки з рецепта', async () => {
    const asset = buildBoardRecipeAsset('tpl.g8-l04-abcd', { x: 0, y: 0 })
    const w = mount(Geometry2DRenderer, {
      props: { asset: asset as never, isSelected: true, interactive: true },
      global: { plugins: [i18n()] },
      attachTo: document.body,
    })
    await flushPromises()
    await flushPromises()
    expect(w.attributes('data-preset')).toBe('parallelogram')
    const free = w.findAll('circle.geo-free').map((c) => c.attributes('data-pt-id') ?? (c.element as SVGElement).dataset.ptId).sort()
    expect(free).toEqual(['A', 'B', 'D'])
    const svg = w.find('[data-testid="geometry-2d-v2-board"] svg').element as SVGElement
    expect(svg.style.pointerEvents).not.toBe('none')
    // тулбар рушія на місці; toggle «Кути» увімкнено з рецепта
    const angles = w.find('[data-testid="geometry-2d-v2-toolbar"] button.tool[data-key="angles"]')
    expect(angles.exists()).toBe(true)
    expect(w.emitted('update:asset')).toBeUndefined()
    w.unmount()
  })

  it('капсула рецепта: V-D3.1 без помилки невідомої капсули', async () => {
    const asset = buildBoardRecipeAsset('tpl.g7-l16-abc-edf', { x: 0, y: 0 })
    const w = mount(VisualCapsuleAssetRenderer, {
      props: { asset: asset as never, isSelected: true, interactive: true, isTutor: true },
      global: { plugins: [i18n()], stubs: { Geometry2DRenderer: true } },
    })
    await flushPromises()
    expect(w.find('[data-testid="visual-capsule"]').exists()).toBe(true)
    expect(w.find('[data-testid="visual-capsule-error"]').exists()).toBe(false)
    w.unmount()
  })
})
