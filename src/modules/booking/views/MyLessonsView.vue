<script setup lang="ts">
// F5: My Lessons View
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Calendar, Clock, CheckCircle } from 'lucide-vue-next'
import { useBookingStore } from '../stores/bookingStore'

// Components
import BookingCard from '../components/booking/BookingCard.vue'

const store = useBookingStore()
const { bookings, upcomingBookings, pendingBookings, pastBookings, isLoading } =
  storeToRefs(store)

type TabType = 'upcoming' | 'pending' | 'past'
const activeTab = ref<TabType>('upcoming')

const tabs = [
  { id: 'upcoming' as TabType, label: 'Upcoming', icon: Calendar },
  { id: 'pending' as TabType, label: 'Pending', icon: Clock },
  { id: 'past' as TabType, label: 'Past', icon: CheckCircle },
]

const filteredBookings = computed(() => {
  switch (activeTab.value) {
    case 'upcoming':
      return upcomingBookings.value
    case 'pending':
      return pendingBookings.value
    case 'past':
      return pastBookings.value
    default:
      return []
  }
})

const emptyMessage = computed(() => {
  switch (activeTab.value) {
    case 'upcoming':
      return 'No upcoming lessons'
    case 'pending':
      return 'No pending bookings'
    case 'past':
      return 'No past lessons'
    default:
      return 'No lessons'
  }
})

onMounted(() => {
  store.loadBookings({ role: 'student' })
})

function setTab(tab: TabType) {
  activeTab.value = tab
}
</script>

<template>
  <div class="my-lessons-view">
    <header class="view-header">
      <h1>My Lessons</h1>
    </header>

    <!-- Tabs -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: activeTab === tab.id }"
        @click="setTab(tab.id)"
      >
        <component :is="tab.icon" :size="18" />
        {{ tab.label }}
        <span v-if="tab.id === 'pending' && pendingBookings.length" class="badge">
          {{ pendingBookings.length }}
        </span>
      </button>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Loading -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner" />
        <p>Loading lessons...</p>
      </div>

      <!-- Bookings List -->
      <div v-else-if="filteredBookings.length > 0" class="bookings-list">
        <BookingCard
          v-for="booking in filteredBookings"
          :key="booking.id"
          :booking="booking"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>{{ emptyMessage }}</h3>
        <p v-if="activeTab === 'upcoming'">
          Book a lesson with a tutor to get started
        </p>
        <router-link
          v-if="activeTab === 'upcoming'"
          to="/tutors"
          class="link-primary"
        >
          Find a Tutor
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.my-lessons-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.view-header {
  margin-bottom: 24px;
}

.view-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.badge {
  background: var(--accent);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Bookings List */
.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px;
}

.empty-state p {
  color: var(--text-secondary);
  margin: 0 0 24px;
}

.router-link-primary {
  background: var(--accent);
  color: white;
}

.router-link-primary:hover {
  background: var(--accent-hover);
}

@media (max-width: 640px) {
  .my-lessons-view {
    padding: 16px;
  }

  .tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab {
    white-space: nowrap;
  }
}

.link-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.125rem;
  border-radius: 25px;
  font-weight: 600;
  font-size: 0.95rem;
  background: var(--accent);
  color: var(--accent-contrast);
  border: 1px solid transparent;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px var(--shadow), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.link-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--shadow-strong), 0 0 0 1px rgba(0, 0, 0, 0.08);
}
</style>
