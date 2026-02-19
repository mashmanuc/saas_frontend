/**
 * [WB5-B5] Unit tests — Laser Pointer UI (WBLaserDot + WBIconLaser + toolbar integration)
 * Ref: TASK_BOARD_V5.md B5
 *
 * Tests:
 * 1. WBLaserDot renders when active=true
 * 2. WBLaserDot hidden when active=false
 * 3. WBLaserDot shows displayName for remote laser
 * 4. WBLaserDot hides displayName for local laser
 * 5. WBLaserDot applies custom color
 * 6. WBLaserDot fading class applied
 * 7. WBLaserDot has aria-hidden (decorative)
 * 8. WBLaserDot position style
 * 9. WBIconLaser renders SVG
 * 10. Toolbar: laser button rendered
 * 11. Toolbar: laser button emits tool-change='laser'
 * 12. Toolbar: thickness hidden when tool=laser
 * 13. Toolbar: color palette hidden when tool=laser
 * 14. Toolbar: laser tooltip includes hint
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBLaserDot from '@/modules/winterboard/components/canvas/WBLaserDot.vue'
import WBIconLaser from '@/modules/winterboard/components/toolbar/icons/WBIconLaser.vue'
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

function mountLaserDot(props: Record<string, unknown> = {}) {
  return mount(WBLaserDot, {
    props: {
      x: 100,
      y: 200,
      active: true,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

function mountToolbar(props: Record<string, unknown> = {}) {
  return mount(WBToolbar, {
    props: {
      currentTool: 'laser',
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

// ─── WBLaserDot Tests ───────────────────────────────────────────────────────

describe('WBLaserDot', () => {
  it('renders when active=true', () => {
    const wrapper = mountLaserDot({ active: true })
    expect(wrapper.find('.wb-laser-dot').exists()).toBe(true)
  })

  it('hidden when active=false', () => {
    const wrapper = mountLaserDot({ active: false })
    expect(wrapper.find('.wb-laser-dot').exists()).toBe(false)
  })

  it('shows displayName for remote laser', () => {
    const wrapper = mountLaserDot({
      isLocal: false,
      displayName: 'Teacher',
    })
    const label = wrapper.find('.wb-laser-dot__label')
    expect(label.exists()).toBe(true)
    expect(label.text()).toBe('Teacher')
  })

  it('hides displayName for local laser', () => {
    const wrapper = mountLaserDot({
      isLocal: true,
      displayName: 'Me',
    })
    expect(wrapper.find('.wb-laser-dot__label').exists()).toBe(false)
  })

  it('applies custom color', () => {
    const wrapper = mountLaserDot({ color: '#3b82f6' })
    const dot = wrapper.find('.wb-laser-dot')
    const style = dot.attributes('style') || ''
    expect(style).toContain('background-color: #3b82f6')
    expect(style).toContain('box-shadow')
  })

  it('fading class applied when isFading=true', () => {
    const wrapper = mountLaserDot({ isFading: true })
    expect(wrapper.find('.wb-laser-dot--fading').exists()).toBe(true)
  })

  it('has aria-hidden for accessibility (decorative)', () => {
    const wrapper = mountLaserDot()
    const dot = wrapper.find('.wb-laser-dot')
    expect(dot.attributes('aria-hidden')).toBe('true')
  })

  it('has correct position style', () => {
    const wrapper = mountLaserDot({ x: 150, y: 300 })
    const dot = wrapper.find('.wb-laser-dot')
    const style = dot.attributes('style') || ''
    expect(style).toContain('left: 150px')
    expect(style).toContain('top: 300px')
  })

  it('local class applied for local laser', () => {
    const wrapper = mountLaserDot({ isLocal: true })
    expect(wrapper.find('.wb-laser-dot--local').exists()).toBe(true)
    expect(wrapper.find('.wb-laser-dot--remote').exists()).toBe(false)
  })

  it('remote class applied for remote laser', () => {
    const wrapper = mountLaserDot({ isLocal: false })
    expect(wrapper.find('.wb-laser-dot--remote').exists()).toBe(true)
    expect(wrapper.find('.wb-laser-dot--local').exists()).toBe(false)
  })
})

// ─── WBIconLaser Tests ──────────────────────────────────────────────────────

describe('WBIconLaser', () => {
  it('renders SVG element', () => {
    const wrapper = mount(WBIconLaser)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('has correct viewBox', () => {
    const wrapper = mount(WBIconLaser)
    expect(wrapper.find('svg').attributes('viewBox')).toBe('0 0 20 20')
  })

  it('contains center circle and rays', () => {
    const wrapper = mount(WBIconLaser)
    expect(wrapper.find('circle').exists()).toBe(true)
    expect(wrapper.findAll('line').length).toBe(8)
  })
})

// ─── Toolbar Laser Integration Tests ────────────────────────────────────────

describe('WBToolbar Laser Integration (B5)', () => {
  it('laser button rendered in toolbar', () => {
    const wrapper = mountToolbar({ currentTool: 'pen' })
    const buttons = wrapper.findAll('.wb-toolbar__btn')
    const laserBtn = buttons.find(b => b.attributes('aria-label')?.includes('Laser pointer'))
    expect(laserBtn).toBeTruthy()
  })

  it('laser button emits tool-change with laser', async () => {
    const wrapper = mountToolbar({ currentTool: 'pen' })
    const buttons = wrapper.findAll('.wb-toolbar__btn')
    const laserBtn = buttons.find(b => b.attributes('aria-label')?.includes('Laser pointer'))
    expect(laserBtn).toBeTruthy()
    await laserBtn!.trigger('click')
    expect(wrapper.emitted('tool-change')).toBeTruthy()
    expect(wrapper.emitted('tool-change')![0]).toEqual(['laser'])
  })

  it('laser button has active class when tool=laser', () => {
    const wrapper = mountToolbar({ currentTool: 'laser' })
    const buttons = wrapper.findAll('.wb-toolbar__btn')
    const laserBtn = buttons.find(b => b.attributes('aria-label')?.includes('Laser pointer'))
    expect(laserBtn!.classes()).toContain('wb-toolbar__btn--active')
  })

  it('thickness hidden when tool=laser', () => {
    const wrapper = mountToolbar({ currentTool: 'laser' })
    expect(wrapper.find('[data-testid="thickness-presets"]').exists()).toBe(false)
  })

  it('color palette hidden when tool=laser', () => {
    const wrapper = mountToolbar({ currentTool: 'laser' })
    expect(wrapper.find('[data-testid="quick-palette"]').exists()).toBe(false)
  })

  it('laser tooltip includes hint text', () => {
    const wrapper = mountToolbar({ currentTool: 'pen' })
    const buttons = wrapper.findAll('.wb-toolbar__btn')
    const laserBtn = buttons.find(b => b.attributes('aria-label')?.includes('Laser pointer'))
    const tooltip = laserBtn!.attributes('data-tooltip') || ''
    expect(tooltip).toContain('Hold to point')
  })
})
