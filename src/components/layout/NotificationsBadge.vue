<template>
  <button class="notifications-btn" @click="toggleDropdown" :aria-label="$t('notifications.title')">
    <BellIcon class="w-5 h-5" />
    <span v-if="unreadCount > 0" class="badge">
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bell as BellIcon } from 'lucide-vue-next'
import { bookingApi } from '@/modules/booking/api/booking'

const unreadCount = ref(0)

async function loadUnreadCount() {
  try {
    const data = await bookingApi.getBookingRequests({
      status: 'pending',
      page: 1,
      page_size: 1,
    })
    unreadCount.value = data.count || 0
  } catch (err) {
    console.error('Failed to load unread count:', err)
  }
}

function toggleDropdown() {
  // Navigate to booking requests page
  window.location.href = '/booking/requests'
}

onMounted(() => {
  loadUnreadCount()
  
  // Poll every 30 seconds
  setInterval(loadUnreadCount, 30000)
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
