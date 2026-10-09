<template>
  <div class="staff-ai-costs" data-testid="staff-ai-costs">
    <div class="page-header">
      <h1 class="page-title">{{ $t('staff.aiCosts.title') }}</h1>
      <p class="page-help">{{ $t('staff.aiCosts.helpText') }}</p>
    </div>

    <!-- Тривоги — угорі, щоб не чекати місяць без контролю (власник 2026-10-08) -->
    <div v-if="report && report.alerts.length" class="alerts-banner" data-testid="ai-costs-alerts">
      <Alert
        v-for="alert in report.alerts"
        :key="alert.code"
        variant="warning"
        :title="alertTitle(alert)"
        :description="alertText(alert)"
      />
    </div>

    <Card class="section-card">
      <div class="period-row">
        <button
          v-for="p in PERIODS"
          :key="p"
          type="button"
          class="period-btn"
          :class="{ active: period === p }"
          @click="setPeriod(p)"
        >
          {{ $t(`staff.aiCosts.periods.${p}`) }}
        </button>
        <template v-if="period === 'custom'">
          <label class="date-field">
            {{ $t('staff.aiCosts.from') }}
            <input v-model="customFrom" type="date" class="date-input" @change="load">
          </label>
          <label class="date-field">
            {{ $t('staff.aiCosts.to') }}
            <input v-model="customTo" type="date" class="date-input" @change="load">
          </label>
        </template>
        <span class="period-note">{{ $t('staff.aiCosts.utcNote') }}</span>
      </div>
    </Card>

    <div v-if="loading" class="section-loading"><LoadingSpinner /></div>
    <Alert v-else-if="error" variant="danger" :description="error" />

    <template v-else-if="report">
      <div class="summary-grid" data-testid="ai-costs-summary">
        <div class="summary-card primary">
          <div class="summary-label">{{ $t('staff.aiCosts.estimateTeachers') }}</div>
          <div class="summary-value">{{ usd(report.totals.teachers.cost_usd) }}</div>
          <div class="summary-sub">{{ $t('staff.aiCosts.teachersCalls', { n: report.totals.teachers.calls }) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">{{ $t('staff.aiCosts.ownerTests') }}</div>
          <div class="summary-value">{{ usd(report.totals.internal.cost_usd) }}</div>
          <div class="summary-sub">{{ $t('staff.aiCosts.calls', { n: report.totals.internal.calls }) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">{{ $t('staff.aiCosts.noOwner') }}</div>
          <div class="summary-value">{{ usd(report.totals.no_owner.cost_usd) }}</div>
          <div class="summary-sub">{{ $t('staff.aiCosts.calls', { n: report.totals.no_owner.calls }) }}</div>
        </div>
        <div class="summary-card" :class="{ warn: report.unknown_cost_calls > 0 }">
          <div class="summary-label">{{ $t('staff.aiCosts.unknownCost') }}</div>
          <div class="summary-value">{{ report.unknown_cost_calls }}</div>
          <div class="summary-sub">{{ $t('staff.aiCosts.unknownCostHint') }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">{{ $t('staff.aiCosts.openaiBill') }}</div>
          <div class="summary-value">{{ report.reconciliation.billed_usd === null ? '—' : usd(report.reconciliation.billed_usd) }}</div>
          <div class="summary-sub">
            {{ report.reconciliation.admin_key_configured
              ? $t('staff.aiCosts.billDays', { n: report.reconciliation.days_billed })
              : $t('staff.aiCosts.noAdminKey') }}
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">{{ $t('staff.aiCosts.difference') }}</div>
          <div class="summary-value">{{ report.reconciliation.diff_usd === null ? '—' : usd(report.reconciliation.diff_usd) }}</div>
          <div class="summary-sub">{{ $t('staff.aiCosts.differenceHint') }}</div>
        </div>
      </div>

      <Card class="section-card">
        <h2 class="section-title">{{ $t('staff.aiCosts.teacherStats') }}</h2>
        <p class="stats-line">
          {{ $t('staff.aiCosts.activeTeachers', { n: report.teacher_stats.active }) }} ·
          {{ $t('staff.aiCosts.avg') }}: {{ report.teacher_stats.avg_usd === null ? '—' : usd(report.teacher_stats.avg_usd) }} ·
          p95: {{ report.teacher_stats.p95_usd === null ? '—' : usd(report.teacher_stats.p95_usd) }}
        </p>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ $t('staff.aiCosts.cols.teacher') }}</th>
                <th class="num">{{ $t('staff.aiCosts.cols.estimate') }}</th>
                <th class="num">{{ $t('staff.aiCosts.cols.calls') }}</th>
                <th class="num">{{ $t('staff.aiCosts.cols.unknown') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.top_teachers" :key="row.user_id">
                <td>
                  <router-link :to="`/staff/users/${row.user_id}`">{{ row.email || `#${row.user_id}` }}</router-link>
                </td>
                <td class="num">{{ usd(row.cost_usd) }}</td>
                <td class="num">{{ row.calls }}</td>
                <td class="num">{{ row.unknown_cost_calls }}</td>
              </tr>
              <tr v-if="!report.top_teachers.length">
                <td colspan="4" class="empty">{{ $t('staff.aiCosts.empty') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div class="two-cols">
        <Card class="section-card">
          <h2 class="section-title">{{ $t('staff.aiCosts.byPurpose') }}</h2>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ $t('staff.aiCosts.cols.purpose') }}</th>
                  <th class="num">{{ $t('staff.aiCosts.cols.estimate') }}</th>
                  <th class="num">{{ $t('staff.aiCosts.cols.ownerTests') }}</th>
                  <th class="num">{{ $t('staff.aiCosts.cols.calls') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in report.by_purpose" :key="row.purpose">
                  <td>{{ purposeLabel(row.purpose || '') }}</td>
                  <td class="num">{{ usd(row.cost_usd) }}</td>
                  <td class="num">{{ usd(row.internal_cost_usd) }}</td>
                  <td class="num">{{ row.calls }}</td>
                </tr>
                <tr v-if="!report.by_purpose.length">
                  <td colspan="4" class="empty">{{ $t('staff.aiCosts.empty') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card class="section-card">
          <h2 class="section-title">{{ $t('staff.aiCosts.byModel') }}</h2>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ $t('staff.aiCosts.cols.model') }}</th>
                  <th class="num">{{ $t('staff.aiCosts.cols.estimate') }}</th>
                  <th class="num">{{ $t('staff.aiCosts.cols.calls') }}</th>
                  <th class="num">{{ $t('staff.aiCosts.cols.unknown') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in report.by_model" :key="`${row.provider}:${row.model}`">
                  <td>{{ row.provider }} · {{ row.model }}</td>
                  <td class="num">{{ usd(row.cost_usd) }}</td>
                  <td class="num">{{ row.calls }}</td>
                  <td class="num">{{ row.unknown_cost_calls }}</td>
                </tr>
                <tr v-if="!report.by_model.length">
                  <td colspan="4" class="empty">{{ $t('staff.aiCosts.empty') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card class="section-card">
        <h2 class="section-title">{{ $t('staff.aiCosts.reconciliation') }}</h2>
        <p class="section-help">{{ $t('staff.aiCosts.reconciliationHelp') }}</p>
        <div class="table-wrap">
          <table class="data-table" data-testid="ai-costs-reconciliation">
            <thead>
              <tr>
                <th>{{ $t('staff.aiCosts.cols.date') }}</th>
                <th class="num">{{ $t('staff.aiCosts.cols.journal') }}</th>
                <th class="num">{{ $t('staff.aiCosts.openaiBill') }}</th>
                <th class="num">{{ $t('staff.aiCosts.difference') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.reconciliation.rows" :key="row.date" :class="{ flagged: row.flagged }">
                <td>{{ row.date }}</td>
                <td class="num">{{ usd(row.journal_usd) }}</td>
                <td class="num">{{ row.billed_usd === null ? '—' : usd(row.billed_usd) }}</td>
                <td class="num">{{ row.diff_usd === null ? '—' : usd(row.diff_usd) }}</td>
              </tr>
              <tr v-if="!report.reconciliation.rows.length">
                <td colspan="4" class="empty">{{ $t('staff.aiCosts.empty') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card class="section-card">
        <h2 class="section-title">{{ $t('staff.aiCosts.daily') }}</h2>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ $t('staff.aiCosts.cols.date') }}</th>
                <th class="num">{{ $t('staff.aiCosts.cols.teachers') }}</th>
                <th class="num">{{ $t('staff.aiCosts.cols.ownerTests') }}</th>
                <th class="num">{{ $t('staff.aiCosts.cols.total') }}</th>
                <th class="num">{{ $t('staff.aiCosts.cols.calls') }}</th>
                <th class="num">{{ $t('staff.aiCosts.cols.unknown') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in dailyDesc" :key="day.date">
                <td>{{ day.date }}</td>
                <td class="num">{{ usd(day.teachers_cost_usd) }}</td>
                <td class="num">{{ usd(day.internal_cost_usd) }}</td>
                <td class="num">{{ usd(day.cost_usd) }}</td>
                <td class="num">{{ day.calls }}</td>
                <td class="num">{{ day.unknown_cost_calls }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <p class="price-note" data-testid="ai-costs-price">
        {{ $t('staff.aiCosts.priceNote', { version: report.price.version, date: report.price.verified_on || '—' }) }}
        <template v-if="report.price.cached_input_upper_bound"> {{ $t('staff.aiCosts.cachedUpperBound') }}</template>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Облік витрат на ШІ (власник 2026-10-08; ТЗ saas_docs/domains/billing/AI_COST_METER_TZ_2026-10-08.md, етап 2).
 * Сума за журналом — ОЦІНКА за прайсом, не рахунок: поруч — рахунок OpenAI і різниця. Ваші тести — окремо від
 * учителів. Тривоги — угорі сторінки. Доби — за UTC (так рахує OpenAI, інакше звірка не зійдеться).
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { activeLocale } from '@/utils/i18nDate'
import Card from '@/ui/Card.vue'
import Alert from '@/ui/Alert.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { getAiCosts, type AiCostAlert, type AiCostReport } from '../api/staffAiCostsApi'

type Period = 'today' | 'week' | 'month' | 'custom'
const PERIODS: Period[] = ['today', 'week', 'month', 'custom']
const PURPOSES = [
  'chat', 'chat_redo_quote', 'chat_redo_hint', 'chat_redo_board_hint', 'chat_redo_language', 'chat_math_regen',
  'memory_summary', 'vision_read', 'vision_solve', 'vision_check', 'enrich', 'enrich_genre', 'review',
  'tutor_hint', 'course_plan', 'material_vision', 'material_ocr', 'cli_theory', 'history_lesson',
]
const ALERT_CODES = ['spike', 'unknown_cost', 'reconciliation_mismatch']

const { t, te } = useI18n()

const period = ref<Period>('month')
const customFrom = ref('')
const customTo = ref('')
const report = ref<AiCostReport | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

function utcDay(offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

function range(): [string, string] {
  const today = utcDay()
  if (period.value === 'today') return [today, today]
  if (period.value === 'week') return [utcDay(6), today]
  if (period.value === 'custom' && customFrom.value && customTo.value) return [customFrom.value, customTo.value]
  return [`${today.slice(0, 8)}01`, today]
}

async function load() {
  const [from, to] = range()
  loading.value = true
  error.value = null
  try {
    report.value = await getAiCosts(from, to)
  } catch (err: any) {
    error.value = err?.response?.data?.detail || err?.message || t('staff.aiCosts.errorLoad')
  } finally {
    loading.value = false
  }
}

function setPeriod(p: Period) {
  period.value = p
  if (p === 'custom') {
    const [from, to] = range()
    customFrom.value = customFrom.value || from
    customTo.value = customTo.value || to
  }
  load()
}

/** $0,03 / $0,0004: дрібні суми — з чотирма знаками, інакше копійчані виклики виглядали б нулями. */
function usd(value: string | number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const digits = n !== 0 && Math.abs(n) < 0.01 ? 4 : 2
  return `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString(activeLocale(), {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  })}`
}

function purposeLabel(purpose: string): string {
  return PURPOSES.includes(purpose) ? t(`staff.aiCosts.purposes.${purpose}`) : purpose
}

function alertTitle(alert: AiCostAlert): string {
  return ALERT_CODES.includes(alert.code) ? t(`staff.aiCosts.alerts.${alert.code}.title`) : alert.code
}

function alertText(alert: AiCostAlert): string {
  const key = `staff.aiCosts.alerts.${alert.code}.text`
  if (!ALERT_CODES.includes(alert.code) || !te(key)) return alert.message
  const p = alert.params || {}
  return t(key, {
    ...p,
    last: usd(p.last_day_usd ?? 0),
    avg: usd(p.prev_avg_usd ?? 0),
  })
}

const dailyDesc = computed(() => [...(report.value?.daily || [])].reverse())

onMounted(load)
</script>

<style scoped>
.staff-ai-costs {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1200px;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--space-xs) 0;
}

.page-help,
.section-help,
.price-note {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.alerts-banner {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.section-card {
  padding: var(--space-lg);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-md) 0;
}

.period-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
}

.period-btn {
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
  font-size: var(--text-sm);
}

.period-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.date-field {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.date-input {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 2px var(--space-xs);
  background: var(--card-bg);
  color: var(--text-primary);
}

.period-note {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-left: auto;
}

.section-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-xl) 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--space-sm);
}

.summary-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.summary-card.primary {
  border-color: var(--accent);
}

.summary-card.warn {
  border-color: var(--warning, #d97706);
}

.summary-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-bottom: var(--space-xs);
}

.summary-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
}

.summary-sub {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-xs);
}

.stats-line {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--space-md) 0;
}

.two-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-lg);
}

.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.data-table th {
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
}

.data-table td {
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.data-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.data-table tr.flagged td {
  background: color-mix(in srgb, var(--warning, #d97706) 12%, transparent);
}

.data-table .empty {
  text-align: center;
  color: var(--text-secondary);
}
</style>
