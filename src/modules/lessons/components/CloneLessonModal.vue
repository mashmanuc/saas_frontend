<script setup lang="ts">
/**
 * CloneLessonModal — Модалка «Повторити урок для іншого учня»
 *
 * Виклик:
 *   <CloneLessonModal
 *     v-model="showModal"
 *     :lesson-id="lesson.id"
 *     :lesson-title="lesson.title || 'Урок'"
 *     :students="studentRelations"
 *     :current-student-id="selectedRelation?.student?.id"
 *     @cloned="onCloned"
 *   />
 *
 * Emit 'cloned' передає: { lesson_id, student_id }
 */
import { ref, computed, watch } from 'vue'
import lessonsApi from '@/api/lessons'

// ── Props & Emits ──────────────────────────────────────────────
interface StudentRelation {
  id: string | number
  student?: {
    id: number
    first_name?: string
    last_name?: string
    is_demo?: boolean
  }
}

const props = defineProps<{
  modelValue: boolean          // v-model (show/hide)
  lessonId: number             // id уроку, що клонується
  lessonTitle?: string         // назва для заголовка модалки
  students: StudentRelation[]  // список відносин тьютора зі студентами
  currentStudentId?: number    // поточний студент (буде вибраний за замовчуванням)
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'cloned', payload: { lessonId: number; studentId: number }): void
}>()

// ── Стан ──────────────────────────────────────────────────────
const selectedStudentId = ref<number | null>(null)
const selectedDate = ref<string>('')   // YYYY-MM-DD
const selectedTime = ref<string>('09:00')  // HH:MM
const isCloning = ref(false)
const cloneError = ref<string | null>(null)

// ── Ініціалізація при відкритті ────────────────────────────────
watch(() => props.modelValue, (open) => {
  if (!open) return
  // Default: той самий учень або перший з списку
  selectedStudentId.value = props.currentStudentId
    ?? props.students[0]?.student?.id
    ?? null
  // Default дата — завтра
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  selectedDate.value = tomorrow.toISOString().slice(0, 10)
  selectedTime.value = '09:00'
  cloneError.value = null
})

// ── Computed ───────────────────────────────────────────────────
const startISO = computed<string>(() => {
  if (!selectedDate.value) return ''
  return `${selectedDate.value}T${selectedTime.value}:00`
})

// Знайти ім'я вибраного студента для preview
const selectedStudentName = computed<string>(() => {
  if (!selectedStudentId.value) return '—'
  const rel = props.students.find(r => r.student?.id === selectedStudentId.value)
  const s = rel?.student
  if (!s) return '—'
  if (s.is_demo) return '🧪 Пісочниця'
  return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Учень #${s.id}`
})

// Валідність форми
const isValid = computed(() => !!selectedStudentId.value && !!selectedDate.value)

// Мінімальна дата — сьогодні
const minDate = computed(() => new Date().toISOString().slice(0, 10))

// ── Дії ────────────────────────────────────────────────────────
function close() {
  emit('update:modelValue', false)
}

function studentLabel(rel: StudentRelation): string {
  const s = rel.student
  if (!s) return `Учень #${rel.id}`
  if (s.is_demo) return '🧪 Пісочниця (demo)'
  const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()
  return name || `Учень #${s.id}`
}

