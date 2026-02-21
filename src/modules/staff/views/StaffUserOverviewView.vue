<template>
  <div class="staff-user-overview">
    <div class="page-header">
      <div class="header-left">
        <router-link to="/staff/users" class="back-link">
          ← {{ $t('staff.sidebar.users') }}
        </router-link>
        <h1 class="page-title">
          <template v-if="staffStore.userOverview">
            {{ staffStore.userOverview.user.first_name || '' }}
            {{ staffStore.userOverview.user.last_name || '' }}
            <Badge v-if="staffStore.userOverview.user.role" :variant="roleBadgeVariant(staffStore.userOverview.user.role)" size="sm">
              {{ staffStore.userOverview.user.role }}
            </Badge>
          </template>
          <template v-else>{{ $t('staff.userOverview.title') }}</template>
        </h1>
      </div>
    </div>

    <div v-if="staffStore.loadUserOverviewError" class="error-banner" role="alert">
      {{ staffStore.loadUserOverviewError }}
    </div>

    <div v-if="staffStore.isLoading" class="loading">
      <LoadingSpinner />
    </div>

    <div v-else-if="staffStore.userOverview" class="overview-content">
      <!-- User Info Section -->
      <Card class="section">
        <h2 class="section-heading">{{ $t('staff.userOverview.userInfo') }}</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.userId') }}</span>
            <span class="value mono">{{ staffStore.userOverview.user.id }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.email') }}</span>
            <span class="value">{{ staffStore.userOverview.user.email }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.role') }}</span>
            <Badge :variant="roleBadgeVariant(staffStore.userOverview.user.role)" size="sm">
              {{ staffStore.userOverview.user.role }}
            </Badge>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.createdAt') }}</span>
            <span class="value">{{ formatDate(staffStore.userOverview.user.created_at) }}</span>
          </div>
        </div>
      </Card>

      <!-- Trust Section -->
      <Card class="section">
        <h2 class="section-heading">{{ $t('staff.userOverview.trustInfo') }}</h2>
        
        <div class="trust-stats">
          <div class="mini-stat">
            <span class="mini-stat-value">{{ staffStore.userOverview.trust.blocks_count }}</span>
            <span class="mini-stat-label">{{ $t('staff.userOverview.blocksCount') }}</span>
          </div>
          <div class="mini-stat" :class="{ 'mini-stat-danger': staffStore.userOverview.trust.reports_open_count > 0 }">
            <span class="mini-stat-value">{{ staffStore.userOverview.trust.reports_open_count }}</span>
            <span class="mini-stat-label">{{ $t('staff.userOverview.reportsOpenCount') }}</span>
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
              <Button 
                v-if="ban.status === 'ACTIVE'"
                variant="primary"
                size="sm"
                :disabled="staffStore.isLoading"
                @click="handleLiftBan(ban.id)"
              >
                {{ $t('staff.userOverview.liftBan') }}
              </Button>
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
              <Button 
                type="submit" 
                variant="primary"
                :disabled="staffStore.isLoading"
              >
                {{ $t('staff.userOverview.createBanButton') }}
              </Button>
            </form>
          </div>
        </div>
      </Card>

      <!-- Billing Section -->
      <Card class="section">
        <h2 class="section-heading">{{ $t('staff.userOverview.billingInfo') }}</h2>
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
            <Button 
              variant="secondary"
              :disabled="staffStore.isLoading || staffStore.userOverview.billing.cancel_at_period_end"
              @click="handleCancelBilling('at_period_end')"
            >
              {{ $t('staff.userOverview.cancelAtPeriodEnd') }}
            </Button>
            <Button 
              variant="danger"
              :disabled="staffStore.isLoading"
              @click="handleCancelBilling('immediate')"
            >
              {{ $t('staff.userOverview.cancelImmediate') }}
            </Button>
          </div>
        </div>
      </Card>

      <!-- Billing Operations Section (v0.79.0) -->
      <Card class="section">
        <h2 class="section-heading">{{ $t('staff.userOverview.billingOperations') }}</h2>
        <UserBillingOpsPanel :user-id="staffStore.userOverview.user.id" />
      </Card>

      <!-- Activity Section -->
      <Card class="section">
        <h2 class="section-heading">{{ $t('staff.userOverview.activityInfo') }}</h2>
        <div class="activity-stats">
          <div class="mini-stat">
            <span class="mini-stat-value">{{ staffStore.userOverview.activity.inquiries_count_30d }}</span>
            <span class="mini-stat-label">{{ $t('staff.userOverview.inquiries30d') }}</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-value">{{ staffStore.userOverview.activity.contacts_unlocked_30d }}</span>
            <span class="mini-stat-label">{{ $t('staff.userOverview.contactsUnlocked30d') }}</span>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStaffStore } from '@/stores/staffStore'
import { BanScope, BillingCancelMode } from '@/types/staff'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import Card from '@/ui/Card.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import UserBillingOpsPanel from '@/modules/staff/components/UserBillingOpsPanel.vue'

const route = useRoute()
const staffStore = useStaffStore()

function roleBadgeVariant(role: string) {
  if (role === 'tutor') return 'accent'
  if (role === 'student') return 'default'
  if (role === 'admin' || role === 'superadmin') return 'warning'
  return 'muted'
}

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
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.back-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: 500;
  transition: color var(--transition-base);
}

.back-link:hover {
  color: var(--accent);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.error-banner {
  padding: var(--space-md);
  background: color-mix(in srgb, var(--danger-bg, #ef4444) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger-bg, #ef4444) 25%, transparent);
  border-radius: var(--radius-md);
  color: var(--danger-bg, #ef4444);
}

.loading {
  text-align: center;
  padding: var(--space-xl);
}

.overview-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.section {
  padding: var(--space-lg);
}

.section-heading {
  margin: 0 0 var(--space-lg) 0;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--border-color);
}

.section h3 {
  margin: var(--space-lg) 0 var(--space-md) 0;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-md);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-item .label {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.info-item .value {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.info-item .mono {
  font-family: monospace;
}

.trust-stats,
.activity-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.mini-stat {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  text-align: center;
  border: 1px solid var(--border-color);
}

.mini-stat-danger {
  border-color: color-mix(in srgb, var(--danger-bg, #ef4444) 40%, transparent);
}

.mini-stat-value {
  display: block;
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.mini-stat-danger .mini-stat-value {
  color: var(--danger-bg, #ef4444);
}

.mini-stat-label {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.bans-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.ban-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  background: var(--bg-secondary);
}

.ban-card.ban-active {
  border-color: var(--warning-bg);
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
}

.ban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.ban-scope {
  font-weight: 600;
  font-size: var(--text-lg);
}

.ban-status {
  padding: var(--space-2xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 500;
}

.status-active {
  background: color-mix(in srgb, var(--warning-bg) 20%, transparent);
  color: var(--warning-bg);
}

.status-lifted {
  background: color-mix(in srgb, var(--info-bg) 15%, transparent);
  color: var(--info-bg);
}

.ban-details p {
  margin: var(--space-xs) 0;
  font-size: var(--text-sm);
}

.ban-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 500px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-group label {
  font-weight: 600;
  font-size: var(--text-sm);
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: var(--space-xs);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-base);
  background: var(--card-bg);
  color: var(--text-primary);
}

.form-group textarea {
  resize: vertical;
}

.action-buttons {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-md);
}
</style>
