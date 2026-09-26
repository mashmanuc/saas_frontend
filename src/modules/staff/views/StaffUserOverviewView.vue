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
              {{ roleLabel(staffStore.userOverview.user.role) }}
            </Badge>
          </template>
          <template v-else>{{ $t('staff.userOverview.title') }}</template>
        </h1>
      </div>
    </div>

    <div v-if="staffStore.loadUserOverviewError" class="error-banner" role="alert">
      {{ staffStore.loadUserOverviewError }}
    </div>

    <!-- 2026-09-26: помилки дій (скасування, бан, вимкнення) раніше йшли лише в console -->
    <div v-if="actionError" class="error-banner" role="alert">
      {{ $t('staff.userOverview.actionFailed', { reason: actionError }) }}
    </div>

    <!-- Спінер — лише поки картки цього користувача ще немає. БУЛО: будь-яка дія
         вмикала спільний isLoading і ховала всю картку, панелі перемонтовувались. -->
    <div v-if="showSpinner" class="loading">
      <LoadingSpinner />
    </div>

    <!-- Лише картка користувача з адреси: при збої чи запізнілій відповіді іншого
         користувача не показуємо (рев'ю 2026-09-26) — дії йшли б на нього. -->
    <div v-else-if="isRouteUserShown" class="overview-content">
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
              {{ roleLabel(staffStore.userOverview.user.role) }}
            </Badge>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.createdAt') }}</span>
            <span class="value">{{ formatDate(staffStore.userOverview.user.created_at) }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.lastLogin') }}</span>
            <!-- 2026-09-26: із сесій — `last_login` ніхто не пише, тут майже завжди було «ніколи» -->
            <span class="value">{{ lastSignIn ? formatDate(lastSignIn) : $t('staff.userOverview.never') }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.userOverview.lastActive') }}</span>
            <span class="value">{{ staffStore.userOverview.user.last_active_at ? formatDate(staffStore.userOverview.user.last_active_at) : '—' }}</span>
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
          <!-- 2026-09-26: «Відкрити профіль» (/tutors/:id) прибрано — публічний профіль
               жив у marketplace (вимкнено), посилання вело на лендинг. -->
        </div>
      </Card>

      <!-- 2026-09-26, перед рекламою: з якого пристрою входив і які помилки мав -->
      <Card class="section">
        <h2 class="section-heading">
          <MonitorSmartphone :size="18" class="section-icon" />
          {{ $t('staff.insight.devices.title') }}
        </h2>
        <UserDevicesPanel :user-id="staffStore.userOverview.user.id" />
      </Card>

      <Card class="section">
        <h2 class="section-heading">
          <AlertTriangle :size="18" class="section-icon" />
          {{ $t('staff.insight.errors.title') }}
        </h2>
        <UserErrorsPanel :user-id="staffStore.userOverview.user.id" />
      </Card>

      <!-- Trust Section -->
      <Card class="section">
        <h2 class="section-heading">{{ $t('staff.userOverview.trustInfo') }}</h2>
        <!-- 2026-09-26: лічильники «Блокувань» і «Відкритих скарг» сховано — у v1 блок і
             скаргу можна було створити лише в marketplace (вимкнено), тож вони завжди 0. -->

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
                <span class="ban-scope">{{ banScopeLabel(ban.scope) }}</span>
                <span :class="`ban-status status-${ban.status.toLowerCase()}`">
                  {{ banStatusLabel(ban.status) }}
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

          <!-- Create Ban Form — СХОВАНО 2026-09-26 (рішення «сховати, не видаляти»): у v1 бан
               перевіряє лише оплата (billing/api/views.py), входу й дошки він не блокує, а
               області PLATFORM/MESSAGING бекенд не приймав (тихий 400). Повернути — BAN_CREATION_ENABLED. -->
          <div v-if="BAN_CREATION_ENABLED" class="create-ban-section">
            <h3>{{ $t('staff.userOverview.createBan') }}</h3>
            <form @submit.prevent="handleCreateBan" class="ban-form">
              <div class="form-group">
                <label for="ban-scope">{{ $t('staff.userOverview.scope') }}</label>
                <select 
                  id="ban-scope"
                  v-model="banForm.scope" 
                  required
                >
                  <option v-for="scope in BAN_SCOPES" :key="scope" :value="scope">{{ banScopeLabel(scope) }}</option>
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
            <span>{{ staffStore.userOverview.billing.subscription_status ? subscriptionStatusLabel(staffStore.userOverview.billing.subscription_status) : $t('staff.userOverview.noSubscription') }}</span>
          </div>
          <div v-if="staffStore.userOverview.billing.provider" class="info-item">
            <span class="label">{{ $t('staff.userOverview.subscriptionSource') }}:</span>
            <span>{{ subscriptionSourceLabel(staffStore.userOverview.billing.provider) }}</span>
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

        <!-- Лише для чинної підписки: БУЛО — кнопки й для EXPIRED/CANCELED → тихий 404 -->
        <div v-if="canCancelSubscription" class="billing-actions">
          <h3>{{ $t('staff.userOverview.billingActions') }}</h3>
          <div class="action-buttons">
            <Button
              v-if="!staffStore.userOverview.billing.cancel_at_period_end && String(staffStore.userOverview.billing.subscription_status).toUpperCase() !== 'TRIALING'"
              variant="secondary"
              :disabled="staffStore.isLoading"
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
        <!-- Бекенд пускає сюди лише суперкористувача (IsBillingOps): admin без цього
             отримував 403-тост на кожному відкритті картки. -->
        <UserBillingOpsPanel v-if="canBillingOps" :user-id="staffStore.userOverview.user.id" />
        <p v-else class="mgmt-desc">{{ $t('staff.billingOps.superadminOnly') }}</p>
      </Card>

      <!-- Account Management Section (v0.91.0) -->
      <Card class="section">
        <h2 class="section-heading">{{ $t('staff.userOverview.accountManagement') }}</h2>
        <div class="account-mgmt-grid">

          <!-- Change Role -->
          <div class="mgmt-panel">
            <h3 class="mgmt-panel-title">{{ $t('staff.userOverview.changeRole') }}</h3>
            <div class="mgmt-row">
              <!-- БУЛО: за замовчуванням вибрано `tutor`, підписи — сирі коди ролей -->
              <select v-model="roleForm.newRole" class="mgmt-select">
                <option value="" disabled>{{ $t('staff.userOverview.selectRole') }}</option>
                <option v-for="role in ASSIGNABLE_ROLES" :key="role" :value="role">{{ roleLabel(role) }}</option>
              </select>
              <Button variant="default" size="sm" :disabled="roleForm.loading || !roleForm.newRole" @click="handleChangeRole">
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
                <option v-for="p in grantablePlans" :key="p.id" :value="p.id">{{ p.name }} ({{ p.slug }})</option>
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

      <!-- Marketplace Extraction 2026-06-18: «Активність за 30 днів» (inquiries / contacts
           unlocked) прибрано — marketplace/inquiry-метрики, мертві в BYO (завжди 0). -->

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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { History, MonitorSmartphone, AlertTriangle } from 'lucide-vue-next'
import { useStaffStore } from '@/stores/staffStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { getUserAuditLog } from '@/api/staff'
import type { AuditEvent } from '@/api/staff'
import { BanScope, BillingCancelMode } from '@/types/staff'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import Card from '@/ui/Card.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import UserBillingOpsPanel from '@/modules/staff/components/UserBillingOpsPanel.vue'
import UserJourneyTimeline from '@/modules/staff/components/UserJourneyTimeline.vue'
import UserDevicesPanel from '@/modules/staff/components/UserDevicesPanel.vue'
import UserErrorsPanel from '@/modules/staff/components/UserErrorsPanel.vue'
import apiClient from '@/utils/apiClient'
import { getSubscriptionPlans } from '@/modules/staff/api/subscriptionPlansApi'
import type { PlanItem } from '@/modules/staff/api/subscriptionPlansApi'
import { activeLocale } from '@/utils/i18nDate'

const route = useRoute()
const { t, te } = useI18n()
const staffStore = useStaffStore()
const authStore = useAuthStore()
// Права глядача — з бекенда (overview.viewer); роль із authStore — лише запасний варіант.
const viewer = computed(() => staffStore.userOverview?.viewer ?? null)
const isSuperadmin = computed(() =>
  viewer.value ? !!viewer.value.is_superadmin : String(authStore.user?.role || '').toLowerCase() === 'superadmin'
)
const canBillingOps = computed(() => (viewer.value ? !!viewer.value.can_billing_ops : isSuperadmin.value))

// Останній вхід — із сесій (бекенд віддає `last_sign_in_at`); `last_login` — лише
// запасний, бо його ніхто не пише (на проді 2 з 88, 2026-09-26).
const lastSignIn = computed(() => {
  const u = staffStore.userOverview?.user
  return u?.last_sign_in_at || u?.last_login || null
})

const auditLog = ref<AuditEvent[]>([])
const auditLogLoading = ref(false)
const auditLogTotal = ref(0)

// Account Management forms (v0.91.0)
const availablePlans = ref<PlanItem[]>([])
const roleForm = ref({ newRole: '', loading: false, result: '', error: false })
const mfaForm = ref({ loading: false, result: '', error: false })
const grantForm = ref({ planId: '' as string | number, days: 30, loading: false, result: '', error: false })

// 2026-09-26 (аудит адмінки): ролі, які адмінка дає ставити. Ролі адмінки видає лише
// суперадмін (бекенд теж відмовить) — адміну їх і не пропонуємо.
const ASSIGNABLE_ROLES = computed(() =>
  isSuperadmin.value ? ['student', 'tutor', 'admin', 'superadmin'] : ['student', 'tutor']
)
// Області, які приймає бекенд (StaffBanCreateSerializer). БУЛО: PLATFORM/MESSAGING → тихий 400.
const BAN_SCOPES: BanScope[] = [BanScope.ALL, BanScope.BILLING, BanScope.CONTACTS, BanScope.CHAT, BanScope.INQUIRIES]
// Створення бану сховано (рішення «сховати, не видаляти»): у v1 бан блокує лише оплату.
const BAN_CREATION_ENABLED = false

/** Людське пояснення помилки з тіла відповіді (`detail`, інакше речення в `error`). */
function errorDetail(e: any, fallback: string): string {
  const data = e?.response?.data
  if (typeof data?.detail === 'string' && data.detail) return data.detail
  if (typeof data?.error === 'string' && data.error.includes(' ')) return data.error
  return fallback
}

// Видавати має сенс лише платний, увімкнений план у гривнях (USD/Paddle вимкнено).
const grantablePlans = computed(() =>
  availablePlans.value.filter(p => !p.slug.startsWith('free') && (!p.currency || p.currency === 'UAH'))
)

const isRouteUserShown = computed(() =>
  !!staffStore.userOverview && String(staffStore.userOverview.user?.id ?? '') === String(route.params.id ?? '')
)
const showSpinner = computed(() => !isRouteUserShown.value && !staffStore.loadUserOverviewError)

const actionError = computed(() => {
  const err = staffStore.cancelBillingError || staffStore.liftBanError || staffStore.createBanError || staffStore.error
  return err && err !== staffStore.loadUserOverviewError ? err : null
})

const canCancelSubscription = computed(() => {
  const status = String(staffStore.userOverview?.billing?.subscription_status || '').toUpperCase()
  // TRIALING — лише «негайно» (пробний завершується сам; рев'ю 2026-09-26)
  return status === 'ACTIVE' || status === 'PAST_DUE' || status === 'TRIALING'
})

function labelOr(key: string, fallback: string): string {
  return te(key) ? t(key) : fallback
}
const roleLabel = (role: string) => labelOr(`staff.roles.${String(role || '').toLowerCase()}`, role)
const banScopeLabel = (scope: string) => labelOr(`staff.userOverview.banScopes.${scope}`, scope)
const banStatusLabel = (status: string) => labelOr(`staff.userOverview.banStatuses.${status}`, status)
const subscriptionStatusLabel = (status: string) =>
  labelOr(`staff.userOverview.subscriptionStatuses.${String(status).toUpperCase()}`, status)
const subscriptionSourceLabel = (provider: string) =>
  labelOr(`staff.userOverview.subscriptionSources.${String(provider).toUpperCase()}`, provider)

async function handleChangeRole() {
  if (!staffStore.userOverview || !roleForm.value.newRole) return
  const userId = staffStore.userOverview.user.id
  const confirmed = confirm(t('staff.userOverview.confirmChangeRole', {
    email: staffStore.userOverview.user.email,
    role: roleLabel(roleForm.value.newRole),
  }))
  if (!confirmed) return
  roleForm.value.loading = true
  roleForm.value.result = ''
  roleForm.value.error = false
  try {
    const res = await apiClient.patch(`/v1/staff/users/${userId}/change-role/`, { role: roleForm.value.newRole })
    roleForm.value.result = t('staff.userOverview.roleChanged', { role: roleLabel(res.new_role) })
      + (res?.mfa_grace_until ? ' ' + t('staff.userOverview.roleChangedMfaGrace', { until: formatDate(res.mfa_grace_until) }) : '')
    roleForm.value.newRole = ''
    await staffStore.loadUserOverview(String(userId))
  } catch (e: any) {
    roleForm.value.error = true
    roleForm.value.result = errorDetail(e, t('staff.userOverview.roleChangeFailed'))
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
    const res = await apiClient.post(`/v1/staff/users/${userId}/reset-mfa/`)
    // БУЛО: «успішно» за будь-якої відповіді. Тепер — що сталося насправді.
    mfaForm.value.result = !res?.mfa_cleared
      ? t('staff.userOverview.mfaWasNotEnabled')
      : res?.mfa_grace_until
        ? t('staff.userOverview.mfaResetWithGrace', { until: formatDate(res.mfa_grace_until) })
        : t('staff.userOverview.mfaResetSuccess')
  } catch (e: any) {
    mfaForm.value.error = true
    mfaForm.value.result = errorDetail(e, t('staff.userOverview.mfaResetFailed'))
  } finally {
    mfaForm.value.loading = false
  }
}

async function handleGrantSubscription() {
  if (!staffStore.userOverview || !grantForm.value.planId) return
  const userId = staffStore.userOverview.user.id
  const plan = grantablePlans.value.find(p => String(p.id) === String(grantForm.value.planId))
  // БУЛО: видача без жодного підтвердження.
  const confirmed = confirm(t('staff.userOverview.confirmGrantSubscription', {
    plan: plan?.name ?? '',
    days: grantForm.value.days,
    email: staffStore.userOverview.user.email,
  }))
  if (!confirmed) return
  grantForm.value.loading = true
  grantForm.value.result = ''
  grantForm.value.error = false
  try {
    const res = await apiClient.post(`/v1/staff/users/${userId}/grant-subscription/`, {
      plan_id: grantForm.value.planId,
      days: grantForm.value.days,
    })
    // entitlement_plan — план, який продукт РЕАЛЬНО бачить після видачі.
    grantForm.value.result = t('staff.userOverview.subscriptionGrantedReal', {
      plan: res.plan,
      until: formatDate(res.valid_until),
      entitlement: res.entitlement_plan,
    })
    await staffStore.loadUserOverview(String(userId))
  } catch (e: any) {
    grantForm.value.error = true
    grantForm.value.result = errorDetail(e, t('staff.userOverview.subscriptionGrantFailed'))
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

// Послідовність запитів: запізніла відповідь на попередню адресу не повинна
// лишитись на екрані під новою (рев'ю 2026-09-26).
let loadSeq = 0

async function loadUser(userId: string) {
  if (!userId) return
  const seq = ++loadSeq
  staffStore.clearErrors()
  // Результати форм належать попередньому користувачеві — при переході з картки на
  // картку вони лишались на екрані (знайдено наживо 2026-09-26).
  roleForm.value = { newRole: '', loading: false, result: '', error: false }
  mfaForm.value = { loading: false, result: '', error: false }
  grantForm.value = { planId: '', days: 30, loading: false, result: '', error: false }
  banForm.value = { scope: BanScope.CONTACTS, ends_at: '', reason: '' }
  try {
    await staffStore.loadUserOverview(userId)
  } catch (error) {
    console.error('Failed to load user overview:', error)
  }
  if (seq !== loadSeq) {
    // новіший запит уже пішов; якщо ця відповідь перезаписала сховище — перечитати поточного
    const routeId = String(route.params.id ?? '')
    if (routeId && String(staffStore.userOverview?.user?.id ?? '') !== routeId) loadUser(routeId)
    return
  }
  loadAuditLog(userId)
}

// 2026-09-26: БУЛО лише onMounted — перехід з картки на картку лишав на екрані
// попереднього користувача під адресою нового.
watch(() => route.params.id, (id, oldId) => {
  if (id && id !== oldId) loadUser(String(id))
})

onMounted(async () => {
  await loadUser(route.params.id as string)
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
  return new Date(dateString).toLocaleDateString(activeLocale(), {
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
