/**
 * Старі дошки з тілами Phase O — те, що ЛИШИЛОСЬ після зняття трея.
 *
 * Спадкоємець `SolidsTrayAndDrop.spec.ts`. Трей `SolidsTray.vue` і гілка
 * створення тіла через `application/x-solid` видалені: живих монтувань трея
 * було нуль, цей MIME ніхто більше не ставив, у реєстрі вставки
 * (`insertRegistry.ts`) його немає — отже НОВЕ тіло створити було нічим.
 *
 * ⚠️ Але **малювати** старі тіла треба й далі: на дошках, зроблених до
 * заміни на `Nmt3dTray`, лежать асети `geometry_solid`, і BE досі приймає
 * їхні `asset_update` (`winterboard/api/serializers.py:366`). Тому
 * `SolidCardRenderer`, `overlayRegistry` і `solidDefaults.ts` лишаються —
 * і саме це стережуть тести нижче.
 *
 * Дві групи перенесено дослівно з попереднього файла:
 *   • DEFAULT_SOLID_STATE — єдине джерело правди (рендерер читає його);
 *   • кнопка видалення в `SolidCardRenderer` (PR-O4).
 * Групи «SolidsTray — drag source» і «useContentDrop — geometry_solid drop»
 * пішли разом із кодом, який вони перевіряли.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'

import {
  DEFAULT_SOLID_STATE,
  SOLID_TYPES,
} from '../constants/solidDefaults'
import type { SolidAsset } from '../types/winterboard'

// ── Mock vendor IIFE + three для SolidCardRenderer ──────────────────────
vi.mock('../vendor/solidCard.js', () => ({}))
vi.mock('three', () => ({}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k, te: (_k: string) => false }),
}))

// ─────────────────────────────────────────────────────────────────────────
//  CHECKPOINT 4 — DEFAULT_SOLID_STATE single source
// ─────────────────────────────────────────────────────────────────────────

describe('DEFAULT_SOLID_STATE — single source of truth', () => {
  it('contains exactly 8 fields per SSOT §3.7.1', () => {
    const keys = Object.keys(DEFAULT_SOLID_STATE).sort()
    expect(keys).toEqual([
      'autoRotate',
      'cutHeight',
      'showCut',
      'showEdges',
      'showFaces',
      'showNet',
      'showVertices',
      'transparent',
    ])
  })

  it('default values match SSOT canonical', () => {
    expect(DEFAULT_SOLID_STATE.showFaces).toBe(true)
    expect(DEFAULT_SOLID_STATE.showEdges).toBe(true)
    expect(DEFAULT_SOLID_STATE.showVertices).toBe(false)
    expect(DEFAULT_SOLID_STATE.transparent).toBe(false)
    expect(DEFAULT_SOLID_STATE.showNet).toBe(false)
    expect(DEFAULT_SOLID_STATE.showCut).toBe(false)
    expect(DEFAULT_SOLID_STATE.cutHeight).toBe(0.5)
    expect(DEFAULT_SOLID_STATE.autoRotate).toBe(true)
  })

  it('SOLID_TYPES has exactly 10 fixed types per SSOT', () => {
    expect(SOLID_TYPES).toHaveLength(10)
    const types = SOLID_TYPES.map((it) => it.type).sort()
    expect(types).toEqual(
      [
        'cone', 'cube', 'cuboid', 'cylinder', 'pyramid3', 'pyramid4',
        'prism3', 'prism6', 'sphere', 'tetrahedron',
      ].sort(),
    )
  })

  it('frozen — runtime mutation throws or is ignored', () => {
    // Object.freeze prevents adding new fields; assigning silently fails у non-strict.
    expect(Object.isFrozen(DEFAULT_SOLID_STATE)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────
//  Рендерер старих тіл — живий, попри зняття трея
// ─────────────────────────────────────────────────────────────────────────

describe('SolidCardRenderer — delete button (PR-O4)', () => {
  // Spyable mock SolidCard (mirror SolidCardRenderer.spec setup)
  class MockSolidCard {
    public set = vi.fn()
    public destroy = vi.fn()
    constructor(_c: HTMLElement, _o: { type: string }) { /* noop */ }
  }
  const ConstructorSpy = vi.fn((c: HTMLElement, o: { type: string }) => new MockSolidCard(c, o))

  beforeEach(async () => {
    const mod = await import('../services/solidCardLoader')
    mod._resetSolidCardLoaderForTests()
    ;(globalThis as any).SolidCard = ConstructorSpy
    ConstructorSpy.mockClear()
  })
  afterEach(() => {
    delete (globalThis as any).SolidCard
    delete (globalThis as any).THREE
  })

  function makeAsset(): SolidAsset {
    return {
      id: 'solid-x',
      type: 'geometry_solid',
      src: 'cube',
      x: 0, y: 0, w: 280, h: 280, rotation: 0, locked: false,
      data: { version: 1, state: { ...DEFAULT_SOLID_STATE } },
    }
  }

  it('delete button click → emits "delete" event', async () => {
    const SolidCardRenderer = (
      await import('../components/board/SolidCardRenderer.vue')
    ).default
    const deletes: number[] = []
    const updates: SolidAsset[] = []
    const Wrapper = defineComponent({
      setup() { return {} },
      render() {
        return h(SolidCardRenderer, {
          asset: makeAsset(),
          // PR-O4.3: delete button visible only when selected.
          isSelected: true,
          'onUpdate:asset': (a: SolidAsset) => { updates.push(a) },
          onDelete: () => { deletes.push(1) },
        })
      },
    })
    const wrapper = mount(Wrapper, { attachTo: document.body })
    await flushPromises()
    await nextTick()

    const btn = wrapper.find('[data-testid="solid-delete"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(deletes).toHaveLength(1)
    // Delete handler не emits update:asset
    expect(updates).toHaveLength(0)

    wrapper.unmount()
  })

  it('locked asset — delete button hidden', async () => {
    const SolidCardRenderer = (
      await import('../components/board/SolidCardRenderer.vue')
    ).default
    const lockedAsset = { ...makeAsset(), locked: true }
    const Wrapper = defineComponent({
      setup() { return {} },
      render() {
        return h(SolidCardRenderer, {
          asset: lockedAsset,
          // PR-O4.3: even with selection, locked asset must hide delete button.
          isSelected: true,
          'onUpdate:asset': () => {},
          onDelete: () => {},
        })
      },
    })
    const wrapper = mount(Wrapper, { attachTo: document.body })
    await flushPromises()
    await nextTick()

    const btn = wrapper.find('[data-testid="solid-delete"]')
    expect(btn.exists()).toBe(false)
    wrapper.unmount()
  })
})

// ─────────────────────────────────────────────────────────────────────────
//  Сторож межі видалення
// ─────────────────────────────────────────────────────────────────────────

describe('Трей знято, малювання лишилось', () => {
  it('старе тіло має свій рендерер у реєстрі оверлеїв', async () => {
    // Це і є причина, чому `solidDefaults.ts` та `SolidCardRenderer` не
    // пішли за треєм: без запису в реєстрі старі дошки показали б порожнє
    // місце замість фігури.
    const { OVERLAY_RENDERERS, isOverlayType } =
      await import('../components/canvas/overlayRegistry')
    expect(OVERLAY_RENDERERS['geometry_solid']).toBeTruthy()
    expect(isOverlayType('geometry_solid')).toBe(true)
  })

  it('створити НОВЕ тіло вже нічим — MIME не ставить ніхто', async () => {
    const mod = await import('../constants/solidDefaults')
    expect('SOLID_DRAG_MIME' in mod).toBe(false)
  })
})
