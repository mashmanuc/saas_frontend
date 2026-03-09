# План А — Глобальна стабілізація профілю тьютора
**Дата:** 2026-02-26
**Пріоритет:** 🔴 КРИТИЧНО для запуску
**Статус:** Готовий до виконання

---

## Загальний стан

З попереднього аудиту та сесії виправлень маємо:
- **6 багів вже виправлено локально** (незакомічено) — `TUTOR_PROFILE_BUGFIXES_REPORT_2026-02-26.md`
- **2 нових критичних баги** знайдено browser-аудитом
- **3 важливих проблеми** потребують подальшого розслідування

---

## КРОК 1 — Закомітити вже готові виправлення (НЕГАЙНО)

Усі ці файли вже виправлені локально, тільки потрібен коміт:

```bash
cd D:\m4sh_v1

git add frontend/src/modules/marketplace/components/editor/TabbedCard.vue
git add frontend/src/modules/booking/components/availability/AvailabilityEditor.vue
git add frontend/src/modules/booking/components/availability/DraftChangesBar.vue
git add frontend/src/modules/marketplace/components/editor/CreateProfilePrompt.vue
git add frontend/src/components/geo/CityAutocomplete.vue
git add frontend/src/modules/marketplace/api/marketplace.ts
git add frontend/src/ui/GlobalLoader.vue

git commit -m "fix(tutor-profile): критичні баги #1 #4 #5b #12 #14 #15 + GlobalLoader pointer-events

- Bug #5b: inline валідація custom_direction_text (50-800 символів, червоний/зелений лічильник)
- Bug #14: overlap detection у calendar (gap-finding алгоритм, заборона збереження при перетинах)
- Bug #15: DraftChangesBar.exitMode() замість clearDraft() при discard
- Bug #1: CreateProfilePrompt — size=lg, fullWidth, ArrowRight у #iconRight slot
- Bug #4: CityAutocomplete watch guards (skip re-fetch при autosave)
- Bug #12: skipLoader:true для getTutorMeProfile() і apiGetFull()
- Fix GlobalLoader: pointer-events:none у .fade-leave-active (блокував кліки на всіх сторінках!)

Fixes: tutor profile validation, calendar UX, navigation loading overlay"
```

---

## КРОК 2 — GlobalLoader pointer-events (ВЖЕ ВИПРАВЛЕНО в цій сесії)

**Файл:** `frontend/src/ui/GlobalLoader.vue`
**Статус:** ✅ Виправлено

**Що було:** `.fade-leave-active` не мав `pointer-events: none`, тому overlay з `opacity: 0` залишався в DOM і перехоплював **всі кліки** на всіх сторінках після завантаження.

**Що стало:**
```css
.fade-leave-active {
  transition: opacity 0.2s ease;
  pointer-events: none; /* Не блокуємо кліки під час fade-out */
}
```

**Вплив:** Критичний — виправляє взаємодію на 100% сторінок.

---

## КРОК 3 — skipLoader для інших фонових запитів

**Проблема:** Деякі API виклики все ще тригерять GlobalLoader при навігації.
**Пріоритет:** 🟡 Важливо

### 3а. calendarWeekApi — fetch при відкритті календаря

**Файл:** `frontend/src/modules/booking/api/calendarWeekApi.js` (або `.ts`)
**Що виправити:** Додати `skipLoader: true` до snapshot fetch:

```js
// Знайти функцію що завантажує snapshot/тиждень:
export function fetchWeekSnapshot(params) {
  return api.get('/booking/calendar/snapshot', {
    params,
    meta: { skipLoader: true }  // ← додати
  })
}
```

### 3б. notificationsStore.loadNotifications()

**Файл:** `frontend/src/stores/notificationsStore.js` (або `.ts`)
**Що виправити:**

```js
async loadNotifications({ limit = 10 } = {}) {
  // Знайти axios/api виклик і додати skipLoader:
  const response = await api.get('/notifications', {
    params: { limit },
    meta: { skipLoader: true }  // ← додати
  })
}
```

### 3в. relationsStore.fetchRelations()

**Файл:** `frontend/src/stores/relationsStore.js` (або `.ts`)
**Що виправити:**

```js
async fetchRelations() {
  if (this._inFlight) return  // вже є guard
  this._inFlight = true
  try {
    const response = await api.get('/people/relations', {
      meta: { skipLoader: true }  // ← додати
    })
    // ...
  } finally {
    this._inFlight = false
  }
}
```

---

## КРОК 4 — has_availability = false

**Проблема:** `has_availability: false` у myProfile тьютора навіть після налаштування розкладу.
**Наслідок:** Тьютор може не з'являтись у фільтрах marketplace при пошуку "з доступними слотами".
**Пріоритет:** 🟡 Важливо для видимості тьютора

### Діагностика:

