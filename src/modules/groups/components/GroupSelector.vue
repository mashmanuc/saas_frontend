<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGroupStore } from '../stores/groupStore'

const { t } = useI18n()
const store = useGroupStore()

const props = defineProps<{
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const selectedId = computed({
  get: () => props.modelValue ?? null,
  set: (val) => emit('update:modelValue', val),
})
</script>

<template>
  <div class="group-selector">
    <label class="text-sm font-medium gs-label">
      {{ t('learningContent.groups.selectGroup') }}
    </label>

    <!-- IMPLICIT groups (автоматичні, для кожного учня) -->
    <div v-if="store.implicitGroups.length > 0" class="mt-2">
      <p class="text-xs uppercase tracking-wider mb-1 gs-section-label">
        {{ t('learningContent.groups.implicitLabel') }}
      </p>
      <button
        v-for="group in store.implicitGroups"
        :key="group.id"
        class="block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors gs-group-btn"
        :class="{ 'gs-group-btn--active': selectedId === group.id }"
        @click="selectedId = group.id"
      >
        {{ group.title }}
        <span class="text-xs ml-1 gs-meta">
          ({{ group.material_count }} {{ t('learningContent.groups.materials') }})
        </span>
      </button>
    </div>

    <!-- EXPLICIT groups (явні класи, створені тьютором) -->
    <div v-if="store.explicitGroups.length > 0" class="mt-3">
      <p class="text-xs uppercase tracking-wider mb-1 gs-section-label">
        {{ t('learningContent.groups.explicitLabel') }}
      </p>
      <button
        v-for="group in store.explicitGroups"
        :key="group.id"
        class="block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors gs-group-btn"
        :class="{ 'gs-group-btn--active': selectedId === group.id }"
        @click="selectedId = group.id"
      >
        {{ group.title }}
        <span class="text-xs ml-1 gs-meta">
          ({{ group.student_count }} {{ t('learningContent.groups.students') }},
           {{ group.material_count }} {{ t('learningContent.groups.materials') }})
        </span>
      </button>
    </div>

    <!-- Empty state -->
    <p
      v-if="store.groups.length === 0 && !store.isLoading"
      class="text-sm mt-2 gs-meta"
    >
      {{ t('learningContent.groups.empty') }}
    </p>
  </div>
</template>

<style scoped>
.gs-label {
  color: var(--text-secondary);
}
.gs-section-label {
  color: var(--text-secondary);
}
.gs-meta {
  color: var(--text-secondary);
  opacity: 0.7;
}
.gs-group-btn {
  color: var(--text-primary);
}
.gs-group-btn:hover {
  background: var(--bg-secondary);
}
.gs-group-btn--active {
  background: color-mix(in srgb, var(--accent) 12%, var(--card-bg));
  color: var(--accent);
}
.gs-group-btn--active:hover {
  background: color-mix(in srgb, var(--accent) 18%, var(--card-bg));
}
</style>
