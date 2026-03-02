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
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.lastLogin') }}</span>
            <span class="value">{{ staffStore.userOverview.user.last_login ? formatDate(staffStore.userOverview.user.last_login) : $t('staff.userOverview.never') }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.emailVerification') }}</span>
            <div class="email-verify-row">
              <Badge v-if="staffStore.userOverview.user.email_verified" variant="success" size="sm">
                {{ $t('staff.userOverview.emailVerified') }}
              </Badge>
              <Badge v-else variant="danger" size="sm">
                {{ $t('staff.userOverview.emailNotVerified') }}
              </Badge>
              <Button
                v-if="!staffStore.userOverview.user.email_verified"
                variant="primary"
                size="sm"
                :disabled="staffStore.isLoading"
                @click="handleVerifyEmail"
              >
                {{ $t('staff.userOverview.verifyEmailButton') }}
              </Button>
            </div>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.accountStatus') }}</span>
            <div class="status-action-row">
              <Badge :variant="(staffStore.userOverview.user as any).is_active !== false ? 'success' : 'danger'" size="sm">
                {{ (staffStore.userOverview.user as any).is_active !== false ? $t('staff.userOverview.active') : $t('staff.userOverview.inactive') }}
              </Badge>
              <Button
                :variant="(staffStore.userOverview.user as any).is_active !== false ? 'danger' : 'primary'"
                size="sm"
                :disabled="staffStore.isLoading"
                @click="handleToggleActive"
              >
                {{ (staffStore.userOverview.user as any).is_active !== false ? $t('staff.userOverview.deactivate') : $t('staff.userOverview.activate') }}
              </Button>
            </div>
          </div>
          <div class="info-item" v-if="staffStore.userOverview.user.role === 'tutor'">
            <span class="label">{{ $t('staff.userOverview.publicProfile') }}</span>
            <a
              :href="`/tutors/${staffStore.userOverview.user.id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="profile-link"
            >
              <ExternalLink :size="14" />
              {{ $t('staff.userOverview.openProfile') }}
            </a>
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

      <!-- Account Management Section (v0.91.0) -->
      <Card class="section">
        <h2 class="section-heading">{{ $t('staff.userOverview.accountManagement') }}</h2>
        <div class="account-mgmt-grid">

          <!-- Change Role -->
          <div class="mgmt-panel">
            <h3 class="mgmt-panel-title">{{ $t('staff.userOverview.changeRole') }}</h3>
            <div class="mgmt-row">
              <select v-model="roleForm.newRole" class="mgmt-select">
                <option value="student">student</option>
                <option value="tutor">tutor</option>
                <option value="admin">admin</option>
                <option value="superadmin">superadmin</option>
              </select>
              <Button variant="default" size="sm" :disabled="roleForm.loading" @click="handleChangeRole">
                {{ roleForm.loading ? $t('common.saving') + '…' : $t('staff.userOverview.applyRole') }}
              </Button>
            </div>
            <p v-if="roleForm.result" class="mgmt-result" :class="roleForm.error ? 'mgmt-error' : 'mgmt-success'">
              {{ roleForm.result }}
            </p>
          </div>

          <!-- Reset MFA -->
          <div class="mgmt-panel">
            <h3 class="mgmt-panel-title">{{ $t('staff.userOverview.resetMfa') }}</h3>
            <p class="mgmt-desc">{{ $t('staff.userOverview.resetMfaDesc') }}</p>
            <Button variant="danger" size="sm" :disabled="mfaForm.loading" @click="handleResetMfa">
              {{ mfaForm.loading ? $t('common.loading') + '…' : $t('staff.userOverview.resetMfaBtn') }}
            </Button>
            <p v-if="mfaForm.result" class="mgmt-result" :class="mfaForm.error ? 'mgmt-error' : 'mgmt-success'">
              {{ mfaForm.result }}
            </p>
          </div>

          <!-- Grant Subscription -->
          <div class="mgmt-panel">
            <h3 class="mgmt-panel-title">{{ $t('staff.userOverview.grantSubscription') }}</h3>
            <div class="mgmt-row" style="flex-wrap: wrap; gap: 8px;">
              <select v-model="grantForm.planId" class="mgmt-select">
                <option value="">{{ $t('staff.userOverview.selectPlan') }}</option>
                <option v-for="p in availablePlans" :key="p.id" :value="p.id">{{ p.name }} ({{ p.slug }})</option>
              </select>
              <input
                v-model.number="grantForm.days"
                type="number"
                min="1"
                max="3650"
                class="mgmt-input-days"
                :placeholder="$t('staff.userOverview.days')"
              />
              <Button variant="primary" size="sm" :disabled="!grantForm.planId || grantForm.loading" @click="handleGrantSubscription">
                {{ grantForm.loading ? $t('common.saving') + '…' : $t('staff.userOverview.grantBtn') }}
              </Button>
            </div>
            <p v-if="grantForm.result" class="mgmt-result" :class="grantForm.error ? 'mgmt-error' : 'mgmt-success'">
              {{ grantForm.result }}
            </p>
          </div>
        </div>
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

      <!-- User Journey Timeline (Phase 6.1) -->
      <Card class="section">
        <h2 class="section-heading">{{ $t('staff.journey.title') }}</h2>
        <UserJourneyTimeline :user-id="staffStore.userOverview.user.id" />
      </Card>

      <!-- Audit Log Section -->
      <Card class="section">
        <div class="section-header-row">
          <h2 class="section-heading">
            <History :size="18" class="section-icon" />
            {{ $t('staff.userOverview.auditLog') }}
          </h2>
          <span v-if="auditLogTotal > 0" class="audit-total">{{ $t('staff.userOverview.auditTotal', { count: auditLogTotal }) }}</span>
        </div>

        <div v-if="auditLogLoading" class="audit-loading">
          <LoadingSpinner />
        </div>
        <div v-else-if="auditLog.length === 0" class="audit-empty">
          {{ $t('staff.userOverview.auditEmpty') }}
        </div>
        <div v-else class="audit-list">
          <div v-for="ev in auditLog" :key="ev.id" class="audit-item">
            <div class="audit-action">{{ auditActionLabel(ev.action) }}</div>
            <div class="audit-meta">
              <span v-if="ev.entity_type" class="audit-entity">{{ ev.entity_type }}</span>
              <span class="audit-time">{{ formatDate(ev.created_at) }}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ExternalLink, History } from 'lucide-vue-next'
