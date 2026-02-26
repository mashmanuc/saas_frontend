<template>
  <div class="plans-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">{{ $t('staff.plans.title') }}</h1>
        <p class="help-text">{{ $t('staff.plans.helpText') }}</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <Plus :size="16" />
        {{ $t('staff.plans.createPlan') }}
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="error-state">
      <p class="error-text">{{ error }}</p>
      <button class="btn-retry" @click="loadPlans">{{ $t('common.retry') }}</button>
    </div>

    <template v-else>
      <!-- Stats row -->
      <div class="stats-row">
        <div class="stat-chip">
          <span class="stat-num">{{ plans.length }}</span>
          <span class="stat-lbl">{{ $t('staff.plans.total') }}</span>
        </div>
        <div class="stat-chip success">
          <span class="stat-num">{{ activePlans.length }}</span>
          <span class="stat-lbl">{{ $t('staff.plans.active') }}</span>
        </div>
        <div class="stat-chip muted">
          <span class="stat-num">{{ inactivePlans.length }}</span>
          <span class="stat-lbl">{{ $t('staff.plans.inactive') }}</span>
        </div>
      </div>

      <!-- Plans grid -->
      <div class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="plan-card"
          :class="{ 'plan-inactive': !plan.is_active, 'plan-featured': plan.is_featured }"
        >
          <div class="plan-card-header">
            <div class="plan-name-row">
              <span class="plan-name">{{ plan.name }}</span>
              <span v-if="plan.is_featured" class="badge-featured">
                <Star :size="11" /> {{ $t('staff.plans.featured') }}
              </span>
            </div>
            <div class="plan-slug">{{ plan.slug }}</div>
          </div>

          <div class="plan-price-row">
            <span class="plan-price">{{ formatPrice(plan.price_decimal, plan.currency) }}</span>
            <span class="plan-interval">/ {{ $t(`staff.plans.interval.${plan.interval}`) }}</span>
          </div>

          <div class="plan-meta">
            <span class="meta-item">
              <BookOpen :size="13" />
              {{ plan.lessons_per_month === 0 ? $t('staff.plans.unlimited') : plan.lessons_per_month + ' ' + $t('staff.plans.lessons') }}
            </span>
            <span v-if="plan.provider_price_id" class="meta-item mono">
              <Zap :size="13" /> {{ plan.provider_price_id }}
            </span>
          </div>

          <div v-if="plan.features.length" class="plan-features">
            <span v-for="f in plan.features" :key="f" class="feature-tag">{{ f }}</span>
          </div>

          <div v-if="plan.description_uk || plan.description" class="plan-desc">
            {{ plan.description_uk || plan.description }}
          </div>

          <div class="plan-status-row">
            <span class="status-badge" :class="plan.is_active ? 'status-active' : 'status-inactive'">
              {{ plan.is_active ? $t('staff.plans.statusActive') : $t('staff.plans.statusInactive') }}
            </span>
            <span class="order-badge"># {{ plan.display_order }}</span>
          </div>

          <div class="plan-actions">
            <button class="btn-edit" @click="openEditModal(plan)" :title="$t('staff.plans.edit')">
              <Pencil :size="14" />
            </button>
            <button
              v-if="plan.is_active"
              class="btn-deactivate"
              @click="handleDeactivate(plan)"
              :title="$t('staff.plans.deactivate')"
            >
              <EyeOff :size="14" />
            </button>
            <button
              v-else
              class="btn-activate"
              @click="handleActivate(plan)"
              :title="$t('staff.plans.activate')"
            >
              <Eye :size="14" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="plans.length === 0" class="empty-state">
        <p>{{ $t('staff.plans.empty') }}</p>
      </div>
    </template>

    <!-- Create / Edit Modal -->
    <div v-if="modalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-box">
        <div class="modal-header">
          <h2 class="modal-title">
            {{ editingPlan ? $t('staff.plans.editPlan') : $t('staff.plans.createPlan') }}
          </h2>
          <button class="modal-close" @click="closeModal"><X :size="18" /></button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="handleSubmit" class="plan-form">
            <div class="form-row two-col">
              <div class="form-group">
                <label>{{ $t('staff.plans.form.name') }} *</label>
                <input v-model="form.name" required class="form-input" />
              </div>
              <div class="form-group">
                <label>{{ $t('staff.plans.form.slug') }} *</label>
                <input v-model="form.slug" required class="form-input mono" :disabled="!!editingPlan" />
              </div>
            </div>

            <div class="form-row two-col">
              <div class="form-group">
                <label>{{ $t('staff.plans.form.price') }} * <span class="hint">({{ $t('staff.plans.form.priceHint') }})</span></label>
                <input v-model.number="form.price" type="number" min="0" required class="form-input" />
              </div>
              <div class="form-group">
                <label>{{ $t('staff.plans.form.currency') }}</label>
                <select v-model="form.currency" class="form-select">
                  <option value="UAH">UAH</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div class="form-row two-col">
              <div class="form-group">
                <label>{{ $t('staff.plans.form.interval') }}</label>
                <select v-model="form.interval" class="form-select">
                  <option value="monthly">{{ $t('staff.plans.interval.monthly') }}</option>
                  <option value="quarterly">{{ $t('staff.plans.interval.quarterly') }}</option>
                  <option value="yearly">{{ $t('staff.plans.interval.yearly') }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>{{ $t('staff.plans.form.lessonsPerMonth') }} <span class="hint">(0 = {{ $t('staff.plans.unlimited') }})</span></label>
                <input v-model.number="form.lessons_per_month" type="number" min="0" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label>{{ $t('staff.plans.form.description') }}</label>
              <textarea v-model="form.description" rows="2" class="form-textarea" />
            </div>

            <div class="form-row two-col">
              <div class="form-group">
                <label>{{ $t('staff.plans.form.titleUk') }}</label>
                <input v-model="form.title_uk" class="form-input" />
              </div>
              <div class="form-group">
                <label>{{ $t('staff.plans.form.displayOrder') }}</label>
                <input v-model.number="form.display_order" type="number" min="0" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label>{{ $t('staff.plans.form.descriptionUk') }}</label>
              <textarea v-model="form.description_uk" rows="2" class="form-textarea" />
            </div>

            <div class="form-group">
              <label>{{ $t('staff.plans.form.features') }} <span class="hint">({{ $t('staff.plans.form.featuresHint') }})</span></label>
              <textarea
                v-model="featuresRaw"
                rows="3"
                class="form-textarea mono"
                :placeholder="$t('staff.plans.form.featuresPlaceholder')"
              />
            </div>

            <div class="form-row two-col">
              <div class="form-group">
                <label>{{ $t('staff.plans.form.providerPriceId') }}</label>
                <input v-model="form.provider_price_id" class="form-input mono" placeholder="price_xxx" />
              </div>
              <div class="form-group">
                <label>{{ $t('staff.plans.form.providerProductId') }}</label>
                <input v-model="form.provider_product_id" class="form-input mono" placeholder="prod_xxx" />
              </div>
            </div>

            <div class="form-checkboxes">
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.is_active" />
                {{ $t('staff.plans.form.isActive') }}
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.is_featured" />
                {{ $t('staff.plans.form.isFeatured') }}
              </label>
            </div>

            <div v-if="submitError" class="form-error">{{ submitError }}</div>

            <div class="modal-footer">
              <button type="button" class="btn-cancel" @click="closeModal">{{ $t('common.cancel') }}</button>
              <button type="submit" class="btn-submit" :disabled="submitting">
                <span v-if="submitting">{{ $t('common.saving') }}…</span>
                <span v-else>{{ editingPlan ? $t('common.save') : $t('staff.plans.createPlan') }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Plus, Pencil, Eye, EyeOff, X, Star, BookOpen, Zap,
} from 'lucide-vue-next'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deactivateSubscriptionPlan,
  type PlanItem,
  type PlanCreatePayload,
} from '../api/subscriptionPlansApi'

