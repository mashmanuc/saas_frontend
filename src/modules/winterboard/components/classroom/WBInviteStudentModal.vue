<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="wb-invite-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="t('winterboard.startClassroom.modalTitle')"
      @click.self="handleCancel"
    >
      <div class="wb-invite-modal">
        <button
          type="button"
          class="wb-invite-modal__close"
          :aria-label="t('common.close', 'Закрити')"
          @click="handleCancel"
        >
          ✕
        </button>

        <h2 class="wb-invite-modal__title">{{ t('winterboard.startClassroom.modalTitle') }}</h2>

        <!-- Student selection -->
        <div class="wb-invite-modal__field">
          <label class="wb-invite-modal__label">
            {{ t('winterboard.startClassroom.selectStudent') }}
          </label>
          <div v-if="isLoadingStudents" class="wb-invite-modal__spinner" aria-busy="true" />
          <p v-else-if="students.length === 0" class="wb-invite-modal__empty">
            {{ t('winterboard.startClassroom.noStudents') }}
          </p>
          <select
            v-else
            v-model="selectedStudentId"
            class="wb-invite-modal__select"
            :disabled="isSubmitting"
          >
            <option value="" disabled>{{ t('winterboard.startClassroom.selectStudentPlaceholder') }}</option>
            <option
              v-for="s in students"
              :key="s.id"
              :value="s.id"
            >
              {{ s.name }}
            </option>
          </select>
        </div>

        <!-- Optional lesson name -->
        <div class="wb-invite-modal__field">
          <label class="wb-invite-modal__label">
            {{ t('winterboard.startClassroom.lessonName') }}
          </label>
          <input
            v-model="lessonName"
            class="wb-invite-modal__input"
            type="text"
            :placeholder="t('winterboard.startClassroom.lessonNamePlaceholder')"
            :disabled="isSubmitting"
            maxlength="255"
          />
        </div>

        <!-- Status while submitting -->
        <p v-if="submitStatus" class="wb-invite-modal__status">{{ submitStatus }}</p>

        <!-- Error -->
        <p v-if="errorMsg" class="wb-invite-modal__error" role="alert">{{ errorMsg }}</p>

        <!-- Actions -->
        <div class="wb-invite-modal__actions">
          <button
            type="button"
            class="wb-invite-modal__btn wb-invite-modal__btn--cancel"
            :disabled="isSubmitting"
            @click="handleCancel"
          >
            {{ t('winterboard.startClassroom.cancel') }}
          </button>
          <button
            type="button"
            class="wb-invite-modal__btn wb-invite-modal__btn--confirm"
            :disabled="isSubmitting || !selectedStudentId || students.length === 0"
            @click="handleConfirm"
          >
            {{ isSubmitting ? '…' : t('winterboard.startClassroom.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ordersApi } from '@/modules/booking/api/ordersApi'
import { winterboardApi } from '../../api/winterboardApi'
import { useOpsSyncStore } from '../../stores/opsSyncStore'

interface StudentOption {
  id: number
  name: string
}

const props = defineProps<{
  visible: boolean
  sessionId: string | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const router = useRouter()
const opsSync = useOpsSyncStore()

const students = ref<StudentOption[]>([])
const isLoadingStudents = ref(false)
const selectedStudentId = ref<number | ''>('')
const lessonName = ref('')
const isSubmitting = ref(false)
const errorMsg = ref('')
const submitStatus = ref('')

watch(() => props.visible, async (v) => {
  if (v) {
    selectedStudentId.value = ''
    lessonName.value = ''
    errorMsg.value = ''
    submitStatus.value = ''
    isSubmitting.value = false
    await loadStudents()
  }
})

async function loadStudents(): Promise<void> {
  isLoadingStudents.value = true
  try {
    const res = await ordersApi.listOrders()
    const seen = new Set<number>()
    students.value = (res.results ?? [])
      .filter((o) => {
        if (seen.has(o.student.id)) return false
        seen.add(o.student.id)
        return true
      })
      .map((o) => ({
        id: o.student.id,
        name: o.student.fullName || `${o.student.firstName} ${o.student.lastName}`.trim() || o.student.email,
      }))
  } catch {
    students.value = []
  } finally {
    isLoadingStudents.value = false
  }
}

function handleCancel(): void {
  if (isSubmitting.value) return
  emit('close')
}

async function handleConfirm(): Promise<void> {
  if (!selectedStudentId.value || !props.sessionId) return

  errorMsg.value = ''
  isSubmitting.value = true

  try {
    // INV-STC-12: flush barrier — all pending ops must reach BE before fork.
    // BE reads state via ChunkStateAssembler; unflushed FE ops would be lost.
    submitStatus.value = t('winterboard.startClassroom.flushing')
    try {
      await opsSync.flushAll()
    } catch (flushErr: unknown) {
      const name = (flushErr as Error)?.name
      if (name === 'DesyncError') {
        errorMsg.value = t('winterboard.startClassroom.errorDesync')
      } else {
        errorMsg.value = t('winterboard.startClassroom.errorFlush')
      }
      return
    }

    // Fork solo → classroom (BE: _reid_state_and_collect_assets + Lesson.create)
    submitStatus.value = t('winterboard.startClassroom.creating')
    const result = await winterboardApi.startClassroom(props.sessionId, {
      student_id: selectedStudentId.value as number,
      lesson_name: lessonName.value || undefined,
    })

    // Reset opsSync for this solo session BEFORE navigation.
    // WBClassroomRoom.onMounted will call opsSync.bootstrap(classroomSessionId).
    opsSync.reset()

    emit('close')
    router.push(result.classroom_url)
  } catch (err: unknown) {
    const code = (err as any)?.response?.data?.code as string | undefined
    if (code === 'quiesce_timeout' || code === 'state_assembler_overflow') {
      errorMsg.value = t('winterboard.startClassroom.errorServer')
    } else if (code === 'invalid_student_id') {
      errorMsg.value = t('winterboard.startClassroom.errorInvalidStudent')
    } else {
      errorMsg.value = t('winterboard.startClassroom.errorGeneric')
    }
  } finally {
    isSubmitting.value = false
    submitStatus.value = ''
  }
}
</script>

<style scoped>
.wb-invite-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-invite-modal {
  position: relative;
  background: var(--wb-bg-secondary, #1e293b);
  color: var(--wb-text-primary, #f1f5f9);
  border-radius: 12px;
  padding: 28px 32px 24px;
  width: min(420px, calc(100vw - 32px));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wb-invite-modal__close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  color: var(--wb-text-secondary, #94a3b8);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 4px 6px;
}
.wb-invite-modal__close:hover {
  color: var(--wb-text-primary, #f1f5f9);
}

.wb-invite-modal__title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  padding-right: 24px;
}

.wb-invite-modal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wb-invite-modal__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-text-secondary, #94a3b8);
}

.wb-invite-modal__select,
.wb-invite-modal__input {
  background: var(--wb-bg-tertiary, #0f172a);
  border: 1px solid var(--wb-border, #334155);
  border-radius: 8px;
  color: var(--wb-text-primary, #f1f5f9);
  font-size: 14px;
  padding: 8px 12px;
  outline: none;
  width: 100%;
}
.wb-invite-modal__select:focus,
.wb-invite-modal__input:focus {
  border-color: var(--wb-accent, #6366f1);
}
.wb-invite-modal__select:disabled,
.wb-invite-modal__input:disabled {
  opacity: 0.5;
}

.wb-invite-modal__empty {
  font-size: 13px;
  color: var(--wb-text-secondary, #94a3b8);
  margin: 0;
}

.wb-invite-modal__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--wb-border, #334155);
  border-top-color: var(--wb-accent, #6366f1);
  border-radius: 50%;
  animation: wb-spin 0.7s linear infinite;
}
@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

.wb-invite-modal__status {
  font-size: 13px;
  color: var(--wb-text-secondary, #94a3b8);
  margin: 0;
}

.wb-invite-modal__error {
  font-size: 13px;
  color: var(--wb-danger, #ef4444);
  margin: 0;
}

.wb-invite-modal__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 4px;
}

.wb-invite-modal__btn {
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 20px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.wb-invite-modal__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wb-invite-modal__btn--cancel {
  background: var(--wb-bg-tertiary, #0f172a);
  color: var(--wb-text-secondary, #94a3b8);
  border: 1px solid var(--wb-border, #334155);
}
.wb-invite-modal__btn--cancel:not(:disabled):hover {
  color: var(--wb-text-primary, #f1f5f9);
}

.wb-invite-modal__btn--confirm {
  background: var(--wb-accent, #6366f1);
  color: #fff;
}
.wb-invite-modal__btn--confirm:not(:disabled):hover {
  opacity: 0.85;
}
</style>
