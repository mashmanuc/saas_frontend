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
        <h2 class="text-base font-semibold text-gray-900 dark:text-white leading-tight flex items-center gap-1.5 min-w-0">
          <span class="flex-shrink-0">📁</span>
          <span v-if="groupStore.selectedGroup" class="truncate">{{ groupStore.selectedGroup.title }}</span>
          <span v-else class="text-gray-500 dark:text-gray-400">{{ t('learningContent.groups.manager') }}</span>
        </h2>
        <!-- Статистика: кількість матеріалів і учнів -->
        <p v-if="groupStore.selectedGroup" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          <span>{{ groupStore.materials.length }}
            {{ groupStore.materials.length === 1 ? 'матеріал' : groupStore.materials.length < 5 ? 'матеріали' : 'матеріалів' }}
          </span>
          <span v-if="groupStore.students.length" class="ml-1">
            · {{ groupStore.students.length }}
            {{ groupStore.students.length === 1 ? 'учень' : groupStore.students.length < 5 ? 'учні' : 'учнів' }}
          </span>
        </p>
        <p v-else class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
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
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            {{ t('learningContent.groups.materials') }}
            <span
              v-if="groupStore.materials.length > 0"
              class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40 rounded-full"
            >
              {{ groupStore.materials.length }}
            </span>
          </h3>
          <span v-if="groupStore.activeMaterials.length < groupStore.materials.length" class="text-xs text-amber-600 dark:text-amber-400">
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
          <div v-if="filteredMaterials.length > 0" class="divide-y divide-gray-100 dark:divide-gray-700">
            <div
              v-for="material in filteredMaterials"
              :key="material.id"
              class="flex items-center justify-between px-4 py-3"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ material.content_title }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ material.content_type }}
                </p>
              </div>

              <!-- Inline delete confirmation -->
              <div v-if="pendingDeleteId === material.id" class="flex items-center gap-2 ml-2">
                <span class="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                  Видалити з класу?
                </span>
                <button
                  type="button"
                  class="px-2 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                  title="Підтвердити видалення матеріалу з класу"
                  @click="confirmDelete"
                >
                  Так
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
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
          <div v-else class="p-6 text-center text-sm text-gray-400">
            🔍 Немає файлів у цій категорії
          </div>
        </template>

        <!-- Empty state (жодного матеріалу в групі) -->
        <div v-else class="p-8 text-center">
          <p class="text-2xl mb-2">📂</p>
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Матеріали ще не додано
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500 leading-snug">
            Знайдіть файл у бібліотеці ліворуч і натисніть «+» щоб додати до цього класу
          </p>
        </div>
      </div>
    </template>

    <!-- Loading -->
    <div v-if="groupStore.isLoading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
    </div>

    <!-- Create Group Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {{ t('learningContent.groups.createGroup') }}
          </h3>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ t('learningContent.groups.groupTitle') }}
            </label>
            <input
              v-model="newGroupTitle"
              type="text"
              maxlength="200"
              autofocus
              class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              :placeholder="t('learningContent.groups.titlePlaceholder')"
              @keydown.enter="createGroup"
            />
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button
              class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              @click="showCreateModal = false"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
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
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  white-space: nowrap;
  line-height: 1.5;
}
.gm-tab:hover {
  background: #e2e8f0;
  color: #1e293b;
}
.gm-tab--active {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #fff;
}
.gm-tab--active:hover {
  background: #4338ca;
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
</style>
