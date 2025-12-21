<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import MatchDetail from '../components/MatchDetail.vue'
import ConversationView from '../components/ConversationView.vue'
import BookingTimeline from '../components/BookingTimeline.vue'
import StudentAvailabilityCalendar from '../../booking/components/calendar/StudentAvailabilityCalendar.vue'
import BookingModal from '../../booking/components/modals/BookingModal.vue'
import { useMatchStore } from '../store/matchStore'
import type { TimeSlot } from '../../booking/api/availabilityApi'
import type { Booking } from '../../booking/api/bookingApi'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const matchStore = useMatchStore()

const matchId = route.params.id as string
const activeTab = ref<'details' | 'chat' | 'bookings' | 'calendar'>('details')
const showBookingModal = ref(false)
const selectedSlot = ref<TimeSlot | null>(null)

const match = computed(() => matchStore.currentMatch)

function handleSlotSelected(slot: TimeSlot): void {
  selectedSlot.value = slot
  showBookingModal.value = true
}

async function handleBookingConfirmed(booking: Booking): Promise<void> {
  showBookingModal.value = false
  // TODO: Add toast notification when toast composable is available
  await matchStore.fetchMatches()
  activeTab.value = 'bookings'
}
</script>

<template>
  <div class="match-detail-view">
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'details' }]"
        @click="activeTab = 'details'"
      >
        {{ t('matches.tabs.details') }}
      </button>
      <button
        :class="['tab', { active: activeTab === 'chat' }]"
        @click="activeTab = 'chat'"
      >
        {{ t('matches.tabs.chat') }}
      </button>
      <button
        v-if="match?.status === 'accepted'"
        :class="['tab', { active: activeTab === 'calendar' }]"
        @click="activeTab = 'calendar'"
      >
        {{ t('matches.tabs.calendar') }}
      </button>
      <button
        :class="['tab', { active: activeTab === 'bookings' }]"
        @click="activeTab = 'bookings'"
      >
        {{ t('matches.tabs.bookings') }}
      </button>
    </div>

    <div class="content">
      <MatchDetail v-if="activeTab === 'details'" />
      <ConversationView v-if="activeTab === 'chat'" :match-id="matchId" />
      
      <div v-if="activeTab === 'calendar' && match" class="calendar-section">
        <h3>{{ t('matches.bookLesson') }}</h3>
        <StudentAvailabilityCalendar
          :tutor-slug="match.tutor.slug"
          :match-id="matchId"
          @slot-selected="handleSlotSelected"
        />
      </div>
      
      <div v-if="activeTab === 'bookings'">
        <BookingTimeline v-if="route.query.booking_id" :booking-id="route.query.booking_id as string" />
      </div>
    </div>

    <BookingModal
      :show="showBookingModal"
      :slot="selectedSlot"
      :tutor-info="match?.tutor || { name: '', slug: '' }"
      :match-id="matchId"
      @close="showBookingModal = false"
      @confirmed="handleBookingConfirmed"
    />
  </div>
</template>

<style scoped>
.match-detail-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.tab {
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
</style>
