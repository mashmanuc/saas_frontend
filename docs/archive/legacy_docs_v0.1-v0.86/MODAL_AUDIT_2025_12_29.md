# Аудит модальних вікон календаря - 29.12.2025

## Огляд

Цей документ містить результати аудиту модальних вікон календаря згідно з MANIFEST_CALENDAR.md та рекомендації щодо покращень.

---

## 1. EventModal.vue - Модальне вікно деталей/редагування події

### Поточний стан

**Позитивні аспекти:**
- ✅ Використовує Composition API з `<script setup>`
- ✅ Має режими перегляду та редагування
- ✅ Інтегрований з Pinia store для отримання даних
- ✅ Використовує i18n для локалізації
- ✅ Має валідацію прав доступу (canEdit, canDelete)

**Проблеми:**
- ❌ **400 Bad Request** при завантаженні week snapshot після операцій
- ❌ Переклади використовують застарілий префікс `calendar.*` замість `booking.calendar.*`
- ❌ Відсутня обробка помилок мережі при завантаженні деталей
- ❌ Немає індикатора завантаження під час збереження змін
- ❌ Форма редагування не валідує дані перед відправкою
- ❌ Відсутня можливість скасувати зміни (тільки закрити модалку)
- ❌ Немає попередження про незбережені зміни при закритті

### Рекомендації згідно з маніфестом

**1. Закон фундаменту (Foundational Law)**
```typescript
// ПОТОЧНИЙ КОД (вузький)
interface EditForm {
  date: string
  hours: string
  minutes: string
  durationMin: number
  regularity: string
  tutorComment: string
}

// РЕКОМЕНДАЦІЯ (розширюваний)
interface EventEditPayload {
  date: string
  time: { hours: string; minutes: string }
  durationMin: number
  regularity: 'single' | 'once_a_week' | 'twice_a_week'
  tutorComment?: string
  // Майбутні розширення:
  // recurrenceEnd?: string
  // timezone?: string
  // notifyStudent?: boolean
  // customDuration?: number
}
```

**2. Закон незвуження (Anti-Narrowing Law)**
- Не прив'язуватись до конкретного UI компонента для вибору часу
- Винести логіку валідації в окремий composable `useEventValidation`
- Підтримувати різні формати дати/часу через адаптер

**3. Закон доменного мислення (Domain-First Law)**
```typescript
// Створити окремий домен для Event Operations
// composables/useEventOperations.ts
export function useEventOperations() {
  const { updateEvent, deleteEvent } = useCalendarStore()
  
  async function rescheduleEvent(eventId: number, newStart: string) {
    // Логіка перенесення з перевіркою конфліктів
  }
  
  async function cancelEvent(eventId: number, reason: string) {
    // Логіка скасування з причиною
  }
  
  return { rescheduleEvent, cancelEvent }
}
```

**4. Закон нарощування (Additive Architecture Law)**
- Додати можливість редагування серії уроків без зміни існуючого API
- Підтримка нових полів через `metadata` об'єкт
- Версіонування API endpoints

### Конкретні покращення

```typescript
// 1. Додати обробку помилок мережі
async function loadEventDetails() {
  isLoading.value = true
  error.value = null
  
  try {
    const details = await store.getEventDetails(props.eventId)
    eventDetails.value = details
    initializeEditForm(details)
  } catch (err: any) {
    if (err.code === 'NETWORK_ERROR') {
      error.value = t('booking.calendar.errorsConnection.networkError')
    } else if (err.response?.status === 404) {
      error.value = t('booking.calendar.errorsConnection.notFound')
    } else {
      error.value = t('booking.calendar.errorsConnection.loadFailed')
    }
  } finally {
    isLoading.value = false
  }
}

// 2. Додати валідацію форми
const formErrors = computed(() => {
  const errors: Record<string, string> = {}
  
  if (!editForm.value.date) {
    errors.date = t('booking.calendar.validation.dateRequired')
  }
  
  const selectedDateTime = new Date(`${editForm.value.date}T${editForm.value.hours}:${editForm.value.minutes}`)
  if (selectedDateTime < new Date()) {
    errors.time = t('booking.calendar.validation.pastTime')
  }
  
  if (editForm.value.durationMin < 15 || editForm.value.durationMin > 180) {
    errors.duration = t('booking.calendar.validation.invalidDuration')
  }
  
  return errors
})

const isFormValid = computed(() => Object.keys(formErrors.value).length === 0)

// 3. Додати попередження про незбережені зміни
const hasUnsavedChanges = computed(() => {
  if (!eventDetails.value) return false
  
  const original = eventDetails.value.event
  const current = editForm.value
  
  return (
    current.date !== dayjs(original.start).format('YYYY-MM-DD') ||
    current.hours !== dayjs(original.start).format('HH') ||
    current.minutes !== dayjs(original.start).format('mm') ||
    current.durationMin !== original.durationMin ||
    current.regularity !== original.regularity ||
    current.tutorComment !== (original.tutorComment || '')
  )
})

function handleClose() {
  if (hasUnsavedChanges.value && !confirm(t('common.unsavedChanges'))) {
    return
  }
  emit('close')
}
```

