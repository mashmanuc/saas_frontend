# Frontend Tasks: Availability Editor v2.0

## Контекст для Frontend-команди

«Ти — FE-інженер M4SH, впроваджуєш Availability Editor v2.0 за AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md. Працюєш безперервно, але усвідомлено: твій UI — проєкція домену, а не набір випадкових кнопок.

Починай кожне завдання з читання відповідної секції FE-плану (slot editing, composables, empty state, conflict resolution, глобальні токени).
Дотримуйся мовної політики (UA/EN), accessibility, responsive дизайну, WebSocket-підписок.
Кожен компонент має відображати статуси редагування, конфлікти, помилки — як описано в i18n ключах та UX-сценаріях.
Після змін запускай unit + E2E тести, перевіряй продуктивність (відсутність блокувань, CLS=0).
Пиши код чисто: строгий TypeScript, композиційні хуки, зрозумілі коментарі лише там, де додаєш складну логіку.
Пам'ятай, що це фундамент платформи: будь-який UI елемент має масштабуватися без "переписати потім".
Працюй з любов'ю до craft'у: максимум уваги до деталей, жодних компромісів у якості.»

---

## Фаза 0: Міграція Sunday day 0 → 7

### Task 0.1: Оновлення days array та логіки

**Пріоритет:** P0 (Критичний)  
**Estimated:** 4 години  
**Owner:** Frontend Lead

#### Проблема
Frontend використовує `day 0` для неділі, але backend очікує `day 7` (ISO 8601).

#### Файли для зміни

```typescript
// Файл: frontend/src/modules/booking/components/availability/AvailabilityEditor.vue

// БУЛО:
const days = [
  { value: 1, label: 'common.weekdays.short.mon' },
  { value: 2, label: 'common.weekdays.short.tue' },
  { value: 3, label: 'common.weekdays.short.wed' },
  { value: 4, label: 'common.weekdays.short.thu' },
  { value: 5, label: 'common.weekdays.short.fri' },
  { value: 6, label: 'common.weekdays.short.sat' },
  { value: 0, label: 'common.weekdays.short.sun' }, // НЕПРАВИЛЬНО
]

// СТАЛО:
const days = [
  { value: 1, label: 'common.weekdays.short.mon' },
  { value: 2, label: 'common.weekdays.short.tue' },
  { value: 3, label: 'common.weekdays.short.wed' },
  { value: 4, label: 'common.weekdays.short.thu' },
  { value: 5, label: 'common.weekdays.short.fri' },
  { value: 6, label: 'common.weekdays.short.sat' },
  { value: 7, label: 'common.weekdays.short.sun' }, // ПРАВИЛЬНО: ISO 8601
]
```

#### Оновлення getBlockedSlotsForDay

```typescript
// Файл: frontend/src/modules/booking/components/availability/AvailabilityEditor.vue

// БУЛО:
const getBlockedSlotsForDay = (dayValue: number) => {
  const dayOfWeek = dayValue === 0 ? 7 : dayValue // Конвертація
  // ...
}

// СТАЛО (більше не потрібна конвертація):
const getBlockedSlotsForDay = (dayValue: number) => {
  // dayValue вже 1-7 (ISO 8601)
  const blockedSlots: any[] = []
  
  Object.entries(existingSlots.value).forEach(([dateKey, slots]) => {
    const date = new Date(dateKey)
    const dateDayOfWeek = (date.getDay() || 7) // Convert JS 0=Sunday to 7
    
    if (dateDayOfWeek === dayValue) {
      blockedSlots.push(...slots)
    }
  })
  
  return blockedSlots
}
```

#### Оновлення всіх date utilities

```typescript
// Файл: frontend/src/utils/dateUtils.ts

/**
 * Get day of week in ISO 8601 format (1=Monday, 7=Sunday)
 */
export function getISODayOfWeek(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/**
 * Convert JS day (0=Sunday) to ISO day (7=Sunday)
 */
export function jsToISODay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay
}

/**
 * Convert ISO day (7=Sunday) to JS day (0=Sunday)
 */
export function isoToJSDay(isoDay: number): number {
  return isoDay === 7 ? 0 : isoDay
}
```

#### Критерії прийняття
- [ ] days array оновлено (value: 7 для неділі)
- [ ] getBlockedSlotsForDay використовує ISO формат
- [ ] Date utilities створено та використовуються
- [ ] Всі компоненти оновлено
- [ ] Unit тести пройшли
- [ ] E2E тести для неділі пройшли
- [ ] Backward compatibility перевірено

---

## Фаза 1: Slot Editing UI

### Task 1.1: SlotEditor Component

