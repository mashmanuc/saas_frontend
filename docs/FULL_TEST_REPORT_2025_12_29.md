# Повний звіт про тестування календаря - 29.12.2025

## Виявлені та виправлені критичні помилки

### ❌ Проблема 1: Помилка 400 Bad Request при завантаженні week snapshot

**Симптоми:**
```
GET http://localhost:5173/api/v1/calendar/week/?page=0&timezone=Europe%2FKiev 400 (Bad Request)
```

**Причина:**
Backend endpoint `/v1/calendar/week/` очікує обов'язковий параметр `weekStart`, але фронтенд його не передавав.

**Виправлення:**

**Файл:** `d:/m4sh_v1/frontend/src/modules/booking/api/calendarWeekApi.ts`
```typescript
// ДО
async getWeekSnapshot(params: {
  page?: number
  timezone?: string
  // ... інші параметри
}): Promise<...>

// ПІСЛЯ
async getWeekSnapshot(params: {
  weekStart: string  // ✅ Додано обов'язковий параметр
  page?: number
  timezone?: string
  // ... інші параметри
}): Promise<...> {
  const response = await api.get<WeekSnapshotResponse>('/v1/calendar/week/', {
    params: {
      weekStart: params.weekStart,  // ✅ Передаємо в запит
      page: params.page ?? 0,
      // ...
    }
  })
}
```

**Файл:** `d:/m4sh_v1/frontend/src/modules/booking/stores/calendarWeekStore.ts`
```typescript
async function fetchWeek(page: number = 0, timezone: string = 'Europe/Kiev') {
  // ✅ Додано обчислення weekStart
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + (page * 7))
  const weekStartStr = weekStart.toISOString().split('T')[0]
  
  const result = await calendarWeekApi.getWeekSnapshot({
    weekStart: weekStartStr,  // ✅ Передаємо weekStart
    page,
    timezone,
    // ...
  })
}
```

**Результат:** ✅ Календар завантажується без помилок 400.

---

### ❌ Проблема 2: TypeError "dayEvents is not iterable"

**Симптоми:**
```
calendarWeekStore.ts:362 TypeError: dayEvents is not iterable
    at normalizeLegacySnapshot (calendarWeekStore.ts:362:27)
    at fetchWeek (calendarWeekStore.ts:341:7)
    at async Proxy.deleteEvent (calendarWeekStore.ts:592:5)
```

**Причина:**
У функції `normalizeLegacySnapshot` код припускав, що `dayEvents` завжди є масивом, але іноді це може бути об'єкт або інший тип даних.

**Виправлення:**

**Файл:** `d:/m4sh_v1/frontend/src/modules/booking/stores/calendarWeekStore.ts`
```typescript
// ДО
for (const [dayKey, dayEvents] of Object.entries(legacySnapshot.events || {})) {
  newEventIdsByDay[dayKey] = []
  
  for (const event of dayEvents as LegacyEvent[]) {  // ❌ Помилка якщо не масив
    // ...
  }
}

// ПІСЛЯ
for (const [dayKey, dayEvents] of Object.entries(legacySnapshot.events || {})) {
  newEventIdsByDay[dayKey] = []
  
  // ✅ Перевірка що dayEvents є масивом
  const eventsArray = Array.isArray(dayEvents) ? dayEvents : []
  
  for (const event of eventsArray as LegacyEvent[]) {
    // ...
  }
}
```

**Результат:** ✅ Помилка ітерації виправлена.

---

### ❌ Проблема 3: 404 Not Found при запиті /api/api/v1/tutor/relations/

**Симптоми:**
```
GET http://localhost:5173/api/api/v1/tutor/relations/?status=all 404 (Not Found)
```

**Причина:**
Подвійний `/api/` в URL через неправильне використання `buildV1Url` з параметром `useAlt: true`. Коли `useAlt: true`, функція додає `/api/v1`, але apiClient вже додає `/api`, тому виходить `/api/api/v1`.

**Виправлення:**

**Файл:** `d:/m4sh_v1/frontend/src/types/relations.js`
```javascript
// ДО
export const RELATION_ENDPOINTS = Object.freeze({
  STUDENT_RELATIONS: buildV1Url('/student/relations/', true),  // ❌ useAlt: true
  TUTOR_RELATIONS: buildV1Url('/tutor/relations/', true),      // ❌ useAlt: true
  // ...
})

// ПІСЛЯ
export const RELATION_ENDPOINTS = Object.freeze({
  STUDENT_RELATIONS: buildV1Url('/student/relations/', false),  // ✅ useAlt: false
  TUTOR_RELATIONS: buildV1Url('/tutor/relations/', false),      // ✅ useAlt: false
  TUTOR_RELATIONS_BULK_ACCEPT: buildV1Url('/tutor/relations/batch/accept/', false),
  TUTOR_RELATIONS_BULK_ARCHIVE: buildV1Url('/tutor/relations/batch/archive/', false),
  ACCEPT: (id) => buildV1Url(`/student/relations/${id}/accept/`, false),
  DECLINE: (id) => buildV1Url(`/student/relations/${id}/decline/`, false),
  RESEND: (id) => buildV1Url(`/tutor/relations/${id}/resend/`, false),
})
```

