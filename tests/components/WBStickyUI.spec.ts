/**
 * [WB5-B9] Unit tests — Sticky Notes UI (Icon, ColorPicker, Toolbar, Context Menu)
 * Ref: TASK_BOARD_V5.md B9
 *
 * Tests:
 * 1. WBIconSticky renders SVG
 * 2. ColorPicker renders 6 swatches
 * 3. Click swatch emits select-color
 * 4. Active color has checkmark
 * 5. Escape closes picker
 * 6. Backdrop click closes picker
 * 7. Toolbar has sticky button
 * 8. Toolbar sticky tooltip includes hint
 * 9. Thickness hidden when sticky active
 * 10. Color palette hidden when sticky active
 * 11. Context menu shows change-color for stickies
 * 12. i18n keys render correctly
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBIconSticky from '@/modules/winterboard/components/toolbar/icons/WBIconSticky.vue'
import WBStickyColorPicker from '@/modules/winterboard/components/canvas/WBStickyColorPicker.vue'
import WBToolbar from '@/modules/winterboard/components/toolbar/WBToolbar.vue'
import WBContextMenu from '@/modules/winterboard/components/canvas/WBContextMenu.vue'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      toolbar: {
        tools: 'Drawing tools',
        actions: 'Actions',
        selectColor: 'Select color',
        customColor: 'Custom color',
        thickness: 'Line thickness',
        thickness_thin: 'Thin (1px)',
        thickness_normal: 'Normal (3px)',
        thickness_bold: 'Bold (6px)',
        thickness_marker: 'Marker (12px)',
        thickness_section: 'Line thickness',
        color_section: 'Color palette',
        laser_hint: 'Hold to point (not saved)',
        sticky_hint: 'Click to place a sticky note',
        color: 'Color',
        color_dark: 'Dark',
        color_red: 'Red',
        color_blue: 'Blue',
        color_green: 'Green',
        color_purple: 'Purple',
        color_orange: 'Orange',
        color_teal: 'Teal',
        color_white: 'White',
        highlighter_yellow: 'Yellow highlighter',
      },
      tools: {
        pen: 'Pen',
        highlighter: 'Highlighter',
        eraser: 'Eraser',
        line: 'Line',
        rectangle: 'Rectangle',
        circle: 'Circle',
        text: 'Text',
        select: 'Select',
        undo: 'Undo',
        redo: 'Redo',
        clear: 'Clear',
        laser: 'Laser pointer',
        sticky: 'Sticky note',
      },
      lock: {
        lock: 'Lock',
        unlock: 'Unlock',
        locked_label: 'Locked item',
        locked_toast: '{count} item(s) locked',
        unlocked_toast: '{count} item(s) unlocked',
        cannot_modify: 'This item is locked',
      },
      clear: {
        button: 'Clear page',
        title: 'Clear page?',
        message: 'All strokes and objects will be removed.',
        locked_note: '{n} locked item(s) will not be removed.',
        cancel: 'Cancel',
        confirm: 'Clear page',
      },
      context: {
        menu_label: 'Context menu',
        group: 'Group',
        ungroup: 'Ungroup',
        align: 'Align',
        align_left: 'Align left',
        align_center: 'Align center',
        align_right: 'Align right',
        align_top: 'Align top',
        align_middle: 'Align middle',
        align_bottom: 'Align bottom',
        distribute: 'Distribute',
        distribute_h: 'Distribute horizontally',
        distribute_v: 'Distribute vertically',
        duplicate: 'Duplicate',
        lock: 'Lock',
        unlock: 'Unlock',
        delete: 'Delete',
      },
      sticky: {
        placeholder: 'Type here...',
        change_color: 'Change color',
        color_yellow: 'Yellow',
        color_green: 'Green',
        color_blue: 'Blue',
        color_pink: 'Pink',
        color_purple: 'Purple',
        color_orange: 'Orange',
      },
    },
  },
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages,
})

// ─── WBIconSticky Tests ─────────────────────────────────────────────────────

describe('WBIconSticky (B9)', () => {
  it('renders SVG with aria-hidden', () => {
    const wrapper = mount(WBIconSticky)
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('width')).toBe('20')
    expect(svg.attributes('height')).toBe('20')
  })
})

// ─── WBStickyColorPicker Tests ──────────────────────────────────────────────

describe('WBStickyColorPicker (B9)', () => {
  function mountPicker(props: Record<string, unknown> = {}) {
    return mount(WBStickyColorPicker, {
      props: {
        visible: true,
        x: 100,
        y: 200,
        currentColor: '#fde047',
        ...props,
      },
      global: {
        plugins: [i18n],
        stubs: { Teleport: true },
      },
    })
  }

  it('renders 6 swatches', () => {
    const wrapper = mountPicker()
    const swatches = wrapper.findAll('.wb-sticky-picker__swatch')
    expect(swatches.length).toBe(6)
  })

  it('click swatch emits select-color', async () => {
    const wrapper = mountPicker()
    const swatches = wrapper.findAll('.wb-sticky-picker__swatch')
    await swatches[2].trigger('click') // blue
    expect(wrapper.emitted('select-color')).toBeTruthy()
    expect(wrapper.emitted('select-color')![0][0]).toBe('#93c5fd')
  })

  it('active color has checkmark', () => {
    const wrapper = mountPicker({ currentColor: '#fde047' })
    const activeSwatches = wrapper.findAll('.wb-sticky-picker__swatch--active')
    expect(activeSwatches.length).toBe(1)
    const check = activeSwatches[0].find('.wb-sticky-picker__check')
    expect(check.exists()).toBe(true)
  })

  it('escape closes picker', async () => {
    const wrapper = mountPicker()
    const picker = wrapper.find('.wb-sticky-picker')
    await picker.trigger('keydown.escape')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('backdrop click closes picker', async () => {
    const wrapper = mountPicker()
    const backdrop = wrapper.find('.wb-sticky-picker-backdrop')
    await backdrop.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('hidden when visible=false', () => {
    const wrapper = mountPicker({ visible: false })
    expect(wrapper.find('.wb-sticky-picker').exists()).toBe(false)
  })
})

// ─── WBToolbar Sticky Integration Tests ─────────────────────────────────────

describe('WBToolbar Sticky (B9)', () => {
  function mountToolbar(props: Record<string, unknown> = {}) {
    return mount(WBToolbar, {
      props: {
        currentTool: 'pen',
        currentColor: '#000000',
        currentSize: 2,
        canUndo: false,
        canRedo: false,
        hasSelection: false,
        hasLockedInSelection: false,
        canClearPage: false,
        ...props,
      },
      global: {
        plugins: [i18n],
      },
    })
  }

  it('has sticky button', () => {
    const wrapper = mountToolbar()
    const html = wrapper.html()
    expect(html).toContain('Sticky note')
  })

  it('sticky tooltip includes hint', () => {
    const wrapper = mountToolbar()
    const stickyBtn = wrapper.findAll('.wb-toolbar__btn--tooltip').find(
      btn => btn.attributes('data-tooltip')?.includes('Sticky note')
    )
    expect(stickyBtn).toBeDefined()
    expect(stickyBtn!.attributes('data-tooltip')).toContain('Click to place a sticky note')
  })

  it('thickness hidden when sticky active', () => {
    const wrapper = mountToolbar({ currentTool: 'sticky' })
    // WBThicknessPresets should not be rendered
    expect(wrapper.findComponent({ name: 'WBThicknessPresets' }).exists()).toBe(false)
  })

  it('color palette hidden when sticky active', () => {
    const wrapper = mountToolbar({ currentTool: 'sticky' })
    expect(wrapper.findComponent({ name: 'WBQuickPalette' }).exists()).toBe(false)
  })
})

// ─── WBContextMenu Sticky Color Tests ───────────────────────────────────────

describe('WBContextMenu Sticky Color (B9)', () => {
  function mountMenu(props: Record<string, unknown> = {}) {
    return mount(WBContextMenu, {
      props: {
        visible: true,
        x: 100,
        y: 200,
        selectedCount: 1,
        canGroup: false,
        canUngroup: false,
        canLock: true,
        canUnlock: false,
        canDuplicate: true,
        allSticky: false,
        ...props,
      },
      global: {
        plugins: [i18n],
        stubs: { Teleport: true },
      },
    })
  }

  it('shows change-color when allSticky=true', () => {
    const wrapper = mountMenu({ allSticky: true })
    const text = wrapper.text()
    expect(text).toContain('Change color')
  })

  it('hides change-color when allSticky=false', () => {
    const wrapper = mountMenu({ allSticky: false })
    const text = wrapper.text()
    expect(text).not.toContain('Change color')
  })
})
