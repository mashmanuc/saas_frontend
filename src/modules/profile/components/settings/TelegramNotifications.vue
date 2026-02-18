<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#229ED9]/10">
        <svg class="h-5 w-5 text-[#229ED9]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      </div>
      <div>
        <h4 class="font-medium text-foreground">Telegram-сповіщення</h4>
        <p class="text-sm text-muted-foreground">
          Отримуйте миттєві сповіщення про нові запити від студентів
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-6">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
    </div>

    <!-- State: Connected -->
    <template v-else-if="status?.connected">
      <div class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="font-medium text-green-700 dark:text-green-300">Telegram підключено</span>
        </div>
        <p v-if="status?.connected_at" class="mt-1 text-sm text-green-600 dark:text-green-400">
          Підключено: {{ formatDate(status.connected_at) }}
        </p>
      </div>

      <!-- Toggle -->
      <div class="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p class="font-medium text-foreground">Сповіщення про нові запити</p>
          <p class="text-sm text-muted-foreground">
            Отримувати повідомлення в Telegram при новому запиті від студента
          </p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="status?.enabled"
          :disabled="toggling"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          :class="status?.enabled ? 'bg-primary' : 'bg-surface-muted'"
          @click="handleToggle"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="status?.enabled ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <!-- Disconnect -->
      <div class="flex justify-end">
        <button
          type="button"
          class="text-sm text-destructive hover:underline"
          :disabled="disconnecting"
          @click="handleDisconnect"
        >
          {{ disconnecting ? 'Відключення...' : 'Відключити Telegram' }}
        </button>
      </div>
    </template>

    <!-- State: Not Connected — QR Code -->
    <template v-else>
      <div class="rounded-lg border border-border p-4 space-y-4">
        <p class="text-sm text-muted-foreground">
          Відскануйте QR-код або натисніть кнопку, щоб підключити Telegram-бот для отримання сповіщень.
        </p>

        <!-- QR Code (server-side SVG, same pattern as MFA) -->
        <div v-if="linkData" class="flex flex-col items-center gap-4">
          <div v-if="linkData.qr_svg" class="rounded-xl border border-border bg-white p-4 text-center" v-html="linkData.qr_svg" />

          <a
            :href="linkData.deep_link"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded-lg bg-[#229ED9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e8fc4] transition-colors"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Відкрити в Telegram
          </a>

          <!-- Timer -->
          <p v-if="timeLeft > 0" class="text-xs text-muted-foreground">
            Посилання дійсне ще {{ formatTimeLeft(timeLeft) }}
          </p>
          <p v-else class="text-xs text-destructive">
            Посилання закінчилось.
            <button type="button" class="underline" @click="generateLink">Згенерувати нове</button>
          </p>
        </div>

        <!-- Generate Button (if no link yet) -->
        <div v-else class="flex justify-center">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            :disabled="generating"
            @click="generateLink"
          >
            <svg v-if="generating" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ generating ? 'Генерація...' : 'Підключити Telegram' }}
          </button>
        </div>
      </div>
    </template>

    <!-- Error -->
    <div v-if="errorMessage" class="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  generateTelegramLink,
  getTelegramStatus,
  toggleTelegramNotifications,
  disconnectTelegram,
} from '@/api/telegram'
import type { TelegramLinkResponse, TelegramStatusResponse } from '@/api/telegram'

const loading = ref(true)
const generating = ref(false)
const toggling = ref(false)
const disconnecting = ref(false)
const errorMessage = ref('')

const status = ref<TelegramStatusResponse>({
  connected: false,
  enabled: false,
  connected_at: null,
})

const linkData = ref<TelegramLinkResponse | null>(null)
const timeLeft = ref(0)

let countdownInterval: ReturnType<typeof setInterval> | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await loadStatus()
})

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
  if (pollInterval) clearInterval(pollInterval)
})

async function loadStatus() {
  loading.value = true
  errorMessage.value = ''

  try {
    const result = await getTelegramStatus()
    if (result) {
      status.value = result
    }
  } catch (err: any) {
    if (err?.response?.status !== 403 && err?.response?.status !== 404) {
      errorMessage.value = 'Не вдалося завантажити статус Telegram'
    }
  } finally {
    loading.value = false
  }
}

async function generateLink() {
  generating.value = true
  errorMessage.value = ''

  try {
    linkData.value = await generateTelegramLink()

    // Start countdown
    timeLeft.value = linkData.value.ttl_seconds
    startCountdown()

    // Start polling for connection
    startPolling()
  } catch (err: any) {
    errorMessage.value = err?.response?.data?.detail || 'Не вдалося згенерувати посилання'
  } finally {
    generating.value = false
  }
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval)

  countdownInterval = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      if (countdownInterval) clearInterval(countdownInterval)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, 1000)
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval)

  pollInterval = setInterval(async () => {
    try {
      const newStatus = await getTelegramStatus()
      if (newStatus.connected) {
        status.value = newStatus
        linkData.value = null
        if (countdownInterval) clearInterval(countdownInterval)
        if (pollInterval) clearInterval(pollInterval)
      }
    } catch {
      // Ignore polling errors
    }
  }, 3000)
}

async function handleToggle() {
  toggling.value = true
  errorMessage.value = ''

  try {
    const result = await toggleTelegramNotifications(!status.value?.enabled)
    if (status.value) {
      status.value.enabled = result.enabled
      status.value.connected = result.connected
    }
  } catch (err: any) {
    errorMessage.value = err?.response?.data?.detail || 'Не вдалося змінити налаштування'
  } finally {
    toggling.value = false
  }
}

async function handleDisconnect() {
  if (!confirm('Ви впевнені, що хочете відключити Telegram-сповіщення?')) return

  disconnecting.value = true
  errorMessage.value = ''

  try {
    const result = await disconnectTelegram()
    status.value = {
      connected: result.connected,
      enabled: result.enabled,
      connected_at: null,
    }
  } catch (err: any) {
    errorMessage.value = err?.response?.data?.detail || 'Не вдалося відключити Telegram'
  } finally {
    disconnecting.value = false
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTimeLeft(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>
