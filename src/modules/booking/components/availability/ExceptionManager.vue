<script setup lang="ts">
// F21: Exception Manager Component
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Plus, X, Calendar } from 'lucide-vue-next'
import { useCalendarStore } from '../../stores/calendarStore'
import type { ExceptionInput, DateException } from '../../api/booking'

const store = useCalendarStore()
const { exceptions, isLoading } = storeToRefs(store)

// Form state
const showForm = ref(false)
const formData = ref<ExceptionInput>({
  date: '',
  exception_type: 'unavailable',
  start_time: '',
  end_time: '',
  reason: '',
})

const isSubmitting = ref(false)

onMounted(async () => {
  // Load exceptions for current month
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
  await store.loadExceptions(formatDate(start), formatDate(end))
})

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function resetForm() {
  formData.value = {
    date: '',
    exception_type: 'unavailable',
    start_time: '',
    end_time: '',
    reason: '',
  }
  showForm.value = false
}

async function handleSubmit() {
  if (!formData.value.date) return

  isSubmitting.value = true

  try {
    await store.addException(formData.value)
    resetForm()
  } catch (e) {
    console.error('Failed to add exception:', e)
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete(exception: DateException) {
  if (confirm('Are you sure you want to delete this exception?')) {
    await store.deleteException(exception.id)
  }
}
</script>

<template>
  <div class="exception-manager">
    <div class="manager-header">
      <h3>Date Exceptions</h3>
      <button v-if="!showForm" class="add-btn" @click="showForm = true">
        <Plus :size="16" />
        Add Exception
      </button>
    </div>

    <!-- Add Form -->
    <div v-if="showForm" class="exception-form">
      <div class="form-group">
        <label>Date</label>
        <input
          v-model="formData.date"
          type="date"
          :min="formatDate(new Date())"
          required
        />
      </div>

      <div class="form-group">
        <label>Type</label>
        <select v-model="formData.exception_type">
          <option value="unavailable">Unavailable (full day)</option>
          <option value="custom_hours">Custom Hours</option>
        </select>
      </div>

      <template v-if="formData.exception_type === 'custom_hours'">
        <div class="form-row">
          <div class="form-group">
            <label>Start Time</label>
            <input v-model="formData.start_time" type="time" />
          </div>
          <div class="form-group">
            <label>End Time</label>
            <input v-model="formData.end_time" type="time" />
          </div>
        </div>
      </template>

      <div class="form-group">
        <label>Reason (optional)</label>
        <input
          v-model="formData.reason"
          type="text"
          placeholder="e.g., Holiday, Vacation"
        />
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="resetForm">Cancel</button>
        <button
          class="btn btn-primary"
          :disabled="!formData.date || isSubmitting"
          @click="handleSubmit"
        >
          {{ isSubmitting ? 'Adding...' : 'Add Exception' }}
        </button>
      </div>
    </div>

    <!-- Exceptions List -->
    <div v-if="isLoading" class="loading">
      <div class="spinner" />
    </div>

    <div v-else-if="exceptions.length === 0" class="empty-state">
      <Calendar :size="32" />
      <p>No exceptions set</p>
    </div>

    <div v-else class="exceptions-list">
      <div
        v-for="exception in exceptions"
        :key="exception.id"
        class="exception-item"
      >
        <div class="exception-info">
          <span class="exception-date">
            {{ formatDisplayDate(exception.date) }}
          </span>
          <span class="exception-type">
            {{ exception.exception_type === 'unavailable' ? 'Unavailable' : 'Custom Hours' }}
          </span>
          <span v-if="exception.reason" class="exception-reason">
            {{ exception.reason }}
          </span>
        </div>
        <button class="delete-btn" @click="handleDelete(exception)">
          <X :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exception-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.manager-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--color-primary, #3b82f6);
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.15s;
}

.add-btn:hover {
  background: var(--color-primary-dark, #2563eb);
}

/* Form */
.exception-form {
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}

.form-group input,
.form-group select {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-bg-primary, white);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  color: var(--color-text-primary, #111827);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

/* Loading & Empty */
.loading,
.empty-state {
  text-align: center;
  padding: 32px;
  color: var(--color-text-secondary, #6b7280);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state p {
  margin: 12px 0 0;
}

/* Exceptions List */
.exceptions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exception-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
}

.exception-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.exception-date {
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.exception-type {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.exception-reason {
  font-size: 12px;
  color: var(--color-text-tertiary, #9ca3af);
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.delete-btn:hover {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
}
</style>
