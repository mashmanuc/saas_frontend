/**
 * Phase O PR-O2 + PR-O3: SolidCardRenderer.vue tests — adapter pattern + toolbar wiring.
 *
 * Refs:
 *   - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O2 CHECKPOINT 5,
 *     PR-O3 CHECKPOINT 1-4 + 8 (throttle)
 *   - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1
 *
 * Critical case = "force divergence":
 *   1. Mount renderer (initial state apply)
 *   2. Manually mutate underlying SolidCard.state (simulates external race)
 *   3. Trigger watch update with same store state → store applyState reapplies
 *   4. Assert: SolidCard reflects STORE value, not the divergent internal value
 *
 * Це доводить single source of truth = WBAsset.data.state (per SSOT §3.7.1).
 *
 * PR-O3 toolbar tests verify:
 *   - Toggle buttons emit `update:asset` with patched state — NO direct card.set()
 *   - showNet ⟂ showCut mutex enforced FE
 *   - cutHeight slider debounced ≤20 ops/sec (CHECKPOINT 8)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

import type { SolidAsset, SolidAssetState } from '../types/winterboard'

// ── Mock vendor IIFE side-effect import ─────────────────────────────────
// Vendor IIFE assigns `window.SolidCard`. Test substitutes spyable mock
// before loader runs.
vi.mock('../vendor/solidCard.js', () => {
  // No exports — IIFE side-effect; mock just provides empty module.
  return {}
})

// Mock 'three' so loader doesn't pull real Three.js (~500KB) into vitest.
vi.mock('three', () => ({}))

// ── Spyable SolidCard mock ──────────────────────────────────────────────
class MockSolidCard {
  // Тримаємо internal "state" що реально проксується через set()/get
  // — лише для force-divergence сценарію.
  public _internal: Record<string, unknown> = {}
  public set = vi.fn((key: string, value: unknown): void => {
    this._internal[key] = value
  })
  public destroy = vi.fn((): void => {
    /* no-op для test */
  })
  public type: string
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_container: HTMLElement, opts: { type: string }) {
    this.type = opts.type
  }
}

let lastInstance: MockSolidCard | null = null
const ConstructorSpy = vi.fn(
  (container: HTMLElement, opts: { type: string }): MockSolidCard => {
    lastInstance = new MockSolidCard(container, opts)
    return lastInstance
  },
) as unknown as new (container: HTMLElement, opts: { type: string }) => MockSolidCard

beforeEach(async () => {
  // Resseed loader щоб mock SolidCard підхопився заново у кожному тесті.
  const mod = await import('../services/solidCardLoader')
  mod._resetSolidCardLoaderForTests()
  ;(globalThis as unknown as { SolidCard: unknown }).SolidCard = ConstructorSpy
  ;(ConstructorSpy as unknown as { mockClear: () => void }).mockClear()
  lastInstance = null
})

afterEach(() => {
  delete (globalThis as unknown as { SolidCard?: unknown }).SolidCard
  delete (globalThis as unknown as { THREE?: unknown }).THREE
})

// ── Helpers ─────────────────────────────────────────────────────────────

const DEFAULT_STATE: SolidAssetState = {
  showFaces: true,
  showEdges: true,
  showVertices: false,
  transparent: false,
  showNet: false,
  showCut: false,
  cutHeight: 0.5,
  autoRotate: true,
}

function makeAsset(stateOverride: Partial<SolidAssetState> = {}): SolidAsset {
  return {
    id: 'solid-1',
    type: 'geometry_solid',
    src: 'cube',
    x: 0,
    y: 0,
    w: 300,
    h: 300,
    rotation: 0,
    data: {
      version: 1,
      state: { ...DEFAULT_STATE, ...stateOverride },
    },
  }
}

interface SetupResult {
  wrapper: ReturnType<typeof mount>
  assetRef: ReturnType<typeof ref<SolidAsset>>
  selectedRef: ReturnType<typeof ref<boolean>>
  emitted: () => SolidAsset[]
}

