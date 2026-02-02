<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAcceptanceStore } from '@/stores/acceptanceStore'

/**
 * Accept availability badge.
 * 
 * SSOT Section 7: Shows ONLY number, not source/reason.
 * 
 * Display rules:
 * - 🟢 Green: remaining > 2
 * - 🟡 Yellow: remaining = 1-2
 * - 🔴 Red: remaining = 0
 */

const acceptanceStore = useAcceptanceStore()

// Fetch on mount
onMounted(() => {
  acceptanceStore.fetchAvailability()
  
  // Track view
  if (acceptanceStore.canAccept) {
    trackAcceptanceViewed()
  }
})

// Badge color
const badgeColor = computed(() => {
  const remaining = acceptanceStore.remainingAccepts
  
  if (remaining === 0) return 'red'
  if (remaining <= 2) return 'yellow'
  return 'green'
})

// Badge text
const badgeText = computed(() => {
  const remaining = acceptanceStore.remainingAccepts
  
  if (remaining === 0) {
    return 'No accepts available'
  }
  
  return `${remaining} accept${remaining === 1 ? '' : 's'} available`
})

// Grace token expires in (human-readable)
const graceTokenExpiresIn = computed(() => {
  const expiresAt = acceptanceStore.graceTokenExpiresAt
  if (!expiresAt) return null
  
  const now = new Date()
  const expires = new Date(expiresAt)
  const secondsLeft = Math.floor((expires.getTime() - now.getTime()) / 1000)
  
  if (secondsLeft <= 0) return 'expired'
  if (secondsLeft < 60) return `${secondsLeft}s`
  
  return null // Don't show if > 1min (not useful)
})

function trackAcceptanceViewed() {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'acceptance_viewed', {
      remaining: acceptanceStore.remainingAccepts
    })
  }
}
</script>

<template>
  <div
    v-if="acceptanceStore.hasData"
    class="accept-badge"
    :class="`badge-${badgeColor}`"
  >
    <!-- Main text: ONLY show number (SSOT Section 7) -->
    <span class="badge-text">{{ badgeText }}</span>
    
    <!-- Optional: Grace token expiry (informative, not blocking) -->
    <span
      v-if="graceTokenExpiresIn && acceptanceStore.canAccept"
      class="badge-expiry"
    >
      (refreshes in {{ graceTokenExpiresIn }})
    </span>
    
    <!-- Tooltip: Explain what this means -->
    <div class="badge-tooltip">
      <p>
        This shows how many inquiries you can accept right now.
      </p>
      <p v-if="acceptanceStore.remainingAccepts === 0">
        To accept more inquiries, purchase contact tokens.
      </p>
    </div>
  </div>
  
  <!-- Loading state -->
  <div v-else-if="acceptanceStore.isLoading" class="accept-badge badge-loading">
    Loading...
  </div>
</template>

<style scoped>
.accept-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.badge-green {
  background-color: #d1fae5;
  color: #065f46;
}

.badge-yellow {
  background-color: #fef3c7;
  color: #92400e;
}

.badge-red {
  background-color: #fee2e2;
  color: #991b1b;
}

.badge-loading {
  background-color: #f3f4f6;
  color: #6b7280;
}

.badge-expiry {
  font-size: 0.75rem;
  opacity: 0.7;
}

.badge-tooltip {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  padding: 0.75rem;
  background-color: #1f2937;
  color: #fff;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  white-space: nowrap;
  z-index: 10;
}

.accept-badge:hover .badge-tooltip {
  display: block;
}
</style>
