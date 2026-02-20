<template>
  <div class="join-picker">
    <Button
      variant="primary"
      :disabled="!hasLinks"
      data-testid="join-lesson-button"
      @click="togglePicker"
    >
      <template #iconLeft>
        <VideoIcon class="w-5 h-5" />
      </template>
      {{ $t('booking.calendar.eventDetails.joinLesson') }}
      <ChevronDownIcon v-if="hasLinks" class="w-4 h-4" />
    </Button>

    <!-- Dropdown Menu -->
    <div
      v-if="showPicker"
      class="picker-dropdown"
      data-testid="join-picker-dropdown"
    >
      <div class="picker-header">
        <p class="picker-title">{{ $t('booking.calendar.joinPicker.title') }}</p>
        <Button
          variant="ghost"
          iconOnly
          size="sm"
          :aria-label="$t('common.close')"
          @click="closePicker"
        >
          <XIcon class="w-4 h-4" />
        </Button>
      </div>

      <div class="picker-options">
        <!-- Primary Link -->
        <button
          v-if="primaryLink"
          @click="handleJoinClick('primary', primaryLink)"
          class="picker-option"
          data-testid="join-primary-link"
        >
          <div class="option-icon">
            <VideoIcon class="w-5 h-5 text-blue-600" />
          </div>
          <div class="option-content">
            <p class="option-label">{{ $t('booking.calendar.joinPicker.primary') }}</p>
            <p class="option-url">{{ formatUrl(primaryLink) }}</p>
          </div>
          <ExternalLinkIcon class="w-4 h-4 text-gray-400" />
        </button>

        <!-- Backup Link -->
        <button
          v-if="backupLink"
          @click="handleJoinClick('backup', backupLink)"
          class="picker-option"
          data-testid="join-backup-link"
        >
          <div class="option-icon">
            <VideoIcon class="w-5 h-5 text-green-600" />
          </div>
          <div class="option-content">
            <p class="option-label">{{ $t('booking.calendar.joinPicker.backup') }}</p>
            <p class="option-url">{{ formatUrl(backupLink) }}</p>
          </div>
          <ExternalLinkIcon class="w-4 h-4 text-gray-400" />
        </button>

        <!-- Platform Room -->
        <button
          v-if="platformLink"
          @click="handleJoinClick('platform', platformLink)"
          class="picker-option"
          data-testid="join-platform-link"
        >
          <div class="option-icon">
            <VideoIcon class="w-5 h-5 text-purple-600" />
          </div>
          <div class="option-content">
            <p class="option-label">{{ $t('booking.calendar.joinPicker.platform') }}</p>
            <p class="option-url">{{ formatUrl(platformLink) }}</p>
          </div>
          <ExternalLinkIcon class="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div class="picker-footer">
        <p class="picker-hint">{{ $t('booking.calendar.joinPicker.hint') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Video as VideoIcon, ChevronDown as ChevronDownIcon, X as XIcon, ExternalLink as ExternalLinkIcon } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import { useTutorLessonLinksStore } from '@/modules/booking/stores/tutorLessonLinksStore'
import api from '@/utils/apiClient'

const props = defineProps<{
  eventId: number
  lessonLink?: string
}>()

const { t } = useI18n()
const linksStore = useTutorLessonLinksStore()

const showPicker = ref(false)

onMounted(() => {
  // Fetch lesson links if not loaded
  if (!linksStore.primary && !linksStore.backup) {
    linksStore.fetchLessonLinks()
  }
})

const primaryLink = computed(() => {
  return linksStore.primary?.url || null
})

const backupLink = computed(() => {
  return linksStore.backup?.url || null
})

const platformLink = computed(() => {
  // Platform room link from event or generated
  return props.lessonLink || null
})

const hasLinks = computed(() => {
  return !!(primaryLink.value || backupLink.value || platformLink.value)
})

function togglePicker() {
  if (!hasLinks.value) return
  showPicker.value = !showPicker.value
}

function closePicker() {
  showPicker.value = false
}

function formatUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname + urlObj.pathname
  } catch {
    return url
  }
}

async function handleJoinClick(channel: 'primary' | 'backup' | 'platform', url: string) {
  // Track telemetry
  try {
    await api.post('/v1/calendar/event/join-click/', {
      eventId: props.eventId,
      channel
    })
    console.info('[JoinLessonPicker] Join click tracked:', { eventId: props.eventId, channel })
  } catch (err) {
    console.warn('[JoinLessonPicker] Failed to track join click:', err)
    // Don't block user from joining
  }

  // Open link in new tab with security
  window.open(url, '_blank', 'noopener,noreferrer')
  
  // Close picker
  closePicker()
}

// Close picker on outside click
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.join-picker')) {
    closePicker()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.join-picker {
  position: relative;
}

.join-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  width: 100%;
  justify-content: center;
}

.join-button:hover:not(:disabled) {
  background: var(--accent-hover, #2563eb);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.join-button:disabled {
  background: var(--text-secondary);
  cursor: not-allowed;
}

.picker-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  z-index: 50;
  overflow: hidden;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.picker-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--bg-secondary);
}

.picker-options {
  display: flex;
  flex-direction: column;
}

.picker-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  transition: background-color 0.2s;
  text-align: left;
  width: 100%;
}

.picker-option:hover {
  background-color: var(--bg-secondary);
}

.option-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.option-content {
  flex: 1;
  min-width: 0;
}

.option-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.option-url {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-footer {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.picker-hint {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}
</style>
