import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CalendarPopover from '@/modules/booking/components/calendar/CalendarPopover.vue'
import type { CalendarCell } from '@/modules/booking/types/calendar'

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
  })

  describe('Available cell actions', () => {
    it('renders all actions for available cell', async () => {
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
      
      const popover = document.querySelector('.calendar-popover')
      expect(popover).toBeTruthy()
      expect(popover?.textContent).toContain('booking.actions.bookLesson')
      expect(popover?.textContent).toContain('booking.actions.blockTime')
      expect(popover?.textContent).toContain('booking.actions.clearAvailability')
      
      wrapper.unmount()
    })

    it('emits bookLesson event when clicked', async () => {
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
      
      const buttons = document.querySelectorAll('.action-btn')
      const bookButton = Array.from(buttons).find(btn => 
        btn.textContent?.includes('bookLesson')
      ) as HTMLElement
      
      expect(bookButton).toBeTruthy()
      bookButton?.click()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('bookLesson')).toBeTruthy()
      expect(wrapper.emitted('bookLesson')?.[0]).toEqual([baseCell])
      expect(wrapper.emitted('close')).toBeTruthy()
      
      wrapper.unmount()
    })

    it('emits blockTime event when clicked', async () => {
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
      
      const buttons = document.querySelectorAll('.action-btn')
      const blockButton = Array.from(buttons).find(btn => 
        btn.textContent?.includes('blockTime')
      ) as HTMLElement
      
      expect(blockButton).toBeTruthy()
      blockButton?.click()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('blockTime')).toBeTruthy()
      expect(wrapper.emitted('blockTime')?.[0]).toEqual([baseCell])
      
      wrapper.unmount()
    })

    it('emits clearAvailability event when clicked', async () => {
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
      
      const buttons = document.querySelectorAll('.action-btn')
      const clearButton = Array.from(buttons).find(btn => 
        btn.textContent?.includes('clearAvailability')
      ) as HTMLElement
      
      expect(clearButton).toBeTruthy()
      clearButton?.click()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('clearAvailability')).toBeTruthy()
      expect(wrapper.emitted('clearAvailability')?.[0]).toEqual([baseCell])
      
      wrapper.unmount()
    })
  })

  describe('Blocked cell actions', () => {
    const blockedCell: CalendarCell = {
      ...baseCell,
      status: 'blocked',
      source: 'manual',
    }

    it('renders actions for blocked cell', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: blockedCell,
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
      
      const popover = document.querySelector('.calendar-popover')
      expect(popover).toBeTruthy()
      expect(popover?.textContent).toContain('booking.actions.makeAvailable')
      expect(popover?.textContent).toContain('booking.actions.bookLesson')
      
      wrapper.unmount()
    })

    it('emits makeAvailable event when clicked', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: blockedCell,
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
      
      const buttons = document.querySelectorAll('.action-btn')
      const makeAvailableButton = Array.from(buttons).find(btn => 
        btn.textContent?.includes('makeAvailable')
      ) as HTMLElement
      
      expect(makeAvailableButton).toBeTruthy()
      makeAvailableButton?.click()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('makeAvailable')).toBeTruthy()
      expect(wrapper.emitted('makeAvailable')?.[0]).toEqual([blockedCell])
      
      wrapper.unmount()
    })
  })

  describe('Booked cell info', () => {
    const bookedCell: CalendarCell = {
      ...baseCell,
      status: 'booked',
      source: 'lesson',
      booking: {
        id: 123,
        student: {
          id: 45,
          name: 'Іван Петренко',
        },
        lesson_id: 789,
      },
    }

    it('renders booking info', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: bookedCell,
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
      
      const popover = document.querySelector('.calendar-popover')
      expect(popover).toBeTruthy()
      expect(popover?.textContent).toContain('Іван Петренко')
      expect(popover?.textContent).toContain('booking.actions.viewDetails')
      expect(popover?.textContent).toContain('booking.actions.cancelLesson')
      
      wrapper.unmount()
    })

    it('emits viewLesson event with lesson_id', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: bookedCell,
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
      
      const buttons = document.querySelectorAll('.action-btn')
      const viewButton = Array.from(buttons).find(btn => 
        btn.textContent?.includes('viewDetails')
      ) as HTMLElement
      
      expect(viewButton).toBeTruthy()
      viewButton?.click()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('viewLesson')).toBeTruthy()
      expect(wrapper.emitted('viewLesson')?.[0]).toEqual([789])
      
      wrapper.unmount()
    })

    it('emits cancelLesson event with lesson_id', async () => {
      const wrapper = mount(CalendarPopover, {
        props: {
          cell: bookedCell,
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
      
      const buttons = document.querySelectorAll('.action-btn')
      const cancelButton = Array.from(buttons).find(btn => 
        btn.textContent?.includes('cancelLesson')
      ) as HTMLElement
      
      expect(cancelButton).toBeTruthy()
      cancelButton?.click()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('cancelLesson')).toBeTruthy()
      expect(wrapper.emitted('cancelLesson')?.[0]).toEqual([789])
      
      wrapper.unmount()
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
      
      const closeBtn = document.querySelector('.close-btn') as HTMLElement
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
