/**
 * [WB5-B4] Unit tests — Lock/Unlock UI (WBLockIndicator + toolbar lock button)
 * Ref: TASK_BOARD_V5.md B4
 *
 * Tests:
 * 1. WBLockIndicator renders when visible=true
 * 2. WBLockIndicator hidden when visible=false
 * 3. WBLockIndicator has correct position style
 * 4. WBLockIndicator scales inversely with zoom
 * 5. Lock button visible when hasSelection=true
 * 6. Lock button hidden when hasSelection=false
 * 7. Lock button shows lock icon when no locked items
 * 8. Lock button shows unlock icon when locked items in selection
 * 9. Lock button emits lock-selected
 * 10. Unlock button emits unlock-selected
 * 11. Lock i18n keys render correctly
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBLockIndicator from '@/modules/winterboard/components/canvas/WBLockIndicator.vue'
import WBToolbar from '@/modules/winterboard/components/toolbar/WBToolbar.vue'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      toolbar: {
        title: 'Toolbar',
        drawingTools: 'Drawing tools',
        colorPalette: 'Color palette',
        strokeSize: 'Stroke size',
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
        highlighter_green: 'Green highlighter',
        highlighter_blue: 'Blue highlighter',
        highlighter_pink: 'Pink highlighter',
        highlighter_purple: 'Purple highlighter',
        highlighter_orange: 'Orange highlighter',
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function mountIndicator(props: Record<string, unknown> = {}) {
  return mount(WBLockIndicator, {
    props: {
      x: 100,
      y: 50,
      zoom: 1,
      visible: true,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

function mountToolbar(props: Record<string, unknown> = {}) {
  return mount(WBToolbar, {
    props: {
      currentTool: 'pen',
      currentColor: '#1e293b',
      currentSize: 3,
      canUndo: false,
      canRedo: false,
      hasSelection: false,
      hasLockedInSelection: false,
      ...props,
    },
    global: {
      plugins: [i18n],
      stubs: {
        WBThicknessPresets: {
          template: '<div data-testid="thickness-presets" />',
          props: ['modelValue', 'currentColor'],
        },
        WBQuickPalette: {
          template: '<div data-testid="quick-palette" />',
          props: ['modelValue', 'currentTool'],
        },
      },
    },
  })
}

// ─── WBLockIndicator Tests ──────────────────────────────────────────────────

describe('WBLockIndicator', () => {
  it('renders when visible=true', () => {
    const wrapper = mountIndicator({ visible: true })
    expect(wrapper.find('.wb-lock-indicator').exists()).toBe(true)
  })

  it('hidden when visible=false', () => {
    const wrapper = mountIndicator({ visible: false })
    expect(wrapper.find('.wb-lock-indicator').exists()).toBe(false)
  })

  it('has correct position style', () => {
    const wrapper = mountIndicator({ x: 200, y: 80, zoom: 1 })
    const el = wrapper.find('.wb-lock-indicator')
    const style = el.attributes('style') || ''
    expect(style).toContain('left: 200px')
    expect(style).toContain('top: 80px')
  })

  it('scales inversely with zoom', () => {
    const wrapper = mountIndicator({ x: 100, y: 50, zoom: 2 })
    const el = wrapper.find('.wb-lock-indicator')
    const style = el.attributes('style') || ''
    // scale = 1/2 = 0.5
    expect(style).toContain('scale(0.5)')
  })

  it('has aria-label for accessibility', () => {
    const wrapper = mountIndicator({ visible: true })
    const el = wrapper.find('.wb-lock-indicator')
    expect(el.attributes('aria-label')).toBe('Locked item')
  })

  it('contains lock SVG icon', () => {
    const wrapper = mountIndicator({ visible: true })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})

// ─── WBToolbar Lock Button Tests ────────────────────────────────────────────

describe('WBToolbar Lock Button (B4)', () => {
  it('lock button visible when hasSelection=true', () => {
    const wrapper = mountToolbar({ hasSelection: true })
    const contextGroup = wrapper.find('.wb-toolbar__context')
    expect(contextGroup.exists()).toBe(true)
  })

  it('lock button hidden when hasSelection=false', () => {
    const wrapper = mountToolbar({ hasSelection: false })
    const contextGroup = wrapper.find('.wb-toolbar__context')
    expect(contextGroup.exists()).toBe(false)
  })

  it('shows lock aria-label when no locked items in selection', () => {
    const wrapper = mountToolbar({ hasSelection: true, hasLockedInSelection: false })
    const lockBtn = wrapper.find('.wb-toolbar__context button')
    expect(lockBtn.attributes('aria-label')).toBe('Lock')
  })

  it('shows unlock aria-label when locked items in selection', () => {
    const wrapper = mountToolbar({ hasSelection: true, hasLockedInSelection: true })
    const lockBtn = wrapper.find('.wb-toolbar__context button')
    expect(lockBtn.attributes('aria-label')).toBe('Unlock')
  })

  it('emits lock-selected on click when no locked items', async () => {
    const wrapper = mountToolbar({ hasSelection: true, hasLockedInSelection: false })
    const lockBtn = wrapper.find('.wb-toolbar__context button')
    await lockBtn.trigger('click')
    expect(wrapper.emitted('lock-selected')).toBeTruthy()
  })

  it('emits unlock-selected on click when locked items present', async () => {
    const wrapper = mountToolbar({ hasSelection: true, hasLockedInSelection: true })
    const lockBtn = wrapper.find('.wb-toolbar__context button')
    await lockBtn.trigger('click')
    expect(wrapper.emitted('unlock-selected')).toBeTruthy()
  })

  it('lock i18n keys render correctly', () => {
    const wrapper = mountToolbar({ hasSelection: true, hasLockedInSelection: false })
    const lockBtn = wrapper.find('.wb-toolbar__context button')
    expect(lockBtn.attributes('data-tooltip')).toBe('Lock')
  })
})