const { t } = useI18n()

const plans = ref<PlanItem[]>([])
const loading = ref(false)
const error = ref('')
const modalOpen = ref(false)
const editingPlan = ref<PlanItem | null>(null)
const submitting = ref(false)
const submitError = ref('')
const featuresRaw = ref('')

const defaultForm = (): PlanCreatePayload => ({
  name: '',
  slug: '',
  description: '',
  title_uk: '',
  description_uk: '',
  price: 0,
  currency: 'UAH',
  interval: 'monthly',
  lessons_per_month: 0,
  features: [],
  provider: 'stripe',
  provider_price_id: '',
  provider_product_id: '',
  is_active: true,
  is_featured: false,
  display_order: 0,
})

const form = ref<PlanCreatePayload>(defaultForm())

const activePlans = computed(() => plans.value.filter(p => p.is_active))
const inactivePlans = computed(() => plans.value.filter(p => !p.is_active))

async function loadPlans() {
  loading.value = true
  error.value = ''
  try {
    const res = await getSubscriptionPlans()
    plans.value = res.results
  } catch (e: any) {
    error.value = e?.message || t('staff.plans.errorLoad')
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  editingPlan.value = null
  form.value = defaultForm()
  featuresRaw.value = ''
  submitError.value = ''
  modalOpen.value = true
}

function openEditModal(plan: PlanItem) {
  editingPlan.value = plan
  form.value = {
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    title_uk: plan.title_uk,
    description_uk: plan.description_uk,
    price: plan.price,
    currency: plan.currency,
    interval: plan.interval,
    lessons_per_month: plan.lessons_per_month,
    features: [...plan.features],
    provider: plan.provider,
    provider_price_id: plan.provider_price_id,
    provider_product_id: plan.provider_product_id,
    is_active: plan.is_active,
    is_featured: plan.is_featured,
    display_order: plan.display_order,
  }
  featuresRaw.value = plan.features.join('\n')
  submitError.value = ''
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editingPlan.value = null
  submitError.value = ''
}

async function handleSubmit() {
  submitting.value = true
  submitError.value = ''

  // Parse features from textarea
  const features = featuresRaw.value
    .split('\n')
    .map(f => f.trim())
    .filter(Boolean)

  const payload = { ...form.value, features }

  try {
    if (editingPlan.value) {
      const { slug: _slug, ...updateData } = payload
      const updated = await updateSubscriptionPlan(editingPlan.value.id, updateData)
      const idx = plans.value.findIndex(p => p.id === editingPlan.value!.id)
      if (idx !== -1) plans.value[idx] = updated
    } else {
      const created = await createSubscriptionPlan(payload)
      plans.value.push(created)
      plans.value.sort((a, b) => a.display_order - b.display_order || a.price - b.price)
    }
    closeModal()
  } catch (e: any) {
    const data = e?.response?.data || e
    if (typeof data === 'object') {
      const msgs = Object.entries(data)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join(' | ')
      submitError.value = msgs
    } else {
      submitError.value = String(data)
    }
  } finally {
    submitting.value = false
  }
}

async function handleDeactivate(plan: PlanItem) {
  const msg = t('staff.plans.confirmDeactivate', { name: plan.name })
  if (!confirm(msg)) return
  try {
    const res = await deactivateSubscriptionPlan(plan.id)
    const idx = plans.value.findIndex(p => p.id === plan.id)
    if (idx !== -1) plans.value[idx] = { ...plans.value[idx], is_active: false }
    if (res.active_subscriptions_count > 0) {
      alert(t('staff.plans.deactivatedWithSubs', { count: res.active_subscriptions_count }))
    }
  } catch (e: any) {
    alert(e?.response?.data?.error || t('staff.plans.errorDeactivate'))
  }
}

async function handleActivate(plan: PlanItem) {
  try {
    const updated = await updateSubscriptionPlan(plan.id, { is_active: true })
    const idx = plans.value.findIndex(p => p.id === plan.id)
    if (idx !== -1) plans.value[idx] = updated
  } catch (e: any) {
    alert(e?.response?.data?.error || t('staff.plans.errorActivate'))
  }
}

function formatPrice(decimal: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(decimal)
}

onMounted(loadPlans)
</script>

<style scoped>
.plans-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.help-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: opacity var(--transition-base);
}
.btn-primary:hover { opacity: 0.88; }