**Результат:** ✅ URL формується правильно: `/api/v1/tutor/relations/`

---

### ❌ Проблема 4: Нескінченна рекурсія в EventModal

**Симптоми:**
```
[log] [EventModal] Visibility changed: true eventId: 4
[log] [EventModal] Visibility changed: true eventId: 4
[log] [EventModal] Visibility changed: true eventId: 4
... (тисячі разів)
[error] Maximum call stack size exceeded
```

**Причина:**
`watch` з опцією `immediate: true` викликався кожного разу при зміні `visible`, створюючи нескінченний цикл оновлень.

**Виправлення:**

**Файл:** `d:/m4sh_v1/frontend/src/modules/booking/components/modals/EventModal.vue`
```typescript
// ДО
watch(
  () => props.visible,
  async (visible) => {
    console.log('[EventModal] Visibility changed:', visible, 'eventId:', props.eventId)
    if (visible) {
      await loadEventDetails()
    } else {
      eventDetails.value = null
      error.value = null
    }
  },
  { immediate: true }  // ❌ Викликає нескінченну рекурсію
)

// ПІСЛЯ
watch(
  () => props.visible,
  async (visible, oldVisible) => {
    // ✅ Перевірка на реальну зміну значення
    if (visible === oldVisible) return
    
    if (visible) {
      await loadEventDetails()
    } else {
      eventDetails.value = null
      error.value = null
      isEditing.value = false
      isSaving.value = false
      isDeleting.value = false
    }
  }
  // ✅ Прибрано immediate: true
)
```

**Також видалено надмірне логування:**
```typescript
// ДО
async function loadEventDetails() {
  console.log('[EventModal] loadEventDetails START, eventId:', props.eventId)
  isLoading.value = true
  error.value = null
  
  try {
    console.log('[EventModal] Calling store.getEventDetails...')
    const details = await store.getEventDetails(props.eventId)
    console.log('[EventModal] Received details:', details)
    eventDetails.value = details
    console.info('[EventModal] Event details loaded:', props.eventId, eventDetails.value)
    // ... ініціалізація форми
    console.log('[EventModal] Form initialized:', editForm.value)
  } catch (err: any) {
    console.error('[EventModal] Load error:', err)
    handleError(err, t('calendar.errors.loadFailed'))
  } finally {
    isLoading.value = false
    console.log('[EventModal] loadEventDetails END, isLoading:', isLoading.value)
  }
}

// ПІСЛЯ
async function loadEventDetails() {
  isLoading.value = true
  error.value = null
  
  try {
    const details = await store.getEventDetails(props.eventId)
    eventDetails.value = details
    
    // Ініціалізувати форму редагування
    const startDate = new Date(eventDetails.value.event.start)
    editForm.value = {
      date: startDate.toISOString().split('T')[0],
      hours: String(startDate.getHours()).padStart(2, '0'),
      minutes: String(startDate.getMinutes()).padStart(2, '0'),
      durationMin: eventDetails.value.event.durationMin,
      regularity: eventDetails.value.event.regularity || 'single',
      tutorComment: eventDetails.value.event.tutorComment || '',
    }
  } catch (err: any) {
    console.error('[EventModal] Failed to load event details:', err)  // ✅ Тільки критичні помилки
    handleError(err, t('calendar.errors.loadFailed'))
  } finally {
    isLoading.value = false
  }
}
```

**Результат:** ✅ EventModal відкривається без нескінченної рекурсії.

---

## Виявлені проблеми, що потребують додаткового тестування

### ⚠️ Проблема 5: Відсутність авторизації

**Симптоми:**
- Токен відсутній в localStorage
- API запити повертають 401 Unauthorized
- EventModal не може завантажити дані події

**Причина:**
Користувач не авторизований або сесія закінчилася.

**Необхідні дії:**
1. Авторизуватися як тьютор через форму входу
2. Перевірити що токен зберігається в localStorage
3. Перевірити що API запити включають Authorization header

**Статус:** ⏳ Потребує авторизації для продовження тестування

---

### ⚠️ Проблема 6: Кнопка видалення не показується для подій у минулому

**Поведінка:**
EventModal правильно приховує кнопку "Видалити урок" для подій, які вже відбулися або оплачені.

**Код логіки:**
```typescript
const canDelete = computed(() => {
  if (!eventDetails.value) return false
  const event = eventDetails.value.event
  
  // Не можна видалити оплачений урок
  if (event.paidStatus === 'paid') return false
  
  // Не можна видалити урок у минулому
  const eventStart = new Date(event.start)
  if (eventStart < new Date()) return false
  
  return true
})
```

**Статус:** ✅ Це правильна поведінка, не баг.

---

## Результати тестування

### ✅ Успішно протестовано:

1. **Завантаження календаря**
   - Календар завантажується без помилок 400
   - Події відображаються на сітці
   - Навігація по тижнях працює
   - Фільтри (Уроки/Доступність) працюють

