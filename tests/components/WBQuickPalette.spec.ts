/**
 * [WB5-B2] Unit tests — WBQuickPalette
 * Ref: TASK_BOARD_V5.md B2
 *
 * Tests:
 * 1. Renders 8 pen colors when tool=pen
 * 2. Renders 6 highlighter colors when tool=highlighter
 * 3. Hides palette when tool=eraser
 * 4. Hides palette when tool=select
 * 5. Click color → emits update:modelValue
 * 6. Active color has active class
 * 7. Last used color saved to localStorage
 * 8. Last used color restored from localStorage on tool switch
 * 9. Arrow key navigation works
 * 10. White color has visible border class
 * 11. All pen colors have correct aria-labels
 * 12. radiogroup has correct aria-label
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBQuickPalette from '@/modules/winterboard/components/toolbar/WBQuickPalette.vue'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      toolbar: {
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
    },
  },
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages,
})

// ─── localStorage mock ──────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// ─── Helper ─────────────────────────────────────────────────────────────────

function mountPalette(props: Partial<{ modelValue: string; currentTool: string }> = {}) {
  return mount(WBQuickPalette, {
    props: {
      modelValue: '#1e293b',
      currentTool: 'pen',
      ...props,
    } as any,
    global: {
      plugins: [i18n],
    },
  })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WBQuickPalette', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('renders 8 pen colors when tool=pen', () => {
    const wrapper = mountPalette({ currentTool: 'pen' })
    const buttons = wrapper.findAll('[role="radio"]')
    expect(buttons).toHaveLength(8)
  })

  it('renders 8 pen colors for line tool', () => {
    const wrapper = mountPalette({ currentTool: 'line' })
    const buttons = wrapper.findAll('[role="radio"]')
    expect(buttons).toHaveLength(8)
  })

  it('renders 6 highlighter colors when tool=highlighter', () => {
    const wrapper = mountPalette({ currentTool: 'highlighter' })
    const buttons = wrapper.findAll('[role="radio"]')
    expect(buttons).toHaveLength(6)
  })

  it('hides palette when tool=eraser', () => {
    const wrapper = mountPalette({ currentTool: 'eraser' })
    const group = wrapper.find('[role="radiogroup"]')
    expect(group.exists()).toBe(false)
  })

  it('hides palette when tool=select', () => {
    const wrapper = mountPalette({ currentTool: 'select' })
    const group = wrapper.find('[role="radiogroup"]')
    expect(group.exists()).toBe(false)
  })

  it('click color emits update:modelValue', async () => {
    const wrapper = mountPalette({ currentTool: 'pen' })
    const buttons = wrapper.findAll('[role="radio"]')

    // Click red (#dc2626, index 1)
    await buttons[1].trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual(['#dc2626'])
  })

  it('active color has active class', () => {
    const wrapper = mountPalette({ modelValue: '#2563eb', currentTool: 'pen' })
    const buttons = wrapper.findAll('[role="radio"]')

    // Blue (#2563eb) is index 2
    expect(buttons[2].classes()).toContain('wb-quick-palette__btn--active')
    // Others should not
    expect(buttons[0].classes()).not.toContain('wb-quick-palette__btn--active')
    expect(buttons[1].classes()).not.toContain('wb-quick-palette__btn--active')
  })

  it('last used pen color saved to localStorage', async () => {
    const wrapper = mountPalette({ currentTool: 'pen' })
    const buttons = wrapper.findAll('[role="radio"]')

    await buttons[3].trigger('click') // green #16a34a

    expect(localStorageMock.setItem).toHaveBeenCalledWith('wb_last_pen_color', '#16a34a')
  })

  it('last used highlighter color saved to localStorage', async () => {
    const wrapper = mountPalette({ currentTool: 'highlighter', modelValue: '#fde047' })
    const buttons = wrapper.findAll('[role="radio"]')

    await buttons[2].trigger('click') // blue #93c5fd

    expect(localStorageMock.setItem).toHaveBeenCalledWith('wb_last_hl_color', '#93c5fd')
  })

  it('ArrowDown cycles to next color and emits', async () => {
    const wrapper = mountPalette({ modelValue: '#1e293b', currentTool: 'pen' })

    const group = wrapper.find('[role="radiogroup"]')
    await group.trigger('keydown', { key: 'ArrowDown' })

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    // Next after dark(#1e293b, idx 0) is red(#dc2626, idx 1)
    expect(emitted![0]).toEqual(['#dc2626'])
  })

  it('ArrowUp wraps from first to last color', async () => {
    const wrapper = mountPalette({ modelValue: '#1e293b', currentTool: 'pen' })

    const group = wrapper.find('[role="radiogroup"]')
    await group.trigger('keydown', { key: 'ArrowUp' })

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    // Wrap: before dark(idx 0) → white(#ffffff, idx 7)
    expect(emitted![0]).toEqual(['#ffffff'])
  })

  it('white color has visible border class', () => {
    const wrapper = mountPalette({ currentTool: 'pen' })
    const buttons = wrapper.findAll('[role="radio"]')

    // White is last (index 7)
    expect(buttons[7].classes()).toContain('wb-quick-palette__btn--white')
    // Others should not have it
    expect(buttons[0].classes()).not.toContain('wb-quick-palette__btn--white')
  })

  it('all pen colors have correct aria-labels', () => {
    const wrapper = mountPalette({ currentTool: 'pen' })
    const buttons = wrapper.findAll('[role="radio"]')

    expect(buttons[0].attributes('aria-label')).toBe('Dark')
    expect(buttons[1].attributes('aria-label')).toBe('Red')
    expect(buttons[2].attributes('aria-label')).toBe('Blue')
    expect(buttons[3].attributes('aria-label')).toBe('Green')
    expect(buttons[4].attributes('aria-label')).toBe('Purple')
    expect(buttons[5].attributes('aria-label')).toBe('Orange')
    expect(buttons[6].attributes('aria-label')).toBe('Teal')
    expect(buttons[7].attributes('aria-label')).toBe('White')
  })

  it('radiogroup has correct aria-label', () => {
    const wrapper = mountPalette({ currentTool: 'pen' })
    const group = wrapper.find('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBe('Color')
  })

  it('Home key jumps to first color, End to last', async () => {
    const wrapper = mountPalette({ modelValue: '#16a34a', currentTool: 'pen' }) // green, idx 3

    const group = wrapper.find('[role="radiogroup"]')

    await group.trigger('keydown', { key: 'Home' })
    let emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual(['#1e293b']) // dark (first)

    await group.trigger('keydown', { key: 'End' })
    expect(emitted![1]).toEqual(['#ffffff']) // white (last)
  })

  it('highlighter colors have hl class', () => {
    const wrapper = mountPalette({ currentTool: 'highlighter', modelValue: '#fde047' })
    const buttons = wrapper.findAll('[role="radio"]')

    for (const btn of buttons) {
      expect(btn.classes()).toContain('wb-quick-palette__btn--hl')
    }
  })
})
