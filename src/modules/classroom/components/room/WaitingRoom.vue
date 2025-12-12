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
        <button 
          v-if="userRole === 'host'"
          class="btn btn-primary btn-large"
          @click="$emit('ready')"
        >
          <Play class="w-5 h-5 mr-2" />
          Почати урок
        </button>

        <button class="btn btn-secondary" @click="$emit('leave')">
          <LogOut class="w-5 h-5 mr-2" />
          Вийти
        </button>
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
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
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
  color: var(--color-text-secondary, #9ca3af);
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
  color: var(--color-text-secondary, #9ca3af);
}

.waiting-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  margin-bottom: 48px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  min-width: 200px;
}

.btn-large {
  padding: 16px 32px;
  font-size: 1.125rem;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
}

.btn-secondary {
  background: transparent;
  color: var(--color-text-secondary, #9ca3af);
  border: 1px solid var(--color-border, #374151);
}

.btn-secondary:hover {
  background: var(--color-bg-secondary, #374151);
}

.waiting-tips {
  text-align: left;
  padding: 24px;
  background: var(--color-bg-secondary, #374151);
  border-radius: 12px;
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
  color: var(--color-text-secondary, #9ca3af);
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
