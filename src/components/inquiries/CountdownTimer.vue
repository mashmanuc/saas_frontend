<template>
  <div v-if="timeRemaining" class="countdown-timer">
    <span class="countdown-label">{{ $t('inquiries.countdown.expiresIn') }}:</span>
    <span class="countdown-value">{{ formattedTime }}</span>
  </div>
  <div v-else class="countdown-expired">
    {{ $t('inquiries.countdown.expired') }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  expiresAt: string
}>()

const { t } = useI18n()
const now = ref(Date.now())
let intervalId: number | null = null

const timeRemaining = computed(() => {
  const expiresTime = new Date(props.expiresAt).getTime()
  const diff = expiresTime - now.value
  return diff > 0 ? diff : 0
})

const formattedTime = computed(() => {
  const ms = timeRemaining.value
  if (ms === 0) return ''
  
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  
  const parts: string[] = []
  if (days > 0) parts.push(t('inquiries.countdown.days', { count: days }))
  if (hours > 0) parts.push(t('inquiries.countdown.hours', { count: hours }))
  if (minutes > 0 || parts.length === 0) parts.push(t('inquiries.countdown.minutes', { count: minutes }))
  
  return parts.join(' ')
})

onMounted(() => {
  intervalId = window.setInterval(() => {
    now.value = Date.now()
  }, 60000)
})

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId)
  }
})
</script>

<style scoped>
.countdown-timer {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #6B7280;
}

.countdown-label {
  font-weight: 500;
}

.countdown-value {
  color: #F59E0B;
  font-weight: 600;
}

.countdown-expired {
  font-size: 13px;
  color: #DC2626;
  font-weight: 500;
}
</style>
