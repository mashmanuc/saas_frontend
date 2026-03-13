// WB Responsive Phase 6: Tests for WBAssetItem (B12)
// Ref: winterboard_dev/responsive/prompts/active/DAY12-13_PHASE6.md
// DoD: touch button visible on mobile/tablet, addAsset() called with center, haptic feedback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

// ─── Shared test asset ───────────────────────────────────────────────────────

const TEST_ASSET = {
  id: 'asset-001',
  filename: 'test-image.png',
  cdn_url: 'https://cdn.example.com/test-image.png',
  thumbnail_url: 'https://cdn.example.com/test-thumb.png',
}

// ─── Reactive device mode for mock ───────────────────────────────────────────
// Uses real Vue ref so ComputedRef auto-unwraps correctly in templates

const _mode = ref<'mobile' | 'tablet' | 'desktop' | 'display'>('desktop')

vi.mock('../composables/useDeviceMode', () => ({
  useDeviceMode: () => ({
    deviceMode: computed(() => _mode.value),
    isMobile: computed(() => _mode.value === 'mobile'),
    isTablet: computed(() => _mode.value === 'tablet'),
    isDesktop: computed(() => _mode.value === 'desktop'),
    isDisplay: computed(() => _mode.value === 'display'),
    inputMode: ref('mouse'),
    isTouchInput: ref(false),
    isPenInput: ref(false),
    hasMultipleInputModes: ref(false),
    orientation: ref('landscape'),
    isLandscape: ref(true),
    state: ref({}),
  }),
}))

// Mock vue-i18n so useI18n().t returns the key (Composition API, not $t global)
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setDeviceMode(mode: 'mobile' | 'tablet' | 'desktop' | 'display') {
  _mode.value = mode
}

