<template>
  <button
    :class="buttonClasses"
    :disabled="!canJoin"
    @click="handleClick"
  >
    <component :is="icon" class="w-5 h-5 mr-2" />
    {{ buttonText }}
  </button>
</template>

<script setup lang="ts">
// [LEGACY→WB] ClassroomButton — кнопка входу в урок.
// useClassroomEntry видалено разом з modules/classroom/.
// Навігація тепер веде на winterboard-sessions.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Video, Clock, CheckCircle, XCircle } from 'lucide-vue-next'

interface Props {
  bookingId: number
  sessionId?: string
  sessionStatus: 'scheduled' | 'waiting' | 'active' | 'paused' | 'completed' | 'terminated'
  userRole: 'tutor' | 'student'
  scheduledStart?: string
}

const props = defineProps<Props>()
const router = useRouter()

const canJoin = computed(() => {
  if (!props.sessionId) return false
  return ['scheduled', 'waiting', 'active', 'paused'].includes(props.sessionStatus)
})

const buttonText = computed(() => {
  switch (props.sessionStatus) {
    case 'scheduled':
      return props.userRole === 'tutor' ? 'Почати урок' : 'Очікуємо тьютора'
    case 'waiting':
      return props.userRole === 'tutor' ? 'Почати урок' : 'Приєднатися'
    case 'active':
      return 'Увійти в урок'
    case 'completed':
      return 'Урок завершено'
    case 'terminated':
      return 'Урок скасовано'
    default:
      return 'Урок'
  }
})

const icon = computed(() => {
  if (props.sessionStatus === 'completed') return CheckCircle
  if (props.sessionStatus === 'terminated') return XCircle
  if (props.sessionStatus === 'waiting' || props.sessionStatus === 'scheduled') return Clock
  return Video
})

const buttonClasses = computed(() => [
  'classroom-button',
  'flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all',
  canJoin.value
    ? 'bg-primary-600 text-white hover:bg-primary-700 cursor-pointer'
    : 'bg-gray-200 text-gray-500 cursor-not-allowed',
])

function handleClick() {
  if (!canJoin.value) return
  // [LEGACY→WB] modules/classroom видалено — перенаправляємо на список winterboard
  router.push({ name: 'winterboard-sessions' })
}
</script>

<style scoped>
.classroom-button {
  min-width: 180px;
}

.classroom-button:disabled {
  opacity: 0.7;
}
</style>
