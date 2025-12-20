<script setup lang="ts">
// TASK F7: Search Filters Modal
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import CatalogFilters from '../catalog/CatalogFilters.vue'
import type { SearchFilters, ExtendedFilterOptions } from '../../api/marketplace'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isOpen: boolean
  filters: SearchFilters
  options: ExtendedFilterOptions | null
  resultsCount: number
}>()

const emit = defineEmits<{
  close: []
  apply: [filters: SearchFilters]
  clear: []
}>()

const { t } = useI18n()

const localFilters = ref<SearchFilters>({ ...props.filters })

watch(
  () => props.filters,
  (newFilters) => {
    localFilters.value = { ...newFilters }
  },
  { deep: true }
)

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      localFilters.value = { ...props.filters }
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
)

const close = () => emit('close')

const handleUpdate = (updates: Partial<SearchFilters>) => {
  localFilters.value = { ...localFilters.value, ...updates }
}

const handleApply = () => {
  emit('apply', localFilters.value)
  close()
}

const handleClear = () => {
  emit('clear')
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="filters-modal-overlay" @click.self="close">
        <div class="filters-modal">
          <header class="modal-header">
            <h2>{{ t('marketplace.filters.title') }}</h2>
            <button class="close-btn" type="button" @click="close">
              <X :size="24" />
            </button>
          </header>

          <div class="modal-body">
            <CatalogFilters
              :filters="localFilters"
              :options="options"
              @update="handleUpdate"
            />
          </div>

          <footer class="modal-footer">
            <button class="btn btn-secondary" type="button" @click="handleClear">
              {{ t('marketplace.filters.clearAll') }}
            </button>
            <button class="btn btn-primary" type="button" @click="handleApply">
              {{ t('marketplace.search.showResults', { count: resultsCount }) }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.filters-modal-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--text-primary) 50%, transparent);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

.filters-modal {
  background: var(--surface-card);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 8px;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--surface-card-muted);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .filters-modal,
.modal-leave-active .filters-modal {
  transition: transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .filters-modal,
.modal-leave-to .filters-modal {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .filters-modal-overlay {
    align-items: center;
  }

  .filters-modal {
    border-radius: 16px;
    max-height: 80vh;
  }
}
</style>
