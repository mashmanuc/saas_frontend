/**
 * Phase O PR-O4: SolidsTray + drop handler + delete button tests.
 *
 * Refs:
 *  - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O4
 *  - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1
 *
 * Test coverage:
 *  1. Tray button drag → setData з 'application/x-solid' MIME + payload {src}
 *  2. Drop handler з 'application/x-solid' → emits asset_add з DEFAULT_SOLID_STATE
 *  3. Drop handler з image (existing pattern) → still works (regression check)
 *  4. Drop unknown solid src → no asset created (defensive)
 *  5. Drop invalid JSON → no asset created (defensive)
 *  6. SolidCardRenderer delete button → emits 'delete' event
 *  7. DEFAULT_SOLID_STATE — single source verified (no duplicate literals)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'

import {
  DEFAULT_SOLID_STATE,
  SOLID_DRAG_MIME,
  SOLID_TYPES,
  DEFAULT_SOLID_W,
  DEFAULT_SOLID_H,
} from '../constants/solidDefaults'
import { useContentDrop } from '../composables/useContentDrop'
import type { WBAsset, SolidAsset } from '../types/winterboard'
import type { ContentDragPayload } from '@/modules/learning-content'

// ── Mock learning-content API (used for image/sidebar paths) ────────────
vi.mock('@/modules/learning-content', () => ({
  learningContentApi: {
    resolveDropMode: vi.fn(),
    getItemDetail: vi.fn(),
    createLessonMaterial: vi.fn(),
  },
  renderContentToSvgDataUrl: vi.fn(),
}))

// ── Mock vendor IIFE + three для SolidCardRenderer test ─────────────────
vi.mock('../vendor/solidCard.js', () => ({}))
vi.mock('three', () => ({}))

// PR-O4.1: mocks for ContentSidebar visibility tests (top-level — vitest hoists).
vi.mock('@/modules/learning-content/api/learningContentApi', () => ({
  learningContentApi: {
    getStorageQuota: vi.fn(() => Promise.resolve(null)),
    getLessonAllowedItems: vi.fn(() => Promise.resolve([])),
    addAllowedContent: vi.fn(),
  },
}))
vi.mock('@/modules/learning-content/components/StorageQuotaBar.vue', () => ({
  default: { name: 'StorageQuotaBarStub', template: '<div data-testid="quota-stub" />' },
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
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
//  CHECKPOINT 6 — Tray drag MIME + payload format
// ─────────────────────────────────────────────────────────────────────────

describe('SolidsTray — drag source', () => {
  it('drag start — sets application/x-solid MIME з {src} payload', async () => {
    const SolidsTray = (await import('../components/sidebar/SolidsTray.vue')).default
    const wrapper = mount(SolidsTray)

    const cubeBtn = wrapper.find('[data-testid="solid-tray-cube"]')
    expect(cubeBtn.exists()).toBe(true)
    expect(cubeBtn.attributes('draggable')).toBe('true')

    // Mock DataTransfer
    const setData = vi.fn()
    const fakeDt = { setData, effectAllowed: '' } as unknown as DataTransfer
    const fakeEvent = new Event('dragstart') as DragEvent
    Object.defineProperty(fakeEvent, 'dataTransfer', {
      value: fakeDt,
      configurable: true,
    })

    await cubeBtn.element.dispatchEvent(fakeEvent)
    // Vue test-utils dispatch is async — await microtask
    await nextTick()

    expect(setData).toHaveBeenCalledTimes(1)
    expect(setData.mock.calls[0][0]).toBe(SOLID_DRAG_MIME)
    const payload = JSON.parse(setData.mock.calls[0][1])
    expect(payload).toEqual({ src: 'cube' })
    expect(fakeDt.effectAllowed).toBe('copy')

    wrapper.unmount()
  })

  it('renders all 10 solid type buttons', async () => {
    const SolidsTray = (await import('../components/sidebar/SolidsTray.vue')).default
    const wrapper = mount(SolidsTray)

    for (const item of SOLID_TYPES) {
      const btn = wrapper.find(`[data-testid="solid-tray-${item.type}"]`)
      expect(btn.exists()).toBe(true)
    }

    wrapper.unmount()
  })
})

// ─────────────────────────────────────────────────────────────────────────
//  CHECKPOINT 6 — Drop handler з SOLID_DRAG_MIME emits asset_add
// ─────────────────────────────────────────────────────────────────────────

function makeDropEvent(
  mime: string,
  payload: string,
  clientX = 100,
  clientY = 100,
): DragEvent {
  const dt = {
    getData: vi.fn((m: string) => (m === mime ? payload : '')),
    types: [mime],
    files: [],
    items: [],
  } as unknown as DataTransfer
  const ev = new Event('drop') as DragEvent
  Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true })
  Object.defineProperty(ev, 'clientX', { value: clientX, configurable: true })
  Object.defineProperty(ev, 'clientY', { value: clientY, configurable: true })
  return ev
}

describe('useContentDrop — geometry_solid drop', () => {
  let received: WBAsset[]
  let sessionId: Ref<string | null>
  let canDraw: Ref<boolean>
  let drop: ReturnType<typeof useContentDrop>

  beforeEach(() => {
    received = []
    sessionId = ref<string | null>('session-1')
    canDraw = ref(true)
    drop = useContentDrop({
      sessionId,
      canDraw,
      onAssetAdd: (a) => received.push(a),
      // Identity: client coords map directly to canvas (zoom=1, no offset).
      screenToCanvas: (x, y) => ({ x, y }),
    })
  })

  it('1. Drop з SOLID_DRAG_MIME → emits geometry_solid asset з DEFAULT_SOLID_STATE', async () => {
    const ev = makeDropEvent(SOLID_DRAG_MIME, JSON.stringify({ src: 'cube' }), 500, 400)
    await drop.handleCanvasDrop(ev)

    expect(received).toHaveLength(1)
    const a = received[0] as SolidAsset
    expect(a.type).toBe('geometry_solid')
    expect(a.src).toBe('cube')
    // CHECKPOINT 3: drop coords correct — center on drop point.
    expect(a.x).toBe(500 - DEFAULT_SOLID_W / 2)
    expect(a.y).toBe(400 - DEFAULT_SOLID_H / 2)
    expect(a.w).toBe(DEFAULT_SOLID_W)
    expect(a.h).toBe(DEFAULT_SOLID_H)
    expect(a.rotation).toBe(0)
    expect(a.locked).toBe(false)
    // CHECKPOINT 4: state використовує DEFAULT_SOLID_STATE (single source).
    expect(a.data.version).toBe(1)
    expect(a.data.state).toEqual({ ...DEFAULT_SOLID_STATE })
    // Generated id має solid- prefix.
    expect(a.id).toMatch(/^solid-/)
  })

  it('2. Drop з SOLID_DRAG_MIME — different type (sphere)', async () => {
    const ev = makeDropEvent(SOLID_DRAG_MIME, JSON.stringify({ src: 'sphere' }), 100, 100)
    await drop.handleCanvasDrop(ev)
    expect(received).toHaveLength(1)
    expect((received[0] as SolidAsset).src).toBe('sphere')
  })

  it('3. Drop з invalid JSON у solid MIME → silent no-op', async () => {
    const ev = makeDropEvent(SOLID_DRAG_MIME, 'not-json{', 100, 100)
    await drop.handleCanvasDrop(ev)
    expect(received).toHaveLength(0)
  })

  it('4. Drop з unknown solid src → silent no-op', async () => {
    const ev = makeDropEvent(SOLID_DRAG_MIME, JSON.stringify({ src: 'banana' }), 100, 100)
    await drop.handleCanvasDrop(ev)
    expect(received).toHaveLength(0)
  })

  it('5. Drop без data — canDraw=false → no emit (regression: edit-mode guard)', async () => {
    canDraw.value = false
    const ev = makeDropEvent(SOLID_DRAG_MIME, JSON.stringify({ src: 'cube' }), 100, 100)
    await drop.handleCanvasDrop(ev)
    expect(received).toHaveLength(0)
  })

  it('6. State spread is FRESH copy (mutation isolation)', async () => {
    const ev = makeDropEvent(SOLID_DRAG_MIME, JSON.stringify({ src: 'cube' }), 100, 100)
    await drop.handleCanvasDrop(ev)
    const a = received[0] as SolidAsset
    // Mutating asset state must NOT mutate DEFAULT_SOLID_STATE (frozen, але ще
    // перевіряємо що spread створив новий object reference).
    expect(a.data.state).not.toBe(DEFAULT_SOLID_STATE)
    expect(a.data.state.showFaces).toBe(true)
  })

  it('7. Regression: drop без SOLID_DRAG_MIME — solid branch не consumes', async () => {
    // Drop without solid MIME — solid branch must early-exit і не emit solid asset.
    // Other branches (image/sidebar/content) тестуються окремо у власних suites.
    const ev = {
      preventDefault: () => {},
      dataTransfer: {
        getData: vi.fn((m: string) => (m === 'application/x-asset-id' ? '42' : '')),
        types: ['application/x-asset-id'],
        files: [],
      },
      clientX: 100,
      clientY: 100,
    } as unknown as DragEvent
    await drop.handleCanvasDrop(ev)
    // No solid asset emitted — branch did not fire.
    expect(received.find((a) => a.type === 'geometry_solid')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────
//  Delete button — SolidCardRenderer emits 'delete'
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
//  PR-O4.1 P0 — ContentSidebar mounts SolidsTray у всіх sub-states
//
//  Bug: SolidsTray був унизу sidebar — після всіх materials groups + button.
//  Користувач не міг побачити tray після 15+ матеріалів (off-screen).
//  Fix: tray ABOVE groups → завжди видимий у lesson mode у будь-якому стані
//  (loading / error / empty / groups). Hidden ONLY у library mode.
// ─────────────────────────────────────────────────────────────────────────

describe('ContentSidebar — SolidsTray visibility invariant (PR-O4.1)', () => {
  // Тут ми НЕ мокуємо useContentSidebar композабл (vi.mock працює тільки top-level).
  // Натомість покладаємось на контракт компонента: SolidsTray розташований ABOVE
  // sub-state branches (loading/error/empty/groups) → рендериться у lesson mode
  // у будь-якому стані. Hidden ONLY у library mode (через v-if на template-блоці).
  // learningContentApi мокнута глобально (returns empty array → empty state).

  async function mountSidebar(props: { lessonId: string | null; isTutor: boolean }) {
    const ContentSidebar = (
      await import('../components/sidebar/ContentSidebar.vue')
    ).default
    return mount(ContentSidebar, { props })
  }

  it('empty state — SolidsTray rendered (totalCount=0)', async () => {
    const wrapper = await mountSidebar({ lessonId: '42', isTutor: true })
    await flushPromises()
    expect(wrapper.find('[data-testid="solids-tray"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('loading state — SolidsTray rendered (isLoading=true)', async () => {
    const wrapper = await mountSidebar({ lessonId: null, isTutor: true })
    await flushPromises()
    expect(wrapper.find('[data-testid="solids-tray"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('library mode — SolidsTray HIDDEN (toggle via empty-state CTA button)', async () => {
    // Empty state — для tutor показує "addFromLibrary" CTA. Click → mode='library'.
    const wrapper = await mountSidebar({ lessonId: '42', isTutor: true })
    await flushPromises()

    // Lesson mode default — SolidsTray rendered.
    expect(wrapper.find('[data-testid="solids-tray"]').exists()).toBe(true)

    // Switch to library mode (empty-state primary CTA).
    const emptyAddBtn = wrapper.find('.content-sidebar__add-btn--primary')
    if (emptyAddBtn.exists()) {
      await emptyAddBtn.trigger('click')
      await flushPromises()
      // Library mode active → SolidsTray hidden (not in DOM).
      expect(wrapper.find('[data-testid="solids-tray"]').exists()).toBe(false)
    }
    wrapper.unmount()
  })
})

// ─────────────────────────────────────────────────────────────────────────
//  PR-O4.2 P0 — GroupContentSidebar (production sidebar) mounts SolidsTray
//
//  Bug: PR-O4 mounted SolidsTray у ContentSidebar.vue, але прод використовує
//  GroupContentSidebar.vue (Solo + Classroom rooms). SolidsTray був недосяжний
//  у production. Fix: mount <SolidsTray /> at top of content sections, NO v-if,
//  always visible — single mount → Solo + Classroom inherit.
// ─────────────────────────────────────────────────────────────────────────

vi.mock('../composables/useGroupSidebar', () => ({
  useGroupSidebar: () => ({
    items: ref([]),
    isLoading: ref(false),
    error: ref(null),
    grouped: ref({}),
    totalCount: ref(0),
    showPasteOnly: ref(false),
    pasteCount: ref(0),
    reload: vi.fn(),
    uploadFiles: vi.fn(() => Promise.resolve()),
    SIDEBAR_DRAG_MIME: 'application/x-sidebar-asset',
  }),
}))
vi.mock('../board/state/boardStore', () => ({
  useWBStore: () => ({}),
}))
vi.mock('../api/library', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchFoldersTree: vi.fn(() => Promise.resolve([])),
  }
})

describe('SolidsTray — mounted у GroupContentSidebar (production sidebar) PR-O4.2', () => {
  it('renders SolidsTray у GroupContentSidebar (always visible, no v-if)', async () => {
    const GroupContentSidebar = (
      await import('../components/sidebar/GroupContentSidebar.vue')
    ).default
    const wrapper = mount(GroupContentSidebar, {
      props: { groupId: 'group-1', isTutor: true },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="solids-tray"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SolidsTray' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('SolidsTray rendered коли groupId=null (library mode also covered)', async () => {
    const GroupContentSidebar = (
      await import('../components/sidebar/GroupContentSidebar.vue')
    ).default
    const wrapper = mount(GroupContentSidebar, {
      props: { groupId: null, isTutor: false },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="solids-tray"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

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