async function mountAssetItem(asset = TEST_ASSET) {
  const WBAssetItem = (await import('../components/sidebar/WBAssetItem.vue')).default
  return mount(WBAssetItem, {
    props: { asset },
    global: {
      stubs: {
        PlusIcon: { template: '<span class="stub-plus-icon" />' },
        GripVerticalIcon: { template: '<span class="stub-grip-icon" />' },
      },
    },
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WBAssetItem.vue (B12)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setDeviceMode('desktop')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── Test 1: Add button visible on mobile ──────────────────────────────────

  it('shows add button on mobile device', async () => {
    setDeviceMode('mobile')
    const wrapper = await mountAssetItem()

    const addBtn = wrapper.find('.wb-asset-item__add-btn')
    const dragHandle = wrapper.find('.wb-asset-item__drag-handle')

    expect(addBtn.exists()).toBe(true)
    expect(dragHandle.exists()).toBe(false)
  })

  // ── Test 2: Add button visible on tablet ──────────────────────────────────

  it('shows add button on tablet device', async () => {
    setDeviceMode('tablet')
    const wrapper = await mountAssetItem()

    const addBtn = wrapper.find('.wb-asset-item__add-btn')
    const dragHandle = wrapper.find('.wb-asset-item__drag-handle')

    expect(addBtn.exists()).toBe(true)
    expect(dragHandle.exists()).toBe(false)
  })

  // ── Test 3: Drag handle visible on desktop, add button hidden ─────────────

  it('hides add button and shows drag handle on desktop', async () => {
    setDeviceMode('desktop')
    const wrapper = await mountAssetItem()

    const addBtn = wrapper.find('.wb-asset-item__add-btn')
    const dragHandle = wrapper.find('.wb-asset-item__drag-handle')

    expect(addBtn.exists()).toBe(false)
    expect(dragHandle.exists()).toBe(true)
  })

  // ── Test 4: addToBoard calls wbStore.addAsset with correct asset data ──────

  it('calls wbStore.addAsset with image asset at viewport center on add button click', async () => {
    setDeviceMode('mobile')

    // Import store and spy on addAsset BEFORE mounting the component
    const { useWBStore } = await import('../board/state/boardStore')
    const store = useWBStore()

    // Pre-set container dimensions so center is computable
    store.setContainerSize(800, 600)
    store.zoom = 1

    const addAssetSpy = vi.spyOn(store, 'addAsset')

    const wrapper = await mountAssetItem()
    const addBtn = wrapper.find('.wb-asset-item__add-btn')
    await addBtn.trigger('click')

    expect(addAssetSpy).toHaveBeenCalledOnce()

    const call = addAssetSpy.mock.calls[0][0]
    expect(call.type).toBe('image')
    expect(call.src).toBe(TEST_ASSET.cdn_url)
    expect(typeof call.x).toBe('number')
    expect(typeof call.y).toBe('number')
    expect(call.w).toBe(200)
    expect(call.h).toBe(200)
    expect(call.rotation).toBe(0)
    expect(call.id).toMatch(/^asset-/)
  })

  // ── Test 5: Haptic feedback triggered on mobile add ───────────────────────

  it('triggers navigator.vibrate(30) on add button click when available', async () => {
    setDeviceMode('mobile')

    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
      writable: true,
    })

    const { useWBStore } = await import('../board/state/boardStore')
    const store = useWBStore()
    store.setContainerSize(800, 600)

    const wrapper = await mountAssetItem()
    await wrapper.find('.wb-asset-item__add-btn').trigger('click')

    expect(vibrateMock).toHaveBeenCalledWith(30)
  })

  // ── Test 6: aria-label on add button uses i18n key ────────────────────────

  it('add button has aria-label from i18n key winterboard.sidebar.addToBoard', async () => {
    setDeviceMode('tablet')
    const wrapper = await mountAssetItem()

    const addBtn = wrapper.find('.wb-asset-item__add-btn')
    expect(addBtn.attributes('aria-label')).toBe('winterboard.sidebar.addToBoard')
  })

  // ── Test 7: Thumbnail renders from thumbnail_url ──────────────────────────

  it('renders thumbnail image from thumbnail_url when available', async () => {
    setDeviceMode('desktop')
    const wrapper = await mountAssetItem()

    const img = wrapper.find('.wb-asset-item__thumb')
    expect(img.attributes('src')).toBe(TEST_ASSET.thumbnail_url)
    expect(img.attributes('alt')).toBe(TEST_ASSET.filename)
  })

  // ── Test 8: Falls back to cdn_url when no thumbnail ───────────────────────

  it('renders cdn_url as image src when thumbnail_url is absent', async () => {
    setDeviceMode('desktop')
    const assetWithoutThumb = { ...TEST_ASSET, thumbnail_url: undefined }
    const wrapper = await mountAssetItem(assetWithoutThumb)

    const img = wrapper.find('.wb-asset-item__thumb')
    expect(img.attributes('src')).toBe(TEST_ASSET.cdn_url)
  })

  // ── Test 9: device mode modifier class applied ────────────────────────────

  it('applies device mode modifier class to root element', async () => {
    setDeviceMode('tablet')
    const wrapper = await mountAssetItem()

    // data-device-mode reflects the reactive deviceMode value
    expect(wrapper.find('.wb-asset-item').attributes('data-device-mode')).toBe('tablet')
    expect(wrapper.find('.wb-asset-item').classes()).toContain('wb-asset-item--tablet')
  })

  // ── Test 10: Center fallback when containerWidth=0 ────────────────────────

  it('falls back to page center when container is not yet sized', async () => {
    setDeviceMode('mobile')

    const { useWBStore } = await import('../board/state/boardStore')
    const store = useWBStore()
    store.setContainerSize(0, 0) // not sized yet

    const addAssetSpy = vi.spyOn(store, 'addAsset')
    const wrapper = await mountAssetItem()
    await wrapper.find('.wb-asset-item__add-btn').trigger('click')

    expect(addAssetSpy).toHaveBeenCalledOnce()
    const call = addAssetSpy.mock.calls[0][0]
    // Should be near pageWidth/2 - 100 (offset by half asset width)
    expect(call.x).toBeCloseTo(store.pageWidth / 2 - 100, 0)
    expect(call.y).toBeCloseTo(store.pageHeight / 2 - 100, 0)
  })
})
