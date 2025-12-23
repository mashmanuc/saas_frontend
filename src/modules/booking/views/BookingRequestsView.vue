<template>
  <div class="booking-requests-view">
    <div class="page-header">
      <h1>{{ $t('booking.requests.title') }}</h1>
    </div>

    <div class="filters">
      <button
        v-for="status in statuses"
        :key="status"
        @click="selectedStatus = status"
        :class="['filter-btn', { active: selectedStatus === status }]"
      >
        {{ $t(`booking.requests.${status}`) }}
        <span v-if="status === 'pending' && pendingCount > 0" class="badge">
          {{ pendingCount }}
        </span>
      </button>
    </div>

    <div v-if="loading" class="loading">
      <div v-for="i in 3" :key="i" class="skeleton-card"></div>
    </div>

    <div v-else-if="requests.length === 0" class="empty-state">
      <InboxIcon class="w-16 h-16 text-gray-400" />
      <p>{{ $t('booking.requests.noRequests', { status: selectedStatus }) }}</p>
    </div>

    <div v-else class="requests-list">
      <BookingRequestCard
        v-for="request in requests"
        :key="request.id"
        :request="request"
        @accept="handleAccept"
        @reject="handleReject"
      />
    </div>

    <div v-if="hasMore && !loading" class="load-more">
      <button @click="loadMore" class="btn-secondary">
        {{ $t('common.loadMore') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Inbox as InboxIcon } from 'lucide-vue-next'
import BookingRequestCard from '@/modules/booking/components/BookingRequestCard.vue'
import { bookingApi } from '@/modules/booking/api/booking'
import { useToast } from '@/composables/useToast'
import { useCalendarStore } from '@/modules/booking/stores/calendarStore'

const statuses = ['pending', 'accepted', 'rejected', 'all']
const selectedStatus = ref('pending')
const requests = ref<any[]>([])
const loading = ref(true)
const page = ref(1)
const hasMore = ref(false)
const { success, error: showError } = useToast()
const calendarStore = useCalendarStore()

const pendingCount = computed(() => {
  if (selectedStatus.value === 'pending') {
    return requests.value.length
  }
  return requests.value.filter(r => r.status === 'pending').length
})

async function loadRequests(resetPage = true) {
  if (resetPage) {
    page.value = 1
    requests.value = []
  }

  loading.value = true

  try {
    const data = await bookingApi.getBookingRequests({
      status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
      page: page.value,
      page_size: 20,
    })

    if (resetPage) {
      requests.value = data.results
    } else {
      requests.value.push(...data.results)
    }

    hasMore.value = !!data.next
  } catch (err) {
    showError('Failed to load requests')
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  page.value++
  await loadRequests(false)
}

async function handleAccept(requestId: number) {
  try {
    await bookingApi.acceptBookingRequest(requestId, {
      tutor_response: 'Looking forward to our lesson!',
    })

    success('Request accepted')
    await loadRequests()
    await calendarStore.loadWeekView({
      tutorId: undefined,
      weekStart: new Date().toISOString().split('T')[0],
      timezone: 'Europe/Kiev',
    })
  } catch (err: any) {
    if (err.code === 'slot_not_available') {
      showError('This time slot is no longer available')
    } else {
      showError('Failed to accept request')
    }
  }
}

async function handleReject(requestId: number, reason: string) {
  try {
    await bookingApi.rejectBookingRequest(requestId, {
      tutor_response: reason || 'Sorry, I cannot accept this request.',
    })

    success('Request rejected')
    await loadRequests()
  } catch (err) {
    showError('Failed to reject request')
  }
}

watch(selectedStatus, () => {
  loadRequests()
})

onMounted(() => {
  loadRequests()
})
</script>

<style scoped>
.booking-requests-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 12px;
}

.filter-btn {
  position: relative;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-btn:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.filter-btn.active {
  background-color: #3b82f6;
  color: white;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background-color: #ef4444;
  color: white;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.filter-btn.active .badge {
  background-color: white;
  color: #3b82f6;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-card {
  height: 180px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 12px;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px 24px;
  text-align: center;
}

.empty-state p {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
}

.requests-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.load-more {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.btn-secondary {
  padding: 10px 24px;
  background-color: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background-color: #f9fafb;
}
</style>