**Пріоритет:** P1 (Високий)  
**Estimated:** 8 годин  
**Owner:** Frontend Engineer

#### Component Structure

```vue
<!-- Файл: frontend/src/modules/booking/components/availability/SlotEditor.vue -->

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TimeRangeInput from './TimeRangeInput.vue'
import ConflictWarning from './ConflictWarning.vue'
import { useSlotEditor } from '@/modules/booking/composables/useSlotEditor'
import type { Slot, SlotEditStrategy, Conflict } from '@/modules/booking/types'

const props = defineProps<{
  slot: Slot
  conflicts?: Conflict[]
}>()

const emit = defineEmits<{
  save: [slot: Slot]
  cancel: []
  strategyChange: [strategy: SlotEditStrategy]
}>()

const { t } = useI18n()
const { editSlot, detectConflicts, isLoading } = useSlotEditor()

// Local state
const localStart = ref(props.slot.start)
const localEnd = ref(props.slot.end)
const selectedStrategy = ref<SlotEditStrategy>('user_choice')
const localConflicts = ref<Conflict[]>(props.conflicts || [])

// Show strategy dialog if slot is from template
const showStrategyDialog = computed(() => {
  return props.slot.source === 'template' && selectedStrategy.value === 'user_choice'
})

// Watch for time changes and detect conflicts
watch([localStart, localEnd], async () => {
  if (localStart.value && localEnd.value) {
    localConflicts.value = await detectConflicts(
      props.slot.id,
      localStart.value,
      localEnd.value
    )
  }
})

// Handle save
async function handleSave() {
  if (showStrategyDialog.value) {
    // Show strategy selection dialog
    return
  }
  
  try {
    const updatedSlot = await editSlot(
      props.slot.id,
      localStart.value,
      localEnd.value,
      selectedStrategy.value
    )
    emit('save', updatedSlot)
  } catch (error) {
    console.error('Failed to save slot:', error)
  }
}

// Handle cancel
function handleCancel() {
  localStart.value = props.slot.start
  localEnd.value = props.slot.end
  emit('cancel')
}

// Handle strategy selection
function selectStrategy(strategy: SlotEditStrategy) {
  selectedStrategy.value = strategy
  emit('strategyChange', strategy)
}
</script>

<template>
  <div class="slot-editor">
    <!-- Header -->
    <div class="slot-editor-header">
      <h3 class="slot-editor-title">
        {{ t('availability.slotEditor.title') }}
      </h3>
      <span class="slot-date">{{ slot.date }}</span>
    </div>
    
    <!-- Time Range Input -->
    <TimeRangeInput
      v-model:start="localStart"
      v-model:end="localEnd"
      :disabled="isLoading"
    />
    
    <!-- Strategy Dialog (if slot from template) -->
    <div v-if="showStrategyDialog" class="strategy-dialog">
      <p class="strategy-message">
        {{ t('availability.slotEditor.strategyMessage') }}
      </p>
      
      <div class="strategy-options">
        <button
          class="strategy-option"
          @click="selectStrategy('override')"
        >
          <div class="strategy-icon">🔒</div>
          <div class="strategy-content">
            <h4>{{ t('availability.slotEditor.overrideTitle') }}</h4>
            <p>{{ t('availability.slotEditor.overrideDescription') }}</p>
          </div>
        </button>
        
        <button
          class="strategy-option"
          @click="selectStrategy('template_update')"
        >
          <div class="strategy-icon">🔄</div>
          <div class="strategy-content">
            <h4>{{ t('availability.slotEditor.templateUpdateTitle') }}</h4>
            <p>{{ t('availability.slotEditor.templateUpdateDescription') }}</p>
          </div>
        </button>
      </div>
    </div>
    
    <!-- Conflict Warning -->
    <ConflictWarning
      v-if="localConflicts.length > 0"
      :conflicts="localConflicts"
      @resolve="handleSave"
    />
    
    <!-- Slot Source Info -->
    <div v-if="slot.source !== 'manual'" class="slot-source-info">
      <span class="source-badge" :class="`source-${slot.source}`">
        {{ t(`availability.slotEditor.source.${slot.source}`) }}
      </span>
      <span v-if="slot.overrideReason" class="override-reason">
        {{ slot.overrideReason }}
      </span>
    </div>
    
    <!-- Actions -->
    <div class="slot-editor-actions">
      <button
        class="btn btn-secondary"
        :disabled="isLoading"
        @click="handleCancel"
      >
        {{ t('common.cancel') }}
      </button>
      
      <button
        class="btn btn-primary"
        :disabled="isLoading || localConflicts.some(c => c.severity === 'error')"
        @click="handleSave"
      >
        <span v-if="isLoading" class="spinner"></span>
        {{ t('common.save') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.slot-editor {
  background: var(--color-bg-primary);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.slot-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.slot-editor-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.slot-date {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.strategy-dialog {
  margin: 20px 0;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
}

.strategy-message {
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.strategy-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.strategy-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.strategy-option:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
}

.strategy-icon {
  font-size: 24px;
}

.strategy-content h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--color-text-primary);
}

.strategy-content p {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.slot-source-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: 6px;
}

.source-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.source-template {
  background: var(--color-info-light);
  color: var(--color-info);
}

.source-override {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.source-manual {
  background: var(--color-success-light);
  color: var(--color-success);
}

.override-reason {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.slot-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
```

