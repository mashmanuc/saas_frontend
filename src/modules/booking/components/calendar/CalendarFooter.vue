<template>
  <div class="calendar-footer">
    <div class="footer-content">
      <div class="footer-label">
        <svg class="icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm5-6h4c2.76 0 5 2.24 5 5s-2.24 5-5 5h-4v-1.9h4c1.71 0 3.1-1.39 3.1-3.1 0-1.71-1.39-3.1-3.1-3.1h-4V7z"/>
        </svg>
        {{ t('calendar.footer.your_lesson_link') }}
      </div>
      <div class="footer-link-container">
        <input 
          ref="linkInput"
          :value="lessonLink" 
          readonly 
          class="link-input"
          @focus="(e) => (e.target as HTMLInputElement).select()"
        />
        <button class="copy-btn" @click="copyLink">
          <svg v-if="!copied" class="icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <svg v-else class="icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          {{ copied ? t('calendar.footer.copied') : t('calendar.footer.copy') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  lessonLink: string
}>()

const { t } = useI18n()
const copied = ref(false)
const linkInput = ref<HTMLInputElement | null>(null)

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(props.lessonLink)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
    // Fallback for older browsers
    if (linkInput.value) {
      linkInput.value.select()
      document.execCommand('copy')
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    }
  }
}
</script>

<style scoped>
.calendar-footer {
  padding: 16px 24px;
  background: #f5f7fa;
  border-radius: 0 0 8px 8px;
  border-top: 1px solid #e0e0e0;
}

.footer-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

.icon {
  color: #1976D2;
  flex-shrink: 0;
}

.footer-link-container {
  display: flex;
  gap: 12px;
  align-items: center;
}

.link-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  color: #333;
  font-family: monospace;
}

.link-input:focus {
  outline: none;
  border-color: #1976D2;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #1976D2;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.copy-btn:hover {
  background: #1565C0;
}

.copy-btn .icon {
  color: white;
}

@media (max-width: 768px) {
  .footer-link-container {
    flex-direction: column;
  }
  
  .copy-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
