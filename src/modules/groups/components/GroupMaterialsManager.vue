<script setup lang="ts">
/**
 * GroupMaterialsManager — керування матеріалами класу/групи.
 * Модуль: groups (виокремлено з learning-content)
 *
 * Показує список матеріалів поточної групи + кнопку "Створити групу".
 * Предмет (Subject) прибрано з UI (CL10 залишається в бекенді, але прихований поки немає платформного контенту).
 */
import { ref, watch, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGroupStore } from '../stores/groupStore'
import GroupSelector from './GroupSelector.vue'
import MaterialAccessToggle from './MaterialAccessToggle.vue'

const { t } = useI18n()
const groupStore = useGroupStore()

// Якщо передано ззовні — синхронізуємо з батьківським selectedGroupId
const props = defineProps<{
  externalGroupId?: string | null
}>()

const selectedGroupId = ref<string | null>(null)

// Коли батьківський компонент змінює вибір — синхронізуємо внутрішній стан
watch(() => props.externalGroupId, (gid) => {
  if (gid !== undefined) {
    selectedGroupId.value = gid ?? null
  }
}, { immediate: true })

const showCreateModal = ref(false)
const newGroupTitle = ref('')

onMounted(async () => {
  await groupStore.fetchGroups()
})

// ── Watch group selection ────────────────────────────────────
watch(selectedGroupId, async (groupId) => {
  if (groupId) {
    await groupStore.selectGroup(groupId)
  }
})

// ── Create group ─────────────────────────────────────────────
async function createGroup() {
  if (!newGroupTitle.value.trim()) return
  const group = await groupStore.createGroup({
    title: newGroupTitle.value.trim(),
  })
  selectedGroupId.value = group.id
  showCreateModal.value = false
  newGroupTitle.value = ''
}

// ── Material actions ─────────────────────────────────────────
async function onToggleMaterial(materialId: string, isActive: boolean) {
  await groupStore.toggleMaterial(materialId, isActive)
}

// ── Фільтрація матеріалів за типом ───────────────────────────
const groupTab = ref<string>('all')
const GROUP_TABS = [
  { key: 'all',          label: 'Всі' },
  { key: 'pdf',          label: 'PDF' },
  { key: 'image',        label: 'Фото' },
  { key: 'presentation', label: 'Слайди' },
  { key: 'audio',        label: 'Аудіо' },
  { key: 'video',        label: 'Відео' },
] as const

const groupTabCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const m of groupStore.materials) {
    const ct = m.content_type ?? ''
    counts[ct] = (counts[ct] ?? 0) + 1
  }
  return counts
})

const filteredMaterials = computed(() => {
  if (groupTab.value === 'all') return groupStore.materials
  return groupStore.materials.filter(m => m.content_type === groupTab.value)
})

// Скидаємо вкладку при зміні групи
watch(selectedGroupId, () => { groupTab.value = 'all' })

// Inline delete confirmation — не видаляємо одразу, просимо підтвердження
const pendingDeleteId = ref<string | null>(null)

function onRemoveMaterial(materialId: string) {
  pendingDeleteId.value = materialId
}

async function confirmDelete() {
  if (!pendingDeleteId.value) return
  await groupStore.removeMaterial(pendingDeleteId.value)
  pendingDeleteId.value = null
}

function cancelDelete() {
  pendingDeleteId.value = null
}
</script>

