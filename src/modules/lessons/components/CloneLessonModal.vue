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
                  <circle cx="8" cy="8" r="7" fill="currentColor"/>
                  <path d="M4.5 8l2.5 2.5 4-4" stroke="var(--accent-contrast, #fff)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
              <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 5v3.5l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: 0 20px 60px var(--shadow);
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
  color: var(--text-primary);
  margin: 0;
}
.cll-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
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
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 1.125rem;
  line-height: 1;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.cll-close:hover {
  background: var(--border-color);
  color: var(--text-primary);
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
  color: var(--text-primary);
}
.cll-required {
  color: var(--danger-bg);
  margin-left: 2px;
}
.cll-input {
  padding: 0.5rem 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--card-bg);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.cll-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
}

/* ── Student list ── */
.cll-student-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
  border: 1.5px solid var(--border-color);
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
  background: var(--bg-secondary);
}
.cll-student-option--selected {
  background: color-mix(in srgb, var(--accent) 8%, var(--card-bg));
}
.cll-student-avatar {
  font-size: 1rem;
  flex-shrink: 0;
}
.cll-student-name {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cll-student-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 15%, var(--card-bg));
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.cll-student-check {
  flex-shrink: 0;
  color: var(--accent);
}
.cll-no-students {
  padding: 1rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* ── Preview ── */
.cll-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: color-mix(in srgb, var(--info-bg) 10%, var(--card-bg));
  border: 1px solid color-mix(in srgb, var(--info-bg) 25%, transparent);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--info-bg);
  line-height: 1.4;
}
.cll-preview strong {
  font-weight: 700;
}
.cll-preview-icon {
  flex-shrink: 0;
  color: var(--accent);
}

/* ── Error ── */
.cll-error {
  padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, var(--danger-bg) 8%, var(--card-bg));
  border: 1px solid color-mix(in srgb, var(--danger-bg) 25%, transparent);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--danger-bg);
}

/* ── Footer ── */
.cll-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem 1.25rem;
  border-top: 1px solid var(--border-color);
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
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.cll-btn--cancel:hover {
  background: var(--border-color);
}
.cll-btn--confirm {
  background: var(--accent);
  color: var(--accent-contrast);
}
.cll-btn--confirm:hover:not(:disabled) {
  background: var(--accent-hover);
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
