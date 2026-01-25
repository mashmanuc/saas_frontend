<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Contact Requests</h1>
          <p class="mt-1 text-sm text-gray-500">
            Review and respond to student contact requests
          </p>
        </div>
        <span
          v-if="pendingCount > 0"
          class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
        >
          {{ pendingCount }} pending
        </span>
      </div>
    </div>

    <div class="mb-4 border-b border-gray-200">
      <nav class="-mb-px flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          @click="activeTab = tab.value"
          :class="[
            activeTab === tab.value
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
          ]"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-sm text-red-800">{{ error }}</p>
      <button
        @click="loadInquiries"
        class="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
      >
        Try again
      </button>
    </div>

    <div v-else-if="filteredInquiries.length === 0" class="text-center py-12">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No requests</h3>
      <p class="mt-1 text-sm text-gray-500">
        {{ emptyStateMessage }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <InquiryCard
        v-for="inquiry in filteredInquiries"
        :key="inquiry.id"
        :inquiry="inquiry"
        viewer-role="tutor"
      >
        <template #actions="{ inquiry: inq }">
          <button
            v-if="inq.status === 'OPEN'"
            @click="handleAccept(inq.id)"
            :disabled="isLoading"
            class="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
          >
            Accept
          </button>
          <button
            v-if="inq.status === 'OPEN'"
            @click="handleDecline(inq.id)"
            :disabled="isLoading"
            class="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
          >
            Decline
          </button>
          <button
            v-if="inq.status === 'ACCEPTED'"
            @click="handleOpenChat(inq.id)"
            class="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Open Chat
          </button>
        </template>
      </InquiryCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useNegotiationChatStore } from '@/stores/negotiationChatStore'
import type { InquiryStatus } from '@/types/inquiries'
import InquiryCard from '../components/InquiryCard.vue'

const router = useRouter()
const inquiriesStore = useInquiriesStore()
const chatStore = useNegotiationChatStore()

const activeTab = ref<'pending' | 'all'>('pending')

const tabs = [
  { label: 'Pending', value: 'pending' as const },
  { label: 'All', value: 'all' as const }
]

const inquiries = computed(() => inquiriesStore.items)
const isLoading = computed(() => inquiriesStore.isLoading)
const error = computed(() => inquiriesStore.error)
const pendingCount = computed(() => inquiriesStore.pendingCount)

const filteredInquiries = computed(() => {
  if (activeTab.value === 'pending') {
    return inquiries.value.filter(i => i.status === 'OPEN')
  }
  return inquiries.value
})

const emptyStateMessage = computed(() => {
  if (activeTab.value === 'pending') {
    return 'No pending contact requests at the moment.'
  }
  return 'You haven\'t received any contact requests yet.'
})

onMounted(() => {
  loadInquiries()
})

async function loadInquiries() {
  try {
    const filters: { role: 'tutor'; status?: InquiryStatus } = { role: 'tutor' }
    if (activeTab.value === 'pending') {
      filters.status = 'OPEN'
    }
    await inquiriesStore.fetchInquiries(filters)
  } catch (err) {
    console.error('Failed to load inquiries:', err)
  }
}

async function handleAccept(inquiryId: number) {
  try {
    await inquiriesStore.acceptInquiry(inquiryId)
  } catch (err) {
    console.error('Failed to accept inquiry:', err)
  }
}

async function handleDecline(inquiryId: number) {
  if (!confirm('Are you sure you want to decline this request?')) {
    return
  }

  try {
    await inquiriesStore.declineInquiry(inquiryId, { reason: 'OTHER' })
  } catch (err) {
    console.error('Failed to decline inquiry:', err)
  }
}

async function handleOpenChat(inquiryId: number) {
  try {
    const thread = await chatStore.ensureThread(String(inquiryId))
    router.push(`/chat/thread/${thread.id}`)
  } catch (err) {
    console.error('Failed to open chat:', err)
  }
}
</script>
