<template>
  <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
          <span class="text-sm font-medium text-gray-600">
            {{ userInitials }}
          </span>
        </div>
        <div>
          <h3 class="text-sm font-medium text-gray-900">
            {{ displayUser.firstName }} {{ displayUser.lastName }}
          </h3>
          <p class="text-xs text-gray-500">{{ displayUser.role }}</p>
        </div>
      </div>
      <InquiryStatusPill :status="inquiry.status" />
    </div>

    <p class="text-sm text-gray-700 mb-3">{{ inquiry.message }}</p>

    <div class="flex items-center justify-between text-xs text-gray-500">
      <span>{{ formattedDate }}</span>
      <div class="flex space-x-2">
        <slot name="actions" :inquiry="inquiry"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { InquiryDTO, UserSummary } from '@/types/inquiries'
import InquiryStatusPill from './InquiryStatusPill.vue'

const props = defineProps<{
  inquiry: InquiryDTO
  viewerRole: 'student' | 'tutor'
}>()

const displayUser = computed<UserSummary>(() => {
  return props.viewerRole === 'student' ? props.inquiry.tutor : props.inquiry.student
})

const userInitials = computed(() => {
  const user = displayUser.value
  return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
})

const formattedDate = computed(() => {
  const date = new Date(props.inquiry.createdAt)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})
</script>