#### Критерії прийняття
- [ ] Component створено з усіма states
- [ ] Strategy dialog працює
- [ ] Conflict detection інтегровано
- [ ] Loading states відображаються
- [ ] Accessibility (keyboard navigation, ARIA)
- [ ] Responsive design
- [ ] Unit тести покривають всі сценарії
- [ ] i18n keys додано

---

### Task 1.2: useSlotEditor Composable

**Пріоритет:** P1 (Високий)  
**Estimated:** 6 годин  
**Owner:** Frontend Engineer

```typescript
// Файл: frontend/src/modules/booking/composables/useSlotEditor.ts

import { ref } from 'vue'
import { bookingApi } from '@/modules/booking/api/booking'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import type { Slot, SlotEditStrategy, Conflict } from '@/modules/booking/types'

export function useSlotEditor() {
  const { t } = useI18n()
  const toast = useToast()
  
  const isLoading = ref(false)
  const currentSlot = ref<Slot | null>(null)
  
  /**
   * Edit a slot with conflict detection
   */
  async function editSlot(
    slotId: string,
    newStart: string,
    newEnd: string,
    strategy: SlotEditStrategy = 'user_choice'
  ): Promise<Slot> {
    isLoading.value = true
    
    try {
      const response = await bookingApi.editSlot(slotId, {
        start_time: newStart,
        end_time: newEnd,
        strategy
      })
      
      toast.success(t('availability.slotEditor.saveSuccess'))
      return response
      
    } catch (error: any) {
      if (error.status === 409) {
        // Conflict error
        toast.error(t('availability.slotEditor.conflictError'))
        throw new ConflictError(error.data.conflicts)
      } else {
        toast.error(t('availability.slotEditor.saveError'))
        throw error
      }
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Detect conflicts before saving
   */
  async function detectConflicts(
    slotId: string,
    newStart: string,
    newEnd: string
  ): Promise<Conflict[]> {
    try {
      const response = await bookingApi.checkSlotConflicts(slotId, {
        start_time: newStart,
        end_time: newEnd
      })
      
      return response.conflicts || []
      
    } catch (error) {
      console.error('Failed to detect conflicts:', error)
      return []
    }
  }
  
  /**
   * Delete a slot
   */
  async function deleteSlot(slotId: string): Promise<void> {
    isLoading.value = true
    
    try {
      await bookingApi.deleteSlot(slotId)
      toast.success(t('availability.slotEditor.deleteSuccess'))
      
    } catch (error) {
      toast.error(t('availability.slotEditor.deleteError'))
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Batch edit multiple slots
   */
  async function batchEditSlots(
    updates: Array<{
      id: string
      start_time: string
      end_time: string
      strategy?: SlotEditStrategy
    }>
  ): Promise<{ successCount: number; errorCount: number; results: any[] }> {
    isLoading.value = true
    
    try {
      const response = await bookingApi.batchEditSlots({ updates })
      
      if (response.errorCount > 0) {
        toast.warning(
          t('availability.slotEditor.batchPartialSuccess', {
            success: response.successCount,
            error: response.errorCount
          })
        )
      } else {
        toast.success(t('availability.slotEditor.batchSuccess'))
      }
      
      return response
      
    } catch (error) {
      toast.error(t('availability.slotEditor.batchError'))
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  return {
    isLoading,
    currentSlot,
    editSlot,
    detectConflicts,
    deleteSlot,
    batchEditSlots
  }
}

class ConflictError extends Error {
  conflicts: Conflict[]
  
  constructor(conflicts: Conflict[]) {
    super('Slot edit conflicts detected')
    this.conflicts = conflicts
  }
}
```

#### API Integration

