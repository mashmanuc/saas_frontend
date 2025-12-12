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
// F1: ClassroomButton - Entry point to classroom
import { computed } from 'vue'
import { Video, Clock, CheckCircle, Loader2, XCircle } from 'lucide-vue-next'
import { useClassroomEntry } from '@/modules/classroom/composables/useClassroomEntry'

interface Props {
  bookingId: number
  sessionId?: string
  sessionStatus: 'scheduled' | 'waiting' | 'active' | 'paused' | 'completed' | 'terminated'
  userRole: 'tutor' | 'student'
  scheduledStart?: string
}

const props = defineProps<Props>()
const { getJwtAndNavigate, isLoading, canJoinSession } = useClassroomEntry()

const joinCheck = computed(() => {
  return canJoinSession(props.sessionStatus, props.scheduledStart)
})

const canJoin = computed(() => {
  if (!props.sessionId) return false
  return joinCheck.value.canJoin
})

const buttonText = computed(() => {
  if (isLoading.value) return 'Підключення...'

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
  if (isLoading.value) return Loader2
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
  isLoading.value && 'animate-pulse',
])

async function handleClick() {
  if (!canJoin.value || !props.sessionId) return
  await getJwtAndNavigate(props.sessionId)
}
</script>

<style scoped>
.classroom-button {
  min-width: 180px;
}

.classroom-button:disabled {
  opacity: 0.7;
}

.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
