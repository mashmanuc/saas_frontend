<script setup lang="ts">
// TASK F7: Search Filters Modal
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import CatalogFilters from '../catalog/CatalogFilters.vue'
import type { SearchFilters, ExtendedFilterOptions } from '../../api/marketplace'

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
            <h2>Filters</h2>
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
              Clear All
            </button>
            <button class="btn btn-primary" type="button" @click="handleApply">
              Show {{ resultsCount }} Results
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

.filters-modal {
  background: var(--color-bg-primary, white);
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
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-secondary, #6b7280);
  border-radius: 8px;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-primary, #111827);
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
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-primary, #111827);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
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