---

## 2. CreateLessonModal.vue - Модальне вікно створення уроку

### Поточний стан

**Позитивні аспекти:**
- ✅ Чітка структура форми
- ✅ Валідація обов'язкових полів
- ✅ Попередження про конфлікти часу

**Проблеми:**
- ❌ **400 Bad Request** після створення уроку
- ❌ Відсутня можливість створити серію уроків
- ❌ Немає попереднього перегляду створеного уроку
- ❌ Відсутня інтеграція з календарем для вибору часу (тільки datetime-local input)

### Рекомендації

**1. Інтеграція з календарем**
```vue
<template>
  <div class="time-selection">
    <!-- Поточний спосіб -->
    <input type="datetime-local" v-model="formData.start" />
    
    <!-- Рекомендований спосіб -->
    <CalendarTimePicker
      v-model="formData.start"
      :available-slots="availableSlots"
      :conflicts="conflicts"
      @conflict-detected="handleConflict"
    />
  </div>
</template>
```

**2. Створення серії уроків**
```typescript
interface RecurrenceOptions {
  frequency: 'single' | 'weekly' | 'biweekly' | 'custom'
  count?: number // кількість повторень
  until?: string // дата закінчення
  weekdays?: number[] // дні тижня для custom
}

async function createLessonSeries(
  baseLesson: CreateEventPayload,
  recurrence: RecurrenceOptions
) {
  // Генерація серії дат
  const dates = generateRecurrenceDates(baseLesson.start, recurrence)
  
  // Перевірка конфліктів для всіх дат
  const conflicts = await checkBulkConflicts(dates)
  
  if (conflicts.length > 0) {
    // Показати модалку з конфліктами
    return
  }
  
  // Створити всі уроки
  await store.createEventBulk(dates.map(date => ({
    ...baseLesson,
    start: date
  })))
}
```

---

## 3. EventDetailsView.vue - Компонент перегляду деталей

### Поточний стан

**Позитивні аспекти:**
- ✅ Чистий read-only інтерфейс
- ✅ Використання іконок Lucide
- ✅ Правильна структура з секціями

**Проблеми:**
- ❌ Відсутня можливість копіювати дані (email, телефон)
- ❌ Немає посилання на профіль студента
- ❌ Відсутня історія змін уроку

### Рекомендації

```vue
<template>
  <div class="event-details">
    <!-- Додати історію змін -->
    <div v-if="event.history?.length" class="detail-section">
      <h4>{{ $t('booking.calendar.eventDetails.history') }}</h4>
      <div class="history-timeline">
        <div v-for="change in event.history" :key="change.id" class="history-item">
          <span class="history-date">{{ formatDate(change.createdAt) }}</span>
          <span class="history-action">{{ change.action }}</span>
          <span class="history-user">{{ change.userName }}</span>
        </div>
      </div>
    </div>
    
    <!-- Додати можливість копіювання -->
    <div class="detail-row">
      <UserIcon class="w-5 h-5 text-gray-500" />
      <div>
        <p class="detail-label">{{ $t('booking.calendar.eventDetails.student') }}</p>
        <a :href="`/students/${event.studentId}`" class="detail-value link">
          {{ event.clientName }}
        </a>
        <p v-if="event.clientPhone" class="detail-subvalue">
          {{ event.clientPhone }}
          <button @click="copyToClipboard(event.clientPhone)" class="copy-btn">
            <CopyIcon class="w-4 h-4" />
          </button>
        </p>
      </div>
    </div>
  </div>
</template>
```

---

## 4. Загальні рекомендації для всіх модалок

### 4.1 Accessibility (A11y)

