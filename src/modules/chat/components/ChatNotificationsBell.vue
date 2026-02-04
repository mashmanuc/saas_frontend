<template>
  <div class="relative">
    <button
      type="button"
      class="relative rounded-full p-2 text-muted transition hover:bg-surface hover:text-body"
      :aria-label="$t('chat.notifications.title')"
      @click="toggleDropdown"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      
      <!-- Unread badge -->
      <span
        v-if="totalUnread > 0"
        class="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white"
      >
        {{ totalUnread > 99 ? '99+' : totalUnread }}
      </span>
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        v-click-outside="closeDropdown"
        class="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-default bg-surface shadow-lg z-50"
      >
        <div class="border-b border-default px-4 py-3">
          <h3 class="text-sm font-semibold text-body">
            {{ $t('chat.notifications.title') }}
          </h3>
        </div>

        <div class="max-h-96 overflow-y-auto">
          <template v-if="loading">
            <div class="flex items-center justify-center py-8">
              <div class="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
            </div>
          </template>

          <template v-else-if="unreadThreads.length === 0">
            <div class="px-4 py-8 text-center">
              <p class="text-sm text-muted">
                {{ $t('chat.notifications.empty') }}
              </p>
            </div>
          </template>

          <template v-else>
            <ul class="divide-y divide-default">
              <li
                v-for="thread in unreadThreads"
                :key="thread.thread_id"
                class="cursor-pointer px-4 py-3 transition hover:bg-surface-soft"
                @click="handleThreadClick(thread)"
              >
                <div class="flex items-start gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-body truncate">
                      {{ thread.other_user_name }}
                    </p>
                    <p class="text-xs text-muted truncate mt-1">
                      {{ thread.last_message_preview }}
                    </p>
                    <p class="text-xs text-muted mt-1">
                      {{ formatRelativeTime(thread.last_message_at) }}
                    </p>
                  </div>
                  <span
                    class="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-accent px-2 text-xs font-bold text-white"
                  >
                    {{ thread.unread_count }}
                  </span>
                </div>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatThreadsStore } from '@/stores/chatThreadsStore'
import { useAuthStore } from '@/modules/auth/store/authStore'

const router = useRouter()
const chatThreadsStore = useChatThreadsStore()
const authStore = useAuthStore()

const isOpen = ref(false)
const loading = ref(false)
let pollingInterval = null

const totalUnread = computed(() => chatThreadsStore.totalUnread)
const unreadThreads = computed(() => chatThreadsStore.unreadSummary.threads || [])

function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    fetchUnreadSummary()
  }
}

function closeDropdown() {
  isOpen.value = false
}

async function fetchUnreadSummary() {
  loading.value = true
  try {
    await chatThreadsStore.fetchUnreadSummary()
  } finally {
    loading.value = false
  }
}

function handleThreadClick(thread) {
  const userId = thread.other_user_id
  const role = authStore.user?.role
  
  closeDropdown()
  
  // Navigate to chat based on role
  if (role === 'tutor') {
    router.push({
      name: 'chat-student',
      params: { studentId: userId }
    }).catch(() => {})
  } else if (role === 'student') {
    router.push({
      name: 'chat-tutor',
      params: { tutorId: userId }
    }).catch(() => {})
  }
}

function formatRelativeTime(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'щойно'
  if (diffMins < 60) return `${diffMins} хв тому`
  if (diffHours < 24) return `${diffHours} год тому`
  if (diffDays < 7) return `${diffDays} дн тому`
  
  return date.toLocaleDateString('uk-UA', { 
    day: 'numeric', 
    month: 'short' 
  })
}

function startPolling() {
  // Smart polling: 3s when visible, 15s when hidden
  const updateInterval = () => {
    const interval = document.hidden ? 15000 : 3000
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }
    pollingInterval = setInterval(() => {
      chatThreadsStore.fetchUnreadSummary()
    }, interval)
  }

  updateInterval()
  document.addEventListener('visibilitychange', updateInterval)
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
  document.removeEventListener('visibilitychange', startPolling)
}

// Click outside directive
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value()
      }
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent)
  }
}

onMounted(() => {
  fetchUnreadSummary()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>
