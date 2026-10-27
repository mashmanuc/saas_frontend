<template>
  <Modal :open="open" :title="title" size="sm" @close="emit('close')">
    <div class="csm" data-testid="conduct-student-modal">
      <p class="csm__hint">{{ t('winterboard.lesson.conductStudent.hint') }}</p>
      <!-- v-if: свіжий список учнів при кожному відкритті -->
      <ConductStudentChoice v-if="open" :current-id="currentId" :busy="busy" @choose="emit('choose', $event)" />
    </div>
  </Modal>
</template>

<script setup lang="ts">
/** «З ким урок?» на сайті (LAW §9 v1.68): перед «Провести» і для «Змінити учня» на картці проведеного уроку. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import ConductStudentChoice from './ConductStudentChoice.vue'

const props = defineProps<{ open: boolean; mode: 'conduct' | 'change'; currentId?: number | null; busy?: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'choose', studentId: number | null): void
}>()
const { t } = useI18n({ useScope: 'global' })

const title = computed(() => t(props.mode === 'change'
  ? 'winterboard.lesson.conductStudent.changeTitle'
  : 'winterboard.lesson.conductStudent.title'))
</script>

<style scoped>
.csm { display: flex; flex-direction: column; gap: 10px; }
.csm__hint { margin: 0; font-size: 0.875rem; color: var(--text-secondary); }
</style>
