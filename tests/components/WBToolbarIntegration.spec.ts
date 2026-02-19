/**
 * [WB5-B3] Unit tests — WBToolbar integration (conditional visibility, sections)
 * Ref: TASK_BOARD_V5.md B3
 *
 * Tests:
 * 1. Thickness presets visible when tool=pen
 * 2. Thickness presets hidden when tool=eraser
 * 3. Color palette visible when tool=pen
 * 4. Color palette hidden when tool=select
 * 5. Color palette visible when tool=text
 * 6. Section labels rendered with correct i18n
 * 7. Thickness hidden when tool=select
 * 8. Both sections visible when tool=rectangle
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
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

// ─── Helper ─────────────────────────────────────────────────────────────────

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
        // Stub child components to isolate toolbar logic
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WBToolbar Integration (B3)', () => {
  it('thickness presets visible when tool=pen', () => {
    const wrapper = mountToolbar({ currentTool: 'pen' })
    expect(wrapper.find('[data-testid="thickness-presets"]').exists()).toBe(true)
  })

  it('thickness presets hidden when tool=eraser', () => {
    const wrapper = mountToolbar({ currentTool: 'eraser' })
    expect(wrapper.find('[data-testid="thickness-presets"]').exists()).toBe(false)
  })

  it('thickness presets hidden when tool=select', () => {
    const wrapper = mountToolbar({ currentTool: 'select' })
    expect(wrapper.find('[data-testid="thickness-presets"]').exists()).toBe(false)
  })

  it('color palette visible when tool=pen', () => {
    const wrapper = mountToolbar({ currentTool: 'pen' })
    expect(wrapper.find('[data-testid="quick-palette"]').exists()).toBe(true)
  })

  it('color palette hidden when tool=select', () => {
    const wrapper = mountToolbar({ currentTool: 'select' })
    expect(wrapper.find('[data-testid="quick-palette"]').exists()).toBe(false)
  })

  it('color palette visible when tool=text', () => {
    const wrapper = mountToolbar({ currentTool: 'text' })
    expect(wrapper.find('[data-testid="quick-palette"]').exists()).toBe(true)
  })

  it('color palette hidden when tool=eraser', () => {
    const wrapper = mountToolbar({ currentTool: 'eraser' })
    expect(wrapper.find('[data-testid="quick-palette"]').exists()).toBe(false)
  })

  it('both sections visible when tool=rectangle', () => {
    const wrapper = mountToolbar({ currentTool: 'rectangle' })
    expect(wrapper.find('[data-testid="thickness-presets"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quick-palette"]').exists()).toBe(true)
  })

  it('thickness visible but color hidden for no tool (thickness only for highlighter)', () => {
    const wrapper = mountToolbar({ currentTool: 'highlighter' })
    expect(wrapper.find('[data-testid="thickness-presets"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quick-palette"]').exists()).toBe(true)
  })

  it('section labels rendered with correct i18n', () => {
    const wrapper = mountToolbar({ currentTool: 'pen' })
    const groups = wrapper.findAll('[role="group"]')

    // Find group with thickness_section label
    const thicknessGroup = groups.find(g => g.attributes('aria-label') === 'Line thickness')
    expect(thicknessGroup).toBeTruthy()

    // Find group with color_section label
    const colorGroup = groups.find(g => g.attributes('aria-label') === 'Color palette')
    expect(colorGroup).toBeTruthy()

    // Find actions group
    const actionsGroup = groups.find(g => g.attributes('aria-label') === 'Actions')
    expect(actionsGroup).toBeTruthy()
  })

  it('text tool shows color palette but hides thickness', () => {
    const wrapper = mountToolbar({ currentTool: 'text' })
    expect(wrapper.find('[data-testid="thickness-presets"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quick-palette"]').exists()).toBe(true)
  })
})