.btn-retry {
  padding: var(--space-xs) var(--space-md);
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  font-family: inherit;
}

/* Stats row */
.stats-row {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
}

.stat-chip.success { border-color: #22c55e; }
.stat-chip.muted { opacity: 0.7; }

.stat-num {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.stat-lbl {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Plans grid */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-md);
}

.plan-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  transition: box-shadow var(--transition-base);
  position: relative;
}

.plan-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.plan-card.plan-inactive { opacity: 0.55; }
.plan-card.plan-featured { border-color: var(--accent); }

.plan-card-header { display: flex; flex-direction: column; gap: 2px; }

.plan-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.plan-name {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-primary);
}

.badge-featured {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
}

.plan-slug {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: monospace;
}

.plan-price-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
}

.plan-price {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--accent);
}

.plan-interval {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.plan-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.meta-item.mono { font-family: monospace; }

.plan-features {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.feature-tag {
  font-size: 0.7rem;
  padding: 2px 7px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-radius: 999px;
  font-weight: 500;
}

.plan-desc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.5;
}

.plan-status-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.status-active {
  background: color-mix(in srgb, #22c55e 15%, transparent);
  color: #166534;
}

.status-inactive {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.order-badge {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.plan-actions {
  display: flex;
  gap: var(--space-xs);
  margin-top: auto;
  padding-top: var(--space-xs);
  border-top: 1px solid var(--border-color);
}

.btn-edit, .btn-deactivate, .btn-activate {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  cursor: pointer;
  transition: all var(--transition-base);
  font-family: inherit;
}

.btn-edit:hover { background: var(--bg-secondary); color: var(--accent); border-color: var(--accent); }
.btn-deactivate { color: #f59e0b; }
.btn-deactivate:hover { background: color-mix(in srgb, #f59e0b 10%, transparent); border-color: #f59e0b; }
.btn-activate { color: #22c55e; }
.btn-activate:hover { background: color-mix(in srgb, #22c55e 10%, transparent); border-color: #22c55e; }

/* States */
.loading-state, .empty-state {
  padding: var(--space-2xl);
  text-align: center;
  color: var(--text-secondary);
}

.error-state {
  padding: var(--space-xl);
  text-align: center;
  background: color-mix(in srgb, #ef4444 8%, transparent);
  border: 1px solid color-mix(in srgb, #ef4444 20%, transparent);
  border-radius: var(--radius-md);
}

.error-text { color: #ef4444; margin-bottom: var(--space-md); }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-md);
}

.modal-box {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-base);
}
.modal-close:hover { background: var(--bg-secondary); }

.modal-body {
  overflow-y: auto;
  padding: var(--space-lg);
  flex: 1;
}

/* Form */
.plan-form { display: flex; flex-direction: column; gap: var(--space-md); }

.form-row { display: flex; gap: var(--space-md); }
.form-row.two-col > * { flex: 1; }

.form-group { display: flex; flex-direction: column; gap: 4px; }

.form-group label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hint { text-transform: none; font-weight: 400; opacity: 0.7; }

.form-input, .form-select, .form-textarea {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.form-input.mono, .mono { font-family: monospace; }

.form-textarea { resize: vertical; }

.form-checkboxes { display: flex; gap: var(--space-lg); }

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--text-primary);
  cursor: pointer;
  text-transform: none;
  font-weight: 500;
  letter-spacing: normal;
}

.form-error {
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, #ef4444 10%, transparent);
  border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
  border-radius: var(--radius-md);
  color: #ef4444;
  font-size: var(--text-sm);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-color);
  margin-top: var(--space-sm);
}

.btn-cancel {
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  font-family: inherit;
}
.btn-cancel:hover { background: var(--bg-secondary); }

.btn-submit {
  padding: var(--space-xs) var(--space-lg);
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity var(--transition-base);
}
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-submit:not(:disabled):hover { opacity: 0.88; }

@media (max-width: 640px) {
  .form-row.two-col { flex-direction: column; }
  .plans-grid { grid-template-columns: 1fr; }
}
</style>