```bash
# Backend — перевірити логіку розрахунку has_availability
grep -r "has_availability" backend/apps/marketplace/ --include="*.py"
grep -r "has_availability" backend/apps/booking/ --include="*.py"
```

**Де шукати:**
- `backend/apps/marketplace/models.py` — поле `has_availability`
- `backend/apps/booking/signals.py` або `tasks.py` — оновлення після зміни слотів
- Celery task що оновлює цей флаг після збереження availability

**Типова причина:** Celery worker не запущений або сигнал `post_save` на `AvailabilityTemplate` не тригерить оновлення `TutorProfile.has_availability`.

**Швидке виправлення (ручне через shell):**
```python
# python manage.py shell
from apps.marketplace.models import TutorProfile
from apps.booking.models import AvailabilityTemplate

tutor = TutorProfile.objects.get(user__email='mashmanuc@gmail.com')
has = AvailabilityTemplate.objects.filter(tutor=tutor, is_active=True).exists()
tutor.has_availability = has
tutor.save(update_fields=['has_availability'])
```

---

## КРОК 5 — Notification без title/body

**Проблема:** `subscription.confirmed` notification приходить без `title` і `body`.
**Наслідок:** Порожнє сповіщення у дзвіночку.
**Пріоритет:** 🟡 Важливо для UX

**Файл:** `frontend/src/components/Notifications/NotificationBell.vue`

**Поточний код (рядок 57):**
```html
<p class="item-title">{{ item.title }}</p>
<p class="item-body">{{ item.body }}</p>
```

**Виправлення:**

```html
<!-- NotificationBell.vue — замінити template рядки 57-58 -->
<p class="item-title">{{ getNotificationTitle(item) }}</p>
<p class="item-body">{{ item.body || '' }}</p>
```

**І в `<script setup>`:**
```js
const NOTIFICATION_FALLBACK_TITLES: Record<string, string> = {
  'subscription.confirmed': 'Підписку активовано',
  'subscription.cancelled': 'Підписку скасовано',
  'inquiry.created': 'Новий запит від студента',
  'inquiry.accepted': 'Запит прийнято',
  'inquiry.rejected': 'Запит відхилено',
  'booking.created': 'Нове бронювання',
  'booking.cancelled': 'Бронювання скасовано',
}

function getNotificationTitle(item: InAppNotification): string {
  return item.title || NOTIFICATION_FALLBACK_TITLES[item.type] || 'Сповіщення'
}
```

---

## КРОК 6 — Перевірка marketplace tutor_count = 0

**Проблема:** Всі 37 предметів показують `tutor_count: 0`.
**Пріоритет:** 🟡 Потребує перевірки — чи це дані чи UI?

### Перевірка:

```bash
# Backend shell
python manage.py shell -c "
from apps.marketplace.models import TutorProfile, Subject
from django.db.models import Count

print('Total active tutor profiles:', TutorProfile.objects.filter(is_published=True).count())
print('Subjects with tutors:', Subject.objects.annotate(cnt=Count('tutorprofile')).filter(cnt__gt=0).count())
"
```

**Якщо дані є в БД але не в API:** Проблема в серіалізаторі або кеші.
**Якщо даних немає:** Тестовий акаунт не опублікований або поле `subjects` не заповнено.

---

## КРОК 7 — Tutor Dashboard нульові лічильники

**Проблема:** "Усі 0", "Запрошені 0", "Активні 0", "Архівні 0".
**Причина:** Тестовий акаунт `mashmanuc@gmail.com` не має відносин зі студентами.
**Дія:** Перевірити з реальними даними після додавання тестового студента або на prod.

---

## Підсумкова таблиця

| # | Проблема | Пріоритет | Складність | Статус |
|---|----------|-----------|------------|--------|
| 1 | GlobalLoader pointer-events | 🔴 КРИТИЧНО | Низька | ✅ Виправлено |
| 2 | Закомітити 6 незакомічених багів | 🔴 КРИТИЧНО | Низька | ⏳ Коміт потрібен |
| 3 | skipLoader для calendar/notifications/relations | 🟡 Важливо | Низька | ⏳ Потрібно |
| 4 | has_availability = false | 🟡 Важливо | Середня | 🔍 Дослідити |
| 5 | Notification без title | 🟡 Важливо | Низька | ⏳ Потрібно |
| 6 | tutor_count: 0 | 🟡 Важливо | Середня | 🔍 Дослідити |
| 7 | Dashboard нульові лічильники | 🟢 Minor | — | Тест дані |

---

## Очікуваний результат після виконання

- ✅ Кліки працюють одразу після завантаження сторінки
- ✅ Loader не з'являється при навігації між сторінками
- ✅ Календар не показує накладки часу
- ✅ Discard у профілі повністю скидає режим редагування
- ✅ Сповіщення мають заголовки
- ✅ Тьютор відображається у фільтрі за доступністю
