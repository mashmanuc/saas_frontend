<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import MatchDetail from '../components/MatchDetail.vue'
import ConversationView from '../components/ConversationView.vue'
import BookingTimeline from '../components/BookingTimeline.vue'

const route = useRoute()
const matchId = route.params.id as string
const activeTab = ref<'details' | 'chat' | 'bookings'>('details')
</script>

<template>
  <div class="match-detail-view">
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'details' }]"
        @click="activeTab = 'details'"
      >
        Details
      </button>
      <button
        :class="['tab', { active: activeTab === 'chat' }]"
        @click="activeTab = 'chat'"
      >
        Chat
      </button>
      <button
        :class="['tab', { active: activeTab === 'bookings' }]"
        @click="activeTab = 'bookings'"
      >
        Bookings
      </button>
    </div>

    <div class="content">
      <MatchDetail v-if="activeTab === 'details'" />
      <ConversationView v-if="activeTab === 'chat'" :match-id="matchId" />
      <div v-if="activeTab === 'bookings'">
        <BookingTimeline v-if="route.query.booking_id" :booking-id="route.query.booking_id as string" />
      </div>
    </div>
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
