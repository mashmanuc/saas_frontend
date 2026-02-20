<template>
  <div class="waiting-room">
    <div class="waiting-content">
      <div class="waiting-icon">
        <Clock class="w-20 h-20 text-blue-500 animate-pulse" />
      </div>

      <h1 class="waiting-title">
        {{ userRole === 'host' ? 'Готові почати?' : 'Очікуємо тьютора' }}
      </h1>

      <p class="waiting-message">
        {{ userRole === 'host' 
          ? 'Натисніть кнопку нижче, щоб почати урок'
          : 'Тьютор скоро приєднається до уроку'
        }}
      </p>

      <!-- Session Info -->
      <div v-if="session" class="session-info">
        <div class="info-item">
          <Calendar class="w-5 h-5" />
          <span>{{ formatDate(session.scheduled_start) }}</span>
        </div>
        <div class="info-item">
          <Clock class="w-5 h-5" />
          <span>{{ formatTime(session.scheduled_start) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="waiting-actions">
        <Button 
          v-if="userRole === 'host'"
          variant="primary"
          size="lg"
          @click="$emit('ready')"
        >
          <template #iconLeft><Play class="w-5 h-5" /></template>
          Почати урок
        </Button>

        <Button variant="outline" @click="$emit('leave')">
          <template #iconLeft><LogOut class="w-5 h-5" /></template>
          Вийти
        </Button>
      </div>

      <!-- Tips -->
      <div class="waiting-tips">
        <h3>Поки чекаєте:</h3>
        <ul>
          <li>Перевірте камеру та мікрофон</li>
          <li>Переконайтеся в стабільному інтернет-з'єднанні</li>
          <li>Підготуйте необхідні матеріали</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Clock, Calendar, Play, LogOut } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import type { ClassroomSession } from '../../api/classroom'

interface Props {
  session: ClassroomSession | null
  userRole: 'host' | 'student'
}

defineProps<Props>()

defineEmits<{
  (e: 'ready'): void
  (e: 'leave'): void
}>()

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.waiting-room {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--bg-tertiary, #1f2937) 0%, var(--bg-primary, #111827) 100%);
  padding: 24px;
}

.waiting-content {
  text-align: center;
  max-width: 500px;
}

.waiting-icon {
  margin-bottom: 32px;
}

.waiting-title {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin: 0 0 16px;
}

.waiting-message {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin: 0 0 32px;
}

.session-info {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 32px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.waiting-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  margin-bottom: 48px;
}

.waiting-tips {
  text-align: left;
  padding: 24px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
}

.waiting-tips h3 {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin: 0 0 12px;
}

.waiting-tips ul {
  margin: 0;
  padding-left: 20px;
}

.waiting-tips li {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 8px;
}

.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