```typescript
// Файл: frontend/src/modules/booking/api/booking.ts

export const bookingApi = {
  // ... existing methods
  
  /**
   * Edit a slot
   */
  async editSlot(
    slotId: string,
    data: {
      start_time: string
      end_time: string
      strategy: SlotEditStrategy
    }
  ): Promise<Slot> {
    return await apiClient.put(`/booking/slots/${slotId}/`, data)
  },
  
  /**
   * Check for conflicts before editing
   */
  async checkSlotConflicts(
    slotId: string,
    data: {
      start_time: string
      end_time: string
    }
  ): Promise<{ has_conflicts: boolean; conflicts: Conflict[] }> {
    return await apiClient.post(`/booking/slots/${slotId}/conflicts/`, data)
  },
  
  /**
   * Delete a slot
   */
  async deleteSlot(slotId: string): Promise<void> {
    return await apiClient.delete(`/booking/slots/${slotId}/`)
  },
  
  /**
   * Batch edit slots
   */
  async batchEditSlots(data: {
    updates: Array<{
      id: string
      start_time: string
      end_time: string
      strategy?: SlotEditStrategy
    }>
  }): Promise<{
    success_count: number
    error_count: number
    results: any[]
  }> {
    return await apiClient.post('/booking/slots/batch/', data)
  }
}
```

#### Types

```typescript
// Файл: frontend/src/modules/booking/types.ts

export interface Slot {
  id: string
  date: string
  start: string
  end: string
  status: 'available' | 'booked' | 'blocked'
  source: 'template' | 'manual' | 'override'
  templateId?: string
  overrideReason?: string
  createdAt: string
  updatedAt: string
}

export type SlotEditStrategy = 'override' | 'template_update' | 'user_choice'

export interface Conflict {
  type: 'slot_overlap' | 'booked_overlap' | 'template_overlap'
  severity: 'error' | 'warning'
  message: string
  slotId?: string
  lessonId?: string
  studentName?: string
}
```

#### Критерії прийняття
- [ ] Composable створено з усіма методами
- [ ] API integration працює
- [ ] Error handling реалізовано
- [ ] Toast notifications показуються
- [ ] Types визначено
- [ ] Unit тести покривають всі методи
- [ ] JSDoc документація додано

---

### Task 1.3: i18n Keys

**Пріоритет:** P1 (Високий)  
**Estimated:** 2 години  
**Owner:** Frontend Engineer

```json
// Файл: frontend/src/i18n/locales/uk.json

{
  "availability": {
    "slotEditor": {
      "title": "Редагування слота",
      "strategyMessage": "Цей слот згенеровано з шаблону. Оберіть дію:",
      "overrideTitle": "Змінити тільки цей слот",
      "overrideDescription": "Слот буде відокремлено від шаблону",
      "templateUpdateTitle": "Оновити шаблон",
      "templateUpdateDescription": "Всі слоти з цього шаблону будуть регенеровані",
      "saveSuccess": "Слот успішно збережено",
      "saveError": "Не вдалося зберегти слот",
      "conflictError": "Виявлено конфлікти з іншими слотами",
      "deleteSuccess": "Слот успішно видалено",
      "deleteError": "Не вдалося видалити слот",
      "batchSuccess": "Всі слоти успішно оновлено",
      "batchPartialSuccess": "Оновлено {success} слотів, помилок: {error}",
      "batchError": "Не вдалося оновити слоти",
      "source": {
        "template": "З шаблону",
        "manual": "Створено вручну",
        "override": "Перевизначено"
      }
    }
  }
}
```

```json
// Файл: frontend/src/i18n/locales/en.json

{
  "availability": {
    "slotEditor": {
      "title": "Edit Slot",
      "strategyMessage": "This slot was generated from a template. Choose an action:",
      "overrideTitle": "Edit this slot only",
      "overrideDescription": "Slot will be detached from template",
      "templateUpdateTitle": "Update template",
      "templateUpdateDescription": "All slots from this template will be regenerated",
      "saveSuccess": "Slot saved successfully",
      "saveError": "Failed to save slot",
      "conflictError": "Conflicts detected with other slots",
      "deleteSuccess": "Slot deleted successfully",
      "deleteError": "Failed to delete slot",
      "batchSuccess": "All slots updated successfully",
      "batchPartialSuccess": "Updated {success} slots, {error} errors",
      "batchError": "Failed to update slots",
      "source": {
        "template": "From template",
        "manual": "Created manually",
        "override": "Overridden"
      }
    }
  }
}
```

#### Критерії прийняття
- [ ] Всі i18n keys додано для UK та EN
- [ ] Keys використовуються в компонентах
- [ ] Pluralization правильно налаштовано
- [ ] Перевірка на дублікати виконана

---

## Фаза 2: Integration & Testing

### Task 2.1: E2E Tests

