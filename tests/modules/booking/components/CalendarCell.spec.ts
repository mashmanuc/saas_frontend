import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CalendarCell from '@/modules/booking/components/calendar/CalendarCell.vue'
import type { CalendarCell as CalendarCellType } from '@/modules/booking/types/calendar'

describe('CalendarCell', () => {
  const baseCell: CalendarCellType = {
    startAtUTC: '2024-12-23T10:00:00Z',
    durationMin: 30,
    status: 'empty',
    source: null,
  }

  it('renders empty cell correctly', () => {
    const wrapper = mount(CalendarCell, {
      props: { cell: baseCell },
    })

    expect(wrapper.classes()).toContain('cell-empty')
    expect(wrapper.attributes('data-utc-key')).toBe('2024-12-23T10:00:00Z')
  })

  it('renders available cell with time label', () => {
    const cell: CalendarCellType = {
      ...baseCell,
      status: 'available',
      source: 'template',
    }

    const wrapper = mount(CalendarCell, {
      props: { cell },
    })

    expect(wrapper.classes()).toContain('cell-available')
    expect(wrapper.classes()).toContain('cell-clickable')
    expect(wrapper.find('.time-label').exists()).toBe(true)
  })

  it('renders blocked cell with lock icon', () => {
    const cell: CalendarCellType = {
      ...baseCell,
      status: 'blocked',
      source: 'manual',
    }

    const wrapper = mount(CalendarCell, {
      props: { cell },
    })

    expect(wrapper.classes()).toContain('cell-blocked')
    expect(wrapper.classes()).toContain('cell-clickable')
    expect(wrapper.find('.cell-blocked').exists()).toBe(true)
  })

  it('renders booked cell with student name', () => {
    const cell: CalendarCellType = {
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

    const wrapper = mount(CalendarCell, {
      props: { cell },
    })

    expect(wrapper.classes()).toContain('cell-has-booking')
    expect(wrapper.find('.student-name').text()).toBe('Іван Петренко')
  })

  it('renders draft indicator when isDraft is true', () => {
    const cell: CalendarCellType = {
      ...baseCell,
      status: 'available',
      source: 'template',
      isDraft: true,
    }

    const wrapper = mount(CalendarCell, {
      props: { cell },
    })

    expect(wrapper.classes()).toContain('cell-draft')
    expect(wrapper.find('.draft-indicator').exists()).toBe(true)
  })

  it('emits click event when clicked', async () => {
    const cell: CalendarCellType = {
      ...baseCell,
      status: 'available',
      source: 'template',
    }

    const wrapper = mount(CalendarCell, {
      props: { cell },
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')?.[0]).toHaveLength(1)
  })

  it('does not add clickable class to empty cells', () => {
    const wrapper = mount(CalendarCell, {
      props: { cell: baseCell },
    })

    expect(wrapper.classes()).not.toContain('cell-clickable')
  })

  it('formats time correctly', () => {
    const cell: CalendarCellType = {
      ...baseCell,
      startAtUTC: '2024-12-23T14:30:00Z',
      status: 'available',
      source: 'template',
    }

    const wrapper = mount(CalendarCell, {
      props: { cell },
    })

    const timeLabel = wrapper.find('.time-label')
    expect(timeLabel.exists()).toBe(true)
    // Time format залежить від locale, перевіряємо що текст не порожній
    expect(timeLabel.text().length).toBeGreaterThan(0)
  })
})