async function confirmClone() {
  if (!isValid.value || isCloning.value) return
  cloneError.value = null
  isCloning.value = true

  try {
    await (lessonsApi as any).cloneLesson(props.lessonId, {
      student_id: selectedStudentId.value,
      start: startISO.value,
    })
    emit('cloned', {
      lessonId: props.lessonId,
      studentId: selectedStudentId.value!,
    })
    close()
  } catch (e: any) {
    const msg = e?.response?.data?.detail
      ?? e?.response?.data?.error
      ?? 'Помилка клонування. Спробуйте ще раз.'
    cloneError.value = String(msg)
  } finally {
    isCloning.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="cll-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cll-title"
      @click.self="close"
    >
      <div class="cll-panel">
        <!-- Заголовок -->
        <div class="cll-header">
          <div>
            <h2 id="cll-title" class="cll-title">🔄 Повторити урок</h2>
            <p v-if="lessonTitle" class="cll-subtitle">«{{ lessonTitle }}»</p>
          </div>
          <button class="cll-close" :title="'Закрити'" @click="close">×</button>
        </div>

        <!-- Body -->
        <div class="cll-body">

          <!-- Вибір учня -->
          <div class="cll-field">
            <label class="cll-label">
              Для кого провести урок
              <span class="cll-required">*</span>
            </label>
            <div class="cll-student-list">
              <label
                v-for="rel in students"
                :key="rel.id"
                class="cll-student-option"
                :class="{ 'cll-student-option--selected': selectedStudentId === rel.student?.id }"
              >
                <input
                  type="radio"
                  :value="rel.student?.id"
                  :checked="selectedStudentId === rel.student?.id"
                  class="sr-only"
                  @change="selectedStudentId = rel.student?.id ?? null"
                />
                <span class="cll-student-avatar">
                  {{ rel.student?.is_demo ? '🧪' : '👤' }}
                </span>
                <span class="cll-student-name">{{ studentLabel(rel) }}</span>
                <span v-if="rel.student?.id === currentStudentId" class="cll-student-badge">
                  поточний
                </span>
                <!-- Checkmark -->
                <svg
                  v-if="selectedStudentId === rel.student?.id"
                  class="cll-student-check"
                  width="16" height="16" viewBox="0 0 16 16" fill="none"
                >
                  <circle cx="8" cy="8" r="7" fill="#3b82f6"/>
                  <path d="M4.5 8l2.5 2.5 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </label>

              <div v-if="students.length === 0" class="cll-no-students">
                Немає учнів. Спочатку заброньте урок зі студентом.
              </div>
            </div>
          </div>

          <!-- Дата + час -->
          <div class="cll-field-row">
            <div class="cll-field">
              <label class="cll-label" for="cll-date">
                Дата уроку
                <span class="cll-required">*</span>
              </label>
              <input
                id="cll-date"
                v-model="selectedDate"
                type="date"
                class="cll-input"
                :min="minDate"
              />
            </div>
            <div class="cll-field">
              <label class="cll-label" for="cll-time">Час початку</label>
              <input
                id="cll-time"
                v-model="selectedTime"
                type="time"
                class="cll-input"
                step="900"
              />
            </div>
          </div>

          <!-- Preview -->
          <div v-if="isValid" class="cll-preview">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="cll-preview-icon">
              <circle cx="8" cy="8" r="7" stroke="#3b82f6" stroke-width="1.5"/>
              <path d="M8 5v3.5l2 2" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Буде створено чернетку уроку для
            <strong>{{ selectedStudentName }}</strong>
            на {{ selectedDate.split('-').reverse().join('.') }}
            о {{ selectedTime }}
          </div>

          <!-- Помилка -->
          <div v-if="cloneError" class="cll-error">
            ⚠️ {{ cloneError }}
          </div>
        </div>

        <!-- Footer -->
        <div class="cll-footer">
          <button class="cll-btn cll-btn--cancel" @click="close">
            Скасувати
          </button>
          <button
            class="cll-btn cll-btn--confirm"
            :disabled="!isValid || isCloning"
            @click="confirmClone"
          >
            <span v-if="isCloning" class="cll-spinner" />
            {{ isCloning ? 'Створюємо…' : '🔄 Повторити урок' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop ── */
.cll-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: cll-fade-in 0.15s ease;
}
@keyframes cll-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Panel ── */
.cll-panel {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 440px;
  animation: cll-slide-up 0.2s ease;
  overflow: hidden;
}
@keyframes cll-slide-up {
  from { transform: translateY(16px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

/* ── Header ── */
.cll-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 0;
}
.cll-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}
.cll-subtitle {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0.125rem 0 0;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cll-close {
  width: 28px;
  height: 28px;
  border: none;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 1.125rem;
  line-height: 1;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.cll-close:hover {
  background: #e2e8f0;
  color: #1e293b;
}

/* ── Body ── */
.cll-body {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Field ── */
.cll-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.cll-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.cll-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
}
.cll-required {
  color: #ef4444;
  margin-left: 2px;
}
.cll-input {
  padding: 0.5rem 0.75rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #1e293b;
  background: #fff;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.cll-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

/* ── Student list ── */
.cll-student-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  padding: 0.375rem;
}
.cll-student-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}
.cll-student-option:hover {
  background: #f1f5f9;
}
.cll-student-option--selected {
  background: #eff6ff;
}
.cll-student-avatar {
  font-size: 1rem;
  flex-shrink: 0;
}
.cll-student-name {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cll-student-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #3b82f6;
  background: #dbeafe;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.cll-student-check {
  flex-shrink: 0;
}
.cll-no-students {
  padding: 1rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #94a3b8;
}

/* ── Preview ── */
.cll-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #1e40af;
  line-height: 1.4;
}
.cll-preview strong {
  font-weight: 700;
}
.cll-preview-icon {
  flex-shrink: 0;
}

/* ── Error ── */
.cll-error {
  padding: 0.5rem 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #dc2626;
}

/* ── Footer ── */
.cll-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem 1.25rem;
  border-top: 1px solid #f1f5f9;
}
.cll-btn {
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border: none;
}
.cll-btn--cancel {
  background: #f1f5f9;
  color: #475569;
}
.cll-btn--cancel:hover {
  background: #e2e8f0;
}
.cll-btn--confirm {
  background: #3b82f6;
  color: #ffffff;
}
.cll-btn--confirm:hover:not(:disabled) {
  background: #2563eb;
}
.cll-btn--confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Spinner ── */
.cll-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: cll-spin 0.6s linear infinite;
}
@keyframes cll-spin {
  to { transform: rotate(360deg); }
}
</style>
