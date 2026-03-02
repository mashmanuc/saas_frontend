<template>
  <div class="engagement-panel">
    <!-- Summary Section -->
    <div v-if="summaryLoading" class="engagement-loading">
      <LoadingSpinner />
    </div>
    <div v-else-if="summary" class="engagement-summary">
      <div class="summary-cards">
        <div class="summary-card">
          <span class="card-value">{{ summary.total_users }}</span>
          <span class="card-label">{{ t('staff.engagement.totalUsers') }}</span>
        </div>
        <div class="summary-card">
          <span class="card-value">{{ summary.avg_score }}</span>
          <span class="card-label">{{ t('staff.engagement.avgScore') }}</span>
        </div>
      </div>

      <!-- Segment Distribution -->
      <div class="segment-bars">
        <div
          v-for="seg in segmentOrder"
          :key="seg"
          class="segment-bar-row"
        >
          <span class="seg-label" :class="`seg-${seg}`">{{ t(`staff.engagement.segments.${seg}`) }}</span>
          <div class="seg-bar-track">
            <div
              class="seg-bar-fill"
              :class="`seg-fill-${seg}`"
              :style="{ width: (summary.segments[seg]?.percent || 0) + '%' }"
            ></div>
          </div>
          <span class="seg-count">{{ summary.segments[seg]?.count || 0 }} ({{ summary.segments[seg]?.percent || 0 }}%)</span>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="engagement-filters">
      <select v-model="segmentFilter" class="eng-select">
        <option value="">{{ t('staff.engagement.allSegments') }}</option>
        <option v-for="seg in segmentOrder" :key="seg" :value="seg">
          {{ t(`staff.engagement.segments.${seg}`) }}
        </option>
      </select>
      <select v-model="roleFilter" class="eng-select">
        <option value="ALL">{{ t('staff.engagement.allRoles') }}</option>
        <option value="TUTOR">{{ t('staff.engagement.roleTutor') }}</option>
        <option value="STUDENT">{{ t('staff.engagement.roleStudent') }}</option>
      </select>
      <select v-model="sortOrder" class="eng-select">
        <option value="-score">{{ t('staff.engagement.sortDesc') }}</option>
        <option value="score">{{ t('staff.engagement.sortAsc') }}</option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="listLoading" class="engagement-loading">
      <LoadingSpinner />
    </div>
    <div v-else-if="listError" class="engagement-error" role="alert">
      {{ listError }}
    </div>
    <div v-else-if="engagementData && engagementData.results.length > 0" class="engagement-table-wrap">
      <table class="engagement-table">
        <thead>
          <tr>
            <th>{{ t('staff.engagement.colEmail') }}</th>
            <th>{{ t('staff.engagement.colRole') }}</th>
            <th>{{ t('staff.engagement.colScore') }}</th>
            <th>{{ t('staff.engagement.colSegment') }}</th>
            <th>{{ t('staff.engagement.colFrequency') }}</th>
            <th>{{ t('staff.engagement.colRecency') }}</th>
            <th>{{ t('staff.engagement.colDepth') }}</th>
            <th>{{ t('staff.engagement.colConsistency') }}</th>
            <th>{{ t('staff.engagement.colActiveDays') }}</th>
            <th>{{ t('staff.engagement.colLastActivity') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in engagementData.results" :key="item.user_id">
            <td class="cell-email">{{ item.user_email }}</td>
            <td>{{ item.user_role || '—' }}</td>
            <td>
              <span class="score-badge" :class="segmentClass(item.segment)">{{ item.score }}</span>
            </td>
            <td>
              <span class="segment-tag" :class="`seg-${item.segment}`">
                {{ t(`staff.engagement.segments.${item.segment}`) }}
              </span>
            </td>
            <td>{{ pct(item.frequency_score) }}</td>
            <td>{{ pct(item.recency_score) }}</td>
            <td>{{ pct(item.depth_score) }}</td>
            <td>{{ pct(item.consistency_score) }}</td>
            <td>{{ item.active_days_30d }}</td>
            <td>{{ item.last_activity_at ? formatDate(item.last_activity_at) : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="engagement-pagination">
        <button
          class="page-btn"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          &laquo;
        </button>
        <span class="page-info">
          {{ t('staff.engagement.page') }} {{ currentPage }} / {{ totalPages }}
        </span>
        <button
          class="page-btn"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          &raquo;
        </button>
      </div>
    </div>
    <div v-else class="engagement-empty">
      {{ t('staff.engagement.noData') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import staffAnalyticsApi from '@/modules/staff/api/staffAnalyticsApi'
import type {
  EngagementListResponse,
  EngagementSummaryResponse,
  EngagementSegment,
} from '@/modules/staff/api/staffAnalyticsApi'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'

const { t } = useI18n()

const segmentOrder: EngagementSegment[] = ['champion', 'loyal', 'potential', 'at_risk', 'hibernating']

const summary = ref<EngagementSummaryResponse | null>(null)
const summaryLoading = ref(false)

const engagementData = ref<EngagementListResponse | null>(null)
const listLoading = ref(false)
const listError = ref<string | null>(null)

const segmentFilter = ref<EngagementSegment | ''>('')
const roleFilter = ref<'TUTOR' | 'STUDENT' | 'ALL'>('ALL')
const sortOrder = ref<'score' | '-score'>('-score')
const currentPage = ref(1)
const pageSize = 20

const totalPages = computed(() => {
  if (!engagementData.value) return 1
  return Math.max(1, Math.ceil(engagementData.value.total / pageSize))
})

async function fetchSummary() {
  summaryLoading.value = true
  try {
    summary.value = await staffAnalyticsApi.getEngagementSummary()
  } catch {
    summary.value = null
  } finally {
    summaryLoading.value = false
  }
}

async function fetchList() {
  listLoading.value = true
  listError.value = null
  try {
    const params: Record<string, unknown> = {
      sort: sortOrder.value,
      page: currentPage.value,
      page_size: pageSize,
    }
    if (segmentFilter.value) params.segment = segmentFilter.value
    if (roleFilter.value !== 'ALL') params.role = roleFilter.value

    engagementData.value = await staffAnalyticsApi.getEngagement(params as any)
  } catch (e: any) {
    listError.value = e?.message || 'Failed to load engagement data'
    engagementData.value = null
  } finally {
    listLoading.value = false
  }
}

function goToPage(page: number) {
  currentPage.value = page
}

function segmentClass(segment: string): string {
  return `seg-${segment}`
}

function pct(val: number): string {
  return `${Math.round(val * 100)}%`
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('uk-UA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch([segmentFilter, roleFilter, sortOrder], () => {
  currentPage.value = 1
  fetchList()
})

watch(currentPage, () => {
  fetchList()
})

onMounted(() => {
  fetchSummary()
  fetchList()
})
</script>

<style scoped>
.engagement-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.engagement-loading,
.engagement-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted, #6b7280);
  font-size: 14px;
}

.engagement-error {
  padding: 16px;
  text-align: center;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 8px;
  font-size: 14px;
}

/* Summary */
.engagement-summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-cards {
  display: flex;
  gap: 16px;
}

.summary-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: var(--bg-secondary, #f9fafb);
  border-radius: 10px;
  border: 1px solid var(--border-color, #e5e7eb);
}

.card-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.card-label {
  font-size: 12px;
  color: var(--text-muted, #6b7280);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

/* Segment Bars */
.segment-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.segment-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.seg-label {
  width: 100px;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
  flex-shrink: 0;
}

.seg-bar-track {
  flex: 1;
  height: 16px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 8px;
  overflow: hidden;
}

.seg-bar-fill {
  height: 100%;
  border-radius: 8px;
  transition: width 0.3s ease;
}

.seg-count {
  width: 80px;
  font-size: 12px;
  color: var(--text-muted, #6b7280);
  flex-shrink: 0;
}

/* Segment colors */
.seg-champion, .seg-fill-champion { color: #059669; }
.seg-fill-champion { background: #059669; }
.seg-loyal, .seg-fill-loyal { color: #3b82f6; }
.seg-fill-loyal { background: #3b82f6; }
.seg-potential, .seg-fill-potential { color: #8b5cf6; }
.seg-fill-potential { background: #8b5cf6; }
.seg-at_risk, .seg-fill-at_risk { color: #f59e0b; }
.seg-fill-at_risk { background: #f59e0b; }
.seg-hibernating, .seg-fill-hibernating { color: #6b7280; }
.seg-fill-hibernating { background: #6b7280; }

/* Filters */
.engagement-filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.eng-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #111827);
}

/* Table */
.engagement-table-wrap {
  overflow-x: auto;
}

.engagement-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.engagement-table th {
  text-align: left;
  padding: 8px 10px;
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted, #6b7280);
  border-bottom: 2px solid var(--border-color, #e5e7eb);
  white-space: nowrap;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.engagement-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
  white-space: nowrap;
}

.cell-email {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score-badge {
  display: inline-block;
  min-width: 32px;
  padding: 2px 8px;
  border-radius: 6px;
  text-align: center;
  font-weight: 700;
  font-size: 13px;
  color: #fff;
}

.score-badge.seg-champion { background: #059669; }
.score-badge.seg-loyal { background: #3b82f6; }
.score-badge.seg-potential { background: #8b5cf6; }
.score-badge.seg-at_risk { background: #f59e0b; color: #78350f; }
.score-badge.seg-hibernating { background: #9ca3af; }

.segment-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: capitalize;
}

.segment-tag.seg-champion { background: #d1fae5; color: #059669; }
.segment-tag.seg-loyal { background: #dbeafe; color: #3b82f6; }
.segment-tag.seg-potential { background: #ede9fe; color: #8b5cf6; }
.segment-tag.seg-at_risk { background: #fef3c7; color: #d97706; }
.segment-tag.seg-hibernating { background: #f3f4f6; color: #6b7280; }

/* Pagination */
.engagement-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 0;
}

.page-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  background: var(--bg-primary, #fff);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary, #111827);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: var(--text-muted, #6b7280);
}
</style>
