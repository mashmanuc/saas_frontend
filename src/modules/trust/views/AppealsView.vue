<template>
  <div class="appeals-view">
    <div class="view-header">
      <h1>{{ $t('trust.appeals.title') }}</h1>
      <p class="subtitle">{{ $t('trust.appeals.subtitle') }}</p>
    </div>
    
    <div v-if="loading" class="loading-state">
      <div class="skeleton-card" v-for="i in 2" :key="i"></div>
    </div>
    
    <div v-else-if="activeBans.length" class="bans-section">
      <h3>{{ $t('trust.appeals.activeBans') }}</h3>
      <div class="ban-card" v-for="ban in activeBans" :key="ban.id">
        <div class="ban-header">
          <span class="ban-scope">{{ formatScope(ban.scope) }}</span>
          <span v-if="ban.is_permanent" class="ban-permanent">{{ $t('trust.appeals.permanent') }}</span>
          <span v-else class="ban-expires">{{ $t('trust.appeals.expires') }}: {{ formatDate(ban.expires_at) }}</span>
        </div>
        <p class="ban-reason">{{ $t('trust.appeals.reason') }}: {{ ban.reason }}</p>
        
        <div v-if="hasPendingAppeal(ban.id)" class="appeal-status">
          <span class="status-badge pending">{{ $t('trust.appeals.pending') }}</span>
          <p class="appeal-date">{{ $t('trust.appeals.appealed') }}: {{ formatDate(getAppeal(ban.id).created_at) }}</p>
        </div>
        
        <Button
          v-else
          variant="primary"
          @click="openAppealModal(ban)"
        >
          {{ $t('trust.appeals.fileAppeal') }}
        </Button>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <i class="icon-shield-check"></i>
      <p>{{ $t('trust.appeals.noActiveBans') }}</p>
    </div>
    
    <div v-if="appeals.length" class="appeals-history">
      <h3>{{ $t('trust.appeals.history') }}</h3>
      <div class="appeal-item" v-for="appeal in appeals" :key="appeal.id">
        <div class="appeal-header">
          <span :class="['status-badge', appeal.status]">{{ formatStatus(appeal.status) }}</span>
          <span class="appeal-date">{{ formatDate(appeal.created_at) }}</span>
        </div>
        <p class="appeal-reason">{{ appeal.reason }}</p>
        <p v-if="appeal.admin_response" class="admin-response">
          <strong>{{ $t('trust.appeals.response') }}:</strong> {{ appeal.admin_response }}
        </p>
      </div>
    </div>
    
    <!-- Appeal Modal -->
    <Modal :open="showAppealModal" @close="closeAppealModal">
      <template #header>
        <h3>{{ $t('trust.appeals.modalTitle') }}</h3>
      </template>
      <template #default>
        <div class="appeal-form">
          <p class="form-hint">{{ $t('trust.appeals.modalHint') }}</p>
          <Textarea
            v-model="appealReason"
            :rows="4"
            :placeholder="$t('trust.appeals.reasonPlaceholder')"
          />
          <div v-if="appealError" class="alert alert-error">{{ appealError }}</div>
        </div>
      </template>
      <template #footer>
        <div class="modal-actions">
          <Button variant="outline" @click="closeAppealModal">
            {{ $t('common.cancel') }}
          </Button>
          <Button
            variant="primary"
            :disabled="!appealReason.trim() || submitting"
            :loading="submitting"
            @click="submitAppeal"
          >
            {{ $t('trust.appeals.submit') }}
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTrustStore } from '../stores/trustStore'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'

const store = useTrustStore()

const showAppealModal = ref(false)
const selectedBan = ref(null)
const appealReason = ref('')
const appealError = ref(null)
const submitting = ref(false)

const loading = store.loading
const activeBans = store.bans
const appeals = store.appeals

onMounted(() => {
  store.fetchBans()
  store.fetchAppeals()
})

function formatScope(scope) {
  const scopes = {
    'all': 'Повний доступ',
    'inquiries': 'Запити',
    'messaging': 'Повідомлення',
    'marketplace': 'Каталог'
  }
  return scopes[scope] || scope
}

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function formatStatus(status) {
  const statuses = {
    'pending': 'На розгляді',
    'approved': 'Затверджено',
    'rejected': 'Відхилено'
  }
  return statuses[status] || status
}

function hasPendingAppeal(banId) {
  return appeals.value.some(a => a.ban_id === banId && a.status === 'pending')
}

function getAppeal(banId) {
  return appeals.value.find(a => a.ban_id === banId)
}

function openAppealModal(ban) {
  selectedBan.value = ban
  appealReason.value = ''
  appealError.value = null
  showAppealModal.value = true
}

function closeAppealModal() {
  showAppealModal.value = false
  selectedBan.value = null
}

async function submitAppeal() {
  if (!selectedBan.value || !appealReason.value.trim()) return
  
  submitting.value = true
  appealError.value = null
  
  try {
    await store.createAppeal(selectedBan.value.id, appealReason.value.trim())
    closeAppealModal()
  } catch (e) {
    appealError.value = e.message || 'Не вдалося подати апеляцію'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.appeals-view {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.view-header {
  margin-bottom: var(--spacing-xl);
}

.view-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin: 0 0 var(--spacing-sm);
}

.subtitle {
  color: var(--color-text-secondary);
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.skeleton-card {
  height: 120px;
  background: var(--color-skeleton);
  border-radius: var(--radius-lg);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.bans-section {
  margin-bottom: var(--spacing-xl);
}

.bans-section h3,
.appeals-history h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0 0 var(--spacing-md);
}

.ban-card {
  padding: var(--spacing-md);
  background: var(--color-error-subtle);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-md);
}

.ban-header {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-sm);
}

.ban-scope {
  font-weight: 600;
  color: var(--color-error);
}

.ban-permanent {
  background: var(--color-error);
  color: var(--color-error-text);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.ban-expires {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.ban-reason {
  margin: 0 0 var(--spacing-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.appeal-status {
  padding: var(--spacing-sm);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.appeal-date {
  margin: var(--spacing-xs) 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.status-badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.status-badge.pending {
  background: var(--color-warning-subtle);
  color: var(--color-warning);
}

.status-badge.approved {
  background: var(--color-success-subtle);
  color: var(--color-success);
}

.status-badge.rejected {
  background: var(--color-error-subtle);
  color: var(--color-error);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.empty-state i {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
  color: var(--color-success);
}

.appeals-history {
  margin-top: var(--spacing-xl);
}

.appeal-item {
  padding: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-md);
}

.appeal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.appeal-reason {
  margin: 0 0 var(--spacing-sm);
  color: var(--color-text-secondary);
}

.admin-response {
  margin: 0;
  padding: var(--spacing-sm);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.appeal-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-hint {
  color: var(--color-text-secondary);
  margin: 0;
}

.alert {
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.alert-error {
  background: var(--color-error-subtle);
  color: var(--color-error);
  border: 1px solid var(--color-error);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

</style>
