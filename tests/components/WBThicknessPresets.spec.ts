/**
 * [WB5-B1] Unit tests — WBThicknessPresets
 * Ref: TASK_BOARD_V5.md B1
 *
 * Tests:
 * 1. Renders 4 preset buttons
 * 2. Active preset has aria-checked="true"
 * 3. Click emits update:modelValue with correct size
 * 4. Dot style reflects currentColor
 * 5. Arrow key navigation cycles through presets
 * 6. Closest preset highlighted when value doesn't match exactly
 * 7. Home/End keys jump to first/last preset
 * 8. All presets have correct aria-labels
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBThicknessPresets from '@/modules/winterboard/components/toolbar/WBThicknessPresets.vue'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      winterboard: {
        toolbar: {
          thickness: 'Line thickness',
          thickness_thin: 'Thin (1px)',
          thickness_normal: 'Normal (3px)',
          thickness_bold: 'Bold (6px)',
          thickness_marker: 'Marker (12px)',
        },
      },
    },
  },
})

function mountPresets(props: Partial<{ modelValue: number; currentColor: string }> = {}) {
  return mount(WBThicknessPresets, {
    props: {
      modelValue: 3,
      currentColor: '#1e293b',
      ...props,
    },
    global: {
      plugins: [i18n],
    },
  })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WBThicknessPresets', () => {
  it('renders 4 preset buttons', () => {
    const wrapper = mountPresets()
    const buttons = wrapper.findAll('[role="radio"]')
    expect(buttons).toHaveLength(4)
  })

  it('active preset has aria-checked="true"', () => {
    const wrapper = mountPresets({ modelValue: 6 })
    const buttons = wrapper.findAll('[role="radio"]')

    // bold (size=6) is index 2
    expect(buttons[2].attributes('aria-checked')).toBe('true')
    // others are false
    expect(buttons[0].attributes('aria-checked')).toBe('false')
    expect(buttons[1].attributes('aria-checked')).toBe('false')
    expect(buttons[3].attributes('aria-checked')).toBe('false')
  })

  it('click emits update:modelValue with correct size', async () => {
    const wrapper = mountPresets({ modelValue: 3 })
    const buttons = wrapper.findAll('[role="radio"]')

    // Click "marker" (size=12, index 3)
    await buttons[3].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([12])
  })

  it('dot style reflects currentColor', () => {
    const wrapper = mountPresets({ currentColor: '#dc2626' })
    const dots = wrapper.findAll('.wb-thickness-dot')

    for (const dot of dots) {
      const style = dot.attributes('style') ?? ''
      // happy-dom may keep hex or convert to rgb — accept either
      expect(
        style.includes('#dc2626') || style.includes('rgb(220, 38, 38)')
      ).toBe(true)
    }
  })

  it('ArrowRight cycles to next preset and emits', async () => {
    const wrapper = mountPresets({ modelValue: 1 }) // thin, index 0

    const group = wrapper.find('[role="radiogroup"]')
    await group.trigger('keydown', { key: 'ArrowRight' })

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    // Next after thin(1) is normal(3)
    expect(emitted![0]).toEqual([3])
  })

  it('ArrowLeft wraps from first to last preset', async () => {
    const wrapper = mountPresets({ modelValue: 1 }) // thin, index 0

    const group = wrapper.find('[role="radiogroup"]')
    await group.trigger('keydown', { key: 'ArrowLeft' })

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    // Wrap: before thin(0) → marker(12, index 3)
    expect(emitted![0]).toEqual([12])
  })

  it('highlights closest preset when value does not match exactly', () => {
    // modelValue=4 is between normal(3) and bold(6), closest is normal(3)
    const wrapper = mountPresets({ modelValue: 4 })
    const buttons = wrapper.findAll('[role="radio"]')

    // None should have aria-checked="true" since 4 doesn't match any preset
    for (const btn of buttons) {
      expect(btn.attributes('aria-checked')).toBe('false')
    }

    // But the closest (normal, index 1) should have tabindex=0
    expect(buttons[1].attributes('tabindex')).toBe('0')
    // Others should have tabindex=-1
    expect(buttons[0].attributes('tabindex')).toBe('-1')
    expect(buttons[2].attributes('tabindex')).toBe('-1')
    expect(buttons[3].attributes('tabindex')).toBe('-1')
  })

  it('Home key jumps to first preset, End to last', async () => {
    const wrapper = mountPresets({ modelValue: 6 }) // bold, index 2

    const group = wrapper.find('[role="radiogroup"]')

    await group.trigger('keydown', { key: 'Home' })
    let emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([1]) // thin

    await group.trigger('keydown', { key: 'End' })
    expect(emitted![1]).toEqual([12]) // marker
  })

  it('all presets have correct aria-labels', () => {
    const wrapper = mountPresets()
    const buttons = wrapper.findAll('[role="radio"]')

    expect(buttons[0].attributes('aria-label')).toBe('Thin (1px)')
    expect(buttons[1].attributes('aria-label')).toBe('Normal (3px)')
    expect(buttons[2].attributes('aria-label')).toBe('Bold (6px)')
    expect(buttons[3].attributes('aria-label')).toBe('Marker (12px)')
  })

  it('radiogroup has correct aria-label', () => {
    const wrapper = mountPresets()
    const group = wrapper.find('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBe('Line thickness')
  })
})
