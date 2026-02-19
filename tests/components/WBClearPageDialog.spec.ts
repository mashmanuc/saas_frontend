/**
 * [WB5-B8] Unit tests — WBClearPageDialog + Toolbar clear-page button
 * Ref: TASK_BOARD_V5.md B8
 *
 * Tests:
 * 1. Dialog renders when visible=true
 * 2. Dialog hidden when visible=false
 * 3. Title and message displayed
 * 4. Locked note shown when lockedCount > 0
 * 5. Locked note hidden when lockedCount = 0
 * 6. Confirm button emits 'confirm'
 * 7. Cancel button emits 'cancel'
 * 8. Escape key emits 'cancel'
 * 9. Backdrop click emits 'cancel'
 * 10. Danger button styling
 * 11. i18n keys render correctly
 * 12. role="alertdialog" and aria-modal
 * 13. Toolbar: clear-page button rendered
 * 14. Toolbar: clear-page button disabled when canClearPage=false
 * 15. Toolbar: clear-page button emits 'clear-page-request'
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBClearPageDialog from '@/modules/winterboard/components/dialogs/WBClearPageDialog.vue'
import WBToolbar from '@/modules/winterboard/components/toolbar/WBToolbar.vue'

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
        message: 'All strokes and objects on this page will be removed. You can undo this action.',
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

// ─── Dialog Helper ──────────────────────────────────────────────────────────

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(WBClearPageDialog, {
    props: {
      visible: true,
      lockedCount: 0,
      ...props,
    },
    global: {
      plugins: [i18n],
      stubs: {
        Teleport: true,
      },
    },
  })
}

// ─── Toolbar Helper ─────────────────────────────────────────────────────────

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

// ─── WBClearPageDialog Tests ────────────────────────────────────────────────

describe('WBClearPageDialog (B8)', () => {
  it('renders when visible=true', () => {
    const wrapper = mountDialog({ visible: true })
    expect(wrapper.find('.wb-dialog').exists()).toBe(true)
  })

  it('hidden when visible=false', () => {
    const wrapper = mountDialog({ visible: false })
    expect(wrapper.find('.wb-dialog').exists()).toBe(false)
  })

  it('title and message displayed', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('.wb-dialog__title').text()).toBe('Clear page?')
    expect(wrapper.find('.wb-dialog__message').text()).toContain('All strokes and objects')
  })

  it('locked note shown when lockedCount > 0', () => {
    const wrapper = mountDialog({ lockedCount: 3 })
    const note = wrapper.find('.wb-dialog__note')
    expect(note.exists()).toBe(true)
    expect(note.text()).toContain('3')
  })

  it('locked note hidden when lockedCount = 0', () => {
    const wrapper = mountDialog({ lockedCount: 0 })
    expect(wrapper.find('.wb-dialog__note').exists()).toBe(false)
  })

  it('confirm button emits confirm', async () => {
    const wrapper = mountDialog()
    const confirmBtn = wrapper.find('.wb-dialog__btn--danger')
    expect(confirmBtn.exists()).toBe(true)
    await confirmBtn.trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('cancel button emits cancel', async () => {
    const wrapper = mountDialog()
    const cancelBtn = wrapper.find('.wb-dialog__btn--secondary')
    expect(cancelBtn.exists()).toBe(true)
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('escape key emits cancel', async () => {
    const wrapper = mountDialog()
    const overlay = wrapper.find('.wb-dialog-overlay')
    await overlay.trigger('keydown.escape')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('backdrop click emits cancel', async () => {
    const wrapper = mountDialog()
    const overlay = wrapper.find('.wb-dialog-overlay')
    await overlay.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('danger button styling', () => {
    const wrapper = mountDialog()
    const dangerBtn = wrapper.find('.wb-dialog__btn--danger')
    expect(dangerBtn.exists()).toBe(true)
    expect(dangerBtn.text()).toBe('Clear page')
  })

  it('i18n keys render correctly', () => {
    const wrapper = mountDialog({ lockedCount: 2 })
    const text = wrapper.text()
    expect(text).toContain('Clear page?')
    expect(text).toContain('Cancel')
    expect(text).toContain('Clear page')
  })

  it('role="alertdialog" and aria-modal', () => {
    const wrapper = mountDialog()
    const dialog = wrapper.find('.wb-dialog')
    expect(dialog.attributes('role')).toBe('alertdialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
  })

  it('warning icon displayed', () => {
    const wrapper = mountDialog()
    const icon = wrapper.find('.wb-dialog__icon svg')
    expect(icon.exists()).toBe(true)
  })
})

// ─── Toolbar Clear Page Button Tests ────────────────────────────────────────

describe('WBToolbar Clear Page Button (B8)', () => {
  it('clear-page button rendered', () => {
    const wrapper = mountToolbar()
    const btn = wrapper.find('[aria-label="Clear page"]')
    expect(btn.exists()).toBe(true)
  })

  it('clear-page button disabled when canClearPage=false', () => {
    const wrapper = mountToolbar({ canClearPage: false })
    const btn = wrapper.find('[aria-label="Clear page"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('clear-page button emits clear-page-request', async () => {
    const wrapper = mountToolbar({ canClearPage: true })
    const btn = wrapper.find('[aria-label="Clear page"]')
    await btn.trigger('click')
    expect(wrapper.emitted('clear-page-request')).toBeTruthy()
  })
})