```vue
<template>
  <div
    v-if="visible"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="modalTitleId"
    @click.self="handleClose"
  >
    <div
      ref="modalRef"
      class="modal-container"
      tabindex="-1"
    >
      <div class="modal-header">
        <h2 :id="modalTitleId">{{ title }}</h2>
        <button
          @click="handleClose"
          class="close-btn"
          :aria-label="$t('common.close')"
        >
          <XIcon />
        </button>
      </div>
      <!-- content -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const modalRef = ref<HTMLElement>()
const modalTitleId = `modal-title-${Math.random().toString(36).substr(2, 9)}`

// Trap focus inside modal
onMounted(() => {
  modalRef.value?.focus()
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleClose()
  }
}
</script>
```

### 4.2 Оптимізація продуктивності

```typescript
// Використовувати debounce для API запитів
import { useDebounceFn } from '@vueuse/core'

const debouncedSearch = useDebounceFn(async (query: string) => {
  const results = await api.searchStudents(query)
  students.value = results
}, 300)

// Lazy loading для великих списків
import { useVirtualList } from '@vueuse/core'

const { list, containerProps, wrapperProps } = useVirtualList(
  students,
  { itemHeight: 48 }
)
```

### 4.3 Уніфікований error handling

```typescript
// composables/useModalError.ts
export function useModalError() {
  const error = ref<string | null>(null)
  const showError = ref(false)
  
  function handleError(err: any, fallbackMessage: string) {
    console.error('[Modal Error]', err)
    
    if (err.response?.data?.error?.message) {
      error.value = err.response.data.error.message
    } else if (err.message) {
      error.value = err.message
    } else {
      error.value = fallbackMessage
    }
    
    showError.value = true
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      showError.value = false
    }, 5000)
  }
  
  function clearError() {
    error.value = null
    showError.value = false
  }
  
  return { error, showError, handleError, clearError }
}
```

---

## 5. Виявлений зайвий код для видалення

### 5.1 Дублікати перекладів

**Файл:** `frontend/src/i18n/locales/uk.json`

```json
// ВИДАЛИТИ: дублікат в lessons.calendar
"lessons": {
  "calendar": {
    "eventModal": { ... },  // ❌ ВИДАЛИТИ
    "eventDetails": { ... }, // ❌ ВИДАЛИТИ
    "paidStatus": { ... },   // ❌ ВИДАЛИТИ
    "doneStatus": { ... },   // ❌ ВИДАЛИТИ
    "regularity": { ... }    // ❌ ВИДАЛИТИ
  }
}

// ЗАЛИШИТИ: правильне розташування в booking.calendar
"booking": {
  "calendar": {
    "eventModal": { ... },  // ✅ ЗАЛИШИТИ
    "eventDetails": { ... }, // ✅ ЗАЛИШИТИ
    // ...
  }
}
```

### 5.2 Застарілі компоненти

**Файл:** `frontend/src/modules/booking/components/calendar/CalendarWeekNav.vue`

```
❌ ВИДАЛИТИ: Створений користувачем, але не використовується
Замість нього використовується WeekNavigation.vue
```

### 5.3 Debug код

**Файл:** `backend/apps/booking/api/debug_snapshot.py`

```python
# ❌ ВИДАЛИТИ: Тимчасовий debug endpoint
# Створений для діагностики, більше не потрібен
```

**Файл:** `frontend/src/modules/booking/components/modals/EventModal.vue`

```typescript
// ❌ ВИДАЛИТИ: Надмірне логування
console.log('[EventModal] loadEventDetails START, eventId:', props.eventId)
console.log('[EventModal] Calling store.getEventDetails...')
console.log('[EventModal] Received details:', details)
console.log('[EventModal] Form initialized:', editForm.value)
console.log('[EventModal] loadEventDetails END, isLoading:', isLoading.value)

// ✅ ЗАЛИШИТИ: Тільки критичні помилки
console.error('[EventModal] Load error:', err)
```

### 5.4 Невикористані імпорти

```typescript
// EventModal.vue
import { triggerRef } from 'vue' // ❌ ВИДАЛИТИ: не використовується

// CalendarWeekView.vue
import { debounce } from 'lodash-es' // ❌ ВИДАЛИТИ: не використовується
```

---

## 6. Критичні проблеми для негайного виправлення

### 6.1 400 Bad Request при завантаженні week snapshot

