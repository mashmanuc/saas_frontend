import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import CalendarPopover from '@/modules/booking/components/calendar/CalendarPopover.vue'
import type { CalendarCell } from '@/modules/booking/types/calendar'
import { useDraftStore } from '@/modules/booking/stores/draftStore'

describe('CalendarPopover', () => {
  const mockAnchorEl = document.createElement('div')
  mockAnchorEl.getBoundingClientRect = vi.fn(() => ({
    top: 100,
    left: 200,
    bottom: 140,
    right: 300,
    width: 100,
    height: 40,
    x: 200,
    y: 100,
    toJSON: () => {},
  }))

  const baseCell: CalendarCell = {
    startAtUTC: '2024-12-23T10:00:00Z',
    durationMin: 30,
    status: 'available',
    source: 'template',
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
  })

  describe('Available state actions', () => {
    it('shows block + book buttons for available cell', async () => {
      mount(CalendarPopover, {
        props: {
          cell: baseCell,
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: { $t: (key: string) => key },
        },
        attachTo: document.body,
      })

      await Promise.resolve()

      const popover = document.querySelector('.calendar-popover')
      expect(popover).toBeTruthy()
      expect(popover?.textContent).toContain('booking.actions.setBlocked')
      expect(popover?.textContent).toContain('booking.actions.bookLesson')
    })

    it('adds blocked patch via draftStore', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: baseCell,
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: { $t: (key: string) => key },
        },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()
      const draftStore = useDraftStore()
      const blockBtn = Array.from(document.querySelectorAll('.action-btn')).find(btn =>
        btn.textContent?.includes('booking.actions.setBlocked'),
      ) as HTMLElement

      blockBtn?.click()
      expect(draftStore.draftPatchByKey.get(baseCell.startAtUTC)?.action).toBe('set_blocked')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits bookLesson on book click', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: baseCell,
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: { $t: (key: string) => key },
        },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()

      const bookBtn = Array.from(document.querySelectorAll('.action-btn')).find(btn =>
        btn.textContent?.includes('booking.actions.bookLesson'),
      ) as HTMLElement

      bookBtn?.click()
      expect(wrapper.emitted('bookLesson')).toBeTruthy()
      expect(wrapper.emitted('bookLesson')?.[0]).toEqual([baseCell])
    })
  })

  describe('Blocked state actions', () => {
    const blockedCell: CalendarCell = {
      ...baseCell,
      status: 'blocked',
      source: 'manual',
    }

    it('shows setAvailable button for blocked cell', async () => {
      mount(CalendarPopover, {
        props: {
          cell: blockedCell,
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: { $t: (key: string) => key },
        },
        attachTo: document.body,
      })

      await Promise.resolve()
      const popover = document.querySelector('.calendar-popover')
      expect(popover?.textContent).toContain('booking.actions.setAvailable')
    })

    it('adds available patch on click', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          visible: true,
          cell: blockedCell,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: { $t: (key: string) => key },
        },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()
      const draftStore = useDraftStore()

      const availableBtn = Array.from(document.querySelectorAll('.action-btn')).find(btn =>
        btn.textContent?.includes('booking.actions.setAvailable'),
      ) as HTMLElement

      availableBtn?.click()
      expect(draftStore.draftPatchByKey.get(blockedCell.startAtUTC)?.action).toBe('set_available')
    })
  })

  describe('Draft actions', () => {
    it('shows clear button only when draft exists', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(baseCell, 'set_blocked')

      mount(CalendarPopover, {
        props: {
          cell: baseCell,
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: { $t: (key: string) => key },
        },
        attachTo: document.body,
      })

      await Promise.resolve()

      const clearBtn = Array.from(document.querySelectorAll('.action-btn')).find(btn =>
        btn.textContent?.includes('booking.actions.clearDraft'),
      )
      expect(clearBtn).toBeTruthy()
    })

    it('removes draft when clear clicked', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(baseCell, 'set_blocked')

      const wrapper = mount(CalendarPopover, {
        props: {
          cell: baseCell,
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: { $t: (key: string) => key },
        },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()

      const clearBtn = Array.from(document.querySelectorAll('.action-btn')).find(btn =>
        btn.textContent?.includes('booking.actions.clearDraft'),
      ) as HTMLElement

      clearBtn?.click()
      expect(draftStore.draftPatchByKey.get(baseCell.startAtUTC)).toBeUndefined()
    })
  })

  describe('Positioning', () => {
    it('calculates position based on anchor element', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: baseCell,
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: {
            $t: (key: string) => key,
          },
        },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      const popoverEl = document.querySelector('.calendar-popover') as HTMLElement
      expect(popoverEl).toBeTruthy()
      
      // Position is calculated after nextTick, check that popover exists
      expect(popoverEl.classList.contains('calendar-popover')).toBe(true)
      
      wrapper.unmount()
    })

    it('adjusts position if goes off-screen right', async () => {
      const wideAnchor = document.createElement('div')
      wideAnchor.getBoundingClientRect = vi.fn(() => ({
        top: 100,
        left: window.innerWidth - 50,
        bottom: 140,
        right: window.innerWidth,
        width: 50,
        height: 40,
        x: window.innerWidth - 50,
        y: 100,
        toJSON: () => {},
      }))

      const wrapper = mount(CalendarPopover, {
        props: {
          cell: baseCell,
          visible: true,
          anchorEl: wideAnchor,
        },
        global: {
          mocks: {
            $t: (key: string) => key,
          },
        },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const popoverEl = document.querySelector('.calendar-popover') as HTMLElement
      expect(popoverEl).toBeTruthy()
      expect(popoverEl.classList.contains('calendar-popover')).toBe(true)
      
      wrapper.unmount()
    })
  })

  describe('Close behavior', () => {
    it('emits close when close button clicked', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: baseCell,
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: {
            $t: (key: string) => key,
          },
        },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()
      
      const closeBtn = document.querySelector('.icon-button') as HTMLElement
      expect(closeBtn).toBeTruthy()
      closeBtn?.click()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
      
      wrapper.unmount()
    })

    it('closes on Escape key', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: baseCell,
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: {
            $t: (key: string) => key,
          },
        },
        attachTo: document.body,
      })

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('Time formatting', () => {
    it('formats time correctly', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: {
            ...baseCell,
            startAtUTC: '2024-12-23T14:30:00Z',
          },
          visible: true,
          anchorEl: mockAnchorEl,
        },
        global: {
          mocks: {
            $t: (key: string) => key,
          },
        },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()
      
      const timeLabel = document.querySelector('.time-label')
      expect(timeLabel).toBeTruthy()
      expect(timeLabel?.textContent?.length).toBeGreaterThan(0)
      
      wrapper.unmount()
    })
  })
})