<template>
  <div class="group-materials-manager space-y-4">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <!-- Динамічна назва: назва класу або дефолт -->
        <h2 class="text-base font-semibold leading-tight flex items-center gap-1.5 min-w-0 gm-title">
          <span class="flex-shrink-0">📁</span>
          <span v-if="groupStore.selectedGroup" class="truncate">{{ groupStore.selectedGroup.title }}</span>
          <span v-else class="gm-text-muted">{{ t('learningContent.groups.manager') }}</span>
        </h2>
        <!-- Статистика: кількість матеріалів і учнів -->
        <p v-if="groupStore.selectedGroup" class="text-xs gm-text-muted mt-0.5">
          <span>{{ groupStore.materials.length }}
            {{ groupStore.materials.length === 1 ? 'матеріал' : groupStore.materials.length < 5 ? 'матеріали' : 'матеріалів' }}
          </span>
          <span v-if="groupStore.students.length" class="ml-1">
            · {{ groupStore.students.length }}
            {{ groupStore.students.length === 1 ? 'учень' : groupStore.students.length < 5 ? 'учні' : 'учнів' }}
          </span>
        </p>
        <p v-else class="text-xs gm-text-muted mt-0.5">
          Виберіть клас зі списку або створіть новий
        </p>
      </div>
      <!-- Кнопку "Створити групу" прибрано: клас створюється через sidebar "МОЇ КЛАСИ" → "+" -->
    </div>

    <!-- Group Selector: показуємо тільки якщо немає зовнішнього вибору -->
    <GroupSelector v-if="!props.externalGroupId" v-model="selectedGroupId" />

    <!-- Selected Group Panel -->
    <template v-if="groupStore.selectedGroup && selectedGroupId">
      <!-- Materials List -->
      <div class="rounded-lg gm-panel">
        <div class="p-4 flex items-center justify-between gm-panel-header">
          <h3 class="text-sm font-medium flex items-center gap-2 gm-text-secondary">
            {{ t('learningContent.groups.materials') }}
            <span
              v-if="groupStore.materials.length > 0"
              class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full gm-badge-count"
            >
              {{ groupStore.materials.length }}
            </span>
          </h3>
          <span v-if="groupStore.activeMaterials.length < groupStore.materials.length" class="text-xs gm-text-warning">
            {{ groupStore.materials.length - groupStore.activeMaterials.length }} вимкнено
          </span>
        </div>

        <!-- Materials -->
        <template v-if="groupStore.materials.length > 0">
          <!-- Tabs фільтрації -->
          <div class="gm-tabs">
            <button
              v-for="tab in GROUP_TABS"
              :key="tab.key"
              type="button"
              class="gm-tab"
              :class="{ 'gm-tab--active': groupTab === tab.key }"
              @click="groupTab = tab.key"
            >
              {{ tab.label }}
              <span
                v-if="tab.key !== 'all' && groupTabCounts[tab.key]"
                class="gm-tab-count"
              >{{ groupTabCounts[tab.key] }}</span>
            </button>
          </div>

          <!-- Filtered list -->
          <div v-if="filteredMaterials.length > 0" class="gm-divider-list">
            <div
              v-for="material in filteredMaterials"
              :key="material.id"
              class="flex items-center justify-between px-4 py-3"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate gm-title">
                  {{ material.content_title }}
                </p>
                <p class="text-xs gm-text-muted">
                  {{ material.content_type }}
                </p>
              </div>

              <!-- Inline delete confirmation -->
              <div v-if="pendingDeleteId === material.id" class="flex items-center gap-2 ml-2">
                <span class="text-xs font-medium whitespace-nowrap gm-text-danger">
                  Видалити з класу?
                </span>
                <button
                  type="button"
                  class="px-2 py-1 text-xs font-semibold rounded transition-colors gm-btn-danger"
                  title="Підтвердити видалення матеріалу з класу"
                  @click="confirmDelete"
                >
                  Так
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-xs font-medium rounded transition-colors gm-btn-cancel"
                  title="Скасувати видалення"
                  @click="cancelDelete"
                >
                  Ні
                </button>
              </div>

              <MaterialAccessToggle
                v-else
                :material-id="material.id"
                :is-active="material.is_active"
                @toggle="onToggleMaterial"
                @remove="onRemoveMaterial"
              />
            </div>
          </div>

          <!-- No results for this tab -->
          <div v-else class="p-6 text-center text-sm gm-text-muted">
            🔍 Немає файлів у цій категорії
          </div>
        </template>

        <!-- Empty state (жодного матеріалу в групі) -->
        <div v-else class="p-8 text-center">
          <p class="text-2xl mb-2">📂</p>
          <p class="text-sm font-medium mb-1 gm-text-muted">
            Матеріали ще не додано
          </p>
          <p class="text-xs leading-snug gm-text-muted">
            Знайдіть файл у бібліотеці ліворуч і натисніть «+» щоб додати до цього класу
          </p>
        </div>
      </div>
    </template>

    <!-- Loading -->
    <div v-if="groupStore.isLoading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent gm-spinner" />
    </div>

    <!-- Create Group Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showCreateModal = false"
      >
        <div class="rounded-xl shadow-xl p-6 w-full max-w-md mx-4 gm-modal">
          <h3 class="text-lg font-semibold mb-4 gm-title">
            {{ t('learningContent.groups.createGroup') }}
          </h3>

          <div>
            <label class="block text-sm font-medium mb-1 gm-text-secondary">
              {{ t('learningContent.groups.groupTitle') }}
            </label>
            <input
              v-model="newGroupTitle"
              type="text"
              maxlength="200"
              autofocus
              class="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-shadow gm-input"
              :placeholder="t('learningContent.groups.titlePlaceholder')"
              @keydown.enter="createGroup"
            />
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button
              class="px-4 py-2 text-sm rounded-lg transition-colors gm-btn-cancel"
              @click="showCreateModal = false"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 gm-btn-primary"
              :disabled="!newGroupTitle.trim()"
              @click="createGroup"
            >
              {{ t('learningContent.groups.createGroup') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Group material type tabs ──────────────────────────────── */
.gm-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px 16px 0;
}
.gm-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  white-space: nowrap;
  line-height: 1.5;
}
.gm-tab:hover {
  background: var(--border-color);
  color: var(--text-primary);
}
.gm-tab--active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
}
.gm-tab--active:hover {
  background: var(--accent-hover);
}
.gm-tab-count {
  font-size: 0.6875rem;
  font-weight: 700;
  background: rgba(255,255,255,0.25);
  color: inherit;
  border-radius: 20px;
  padding: 0 5px;
  min-width: 16px;
  text-align: center;
  line-height: 1.6;
}

/* ── Theme-aware utility classes ──────────────────────────── */
.gm-title {
  color: var(--text-primary);
}
.gm-text-secondary {
  color: var(--text-secondary);
}
.gm-text-muted {
  color: var(--text-secondary);
  opacity: 0.7;
}
.gm-text-warning {
  color: var(--warning-bg);
}
.gm-text-danger {
  color: var(--danger-bg);
}
.gm-panel {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
}
.gm-panel-header {
  border-bottom: 1px solid var(--border-color);
}
.gm-badge-count {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.gm-divider-list > * + * {
  border-top: 1px solid var(--border-color);
}
.gm-btn-danger {
  color: var(--accent-contrast);
  background: var(--danger-bg);
}
.gm-btn-danger:hover {
  background: color-mix(in srgb, var(--danger-bg) 85%, black);
}
.gm-btn-cancel {
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  background: transparent;
}
.gm-btn-cancel:hover {
  background: var(--bg-secondary);
}
.gm-btn-primary {
  color: var(--accent-contrast);
  background: var(--accent);
}
.gm-btn-primary:hover {
  background: var(--accent-hover);
}
.gm-spinner {
  border-color: var(--accent);
}
.gm-modal {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
}
.gm-input {
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
}
.gm-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}
.gm-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent);
}
</style>