**Причина:** Невірні параметри запиту або проблема з авторизацією

**Файл:** `frontend/src/modules/booking/api/calendarWeekApi.ts:64`

```typescript
// ПОТОЧНИЙ КОД
async getWeekSnapshot(params: {
  page?: number
  timezone?: string
  includePayments?: boolean
  includeStats?: boolean
  etag?: string
}): Promise<{ data: WeekSnapshot; etag: string; cached: boolean }>

// ПРОБЛЕМА: Backend очікує tutorId, але він не передається

// ВИПРАВЛЕННЯ
async getWeekSnapshot(params: {
  tutorId: number  // ✅ ДОДАТИ обов'язковий параметр
  page?: number
  timezone?: string
  includePayments?: boolean
  includeStats?: boolean
  etag?: string
}): Promise<{ data: WeekSnapshot; etag: string; cached: boolean }> {
  const response = await api.get<WeekSnapshotResponse>('/v1/calendar/week/', {
    params: {
      tutor_id: params.tutorId, // ✅ ДОДАТИ в запит
      page: params.page ?? 0,
      timezone: params.timezone ?? 'Europe/Kiev',
      includePayments: params.includePayments ?? true,
      includeStats: params.includeStats ?? true,
    },
    headers,
  })
  // ...
}
```

### 6.2 Переклади не відображаються

**Причина:** Використання застарілого префіксу `calendar.*` замість `booking.calendar.*`

**Файли для оновлення:**
- `CreateLessonModal.vue` - 12 місць
- `EventModal.vue` - 8 місць (вже виправлено)
- `EventDetailsView.vue` - 7 місць (вже виправлено)
- `CalendarBoardV2.vue` - 4 місця
- `CalendarHeaderV2.vue` - 3 місця
- `CalendarFooter.vue` - 3 місця
- `CalendarGuideModal.vue` - 15+ місць
- `useErrorHandler.ts` - 10 місць

**Скрипт для автоматичного оновлення:**

```bash
# Замінити всі входження calendar. на booking.calendar. в Vue файлах
find frontend/src/modules/booking -name "*.vue" -type f -exec sed -i "s/t('calendar\./t('booking.calendar./g" {} \;
find frontend/src/modules/booking -name "*.ts" -type f -exec sed -i "s/t('calendar\./t('booking.calendar./g" {} \;

# Замінити calendar.errors на booking.calendar.errorsConnection
find frontend/src/modules/booking -name "*.vue" -type f -exec sed -i "s/'calendar\.errors\./'booking.calendar.errorsConnection./g" {} \;
find frontend/src/modules/booking -name "*.ts" -type f -exec sed -i "s/'calendar\.errors\./'booking.calendar.errorsConnection./g" {} \;
```

---

## 7. Roadmap покращень

### Фаза 1: Критичні виправлення (1-2 дні)
- [ ] Виправити 400 Bad Request
- [ ] Оновити всі переклади на booking.calendar.*
- [ ] Видалити зайвий debug код
- [ ] Додати обробку помилок мережі

### Фаза 2: UX покращення (3-5 днів)
- [ ] Додати валідацію форм
- [ ] Реалізувати попередження про незбережені зміни
- [ ] Додати історію змін уроків
- [ ] Покращити accessibility

### Фаза 3: Нові можливості (1-2 тижні)
- [ ] Створення серії уроків
- [ ] Інтеграція календаря для вибору часу
- [ ] Bulk операції (масове редагування/видалення)
- [ ] Експорт уроків в календар (iCal)

### Фаза 4: Оптимізація (1 тиждень)
- [ ] Lazy loading для списків
- [ ] Кешування запитів
- [ ] Оптимізація bundle size
- [ ] Performance monitoring

---

## Висновок

Модальні вікна календаря мають солідну базу, але потребують:
1. **Негайного виправлення** критичних помилок (400 Bad Request, переклади)
2. **Покращення UX** (валідація, error handling, accessibility)
3. **Розширення функціоналу** згідно з маніфестом (серії уроків, bulk операції)
4. **Очищення коду** (видалення дублікатів, debug коду, невикористаних імпортів)

Всі рекомендації відповідають принципам MANIFEST_CALENDAR.md:
- ✅ Фундаментальність (розширюваність без зламу)
- ✅ Доменне мислення (чіткі межі відповідальності)
- ✅ Нарощування (додавання без переробки)
- ✅ Snapshot-мислення (стан над діями)
