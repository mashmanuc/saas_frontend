import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import LessonCardDrawer from './LessonCardDrawer.vue'
import type { CalendarEvent } from '@/modules/booking/types/calendarV055'

const meta: Meta<typeof LessonCardDrawer> = {
  title: 'Calendar/LessonCardDrawer',
  component: LessonCardDrawer,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof LessonCardDrawer>

const mockLesson: CalendarEvent = {
  id: 1,
  start: '2025-12-24T10:00:00+02:00',
  end: '2025-12-24T11:00:00+02:00',
  status: 'scheduled',
  is_first: true,
  student: { id: 1, name: 'Іван Петренко' },
  lesson_link: 'https://zoom.us/j/123456789',
  can_reschedule: true,
  can_mark_no_show: false
}

const pastLesson: CalendarEvent = {
  id: 2,
  start: '2025-12-20T10:00:00+02:00',
  end: '2025-12-20T11:00:00+02:00',
  status: 'scheduled',
  is_first: false,
  student: { id: 2, name: 'Марія Коваленко' },
  lesson_link: 'https://zoom.us/j/987654321',
  can_reschedule: false,
  can_mark_no_show: true
}

export const FirstLesson: Story = {
  render: () => ({
    components: { LessonCardDrawer },
    setup() {
      const isOpen = ref(true)
      const lesson = ref(mockLesson)
      
      return { isOpen, lesson }
    },
    template: '<LessonCardDrawer v-model="isOpen" :lesson="lesson" />'
  })
}

export const RegularLesson: Story = {
  render: () => ({
    components: { LessonCardDrawer },
    setup() {
      const isOpen = ref(true)
      const lesson = ref({ ...mockLesson, is_first: false })
      
      return { isOpen, lesson }
    },
    template: '<LessonCardDrawer v-model="isOpen" :lesson="lesson" />'
  })
}

export const PastLesson: Story = {
  render: () => ({
    components: { LessonCardDrawer },
    setup() {
      const isOpen = ref(true)
      const lesson = ref(pastLesson)
      
      const handleNoShow = (eventId: number) => {
        console.log('Mark no-show:', eventId)
      }
      
      return { isOpen, lesson, handleNoShow }
    },
    template: '<LessonCardDrawer v-model="isOpen" :lesson="lesson" @mark-no-show="handleNoShow" />'
  })
}

export const NoShowLesson: Story = {
  render: () => ({
    components: { LessonCardDrawer },
    setup() {
      const isOpen = ref(true)
      const lesson = ref({ ...pastLesson, status: 'no_show' })
      
      return { isOpen, lesson }
    },
    template: '<LessonCardDrawer v-model="isOpen" :lesson="lesson" />'
  })
}
