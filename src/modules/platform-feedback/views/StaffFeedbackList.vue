<template>
  <div class="staff-feedback-list">
    <header class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">
          💡 {{ $t('feedback.staff.title') }}
        </h1>
        <p class="text-sm text-slate-500">{{ $t('feedback.staff.subtitle') }}</p>
      </div>
      <div class="text-sm text-slate-600">
        {{ $t('feedback.staff.totalLabel') }}: <b>{{ meta.total || 0 }}</b>
      </div>
    </header>

    <!-- Filters -->
    <div class="bg-white border border-slate-200 rounded-lg p-3 mb-4 flex flex-wrap gap-2 items-center">
      <select v-model="filter.status" class="px-2 py-1 border border-slate-300 rounded text-sm">
        <option value="">{{ $t('feedback.staff.allStatuses') }}</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ $t(`feedback.status.${s}`, s) }}</option>
      </select>
      <select v-model="filter.type" class="px-2 py-1 border border-slate-300 rounded text-sm">
        <option value="">{{ $t('feedback.staff.allTypes') }}</option>
        <option v-for="t in TYPES" :key="t" :value="t">{{ $t(`feedback.type.${t}`, t) }}</option>
      </select>
      <select v-model="filter.category" class="px-2 py-1 border border-slate-300 rounded text-sm">
        <option value="">{{ $t('feedback.staff.allCategories') }}</option>
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ $t(`feedback.category.${c}`, c) }}</option>
      </select>
      <select v-model="filter.sort" class="px-2 py-1 border border-slate-300 rounded text-sm">
        <option value="recent">{{ $t('feedback.sort.recent') }}</option>
        <option value="top">{{ $t('feedback.sort.top') }}</option>
        <option value="trending">{{ $t('feedback.sort.trending') }}</option>
      </select>
      <input
        v-model="filter.q"
        type="text"
        :placeholder="$t('feedback.staff.searchPlaceholder')"
        class="flex-1 min-w-[180px] px-2 py-1 border border-slate-300 rounded text-sm"
        @keyup.enter="reload"
      />
      <button class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" @click="reload">
        {{ $t('feedback.staff.apply') }}
      </button>
    </div>

    <!-- Bulk action bar -->
    <transition name="fade">
      <div
        v-if="selectedIds.length"
        class="sticky top-2 z-20 mb-3 bg-blue-50 border border-blue-300 rounded-lg p-3 flex items-center gap-3 flex-wrap"
      >
        <span class="text-sm text-blue-900 font-medium">
          {{ $t('feedback.staff.selected', { n: selectedIds.length }) }}
        </span>
        <button class="px-3 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100"
          @click="runBulk('hide')">🙈 {{ $t('feedback.staff.bulk.hide') }}</button>
        <button class="px-3 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100"
          @click="runBulk('unhide')">👁 {{ $t('feedback.staff.bulk.unhide') }}</button>
        <button class="px-3 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100"
          @click="runBulk('lock')">🔒 {{ $t('feedback.staff.bulk.lock') }}</button>
        <button class="px-3 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100"
          @click="runBulk('unlock')">🔓 {{ $t('feedback.staff.bulk.unlock') }}</button>
        <button class="px-3 py-1 text-xs bg-amber-100 border border-amber-300 rounded hover:bg-amber-200"
          @click="runBulk('archive')">📦 {{ $t('feedback.staff.bulk.archive') }}</button>
        <button class="ml-auto text-xs text-slate-600 hover:underline" @click="clearSelection">
          {{ $t('feedback.staff.clearSelection') }}
        </button>
      </div>
    </transition>

    <!-- Table -->
    <div v-if="loading" class="text-center py-10 text-slate-500">{{ $t('feedback.staff.loading') }}</div>
    <div v-else-if="error" class="text-center py-10 text-rose-600">{{ error }}</div>
    <div v-else-if="!threads.length" class="text-center py-10 text-slate-500">
      {{ $t('feedback.staff.empty') }}
    </div>
    <div v-else class="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="w-8 px-2 py-2">
              <input
                type="checkbox"
                :checked="allSelected"
                @change="toggleAll"
                :aria-label="$t('feedback.staff.selectAll')"
              />
            </th>
            <th class="text-left px-2 py-2 font-medium text-slate-700">{{ $t('feedback.staff.col.title') }}</th>
            <th class="text-left px-2 py-2 font-medium text-slate-700">{{ $t('feedback.staff.col.type') }}</th>
            <th class="text-left px-2 py-2 font-medium text-slate-700">{{ $t('feedback.staff.col.status') }}</th>
            <th class="text-right px-2 py-2 font-medium text-slate-700">⬆</th>
            <th class="text-right px-2 py-2 font-medium text-slate-700">💬</th>
            <th class="text-left px-2 py-2 font-medium text-slate-700">{{ $t('feedback.staff.col.author') }}</th>
            <th class="text-right px-2 py-2 font-medium text-slate-700">{{ $t('feedback.staff.col.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="t in threads"
            :key="t.id"
            class="border-b border-slate-100 hover:bg-slate-50"
            :class="{ 'opacity-50': t.is_hidden, 'bg-amber-50': t.is_locked }"
          >
            <td class="px-2 py-2">
              <input
                type="checkbox"
                :value="t.id"
                :checked="selectedIds.includes(t.id)"
                @change="toggleSelect(t.id)"
              />
            </td>
            <td class="px-2 py-2 max-w-[300px]">
              <router-link
                :to="{ name: 'FeedbackThread', params: { id: t.id } }"
                class="text-blue-700 hover:underline font-medium block truncate"
              >
                {{ t.title }}
              </router-link>
              <div class="flex gap-1 mt-0.5">
                <span v-if="t.is_locked" class="text-xs">🔒</span>
                <span v-if="t.is_hidden" class="text-xs">🙈</span>
                <span class="text-xs text-slate-500">{{ t.category }}</span>
              </div>
            </td>
            <td class="px-2 py-2 whitespace-nowrap text-slate-700">{{ $t(`feedback.type.${t.type}`, t.type) }}</td>
            <td class="px-2 py-2 whitespace-nowrap">
              <span :class="statusBadgeClass(t.status)" class="px-1.5 py-0.5 rounded text-xs">
                {{ $t(`feedback.status.${t.status}`, t.status) }}
              </span>
            </td>
            <td class="px-2 py-2 text-right tabular-nums">{{ t.vote_count }}</td>
            <td class="px-2 py-2 text-right tabular-nums">{{ t.comment_count }}</td>
            <td class="px-2 py-2 text-xs text-slate-600 truncate max-w-[140px]">
              {{ t.author?.display_name || `#${t.author?.id || '?'}` }}
            </td>
            <td class="px-2 py-2 whitespace-nowrap text-right">
              <div class="inline-flex gap-1">
                <button :title="$t('feedback.staff.actions.changeStatus')"
                        class="px-1.5 py-0.5 hover:bg-slate-200 rounded text-xs"
                        @click="openStatusModal(t)">📋</button>
                <button :title="$t('feedback.staff.actions.editContent')"
                        class="px-1.5 py-0.5 hover:bg-slate-200 rounded text-xs"
                        @click="openEditModal(t)">✏️</button>
                <button :title="t.is_locked ? $t('feedback.detail.unlock') : $t('feedback.detail.lock')"
                        class="px-1.5 py-0.5 hover:bg-slate-200 rounded text-xs"
                        @click="onLock(t)">{{ t.is_locked ? '🔓' : '🔒' }}</button>
                <button :title="t.is_hidden ? $t('feedback.detail.unhide') : $t('feedback.detail.hide')"
                        class="px-1.5 py-0.5 hover:bg-slate-200 rounded text-xs"
                        @click="onHide(t)">{{ t.is_hidden ? '👁' : '🙈' }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-4">
      <button
        v-for="p in totalPages"
        :key="p"
        :disabled="p === filter.page"
        class="px-3 py-1 text-sm border border-slate-300 rounded disabled:bg-blue-600 disabled:text-white"
        @click="goPage(p)"
      >{{ p }}</button>
    </div>

    <!-- Status change modal -->
    <StatusChangeModal
      v-if="modalThread && modalKind === 'status'"
      :thread="modalThread"
      @close="closeModal"
      @saved="onSaved"
    />
    <!-- Staff-edit modal -->
    <StaffEditModal
      v-if="modalThread && modalKind === 'edit'"
      :thread="modalThread"
      @close="closeModal"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../api/feedbackApi'
import StatusChangeModal from '../components/staff/StatusChangeModal.vue'
import StaffEditModal from '../components/staff/StaffEditModal.vue'

const STATUSES = ['open', 'under_review', 'planned', 'in_progress', 'released', 'done', 'rejected', 'duplicate', 'archived', 'needs_info']
const TYPES = ['feature_request', 'bug_report', 'improvement', 'review', 'discussion']
const CATEGORIES = ['ux', 'classroom', 'winterboard', 'performance', 'ai', 'marketplace', 'other']

const threads = ref([])
const meta = ref({ page: 1, page_size: 20, total: 0 })
const loading = ref(false)
const error = ref(null)
const selectedIds = ref([])

const filter = reactive({
  status: '',
  type: '',
  category: '',
  sort: 'recent',
  q: '',
  page: 1,
})

const modalThread = ref(null)
const modalKind = ref(null)

const totalPages = computed(() => {
  const total = meta.value.total || 0
  const size = meta.value.page_size || 20
  return Math.max(1, Math.ceil(total / size))
})

const allSelected = computed(() =>
  threads.value.length > 0 && threads.value.every((t) => selectedIds.value.includes(t.id))
)

async function load() {
  loading.value = true
  error.value = null
  try {
    const params = { page: filter.page, sort: filter.sort }
    if (filter.status) params.status = filter.status
    if (filter.type) params.type = filter.type
    if (filter.category) params.category = filter.category
    if (filter.q.trim()) params.q = filter.q.trim()
    const res = await api.listThreads(params)
    threads.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e?.response?.data?.detail || 'Не вдалося завантажити'
  } finally {
    loading.value = false
  }
}

function reload() {
  filter.page = 1
  load()
}

function goPage(p) {
  filter.page = p
  load()
}

function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = selectedIds.value.filter((id) => !threads.value.some((t) => t.id === id))
  } else {
    const ids = threads.value.map((t) => t.id)
    selectedIds.value = [...new Set([...selectedIds.value, ...ids])]
  }
}

function clearSelection() {
  selectedIds.value = []
}

async function runBulk(action) {
  if (!selectedIds.value.length) return
  if (!confirm(`Виконати "${action}" на ${selectedIds.value.length} thread(s)?`)) return
  try {
    await api.bulkAction([...selectedIds.value], action)
    clearSelection()
    await load()
  } catch (e) {
    alert(e?.response?.data?.detail || 'Bulk action failed')
  }
}

async function onLock(t) {
  await api.toggleLock(t.id)
  t.is_locked = !t.is_locked
}

async function onHide(t) {
  await api.toggleHide(t.id)
  t.is_hidden = !t.is_hidden
}

function openStatusModal(t) {
  modalThread.value = t
  modalKind.value = 'status'
}

function openEditModal(t) {
  modalThread.value = t
  modalKind.value = 'edit'
}

function closeModal() {
  modalThread.value = null
  modalKind.value = null
}

function onSaved(updated) {
  // Replace in list
  const idx = threads.value.findIndex((t) => t.id === updated.id)
  if (idx >= 0) threads.value.splice(idx, 1, updated)
  closeModal()
}

function statusBadgeClass(status) {
  switch (status) {
    case 'open': return 'bg-slate-100 text-slate-700'
    case 'under_review': return 'bg-blue-100 text-blue-800'
    case 'planned': return 'bg-amber-100 text-amber-800'
    case 'in_progress': return 'bg-indigo-100 text-indigo-800'
    case 'released':
    case 'done': return 'bg-green-100 text-green-800'
    case 'rejected':
    case 'duplicate':
    case 'archived': return 'bg-rose-100 text-rose-800'
    case 'needs_info': return 'bg-purple-100 text-purple-800'
    default: return 'bg-slate-100 text-slate-700'
  }
}

onMounted(load)
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
