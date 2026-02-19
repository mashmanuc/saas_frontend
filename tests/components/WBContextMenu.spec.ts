/**
 * [WB5-B6] Unit tests — WBContextMenu (context menu for selected items)
 * Ref: TASK_BOARD_V5.md B6
 *
 * Tests:
 * 1. Renders when visible=true
 * 2. Hidden when visible=false
 * 3. Positioned at x, y coordinates
 * 4. Group button shown when canGroup=true
 * 5. Group button hidden when canGroup=false
 * 6. Ungroup button shown when canUngroup=true
 * 7. Align section shown when selectedCount >= 2
 * 8. Align section hidden when selectedCount < 2
 * 9. Distribute section shown when selectedCount >= 3
 * 10. Distribute section hidden when selectedCount < 3
 * 11. Duplicate button emits 'duplicate'
 * 12. Lock button emits 'lock'
 * 13. Unlock button emits 'unlock'
 * 14. Delete button emits 'delete' (danger style)
 * 15. Group button emits 'group'
 * 16. Backdrop click emits 'close'
 * 17. Align buttons emit correct events
 * 18. Distribute buttons emit correct events
 * 19. Delete button has danger class
 * 20. i18n keys render correctly
 * 21. WBIconGroup renders SVG
 * 22. WBIconUngroup renders SVG
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBContextMenu from '@/modules/winterboard/components/canvas/WBContextMenu.vue'
import WBIconGroup from '@/modules/winterboard/components/toolbar/icons/WBIconGroup.vue'
import WBIconUngroup from '@/modules/winterboard/components/toolbar/icons/WBIconUngroup.vue'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
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
      lock: {
        lock: 'Lock',
        unlock: 'Unlock',
        locked_label: 'Locked item',
        locked_toast: '{count} item(s) locked',
        unlocked_toast: '{count} item(s) unlocked',
        cannot_modify: 'This item is locked',
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

function mountMenu(props: Record<string, unknown> = {}) {
  return mount(WBContextMenu, {
    props: {
      visible: true,
      x: 200,
      y: 300,
      selectedCount: 2,
      canGroup: false,
      canUngroup: false,
      canLock: true,
      canUnlock: false,
      canDuplicate: true,
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

// ─── WBContextMenu Tests ────────────────────────────────────────────────────

describe('WBContextMenu (B6)', () => {
  it('renders when visible=true', () => {
    const wrapper = mountMenu({ visible: true })
    expect(wrapper.find('.wb-context-menu').exists()).toBe(true)
  })

  it('hidden when visible=false', () => {
    const wrapper = mountMenu({ visible: false })
    expect(wrapper.find('.wb-context-menu').exists()).toBe(false)
  })

  it('positioned at x, y coordinates', () => {
    const wrapper = mountMenu({ x: 150, y: 250 })
    const menu = wrapper.find('.wb-context-menu')
    const style = menu.attributes('style') || ''
    expect(style).toContain('left: 150px')
    expect(style).toContain('top: 250px')
  })

  it('has role="menu" and aria-label', () => {
    const wrapper = mountMenu()
    const menu = wrapper.find('.wb-context-menu')
    expect(menu.attributes('role')).toBe('menu')
    expect(menu.attributes('aria-label')).toBe('Context menu')
  })

  it('group button shown when canGroup=true', () => {
    const wrapper = mountMenu({ canGroup: true })
    const items = wrapper.findAll('.wb-context-menu__item')
    const groupBtn = items.find(i => i.text().includes('Group') && !i.text().includes('Ungroup'))
    expect(groupBtn).toBeTruthy()
  })

  it('group button hidden when canGroup=false', () => {
    const wrapper = mountMenu({ canGroup: false, canUngroup: false })
    const items = wrapper.findAll('.wb-context-menu__item')
    const groupBtn = items.find(i => i.text().includes('Group') && !i.text().includes('Ungroup'))
    expect(groupBtn).toBeUndefined()
  })

  it('ungroup button shown when canUngroup=true', () => {
    const wrapper = mountMenu({ canUngroup: true })
    const items = wrapper.findAll('.wb-context-menu__item')
    const ungroupBtn = items.find(i => i.text().includes('Ungroup'))
    expect(ungroupBtn).toBeTruthy()
  })

  it('align section shown when selectedCount >= 2', () => {
    const wrapper = mountMenu({ selectedCount: 2 })
    const sublabels = wrapper.findAll('.wb-context-menu__sublabel')
    const alignLabel = sublabels.find(s => s.text() === 'Align')
    expect(alignLabel).toBeTruthy()
    expect(wrapper.findAll('.wb-context-menu__align-btn').length).toBeGreaterThanOrEqual(6)
  })

  it('align section hidden when selectedCount < 2', () => {
    const wrapper = mountMenu({ selectedCount: 1 })
    const sublabels = wrapper.findAll('.wb-context-menu__sublabel')
    const alignLabel = sublabels.find(s => s.text() === 'Align')
    expect(alignLabel).toBeUndefined()
  })

  it('distribute section shown when selectedCount >= 3', () => {
    const wrapper = mountMenu({ selectedCount: 3 })
    const sublabels = wrapper.findAll('.wb-context-menu__sublabel')
    const distLabel = sublabels.find(s => s.text() === 'Distribute')
    expect(distLabel).toBeTruthy()
  })

  it('distribute section hidden when selectedCount < 3', () => {
    const wrapper = mountMenu({ selectedCount: 2 })
    const sublabels = wrapper.findAll('.wb-context-menu__sublabel')
    const distLabel = sublabels.find(s => s.text() === 'Distribute')
    expect(distLabel).toBeUndefined()
  })

  it('duplicate button emits duplicate', async () => {
    const wrapper = mountMenu({ canDuplicate: true })
    const items = wrapper.findAll('.wb-context-menu__item')
    const dupBtn = items.find(i => i.text().includes('Duplicate'))
    expect(dupBtn).toBeTruthy()
    await dupBtn!.trigger('click')
    expect(wrapper.emitted('duplicate')).toBeTruthy()
  })

  it('lock button emits lock', async () => {
    const wrapper = mountMenu({ canLock: true })
    const items = wrapper.findAll('.wb-context-menu__item')
    const lockBtn = items.find(i => i.text().includes('Lock') && !i.text().includes('Unlock'))
    expect(lockBtn).toBeTruthy()
    await lockBtn!.trigger('click')
    expect(wrapper.emitted('lock')).toBeTruthy()
  })

  it('unlock button emits unlock', async () => {
    const wrapper = mountMenu({ canUnlock: true })
    const items = wrapper.findAll('.wb-context-menu__item')
    const unlockBtn = items.find(i => i.text().includes('Unlock'))
    expect(unlockBtn).toBeTruthy()
    await unlockBtn!.trigger('click')
    expect(wrapper.emitted('unlock')).toBeTruthy()
  })

  it('delete button emits delete', async () => {
    const wrapper = mountMenu()
    const deleteBtn = wrapper.find('.wb-context-menu__item--danger')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  it('delete button has danger class', () => {
    const wrapper = mountMenu()
    const deleteBtn = wrapper.find('.wb-context-menu__item--danger')
    expect(deleteBtn.exists()).toBe(true)
    expect(deleteBtn.text()).toContain('Delete')
  })

  it('group button emits group', async () => {
    const wrapper = mountMenu({ canGroup: true })
    const items = wrapper.findAll('.wb-context-menu__item')
    const groupBtn = items.find(i => i.text().includes('Group') && !i.text().includes('Ungroup'))
    await groupBtn!.trigger('click')
    expect(wrapper.emitted('group')).toBeTruthy()
  })

  it('backdrop click emits close', async () => {
    const wrapper = mountMenu({ visible: true })
    const backdrop = wrapper.find('.wb-context-backdrop')
    expect(backdrop.exists()).toBe(true)
    await backdrop.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('align buttons emit correct events', async () => {
    const wrapper = mountMenu({ selectedCount: 2 })
    const alignBtns = wrapper.findAll('.wb-context-menu__align-btn')
    // Should have 6 align buttons
    expect(alignBtns.length).toBe(6)

    await alignBtns[0].trigger('click')
    expect(wrapper.emitted('align-left')).toBeTruthy()

    await alignBtns[1].trigger('click')
    expect(wrapper.emitted('align-center')).toBeTruthy()

    await alignBtns[2].trigger('click')
    expect(wrapper.emitted('align-right')).toBeTruthy()

    await alignBtns[3].trigger('click')
    expect(wrapper.emitted('align-top')).toBeTruthy()

    await alignBtns[4].trigger('click')
    expect(wrapper.emitted('align-middle')).toBeTruthy()

    await alignBtns[5].trigger('click')
    expect(wrapper.emitted('align-bottom')).toBeTruthy()
  })

  it('distribute buttons emit correct events', async () => {
    const wrapper = mountMenu({ selectedCount: 3 })
    // Find distribute grid (2col)
    const distGrid = wrapper.find('.wb-context-menu__align-grid--2col')
    expect(distGrid.exists()).toBe(true)
    const distBtns = distGrid.findAll('.wb-context-menu__align-btn')
    expect(distBtns.length).toBe(2)

    await distBtns[0].trigger('click')
    expect(wrapper.emitted('distribute-horizontal')).toBeTruthy()

    await distBtns[1].trigger('click')
    expect(wrapper.emitted('distribute-vertical')).toBeTruthy()
  })

  it('keyboard shortcuts shown as kbd elements', () => {
    const wrapper = mountMenu({ canGroup: true, canDuplicate: true })
    const kbds = wrapper.findAll('.wb-context-menu__kbd')
    const texts = kbds.map(k => k.text())
    expect(texts).toContain('Ctrl+G')
    expect(texts).toContain('Ctrl+D')
    expect(texts).toContain('Del')
  })

  it('i18n keys render correctly', () => {
    const wrapper = mountMenu({ selectedCount: 3, canGroup: true, canDuplicate: true, canLock: true })
    const text = wrapper.text()
    expect(text).toContain('Group')
    expect(text).toContain('Align')
    expect(text).toContain('Distribute')
    expect(text).toContain('Duplicate')
    expect(text).toContain('Lock')
    expect(text).toContain('Delete')
  })

  it('lock button hidden when canLock=false', () => {
    const wrapper = mountMenu({ canLock: false, canUnlock: false })
    const items = wrapper.findAll('.wb-context-menu__item')
    const lockBtn = items.find(i => i.text().includes('Lock') && !i.text().includes('Unlock'))
    expect(lockBtn).toBeUndefined()
  })

  it('duplicate button hidden when canDuplicate=false', () => {
    const wrapper = mountMenu({ canDuplicate: false })
    const items = wrapper.findAll('.wb-context-menu__item')
    const dupBtn = items.find(i => i.text().includes('Duplicate'))
    expect(dupBtn).toBeUndefined()
  })
})

// ─── Icon Tests ─────────────────────────────────────────────────────────────

describe('WBIconGroup', () => {
  it('renders SVG', () => {
    const wrapper = mount(WBIconGroup)
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})

describe('WBIconUngroup', () => {
  it('renders SVG', () => {
    const wrapper = mount(WBIconUngroup)
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