**Пріоритет:** P1 (Високий)  
**Estimated:** 6 годин  
**Owner:** QA Engineer

```typescript
// Файл: frontend/tests/e2e/availability-slot-editing.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Availability Slot Editing', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tutor
    await page.goto('/login')
    await page.fill('[name="email"]', 'tutor@test.com')
    await page.fill('[name="password"]', 'test123')
    await page.click('button[type="submit"]')
    
    // Navigate to availability editor
    await page.goto('/booking/availability')
    await page.waitForLoadState('networkidle')
  })
  
  test('should edit slot with override strategy', async ({ page }) => {
    // Find a slot to edit
    const slot = page.locator('.availability-slot').first()
    await slot.click()
    
    // Wait for slot editor to appear
    await expect(page.locator('.slot-editor')).toBeVisible()
    
    // Change time
    await page.selectOption('select[name="start"]', '11:00')
    await page.selectOption('select[name="end"]', '13:00')
    
    // Select override strategy
    await page.click('button:has-text("Змінити тільки цей слот")')
    
    // Save
    await page.click('button:has-text("Зберегти")')
    
    // Wait for success toast
    await expect(page.locator('.toast-success')).toBeVisible()
    await expect(page.locator('.toast-success')).toContainText('успішно збережено')
  })
  
  test('should detect conflicts when editing slot', async ({ page }) => {
    // Create overlapping slots scenario
    // ... setup code
    
    // Try to edit slot to overlap
    const slot = page.locator('.availability-slot').first()
    await slot.click()
    
    await page.selectOption('select[name="start"]', '10:30')
    await page.selectOption('select[name="end"]', '12:30')
    
    // Should show conflict warning
    await expect(page.locator('.conflict-warning')).toBeVisible()
    await expect(page.locator('.conflict-warning')).toContainText('Перекриття')
    
    // Save button should be disabled
    await expect(page.locator('button:has-text("Зберегти")')).toBeDisabled()
  })
  
  test('should update template and regenerate slots', async ({ page }) => {
    // Find template-generated slot
    const slot = page.locator('.availability-slot[data-source="template"]').first()
    await slot.click()
    
    // Change time
    await page.selectOption('select[name="start"]', '11:00')
    await page.selectOption('select[name="end"]', '13:00')
    
    // Select template update strategy
    await page.click('button:has-text("Оновити шаблон")')
    
    // Confirm regeneration
    await page.click('button:has-text("Підтвердити")')
    
    // Wait for regeneration to complete
    await expect(page.locator('.regeneration-progress')).toBeVisible()
    await expect(page.locator('.regeneration-progress')).not.toBeVisible({ timeout: 10000 })
    
    // Verify all slots updated
    const slots = page.locator('.availability-slot[data-source="template"]')
    const count = await slots.count()
    
    for (let i = 0; i < count; i++) {
      const slotTime = await slots.nth(i).locator('.slot-time').textContent()
      expect(slotTime).toContain('11:00')
    }
  })
  
  test('should batch edit multiple slots', async ({ page }) => {
    // Select multiple slots
    await page.click('.select-all-slots')
    
    // Open batch edit dialog
    await page.click('button:has-text("Редагувати вибрані")')
    
    // Set new time for all
    await page.selectOption('select[name="start"]', '14:00')
    await page.selectOption('select[name="end"]', '16:00')
    
    // Save batch
    await page.click('button:has-text("Застосувати до всіх")')
    
    // Wait for success
    await expect(page.locator('.toast-success')).toBeVisible()
    await expect(page.locator('.toast-success')).toContainText('успішно оновлено')
  })
})
```

#### Критерії прийняття
- [ ] E2E тести покривають всі сценарії
- [ ] Тести проходять на CI/CD
- [ ] Screenshot тести для візуальної регресії
- [ ] Performance metrics збираються

---

## Deployment Checklist

- [ ] Міграція Sunday day 0→7 завершена
- [ ] SlotEditor component протестовано
- [ ] useSlotEditor composable працює
- [ ] API integration перевірено
- [ ] i18n keys додано для UA/EN
- [ ] E2E тести пройшли
- [ ] Accessibility audit пройдено
- [ ] Performance metrics в нормі
- [ ] Responsive design перевірено
- [ ] Browser compatibility тестовано
- [ ] Feature flag налаштовано

---

## Посилання

- [Архітектурний план](../../backend/docs/plan/AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md)
- [Backend Tasks](../../backend/docs/plan/BE_TASKS_AVAILABILITY_EDITOR_v2.md)
- [API Contract v0.49.5](../../backend/docs/plan/API_CONTRACT_v0495.md)
