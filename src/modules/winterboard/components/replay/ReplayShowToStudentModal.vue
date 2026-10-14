<template>
  <Modal
    :open="!!replay"
    :title="t('winterboard.replay.showToStudent.title')"
    size="sm"
    @close="$emit('close')"
  >
    <div class="show-to-student" data-testid="show-to-student">
      <p class="show-to-student__hint">{{ t('winterboard.replay.showToStudent.hint') }}</p>
      <p v-if="replay?.lesson_student_id" class="show-to-student__note">
        {{ t('winterboard.replay.showToStudent.lessonStudentNote') }}
      </p>

      <p v-if="loading" class="show-to-student__muted">{{ t('loader.loading') }}</p>
      <p v-else-if="loadFailed" class="show-to-student__error">{{ t('winterboard.replay.showToStudent.failed') }}</p>
      <p v-else-if="students.length === 0" class="show-to-student__muted">
        {{ t('winterboard.replay.showToStudent.empty') }}
      </p>
      <ul v-else class="show-to-student__list">
        <li v-for="s in students" :key="s.id">
          <button
            type="button"
            class="show-to-student__item"
            :class="{ 'show-to-student__item--current': s.id === currentId }"
            :disabled="busy"
            data-testid="show-to-student-item"
            @click="choose(s.id)"
          >
            <span>{{ s.name }}</span>
            <span v-if="s.id === currentId" class="show-to-student__current">
              ✓ {{ t('winterboard.replay.showToStudent.current') }}
            </span>
          </button>
        </li>
      </ul>

      <p v-if="saveFailed" class="show-to-student__error">{{ t('winterboard.replay.showToStudent.failed') }}</p>
    </div>

    <template #footer>
      <Button
        v-if="currentId"
        variant="outline"
        :disabled="busy"
        data-testid="show-to-student-remove"
        @click="choose(null)"
      >
        {{ t('winterboard.replay.showToStudent.remove') }}
      </Button>
      <Button variant="primary" @click="$emit('close')">
        {{ t('common.close') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
/**
 * «👤 Показати учню…» (власник 2026-10-14: «супер, роби»): учитель обирає свого учня, і запис
 * з'являється в того в «Моїх уроках». Для соло-дошки, старого запису й учня, доданого пізніше.
 * Обраний учень бачить запис ДОДАТКОВО до учня уроку (BE `Replay.viewer_student_ids`).
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import {
  listShareStudents,
  shareReplayWithStudent,
  type Replay,
  type ShareStudent,
} from '../../api/replayLifecycleApi'

const props = defineProps<{ replay: Replay | null }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', replay: Replay): void
}>()

const { t } = useI18n({ useScope: 'global' })

const students = ref<ShareStudent[]>([])
const loading = ref(false)
const loadFailed = ref(false)
const busy = ref(false)
const saveFailed = ref(false)
/** Кого обрано зараз — з відповіді сервера, а не з кліку (щоб «✓» не брехав після помилки). */
const currentId = computed(() => props.replay?.shared_student?.id ?? null)

watch(() => props.replay?.id, async (id) => {
  saveFailed.value = false
  if (!id) return
  loading.value = true
  loadFailed.value = false
  try {
    students.value = (await listShareStudents()).students
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function choose(studentId: number | null) {
  if (!props.replay || busy.value || studentId === currentId.value) return
  busy.value = true
  saveFailed.value = false
  try {
    emit('updated', await shareReplayWithStudent(props.replay.id, studentId))
  } catch {
    saveFailed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.show-to-student { display: flex; flex-direction: column; gap: 10px; }
.show-to-student__hint { margin: 0; font-size: 0.875rem; color: var(--text-secondary); }
.show-to-student__note { margin: 0; font-size: 0.8125rem; color: var(--text-secondary); }
.show-to-student__muted { margin: 0; font-size: 0.875rem; color: var(--text-secondary); }
.show-to-student__error { margin: 0; font-size: 0.875rem; color: var(--danger, #dc2626); }
.show-to-student__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.show-to-student__item {
  width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 10px;
  background: var(--card-bg, var(--bg-primary)); color: var(--text-primary); font-size: 0.9375rem;
  text-align: left; cursor: pointer;
}
.show-to-student__item:hover:not(:disabled) { border-color: var(--accent); }
.show-to-student__item:disabled { cursor: default; opacity: 0.7; }
.show-to-student__item--current { border-color: var(--accent); }
.show-to-student__current { font-size: 0.8125rem; color: var(--accent); white-space: nowrap; }
</style>