import { useStaffStore } from '@/stores/staffStore'
import { getUserAuditLog } from '@/api/staff'
import type { AuditEvent } from '@/api/staff'
import { BanScope, BillingCancelMode } from '@/types/staff'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import Card from '@/ui/Card.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import UserBillingOpsPanel from '@/modules/staff/components/UserBillingOpsPanel.vue'
import UserJourneyTimeline from '@/modules/staff/components/UserJourneyTimeline.vue'
import apiClient from '@/utils/apiClient'
import { getSubscriptionPlans } from '@/modules/staff/api/subscriptionPlansApi'
import type { PlanItem } from '@/modules/staff/api/subscriptionPlansApi'

const route = useRoute()
const { t } = useI18n()
const staffStore = useStaffStore()

const auditLog = ref<AuditEvent[]>([])
const auditLogLoading = ref(false)
const auditLogTotal = ref(0)

// Account Management forms (v0.91.0)
const availablePlans = ref<PlanItem[]>([])
const roleForm = ref({ newRole: 'tutor', loading: false, result: '', error: false })
const mfaForm = ref({ loading: false, result: '', error: false })
const grantForm = ref({ planId: '' as string | number, days: 30, loading: false, result: '', error: false })

async function handleChangeRole() {
  if (!staffStore.userOverview) return
  const userId = staffStore.userOverview.user.id
  roleForm.value.loading = true
  roleForm.value.result = ''
  roleForm.value.error = false
  try {
    const res = await apiClient.patch(`/v1/staff/users/${userId}/change-role/`, { role: roleForm.value.newRole })
    roleForm.value.result = t('staff.userOverview.roleChanged', { role: res.new_role })
    await staffStore.loadUserOverview(String(userId))
  } catch (e: any) {
    roleForm.value.error = true
    roleForm.value.result = e?.response?.data?.error || t('staff.userOverview.roleChangeFailed')
  } finally {
    roleForm.value.loading = false
  }
}

async function handleResetMfa() {
  if (!staffStore.userOverview) return
  const userId = staffStore.userOverview.user.id
  if (!confirm(t('staff.userOverview.confirmResetMfa', { email: staffStore.userOverview.user.email }))) return
  mfaForm.value.loading = true
  mfaForm.value.result = ''
  mfaForm.value.error = false
  try {
    await apiClient.post(`/v1/staff/users/${userId}/reset-mfa/`)
    mfaForm.value.result = t('staff.userOverview.mfaResetSuccess')
  } catch (e: any) {
    mfaForm.value.error = true
    mfaForm.value.result = e?.response?.data?.error || t('staff.userOverview.mfaResetFailed')
  } finally {
    mfaForm.value.loading = false
  }
}

