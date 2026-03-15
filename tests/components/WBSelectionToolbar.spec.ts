/**
 * [P10-B2] Unit tests — WBSelectionToolbar (floating selection actions toolbar)
 * Ref: DAY1_AGENT_B.md B2.6
 *
 * Tests:
 * 1. Renders when selectedIds.length > 0 (desktop mode)
 * 2. NOT rendered when selectedIds.length === 0
 * 3. NOT rendered when mode === 'replay'
 * 4. Delete button disabled when isLocked === true
 * 5. Duplicate button disabled when isLocked === true
 * 6. Emit 'bring-to-front' on click
 * 7. Emit 'send-to-back' on click
 * 8. Emit 'duplicate' on click
 * 9. Emit 'lock' on click (when unlocked)
 * 10. Emit 'unlock' on click (when locked)
 * 11. Emit 'delete' on click
 * 12. Has role="toolbar" and aria-label
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import WBSelectionToolbar from '@/modules/winterboard/components/canvas/WBSelectionToolbar.vue'

// ─── Mock useDeviceMode to return desktop ────────────────────────────────────

vi.mock('@/modules/winterboard/composables/useDeviceMode', () => ({
  useDeviceMode: () => ({
    deviceMode: ref('desktop'),
    isMobile: ref(false),
    isTablet: ref(false),
    isDesktop: ref(true),
    isDisplay: ref(false),
    inputMode: ref('mouse'),
    isTouchInput: ref(false),
    isPenInput: ref(false),
    hasMultipleInputModes: ref(false),
    orientation: ref('landscape'),
    isLandscape: ref(true),
    state: ref({
      deviceMode: 'desktop',
      viewportWidth: 1920,
      viewportHeight: 1080,
      inputMode: 'mouse',
      hasTouch: false,
      hasPen: false,
      hasHover: true,
      orientation: 'landscape',
      dpr: 1,
      isStandalone: false,
    }),
  }),
}))

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      selection: {
        toolbar: 'Selection toolbar',
        bringToFront: 'Bring to front',
        sendToBack: 'Send to back',
        duplicate: 'Duplicate',
        lock: 'Lock',
        unlock: 'Unlock',
        delete: 'Delete',
      },
    },
  },
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages,
})

// ─── Helper ─────────────────────────────────────────────────────────────────

const defaultBBox = { x: 100, y: 100, w: 200, h: 150 }
const defaultCanvasRect = {
  top: 0,
  left: 0,
  right: 1920,
  bottom: 1080,
  width: 1920,
  height: 1080,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect

function mountToolbar(props: Record<string, unknown> = {}) {
  return mount(WBSelectionToolbar, {
    props: {
      selectedIds: ['asset-1'],
      zoom: 1,
      canvasRect: defaultCanvasRect,
      mode: 'edit' as const,
      isLocked: false,
      bbox: defaultBBox,
      ...props,
    },
    global: {
      plugins: [i18n],
    },
  })
}

// ─── WBSelectionToolbar Tests ────────────────────────────────────────────────

describe('WBSelectionToolbar (B2)', () => {
  it('renders when selectedIds.length > 0', () => {
    const wrapper = mountToolbar({ selectedIds: ['asset-1'] })
    expect(wrapper.find('.wb-selection-toolbar').exists()).toBe(true)
  })

  it('NOT rendered when selectedIds.length === 0', () => {
    const wrapper = mountToolbar({ selectedIds: [] })
    expect(wrapper.find('.wb-selection-toolbar').exists()).toBe(false)
  })

  it('NOT rendered when mode === "replay"', () => {
    const wrapper = mountToolbar({ mode: 'replay' })
    expect(wrapper.find('.wb-selection-toolbar').exists()).toBe(false)
  })

  it('delete button disabled when isLocked === true', () => {
    const wrapper = mountToolbar({ isLocked: true })
    const deleteBtn = wrapper.find('.wb-selection-toolbar__btn--danger')
    expect(deleteBtn.exists()).toBe(true)
    expect(deleteBtn.attributes('disabled')).toBeDefined()
  })

  it('duplicate button disabled when isLocked === true', () => {
    const wrapper = mountToolbar({ isLocked: true })
    const btns = wrapper.findAll('.wb-selection-toolbar__btn')
    // Duplicate is the 3rd button (index 2): BtF, StB, Duplicate, Lock/Unlock, Delete
    const duplicateBtn = btns[2]
    expect(duplicateBtn).toBeTruthy()
    expect(duplicateBtn.attributes('disabled')).toBeDefined()
  })

  it('emit bring-to-front on click', async () => {
    const wrapper = mountToolbar()
    const btns = wrapper.findAll('.wb-selection-toolbar__btn')
    // First button = Bring to Front
    await btns[0].trigger('click')
    expect(wrapper.emitted('bring-to-front')).toBeTruthy()
  })

  it('emit send-to-back on click', async () => {
    const wrapper = mountToolbar()
    const btns = wrapper.findAll('.wb-selection-toolbar__btn')
    // Second button = Send to Back
    await btns[1].trigger('click')
    expect(wrapper.emitted('send-to-back')).toBeTruthy()
  })

  it('emit duplicate on click', async () => {
    const wrapper = mountToolbar({ isLocked: false })
    const btns = wrapper.findAll('.wb-selection-toolbar__btn')
    // Third button = Duplicate
    await btns[2].trigger('click')
    expect(wrapper.emitted('duplicate')).toBeTruthy()
  })

  it('emit lock on click when unlocked', async () => {
    const wrapper = mountToolbar({ isLocked: false })
    const btns = wrapper.findAll('.wb-selection-toolbar__btn')
    // Fourth button = Lock (when isLocked=false)
    await btns[3].trigger('click')
    expect(wrapper.emitted('lock')).toBeTruthy()
  })

  it('emit unlock on click when locked', async () => {
    const wrapper = mountToolbar({ isLocked: true })
    const btns = wrapper.findAll('.wb-selection-toolbar__btn')
    // Fourth button = Unlock (when isLocked=true)
    await btns[3].trigger('click')
    expect(wrapper.emitted('unlock')).toBeTruthy()
  })

  it('emit delete on click', async () => {
    const wrapper = mountToolbar({ isLocked: false })
    const deleteBtn = wrapper.find('.wb-selection-toolbar__btn--danger')
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  it('has role="toolbar" and aria-label', () => {
    const wrapper = mountToolbar()
    const toolbar = wrapper.find('.wb-selection-toolbar')
    expect(toolbar.attributes('role')).toBe('toolbar')
    expect(toolbar.attributes('aria-label')).toBe('Selection toolbar')
  })
})
