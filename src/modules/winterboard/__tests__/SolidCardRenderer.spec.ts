/**
 * Phase O PR-O2: SolidCardRenderer.vue tests — adapter pattern enforcement.
 *
 * Refs:
 *   - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O2 CHECKPOINT 5
 *   - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1
 *
 * Critical case = "force divergence":
 *   1. Mount renderer (initial state apply)
 *   2. Manually mutate underlying SolidCard.state (simulates external race)
 *   3. Trigger watch update with same store state → store applyState reapplies
 *   4. Assert: SolidCard reflects STORE value, not the divergent internal value
 *
 * Це доводить single source of truth = WBAsset.data.state (per SSOT §3.7.1).
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

// Wrapper з reactive prop для watch testing.
async function setup(initial: SolidAsset) {
  const SolidCardRenderer = (
    await import('../components/board/SolidCardRenderer.vue')
  ).default
  const assetRef = ref<SolidAsset>(initial)
  const Wrapper = defineComponent({
    setup() {
      return { assetRef }
    },
    render() {
      return h(SolidCardRenderer, { asset: assetRef.value })
    },
  })
  const wrapper = mount(Wrapper)
  await flushPromises() // resolve loadSolidCard()
  await nextTick()
  return { wrapper, assetRef }
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
      ...assetRef.value,
      data: {
        version: 1,
        state: { ...assetRef.value.data.state, showEdges: false },
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
      ...assetRef.value,
      data: {
        version: 1,
        state: { ...assetRef.value.data.state /* showEdges still true */ },
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
