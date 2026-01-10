<template>
  <div class="staff-user-overview">
    <div class="header">
      <h1>{{ $t('staff.userOverview.title') }}</h1>
      <router-link to="/staff/reports" class="back-link">
        ← {{ $t('staff.userOverview.backToReports') }}
      </router-link>
    </div>

    <div v-if="staffStore.loadUserOverviewError" class="error-banner" role="alert">
      {{ staffStore.loadUserOverviewError }}
    </div>

    <div v-if="staffStore.isLoading" class="loading">
      {{ $t('common.loading') }}
    </div>

    <div v-else-if="staffStore.userOverview" class="overview-content">
      <!-- User Info Section -->
      <section class="section user-section">
        <h2>{{ $t('staff.userOverview.userInfo') }}</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.userId') }}:</span>
            <span>{{ staffStore.userOverview.user.id }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.email') }}:</span>
            <span>{{ staffStore.userOverview.user.email }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.role') }}:</span>
            <span>{{ staffStore.userOverview.user.role }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.createdAt') }}:</span>
            <span>{{ formatDate(staffStore.userOverview.user.created_at) }}</span>
          </div>
        </div>
      </section>

      <!-- Trust Section -->
      <section class="section trust-section">
        <h2>{{ $t('staff.userOverview.trustInfo') }}</h2>
        
        <div class="trust-stats">
          <div class="stat-card">
            <span class="stat-value">{{ staffStore.userOverview.trust.blocks_count }}</span>
            <span class="stat-label">{{ $t('staff.userOverview.blocksCount') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ staffStore.userOverview.trust.reports_open_count }}</span>
            <span class="stat-label">{{ $t('staff.userOverview.reportsOpenCount') }}</span>
          </div>
        </div>

        <!-- Bans List -->
        <div class="bans-section">
          <h3>{{ $t('staff.userOverview.bans') }}</h3>
          
          <div v-if="staffStore.userOverview.trust.bans.length === 0" class="empty-state">
            {{ $t('staff.userOverview.noBans') }}
          </div>

          <div v-else class="bans-list">
            <div 
              v-for="ban in staffStore.userOverview.trust.bans" 
              :key="ban.id"
              class="ban-card"
              :class="{ 'ban-active': ban.status === 'ACTIVE' }"
            >
              <div class="ban-header">
                <span class="ban-scope">{{ ban.scope }}</span>
                <span :class="`ban-status status-${ban.status.toLowerCase()}`">
                  {{ ban.status }}
                </span>
              </div>
              <div class="ban-details">
                <p><strong>{{ $t('staff.userOverview.reason') }}:</strong> {{ ban.reason }}</p>
                <p><strong>{{ $t('staff.userOverview.createdAt') }}:</strong> {{ formatDate(ban.created_at) }}</p>
                <p v-if="ban.ends_at">
                  <strong>{{ $t('staff.userOverview.endsAt') }}:</strong> {{ formatDate(ban.ends_at) }}
                </p>
                <p v-else>
                  <strong>{{ $t('staff.userOverview.endsAt') }}:</strong> {{ $t('staff.userOverview.permanent') }}
                </p>
              </div>
              <button 
                v-if="ban.status === 'ACTIVE'"
                @click="handleLiftBan(ban.id)"
                :disabled="staffStore.isLoading"
                class="btn btn-lift"
              >
                {{ $t('staff.userOverview.liftBan') }}
              </button>
            </div>
          </div>

          <!-- Create Ban Form -->
          <div class="create-ban-section">
            <h3>{{ $t('staff.userOverview.createBan') }}</h3>
            <form @submit.prevent="handleCreateBan" class="ban-form">
              <div class="form-group">
                <label for="ban-scope">{{ $t('staff.userOverview.scope') }}</label>
                <select 
                  id="ban-scope"
                  v-model="banForm.scope" 
                  required
                >
                  <option value="CONTACTS">CONTACTS</option>
                  <option value="PLATFORM">PLATFORM</option>
                  <option value="MESSAGING">MESSAGING</option>
                </select>
              </div>
              <div class="form-group">
                <label for="ban-ends-at">{{ $t('staff.userOverview.endsAt') }} ({{ $t('staff.userOverview.optional') }})</label>
                <input 
                  id="ban-ends-at"
                  v-model="banForm.ends_at" 
                  type="datetime-local"
                />
              </div>
              <div class="form-group">
                <label for="ban-reason">{{ $t('staff.userOverview.reason') }}</label>
                <textarea 
                  id="ban-reason"
                  v-model="banForm.reason" 
                  required
                  rows="3"
                />
              </div>
              <button 
                type="submit" 
                :disabled="staffStore.isLoading"
                class="btn btn-primary"
              >
                {{ $t('staff.userOverview.createBanButton') }}
              </button>
            </form>
          </div>
        </div>
      </section>

      <!-- Billing Section -->
      <section class="section billing-section">
        <h2>{{ $t('staff.userOverview.billingInfo') }}</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.plan') }}:</span>
            <span>{{ staffStore.userOverview.billing.plan || $t('staff.userOverview.noPlan') }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.subscriptionStatus') }}:</span>
            <span>{{ staffStore.userOverview.billing.subscription_status || $t('staff.userOverview.noSubscription') }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.currentPeriodEnd') }}:</span>
            <span>{{ staffStore.userOverview.billing.current_period_end ? formatDate(staffStore.userOverview.billing.current_period_end) : '-' }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.cancelAtPeriodEnd') }}:</span>
            <span>{{ staffStore.userOverview.billing.cancel_at_period_end ? $t('common.yes') : $t('common.no') }}</span>
          </div>
        </div>

        <div v-if="staffStore.userOverview.billing.subscription_status" class="billing-actions">
          <h3>{{ $t('staff.userOverview.billingActions') }}</h3>
          <div class="action-buttons">
            <button 
              @click="handleCancelBilling('at_period_end')"
              :disabled="staffStore.isLoading || staffStore.userOverview.billing.cancel_at_period_end"
              class="btn btn-warning"
            >
              {{ $t('staff.userOverview.cancelAtPeriodEnd') }}
            </button>
            <button 
              @click="handleCancelBilling('immediate')"
              :disabled="staffStore.isLoading"
              class="btn btn-danger"
            >
              {{ $t('staff.userOverview.cancelImmediate') }}
            </button>
          </div>
        </div>
      </section>

      <!-- Activity Section -->
      <section class="section activity-section">
        <h2>{{ $t('staff.userOverview.activityInfo') }}</h2>
        <div class="activity-stats">
          <div class="stat-card">
            <span class="stat-value">{{ staffStore.userOverview.activity.inquiries_count_30d }}</span>
            <span class="stat-label">{{ $t('staff.userOverview.inquiries30d') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ staffStore.userOverview.activity.contacts_unlocked_30d }}</span>
            <span class="stat-label">{{ $t('staff.userOverview.contactsUnlocked30d') }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStaffStore } from '@/stores/staffStore'
import { BanScope, BillingCancelMode } from '@/types/staff'

const route = useRoute()
const staffStore = useStaffStore()

const banForm = ref({
  scope: 'CONTACTS' as BanScope,
  ends_at: '',
  reason: ''
})

onMounted(async () => {
  const userId = route.params.id as string
  if (userId) {
    try {
      await staffStore.loadUserOverview(userId)
    } catch (error) {
      console.error('Failed to load user overview:', error)
    }
  }
})

async function handleCreateBan() {
  if (!staffStore.userOverview) return

  try {
    await staffStore.createBan({
      user_id: staffStore.userOverview.user.id,
      scope: banForm.value.scope,
      ends_at: banForm.value.ends_at || null,
      reason: banForm.value.reason
    })
    
    // Reset form
    banForm.value = {
      scope: 'CONTACTS' as BanScope,
      ends_at: '',
      reason: ''
    }
  } catch (error) {
    console.error('Failed to create ban:', error)
  }
}

async function handleLiftBan(banId: string) {
  try {
    await staffStore.liftBan(banId)
  } catch (error) {
    console.error('Failed to lift ban:', error)
  }
}

async function handleCancelBilling(mode: 'at_period_end' | 'immediate') {
  if (!staffStore.userOverview) return

  const confirmed = confirm(
    mode === 'immediate' 
      ? 'Are you sure you want to cancel billing immediately?' 
      : 'Are you sure you want to cancel billing at period end?'
  )

  if (!confirmed) return

  try {
    await staffStore.cancelBilling(staffStore.userOverview.user.id, { 
      mode: mode as BillingCancelMode 
    })
  } catch (error) {
    console.error('Failed to cancel billing:', error)
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.staff-user-overview {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  font-weight: 600;
}

.back-link {
  color: #007bff;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.error-banner {
  padding: 1rem;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
  margin-bottom: 1rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.overview-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.section h2 {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  border-bottom: 2px solid #007bff;
  padding-bottom: 0.5rem;
}

.section h3 {
  margin: 1.5rem 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item .label {
  font-weight: 600;
  color: #666;
  font-size: 0.875rem;
}

.trust-stats,
.activity-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: #007bff;
  margin-bottom: 0.5rem;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #666;
  background: #f8f9fa;
  border-radius: 4px;
}

.bans-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ban-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: #f8f9fa;
}

.ban-card.ban-active {
  border-color: #ffc107;
  background: #fff3cd;
}

.ban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.ban-scope {
  font-weight: 600;
  font-size: 1.125rem;
}

.ban-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-active {
  background-color: #ffc107;
  color: #856404;
}

.status-lifted {
  background-color: #d1ecf1;
  color: #0c5460;
}

.ban-details p {
  margin: 0.5rem 0;
  font-size: 0.875rem;
}

.ban-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  font-size: 0.875rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  font-size: 1rem;
}

.form-group textarea {
  resize: vertical;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-lift {
  background-color: #28a745;
  color: white;
  margin-top: 0.5rem;
}

.btn-lift:hover:not(:disabled) {
  background-color: #218838;
}

.btn-warning {
  background-color: #ffc107;
  color: #212529;
}

.btn-warning:hover:not(:disabled) {
  background-color: #e0a800;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}
</style>
