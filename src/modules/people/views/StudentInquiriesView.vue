<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">My Contact Requests</h1>
      <p class="mt-1 text-sm text-gray-500">
        Manage your contact requests with tutors
      </p>
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

    <div v-else-if="inquiries.length === 0" class="text-center py-12">
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
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No contact requests</h3>
      <p class="mt-1 text-sm text-gray-500">
        You haven't sent any contact requests yet.
      </p>
    </div>

    <div v-else class="space-y-4">
      <InquiryCard
        v-for="inquiry in inquiries"
        :key="inquiry.id"
        :inquiry="inquiry"
        viewer-role="student"
      >
        <template #actions="{ inquiry: inq }">
          <button
            v-if="inq.status === 'OPEN'"
            @click="handleCancel(inq.id)"
            :disabled="isLoading"
            class="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
          >
            Cancel
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
import InquiryCard from '../components/InquiryCard.vue'

const router = useRouter()
const inquiriesStore = useInquiriesStore()
const chatStore = useNegotiationChatStore()

const inquiries = computed(() => inquiriesStore.items)
const isLoading = computed(() => inquiriesStore.isLoading)
const error = computed(() => inquiriesStore.error)

onMounted(() => {
  loadInquiries()
})

async function loadInquiries() {
  try {
    await inquiriesStore.fetchInquiries({ role: 'student' })
  } catch (err) {
    console.error('Failed to load inquiries:', err)
  }
}

async function handleCancel(inquiryId: string) {
  if (!confirm('Are you sure you want to cancel this request?')) {
    return
  }

  try {
    await inquiriesStore.cancelInquiry(inquiryId)
  } catch (err) {
    console.error('Failed to cancel inquiry:', err)
  }
}

async function handleOpenChat(inquiryId: string) {
  try {
    const thread = await chatStore.ensureThread(String(inquiryId))
    router.push(`/chat/thread/${thread.id}`)
  } catch (err) {
    console.error('Failed to open chat:', err)
  }
}
</script>
