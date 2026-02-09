<template>
  <div class="blocked-users-list">
    <div class="list-header">
      <h3 class="list-title">{{ $t('trust.blocked.title') }}</h3>
      <span class="count-badge">{{ blocks.length }}</span>
    </div>
    
    <div v-if="loading && !blocks.length" class="loading-state">
      <div v-for="i in 3" :key="i" class="skeleton-item"></div>
    </div>
    
    <div v-else-if="blocks.length" class="blocked-users">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="blocked-user-card"
      >
        <div class="user-info">
          <div class="user-avatar">
            <span class="avatar-placeholder">{{ getInitials(block.target_user_name) }}</span>
          </div>
          <div class="user-details">
            <h4 class="user-name">{{ block.target_user_name }}</h4>
            <p v-if="block.reason" class="block-reason">
              {{ $t('trust.blocked.reason') }}: {{ block.reason }}
            </p>
            <p class="block-date">
              {{ $t('trust.blocked.since') }} {{ formatDate(block.created_at) }}
            </p>
          </div>
        </div>
        <button
          class="btn btn-unblock"
          :disabled="processingId === block.id"
          @click="unblock(block.id)"
        >
          <span v-if="processingId === block.id" class="spinner"></span>
          <span v-else>{{ $t('trust.blocked.unblock') }}</span>
        </button>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <i class="icon-shield"></i>
      <p>{{ $t('trust.blocked.empty') }}</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useTrustStore } from '../stores/trustStore'

const store = useTrustStore()

const processingId = ref(null)

const blocks = store.blocks
const loading = store.loading

onMounted(() => {
  if (!store.blocks.length) {
    store.fetchBlocks()
  }
})

function getInitials(name) {
  if (!name) return ''
  return name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()
}

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

async function unblock(blockId) {
  processingId.value = blockId
  try {
    await store.unblockUser(blockId)
  } finally {
    processingId.value = null
  }
}
</script>

<style scoped>
.blocked-users-list {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface-elevated);
  border-bottom: 1px solid var(--color-border);
}

.list-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0;
}

.count-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-primary);
  color: var(--color-primary-text);
  font-size: var(--font-size-xs);
  font-weight: 600;
  border-radius: var(--radius-full);
  min-width: 24px;
  text-align: center;
}

.loading-state {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.skeleton-item {
  height: 64px;
  background: var(--color-skeleton);
  border-radius: var(--radius-md);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.blocked-users {
  display: flex;
  flex-direction: column;
}

.blocked-user-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  transition: background 0.2s ease;
}

.blocked-user-card:last-child {
  border-bottom: none;
}

.blocked-user-card:hover {
  background: var(--color-surface-hover);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
  min-width: 0;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-placeholder {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0 0 var(--spacing-xs);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-reason {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: 0;
}

.btn-unblock {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  min-width: 100px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-unblock:hover:not(:disabled) {
  background: var(--color-success-subtle);
  border-color: var(--color-success);
  color: var(--color-success);
}

.btn-unblock:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  text-align: center;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: var(--font-size-sm);
}
</style>
