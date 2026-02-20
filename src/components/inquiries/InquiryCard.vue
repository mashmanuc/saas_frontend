<template>
  <div class="inquiry-card" :class="statusClass">
    <div class="inquiry-header">
      <div class="user-info">
        <img :src="otherUser.avatar || '/default-avatar.png'" class="avatar" alt="" />
        <div>
          <h4 class="user-name">{{ otherUser.full_name }}</h4>
          <span class="inquiry-date">{{ formattedDate }}</span>
        </div>
      </div>
      <span class="status-badge" :class="statusClass">
        {{ statusLabel }}
      </span>
    </div>
    
    <div class="inquiry-body">
      <p class="inquiry-message">{{ inquiry.message }}</p>
      
      <div v-if="inquiry.subjects && inquiry.subjects.length" class="inquiry-meta">
        <span class="meta-label">Предмети:</span>
        <span class="meta-value">{{ inquiry.subjects.join(', ') }}</span>
      </div>
      
      <div v-if="inquiry.budget" class="inquiry-meta">
        <span class="meta-label">Бюджет:</span>
        <span class="meta-value">{{ inquiry.budget }} грн/год</span>
      </div>
      
      <CountdownTimer
        v-if="inquiry.status === 'OPEN' && inquiry.expires_at"
        :expires-at="inquiry.expires_at"
      />
    </div>
    
    <div v-if="showActions" class="inquiry-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * InquiryCard Component (Phase 1 v0.86)
 * 
 * Картка inquiry для відображення в списках
 */

import { computed } from 'vue'
import type { InquiryDTO } from '@/types/inquiries'
import CountdownTimer from './CountdownTimer.vue'

interface UserSummary {
  id: string
  full_name: string
  avatar?: string
}

const props = defineProps<{
  inquiry: InquiryDTO
  currentUserRole: 'student' | 'tutor'
  showActions?: boolean
}>()

const otherUser = computed((): UserSummary => {
  return props.currentUserRole === 'student' 
    ? props.inquiry.tutor as unknown as UserSummary
    : props.inquiry.student as unknown as UserSummary
})

const statusClass = computed(() => {
  switch (props.inquiry.status) {
    case 'OPEN': return 'status-open'
    case 'ACCEPTED': return 'status-accepted'
    case 'REJECTED': return 'status-rejected'
    case 'CANCELLED': return 'status-cancelled'
    case 'EXPIRED': return 'status-expired'
    default: return ''
  }
})

const statusLabel = computed(() => {
  switch (props.inquiry.status) {
    case 'OPEN': return 'Очікує відповіді'
    case 'ACCEPTED': return 'Прийнято'
    case 'REJECTED': return 'Відхилено'
    case 'CANCELLED': return 'Скасовано'
    case 'EXPIRED': return 'Прострочено'
    default: return props.inquiry.status
  }
})

const formattedDate = computed(() => {
  const date = new Date(props.inquiry.created_at)
  return date.toLocaleDateString('uk-UA', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
})
</script>

<style scoped>
.inquiry-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  transition: box-shadow 0.2s;
}

.inquiry-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.inquiry-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.user-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.inquiry-date {
  font-size: 13px;
  color: var(--text-secondary);
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.status-open {
  background: #DBEAFE;
  color: #1E40AF;
}

.status-badge.status-accepted {
  background: #D1FAE5;
  color: #065F46;
}

.status-badge.status-rejected {
  background: #FEE2E2;
  color: #991B1B;
}

.status-badge.status-cancelled {
  background: #F3F4F6;
  color: #6B7280;
}

.status-badge.status-expired {
  background: #FEF3C7;
  color: #92400E;
}

.inquiry-body {
  margin-bottom: 12px;
}

.inquiry-message {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.inquiry-meta {
  display: flex;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 4px;
}

.meta-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.meta-value {
  color: var(--text-primary);
}

.inquiry-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}
</style>
