<script setup lang="ts">
import { ref, computed } from 'vue'
import { X, ChevronDown, ChevronUp } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import { useI18n } from 'vue-i18n'
import type { CatalogFilters, FilterOptions } from '../../api/marketplace'

interface Props {
  filters: CatalogFilters
  options: FilterOptions | null
  show: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update', filters: Partial<CatalogFilters>): void
  (e: 'close'): void
  (e: 'apply'): void
}>()

const { t } = useI18n()

const localFilters = ref<Partial<CatalogFilters>>({ ...props.filters })

const expandedSections = ref<Record<string, boolean>>({
  experience: false,
  direction: false,
  format: false,
  other: false
})

function toggleSection(key: string) {
  expandedSections.value[key] = !expandedSections.value[key]
}

function handleApply() {
  emit('update', localFilters.value)
  emit('apply')
  emit('close')
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click="handleClose">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h3>{{ t('marketplace.filters.title') }}</h3>
          <Button variant="ghost" iconOnly @click="handleClose">
            <X :size="20" />
          </Button>
        </div>

        <div class="modal-body">
          <!-- Experience Section -->
          <div class="filter-section">
            <button class="section-header" @click="toggleSection('experience')">
              <span>{{ t('marketplace.filters.experience') }}</span>
              <ChevronDown v-if="!expandedSections.experience" :size="18" />
              <ChevronUp v-else :size="18" />
            </button>
            <div v-if="expandedSections.experience" class="section-content">
              <div class="filter-group">
                <label>{{ t('marketplace.filters.experience') }}</label>
                <input
                  v-model.number="localFilters.experience_min"
                  type="number"
                  min="0"
                  :placeholder="t('marketplace.filters.experiencePlaceholder')"
                />
              </div>
              <div class="filter-group">
                <label>{{ t('marketplace.filters.experienceMax') }}</label>
                <input
                  v-model.number="localFilters.experience_max"
                  type="number"
                  min="0"
                  :placeholder="t('marketplace.filters.experienceMaxPlaceholder')"
                />
              </div>
            </div>
          </div>

          <!-- Direction Section -->
          <div class="filter-section">
            <button class="section-header" @click="toggleSection('direction')">
              <span>{{ t('marketplace.filters.direction') }}</span>
              <ChevronDown v-if="!expandedSections.direction" :size="18" />
              <ChevronUp v-else :size="18" />
            </button>
            <div v-if="expandedSections.direction" class="section-content">
              <div class="filter-group">
                <select v-model="localFilters.direction">
                  <option value="">{{ t('marketplace.filters.any') }}</option>
                  <option value="nmt">{{ t('marketplace.filters.directionNmt') }}</option>
                  <option value="dpa">{{ t('marketplace.filters.directionDpa') }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Format Section -->
          <div class="filter-section">
            <button class="section-header" @click="toggleSection('format')">
              <span>{{ t('marketplace.filters.format') }}</span>
              <ChevronDown v-if="!expandedSections.format" :size="18" />
              <ChevronUp v-else :size="18" />
            </button>
            <div v-if="expandedSections.format" class="section-content">
              <div class="filter-group">
                <select v-model="localFilters.format">
                  <option value="">{{ t('marketplace.filters.any') }}</option>
                  <option value="online">{{ t('marketplace.filters.formatOnline') }}</option>
                  <option value="offline">{{ t('marketplace.filters.formatOffline') }}</option>
                  <option value="hybrid">{{ t('marketplace.filters.formatHybrid') }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Other Section -->
          <div class="filter-section">
            <button class="section-header" @click="toggleSection('other')">
              <span>{{ t('common.other') }}</span>
              <ChevronDown v-if="!expandedSections.other" :size="18" />
              <ChevronUp v-else :size="18" />
            </button>
            <div v-if="expandedSections.other" class="section-content">
              <div class="filter-group">
                <label>{{ t('marketplace.filters.timezone') }}</label>
                <input
                  v-model="localFilters.timezone"
                  type="text"
                  :placeholder="t('marketplace.filters.timezonePlaceholder')"
                />
              </div>
              <div class="filter-group">
                <label class="checkbox-label">
                  <input
                    v-model="localFilters.has_certifications"
                    type="checkbox"
                  />
                  {{ t('marketplace.filters.hasCertifications') }}
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <Button variant="outline" @click="handleClose">
            {{ t('common.cancel') }}
          </Button>
          <Button variant="primary" @click="handleApply">
            {{ t('common.apply') }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-muted, #6b7280);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: var(--surface-hover, #f3f4f6);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.filter-section {
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.filter-section:last-child {
  border-bottom: none;
}

.section-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
  border: none;
  background: transparent;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
  cursor: pointer;
  transition: color 0.2s;
}

.section-header:hover {
  color: var(--accent);
}

.section-content {
  padding-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #374151);
}

.filter-group select,
.filter-group input[type='text'],
.filter-group input[type='number'] {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  font-size: 0.9375rem;
  background: white;
}

.filter-group select:focus,
.filter-group input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9375rem;
  color: var(--text-primary, #111827);
}

.checkbox-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

</style>