2. **Відкриття EventModal**
   - Модалка відкривається при кліку на подію
   - Заголовок відображається правильно: "Редагувати подію"
   - Немає нескінченної рекурсії

3. **Переклади**
   - Всі тексти відображаються українською
   - Ключі перекладів працюють коректно

### ⏳ Потребує додаткового тестування (після авторизації):

1. **Завантаження деталей події**
   - Перевірити що EventModal завантажує дані події
   - Перевірити відображення всіх полів (учень, час, тривалість, статуси)

2. **Редагування події**
   - Відкрити режим редагування
   - Змінити дату/час/тривалість
   - Зберегти зміни
   - Перевірити оновлення на календарі

3. **Видалення події**
   - Клікнути "Видалити урок" (для події в майбутньому)
   - Підтвердити видалення
   - Перевірити що подія зникла з календаря
   - Перевірити що календар оновився

4. **Створення нового уроку**
   - Відкрити CreateLessonModal
   - Вибрати учня
   - Вказати дату та час
   - Створити урок
   - Перевірити що урок з'явився на календарі БЕЗ перезагрузки сторінки

---

## Статистика виправлень

| Категорія | Кількість |
|-----------|-----------|
| Критичні помилки виправлено | 4 |
| Файлів змінено | 4 |
| Рядків коду змінено | ~50 |
| Видалено зайвого логування | ~10 console.log |
| Проблем виявлено | 6 |
| Проблем виправлено | 4 |
| Потребує тестування | 2 |

---

## Змінені файли

1. ✅ `frontend/src/modules/booking/api/calendarWeekApi.ts`
   - Додано обов'язковий параметр `weekStart`
   - Виправлено передачу параметрів в API запит

2. ✅ `frontend/src/modules/booking/stores/calendarWeekStore.ts`
   - Додано обчислення `weekStart` в `fetchWeek`
   - Виправлено перевірку типу `dayEvents` перед ітерацією

3. ✅ `frontend/src/types/relations.js`
   - Змінено `useAlt: true` на `useAlt: false` для всіх endpoints
   - Виправлено формування URL для API запитів

4. ✅ `frontend/src/modules/booking/components/modals/EventModal.vue`
   - Виправлено нескінченну рекурсію в `watch`
   - Видалено надмірне логування
   - Додано скидання стану при закритті модалки

---

## Рекомендації для наступних кроків

### Фаза 1: Завершення тестування (потребує авторизації)

1. **Авторизуватися в системі**
   - Email: tutor@test.com
   - Password: test123
   - Або створити нового користувача

2. **Протестувати повний цикл роботи з уроками:**
   - Створити новий урок
   - Перевірити що урок з'явився БЕЗ перезагрузки
   - Відредагувати урок
   - Перевірити що зміни застосувалися БЕЗ перезагрузки
   - Видалити урок
   - Перевірити що урок зник БЕЗ перезагрузки

3. **Перевірити edge cases:**
   - Спроба видалити оплачений урок (має бути заборонено)
   - Спроба видалити урок у минулому (має бути заборонено)
   - Спроба редагувати урок у минулому (має бути заборонено)
   - Створення уроку на зайнятий час (має показати конфлікт)

### Фаза 2: Виправлення виявлених проблем

1. **Якщо урок не з'являється після створення:**
   - Перевірити що `store.createEvent` викликає `fetchWeek`
   - Перевірити що `fetchWeek` оновлює `snapshot`
   - Додати логування для діагностики

2. **Якщо урок не зникає після видалення:**
   - Перевірити що `store.deleteEvent` викликає `fetchWeek`
   - Перевірити що backend повертає успішну відповідь
   - Перевірити що помилка 404 relations виправлена

3. **Якщо зміни не застосовуються після редагування:**
   - Перевірити що `store.updateEvent` викликає `fetchWeek`
   - Перевірити формат даних що відправляються на backend
   - Перевірити що backend приймає та зберігає зміни

### Фаза 3: Очищення коду

1. **Видалити зайвий код (згідно з аудитом):**
   - Дублікати перекладів в `lessons.calendar`
   - Debug endpoint `debug_snapshot.py`
   - Невикористаний компонент `CalendarWeekNav.vue`
   - Невикористані імпорти

2. **Оптимізувати логування:**
   - Залишити тільки критичні помилки
   - Видалити debug логи з production коду

---

## Висновок

### Досягнуто:
✅ Виправлено 4 критичні помилки
✅ Календар завантажується без помилок
✅ EventModal відкривається без рекурсії
✅ Переклади працюють коректно
✅ API endpoints формуються правильно

### Залишилось:
⏳ Авторизуватися для продовження тестування
⏳ Протестувати створення/редагування/видалення уроків
⏳ Перевірити оновлення календаря без перезагрузки
⏳ Виконати edge case тестування
⏳ Очистити код від дублікатів

### Критичність виявлених проблем:
- 🔴 **Критичні (виправлено):** 4
- 🟡 **Середні (потребують тестування):** 2
- 🟢 **Низькі (документовано):** 0

**Календар готовий до продовження тестування після авторизації користувача.**