async function handleGrantSubscription() {
  if (!staffStore.userOverview || !grantForm.value.planId) return
  const userId = staffStore.userOverview.user.id
  grantForm.value.loading = true
  grantForm.value.result = ''
  grantForm.value.error = false
  try {
    const res = await apiClient.post(`/v1/staff/users/${userId}/grant-subscription/`, {
      plan_id: grantForm.value.planId,
      days: grantForm.value.days,
    })
    grantForm.value.result = t('staff.userOverview.subscriptionGranted', {
      plan: res.plan,
      days: res.days,
    })
    await staffStore.loadUserOverview(String(userId))
  } catch (e: any) {
    grantForm.value.error = true
    grantForm.value.result = e?.response?.data?.error || t('staff.userOverview.subscriptionGrantFailed')
  } finally {
    grantForm.value.loading = false
  }
}

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
    loadAuditLog(userId)
  }
  // Load plans for grant-subscription panel (silent fail)
  try {
    const res = await getSubscriptionPlans()
    availablePlans.value = res.results.filter(p => p.is_active)
  } catch {
    // Non-critical
  }
})

async function loadAuditLog(userId: string) {
  auditLogLoading.value = true
  try {
    const res = await getUserAuditLog(userId, { limit: 20 })
    auditLog.value = res.results
    auditLogTotal.value = res.count
  } catch {
    // Silent — audit log is non-critical
  } finally {
    auditLogLoading.value = false
  }
}

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

async function handleVerifyEmail() {
  if (!staffStore.userOverview) return

  const confirmed = confirm(
    t('staff.userOverview.confirmVerifyEmail', { email: staffStore.userOverview.user.email })
  )
  if (!confirmed) return

  try {
    await staffStore.verifyEmail(staffStore.userOverview.user.id)
    await staffStore.loadUserOverview(staffStore.userOverview.user.id)
  } catch (error) {
    console.error('Failed to verify email:', error)
  }
}

async function handleToggleActive() {
  if (!staffStore.userOverview) return
  const user = staffStore.userOverview.user
  const action = (user as any).is_active
    ? t('staff.userOverview.deactivate')
    : t('staff.userOverview.activate')
  const confirmed = confirm(
    t('staff.userOverview.confirmToggleActive', { action, email: user.email })
  )
  if (!confirmed) return

  try {
    await staffStore.toggleUserActive(String(user.id))
    await staffStore.loadUserOverview(String(user.id))
  } catch (error) {
    console.error('Failed to toggle user status:', error)
  }
}

function auditActionLabel(action: string): string {
  return action.replace(/[._]/g, ' ')
}

async function handleCancelBilling(mode: 'at_period_end' | 'immediate') {
  if (!staffStore.userOverview) return

  const confirmed = confirm(
    mode === 'immediate'
      ? t('staff.userOverview.confirmCancelImmediate')
      : t('staff.userOverview.confirmCancelPeriodEnd')
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

.email-verify-row {
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

.status-action-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.profile-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-size: var(--text-sm);
  text-decoration: none;
}

.profile-link:hover {
  text-decoration: underline;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--border-color);
}

.section-header-row .section-heading {
  margin: 0;
  padding: 0;
  border: none;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.section-icon {
  color: var(--text-secondary);
}

.audit-total {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.audit-loading,
.audit-empty {
  padding: var(--space-md);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 400px;
  overflow-y: auto;
}

.audit-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: background var(--transition-base);
}

.audit-item:hover {
  background: var(--bg-secondary);
}

.audit-action {
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.8rem;
}

.audit-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-xs);
}

.audit-entity {
  color: var(--accent);
  font-weight: 500;
}

.audit-time {
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Account Management Section (v0.91.0) */
.account-mgmt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-md);
}

.mgmt-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.mgmt-panel-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.mgmt-desc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.mgmt-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.mgmt-select {
  flex: 1;
  padding: 5px var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
}

.mgmt-input-days {
  width: 72px;
  padding: 5px var(--space-xs);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  text-align: center;
}

.mgmt-result {
  font-size: var(--text-xs);
  margin: 0;
  padding: 4px var(--space-sm);
  border-radius: var(--radius-sm);
}

.mgmt-success {
  background: color-mix(in srgb, #22c55e 12%, transparent);
  color: #166534;
}

.mgmt-error {
  background: color-mix(in srgb, #ef4444 10%, transparent);
  color: #ef4444;
}
</style>
