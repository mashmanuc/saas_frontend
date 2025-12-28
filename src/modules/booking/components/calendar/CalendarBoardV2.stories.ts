import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import CalendarBoardV2 from './CalendarBoardV2.vue'
import type { CalendarEvent } from '@/modules/booking/types/calendarV055'

const meta: Meta<typeof CalendarBoardV2> = {
  title: 'Calendar/CalendarBoardV2',
  component: CalendarBoardV2,
  tags: ['autodocs'],
  argTypes: {
    isDragEnabled: {
      control: 'boolean',
      description: 'Enable drag & drop functionality'
    }
  }
}

export default meta
type Story = StoryObj<typeof CalendarBoardV2>

// Mock events
const mockEvents: CalendarEvent[] = [
  {
    id: 1,
    start: '2025-12-24T10:00:00+02:00',
    end: '2025-12-24T11:00:00+02:00',
    status: 'scheduled',
    is_first: true,
    student: { id: 1, name: 'Іван Петренко' },
    lesson_link: 'https://zoom.us/j/123',
    can_reschedule: true,
    can_mark_no_show: false
  },
  {
    id: 2,
    start: '2025-12-24T14:00:00+02:00',
    end: '2025-12-24T15:30:00+02:00',
    status: 'scheduled',
    is_first: false,
    student: { id: 2, name: 'Марія Коваленко' },
    lesson_link: 'https://zoom.us/j/456',
    can_reschedule: true,
    can_mark_no_show: false
  },
  {
    id: 3,
    start: '2025-12-24T16:00:00+02:00',
    end: '2025-12-24T17:00:00+02:00',
    status: 'no_show',
    is_first: false,
    student: { id: 3, name: 'Олександр Шевченко' },
    lesson_link: 'https://zoom.us/j/789',
    can_reschedule: false,
    can_mark_no_show: false
  }
]

export const Default: Story = {
  args: {
    isDragEnabled: false
  },
  render: (args) => ({
    components: { CalendarBoardV2 },
    setup() {
      return { args }
    },
    template: '<CalendarBoardV2 v-bind="args" />'
  })
}

export const WithDragEnabled: Story = {
  args: {
    isDragEnabled: true
  },
  render: (args) => ({
    components: { CalendarBoardV2 },
    setup() {
      return { args }
    },
    template: '<CalendarBoardV2 v-bind="args" />'
  })
}

export const WithEvents: Story = {
  args: {
    isDragEnabled: false
  },
  render: (args) => ({
    components: { CalendarBoardV2 },
    setup() {
      const handleEventClick = (event: CalendarEvent) => {
        console.log('Event clicked:', event)
      }
      
      return { args, handleEventClick }
    },
    template: '<CalendarBoardV2 v-bind="args" @event-click="handleEventClick" />'
  })
}

export const Interactive: Story = {
  args: {
    isDragEnabled: true
  },
  render: (args) => ({
    components: { CalendarBoardV2 },
    setup() {
      const handleEventClick = (event: CalendarEvent) => {
        alert(`Clicked: ${event.student.name} at ${event.start}`)
      }
      
      const handleDragComplete = (eventId: number, newStart: string, newEnd: string) => {
        console.log('Drag complete:', { eventId, newStart, newEnd })
      }
      
      return { args, handleEventClick, handleDragComplete }
    },
    template: `
      <CalendarBoardV2 
        v-bind="args" 
        @event-click="handleEventClick"
        @drag-complete="handleDragComplete"
      />
    `
  })
}