// Wrapper з reactive prop для watch testing + capture update:asset emits.
// PR-O4.3: default isSelected=true так existing toolbar tests працюють
// (toolbar visibility now driven by selection state).
async function setup(
  initial: SolidAsset,
  options: { isSelected?: boolean } = {},
): Promise<SetupResult> {
  const { isSelected = true } = options
  const SolidCardRenderer = (
    await import('../components/board/SolidCardRenderer.vue')
  ).default
  const assetRef = ref<SolidAsset>(initial)
  const selectedRef = ref<boolean>(isSelected)
  const emittedAssets: SolidAsset[] = []
  const Wrapper = defineComponent({
    setup() {
      return { assetRef, selectedRef }
    },
    render() {
      return h(SolidCardRenderer, {
        asset: assetRef.value,
        isSelected: selectedRef.value,
        'onUpdate:asset': (a: SolidAsset) => {
          emittedAssets.push(a)
        },
      })
    },
  })
  const wrapper = mount(Wrapper, { attachTo: document.body })
  await flushPromises() // resolve loadSolidCard()
  await nextTick()
  return { wrapper, assetRef, selectedRef, emitted: () => emittedAssets }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('SolidCardRenderer (Phase O PR-O2 adapter pattern)', () => {
  it('1. Mount → set() called for each state field with default values', async () => {
    const { wrapper } = await setup(makeAsset())
    expect(lastInstance).not.toBeNull()
    expect(lastInstance!.set).toHaveBeenCalled()
    // Кожен ключ DEFAULT_STATE має бути set-ed хоча б раз.
    for (const key of Object.keys(DEFAULT_STATE)) {
      expect(lastInstance!.set).toHaveBeenCalledWith(
        key,
        DEFAULT_STATE[key as keyof SolidAssetState],
      )
    }
    wrapper.unmount()
  })

  it('2. Watch update — change showEdges true→false → set("showEdges", false) called', async () => {
    const { wrapper, assetRef } = await setup(makeAsset({ showEdges: true }))
    lastInstance!.set.mockClear()

    // Reactive update — створюємо нову state object щоб watch deep fired.
    assetRef.value = {
      ...assetRef.value!,
      data: {
        version: 1,
        state: { ...assetRef.value!.data.state, showEdges: false },
      },
    }
    await nextTick()

    expect(lastInstance!.set).toHaveBeenCalledWith('showEdges', false)
    wrapper.unmount()
  })

  it('3. Force divergence — store wins after external mutation', async () => {
    // Mount with showEdges=true → applyState called once.
    const { wrapper, assetRef } = await setup(makeAsset({ showEdges: true }))
    expect(lastInstance!._internal.showEdges).toBe(true)

    // Simulate "external mutation" — щось напряму штовхнуло SolidCard.
    lastInstance!.set('showEdges', false)
    expect(lastInstance!._internal.showEdges).toBe(false)
    lastInstance!.set.mockClear()

    // Trigger watch — store value НЕ змінилося (showEdges still true), але
    // ми форсуємо apply через нову state reference (mutate inside object).
    // Workflow: store → watch → applyState → set('showEdges', true)
    // — bringing widget back у sync з store.
    assetRef.value = {
      ...assetRef.value!,
      data: {
        version: 1,
        state: { ...assetRef.value!.data.state /* showEdges still true */ },
      },
    }
    await nextTick()

    // Adapter has NO diff → reapplies всі keys including showEdges=true.
    // Store wins → internal.showEdges back до true.
    expect(lastInstance!.set).toHaveBeenCalledWith('showEdges', true)
    expect(lastInstance!._internal.showEdges).toBe(true)
    wrapper.unmount()
  })

  it('4. Unmount → card.destroy() called', async () => {
    const { wrapper } = await setup(makeAsset())
    const destroyFn = lastInstance!.destroy
    wrapper.unmount()
    expect(destroyFn).toHaveBeenCalledTimes(1)
  })
})

// ── PR-O3 toolbar wiring tests ──────────────────────────────────────────

describe('SolidCardRenderer (Phase O PR-O3 toolbar wiring)', () => {
  it('5. toggleField("showEdges") → emits update:asset with patched state, NO direct card.set call', async () => {
    const { wrapper, emitted } = await setup(makeAsset({ showEdges: true }))
    // Clear `set` history накопичений від initial applyState.
    lastInstance!.set.mockClear()

    const btn = wrapper.find('[data-testid="solid-toggle-edges"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')

    // 5a. update:asset emitted з flipped showEdges
    const events = emitted()
    expect(events).toHaveLength(1)
    expect(events[0].data.state.showEdges).toBe(false)
    // version preserved
    expect(events[0].data.version).toBe(1)
    // інші ключі не змінилися
    expect(events[0].data.state.showFaces).toBe(DEFAULT_STATE.showFaces)

    // 5b. No direct card.set() called from toggle handler
    // (set() can only be triggered via watch on prop update, not by emit alone)
    expect(lastInstance!.set).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('6. toggleNet → emits with showNet:true, showCut:false (mutex)', async () => {
    const { wrapper, emitted } = await setup(
      makeAsset({ showNet: false, showCut: true }),
    )
    lastInstance!.set.mockClear()

    await wrapper.find('[data-testid="solid-toggle-net"]').trigger('click')

    const events = emitted()
    expect(events).toHaveLength(1)
    expect(events[0].data.state.showNet).toBe(true)
    expect(events[0].data.state.showCut).toBe(false)
    wrapper.unmount()
  })

  it('7. toggleCut → emits with showCut:true, showNet:false (mutex)', async () => {
    const { wrapper, emitted } = await setup(
      makeAsset({ showNet: true, showCut: false }),
    )
    lastInstance!.set.mockClear()

    await wrapper.find('[data-testid="solid-toggle-cut"]').trigger('click')

    const events = emitted()
    expect(events).toHaveLength(1)
    expect(events[0].data.state.showCut).toBe(true)
    expect(events[0].data.state.showNet).toBe(false)
    wrapper.unmount()
  })

  it('8. cutHeight slider — 60 input events у 1 sec → emits ≤20 ops (debounce 50ms)', async () => {
    // Use fake timers щоб контролювати debounce setTimeout.
    vi.useFakeTimers()
    try {
      // Start з showCut=true щоб slider був rendered.
      const { wrapper, emitted } = await setup(makeAsset({ showCut: true }))

      const slider = wrapper.find('[data-testid="solid-cut-slider"]')
      expect(slider.exists()).toBe(true)

      // Fire 60 input events at ~16.67ms intervals (60Hz native rate over 1 sec).
      const inputEl = slider.element as HTMLInputElement
      for (let i = 0; i < 60; i++) {
        inputEl.value = (0.5 + i * 0.005).toFixed(3)
        inputEl.dispatchEvent(new Event('input'))
        // Advance timer 16ms — менше за debounce 50ms → попередній setTimeout cancelled.
        vi.advanceTimersByTime(16)
      }
      // Flush remaining debounce (final setTimeout fires).
      vi.advanceTimersByTime(60)
      await nextTick()

      const events = emitted()
      // Debounce 50ms + 16ms intervals → only the FINAL setTimeout fires once
      // (previous ones cancelled). Conservative bound: ≤20 ops/sec per SSOT.
      expect(events.length).toBeGreaterThan(0)
      expect(events.length).toBeLessThanOrEqual(20)
      // Final emit має містити cutHeight (some valid range value).
      const last = events[events.length - 1]
      expect(typeof last.data.state.cutHeight).toBe('number')
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('9. NO local state mirror — toolbar reads from props.asset only', async () => {
    // Verify that when props update, toolbar UI reflects new state without
    // any internal ref/reactive holding state — implicit: button active class
    // tracks props directly via computed.
    const { wrapper, assetRef } = await setup(makeAsset({ showEdges: false }))
    let edgesBtn = wrapper.find('[data-testid="solid-toggle-edges"]')
    expect(edgesBtn.classes()).not.toContain('is-active')

    // Update props directly (simulating store → watch → renderer prop update).
    assetRef.value = {
      ...assetRef.value!,
      data: {
        version: 1,
        state: { ...assetRef.value!.data.state, showEdges: true },
      },
    }
    await nextTick()

    edgesBtn = wrapper.find('[data-testid="solid-toggle-edges"]')
    expect(edgesBtn.classes()).toContain('is-active')
    wrapper.unmount()
  })

  it('10. Toolbar action does NOT directly call card.set() — only via emit→watch path', async () => {
    const { wrapper } = await setup(makeAsset())
    lastInstance!.set.mockClear()

    // Click multiple toolbar buttons.
    await wrapper.find('[data-testid="solid-toggle-faces"]').trigger('click')
    await wrapper.find('[data-testid="solid-toggle-vertices"]').trigger('click')
    await wrapper.find('[data-testid="solid-toggle-transparent"]').trigger('click')
    await nextTick()

    // У unit test parent НЕ propagates emit back до prop → watch не fires →
    // card.set() ніколи не викликається безпосередньо з toggle handlers.
    expect(lastInstance!.set).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

// ── PR-O4.3 toolbar visibility + pointer-events tests ───────────────────

describe('SolidCardRenderer (Phase O PR-O4.3 selection-driven toolbar)', () => {
  it('11. Toolbar HIDDEN when isSelected=false', async () => {
    const { wrapper } = await setup(makeAsset(), { isSelected: false })
    expect(wrapper.find('[data-testid="solid-toolbar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="solid-delete"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('12. Toolbar VISIBLE when isSelected=true', async () => {
    const { wrapper } = await setup(makeAsset(), { isSelected: true })
    expect(wrapper.find('[data-testid="solid-toolbar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="solid-delete"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('13. Toolbar reactively appears коли isSelected flips false→true', async () => {
    const { wrapper, selectedRef } = await setup(makeAsset(), { isSelected: false })
    expect(wrapper.find('[data-testid="solid-toolbar"]').exists()).toBe(false)
    selectedRef.value = true
    await nextTick()
    expect(wrapper.find('[data-testid="solid-toolbar"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('14. .solid-card-renderer wrapper class present (CSS rule pointer-events:none у scoped block)', async () => {
    // jsdom не парсить scoped CSS imports з SFC — перевіряємо що класи
    // .solid-card-renderer та .solid-canvas mounted (CSS rule existence
    // ensured static review of <style scoped> у компоненті). Контракт:
    // wrapper має pointer-events:none; Konva proxy у WBCanvas catches drag.
    const { wrapper } = await setup(makeAsset(), { isSelected: true })
    expect(wrapper.find('.solid-card-renderer').exists()).toBe(true)
    expect(wrapper.find('.solid-canvas').exists()).toBe(true)
    wrapper.unmount()
  })

  it('15. is-toolbar-visible class toggles with isSelected', async () => {
    const { wrapper, selectedRef } = await setup(makeAsset(), { isSelected: false })
    const root = wrapper.find('.solid-card-renderer')
    expect(root.classes()).not.toContain('is-toolbar-visible')

    selectedRef.value = true
    await nextTick()
    expect(wrapper.find('.solid-card-renderer').classes()).toContain('is-toolbar-visible')
    wrapper.unmount()
  })
})
