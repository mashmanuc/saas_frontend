<template>
  <button class="notifications-btn" @click="toggleDropdown" :aria-label="$t('notifications.title')">
    <BellIcon class="w-5 h-5" />
    <span v-if="unreadCount > 0" class="badge">
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Bell as BellIcon } from 'lucide-vue-next'
import apiClient from '@/utils/apiClient'

const unreadCount = ref(0)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadUnreadCount() {
  try {
    const data = await apiClient.get('/v1/booking/requests/', {
      params: { status: 'pending', page: 1, page_size: 1 },
      meta: { skipLoader: true },
    } as any)
    unreadCount.value = data.count || 0
  } catch (err) {
    // Silent fail — фоновий polling
  }
}

function toggleDropdown() {
  window.location.href = '/booking/requests'
}

onMounted(() => {
  loadUnreadCount()
  // Poll кожні 60 секунд (замість 30)
  pollTimer = setInterval(loadUnreadCount, 60000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped>
.notifications-btn {
  position: relative;
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.15s;
  color: #6b7280;
}

.notifications-btn:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background-color: #ef4444;
  color: white;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}
</style>
