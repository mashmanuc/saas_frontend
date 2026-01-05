# E2E Calendar Tests Refactoring Report

**Дата**: 2026-01-05  
**Мета**: Стабілізувати `createLesson.spec.ts` без UI-хаків, retry loops та execSync в spec файлах

---

## ✅ Виконані зміни

### 1. Global Setup з Seed Pipeline (`frontend/tests/e2e/global-setup.ts`)

**Що додано:**
- Функція `runE2ESeed()` - виконує `backend/manage.py e2e_seed_calendar` через execSync
- Функція `verifySeedData()` - sanity check через calendar API endpoint
- Інтеграція seed в існуючий global-setup перед аутентифікацією

**Ключові особливості:**
```typescript
// Виконується ОДИН РАЗ перед всіма тестами
await runE2ESeed()  // Створює детерміновані дані
await verifySeedData(apiURL, access)  // Перевіряє доступність через API
```

**Fail-fast механізм:**
- Якщо seed падає → тести не запускаються, чіткий лог помилки
- Якщо API не повертає слоти → Exception з інструкцією перезапустити backend з E2E_MODE=1

**Файл**: `d:\m4sh_v1\frontend\tests\e2e\global-setup.ts`

---

### 2. UI Layer: Data Attributes для Accessible Slots

**Файл**: `frontend/src/modules/booking/components/calendar/layers/AccessibleSlotsLayer.vue`

**Що додано:**
```vue
<div
  v-for="slot in accessibleSlots"
  :key="slot.id"
  data-testid="accessible-slot"
  :data-slot-hour="getSlotHour(slot.start)"  <!-- НОВИЙ АТРИБУТ -->
  @click="handleSlotClick(slot)"
>
```

**Функція для атрибуту:**
```typescript
const getSlotHour = (startTime: string): number => {
  return dayjs(startTime).tz(tz.value).hour()
}
```

**Переваги:**
- Детермінований пошук слотів за годиною: `[data-slot-hour="10"]`
- Не залежить від DOM структури чи CSS класів
- Стабільний селектор для E2E тестів

---

### 3. Spec Simplification (`frontend/tests/e2e/calendar-suite/createLesson.spec.ts`)

**Видалено:**
- ❌ `execSync` виклики в spec
- ❌ `runSeedIfNeeded()` функція
- ❌ Retry loops в `openDeterministicSlot()`
- ❌ DOM маніпуляції через `page.evaluate()`
- ❌ Fallback логіка з `grid-hour-*` селекторами

**Додано:**
- ✅ Чиста функція `openCreateLessonModal()` - клік по `[data-testid="accessible-slot"]`
- ✅ Детерміновані селектори без припущень про DOM
- ✅ Чіткі коментарі українською для кожної функції
- ✅ Прості assertions без retry логіки

**Приклад нової логіки:**
```typescript
async function openCreateLessonModal(page: any) {
  // Чекаємо на появу доступних слотів (seed створює слоти на години 10, 11, 14, 15, 16)
  const accessibleSlot = page.locator('[data-testid="accessible-slot"]').first()
  await expect(accessibleSlot).toBeVisible({ timeout: 10000 })
  
  // Клікаємо по першому доступному слоту
  await accessibleSlot.click()
  
  // Перевіряємо, що модалка відкрилася
  const modal = page.locator('.modal-overlay')
  await expect(modal).toBeVisible({ timeout: 5000 })
}
```

**Файл**: `d:\m4sh_v1\frontend\tests\e2e\calendar-suite\createLesson.spec.ts`

---

### 4. Backend: E2E Seed Command (вже існував)

**Файл**: `backend/apps/booking/management/commands/e2e_seed_calendar.py`

**Що створює:**
- Tutor: `m3@gmail.com` (id=79)
- Student: `e2e-student@example.com` (id=90)
- Active relation між ними
- 21 CalendarAccessibleSlot на години 10, 11, 14, 15, 16 протягом 7 днів

**Ідемпотентність**: можна запускати багато разів без дублювання даних

---

### 5. Backend: E2E_MODE Configuration (вже існував)

**Файл**: `backend/config/settings.py`

```python
E2E_MODE = env.bool('E2E_MODE', default=False)
CALENDAR_DISABLE_RATE_LIMIT = env.bool('CALENDAR_DISABLE_RATE_LIMIT', default=False) or E2E_MODE

if E2E_MODE:
    CELERY_TASK_ALWAYS_EAGER = True  # Синхронне виконання tasks
    CELERY_TASK_EAGER_PROPAGATES = True
```

---

## 📋 Інструкції для запуску

### Передумова: Backend з E2E_MODE=1

**ВАЖЛИВО**: Backend повинен працювати з `E2E_MODE=1` для синхронного Celery.

```powershell
cd D:\m4sh_v1\backend
$env:E2E_MODE='1'
.venv\Scripts\python.exe manage.py runserver
```

**Перевірка:**
```powershell
.venv\Scripts\python.exe manage.py shell -c "from django.conf import settings; print(f'E2E_MODE: {settings.E2E_MODE}')"
# Очікується: E2E_MODE: True
```

### Запуск тестів (повний цикл з seed)

```powershell
cd D:\m4sh_v1\frontend
npm run test:e2e -- --project=calendar-e2e tests/e2e/calendar-suite/createLesson.spec.ts
```

Global setup автоматично:
1. Запустить seed command
2. Створить детерміновані дані
3. Перевірить доступність через API
4. Виконає аутентифікацію

### Запуск тестів (без seed, якщо дані вже є)

```powershell
cd D:\m4sh_v1\frontend
$env:E2E_SKIP_SEED='1'
npm run test:e2e -- --project=calendar-e2e tests/e2e/calendar-suite/createLesson.spec.ts
```

### Запуск 3 рази підряд (stability test)

```powershell
cd D:\m4sh_v1\frontend
.\tests\e2e\run-tests-3x.ps1
```

---

## 🏗️ Архітектура рішення

```
┌─────────────────────────────────────────────────────────────┐
│ Global Setup (виконується 1 раз)                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. runE2ESeed()                                         │ │
│ │    └─> execSync('python manage.py e2e_seed_calendar')  │ │
│ │                                                         │ │
│ │ 2. verifySeedData()                                     │ │
│ │    └─> GET /api/v1/calendar/week/v055/                 │ │
│ │    └─> Assert: accessible.length > 0                   │ │
│ │                                                         │ │
│ │ 3. Authenticate & save auth state                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Test Spec (createLesson.spec.ts)                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ beforeEach:                                             │ │
│ │   - goto('/booking/tutor')                              │ │
│ │   - waitForCalendarReady()                              │ │
│ │                                                         │ │
│ │ test('Happy path'):                                     │ │
│ │   - openCreateLessonModal()  ← клік по accessible-slot │ │
│ │   - selectDeterministicStudent('e2e-student')           │ │
│ │   - submitHappyPath()                                   │ │
│ │   - expect(lesson-card).toBeVisible()                   │ │
│ │                                                         │ │
│ │ test('Validation'):                                     │ │
│ │   - openCreateLessonModal()                             │ │
│ │   - expect(submitBtn).toBeDisabled()                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Досягнуті цілі

### ✅ Заборонені практики видалено
- ❌ execSync в spec файлах
- ❌ page.evaluate() DOM маніпуляції
- ❌ Retry loops на кліках
- ❌ Припущення про DOM структуру (grid-hour-*)

### ✅ Дозволені практики реалізовано
- ✅ Детерміновані дані через Django management command
- ✅ Seed інтегровано в global-setup
- ✅ Sanity check через calendar API
- ✅ Fail-fast з чіткими логами
- ✅ Data-testid атрибути в UI layer

### ✅ Stability improvements
- Тести не залежать від runtime стану backend
- Global setup перевіряє доступність даних перед тестами
- Чіткі помилки з інструкціями при проблемах
- Ідемпотентний seed (можна запускати багато разів)

---

## 📁 Змінені файли

1. **`frontend/tests/e2e/global-setup.ts`**
   - Додано seed pipeline
   - Додано sanity check
   - ~90 рядків нового коду

2. **`frontend/src/modules/booking/components/calendar/layers/AccessibleSlotsLayer.vue`**
   - Додано `:data-slot-hour` атрибут
   - Додано `getSlotHour()` функцію
   - ~5 рядків нового коду

3. **`frontend/tests/e2e/calendar-suite/createLesson.spec.ts`**
   - Повністю переписано без UI-хаків
   - Видалено execSync та retry loops
   - Спрощено до 126 рядків (було ~343)

4. **`backend/config/settings.py`** (вже існував)
   - E2E_MODE configuration
   - Celery eager mode

5. **`backend/apps/booking/management/commands/e2e_seed_calendar.py`** (вже існував)
   - Ідемпотентний seed command

---

## 📚 Документація

Створено:
- **`frontend/tests/e2e/README_E2E_SETUP.md`** - повна інструкція з setup, troubleshooting, CI/CD
- **`frontend/tests/e2e/run-tests-3x.ps1`** - скрипт для 3x прогону з summary
- **`backend/RESTART_BACKEND_E2E.md`** - інструкція для перезапуску backend з E2E_MODE

---

## ⚠️ Важливі примітки

### Ручний крок: Backend з E2E_MODE=1

**Це НЕ автоматизовано в коді**, оскільки потребує перезапуску backend процесу.

Користувач повинен вручну:
1. Зупинити поточний backend
2. Запустити з `E2E_MODE=1`
3. Перевірити через shell, що налаштування застосовано

**Альтернатива**: Додати до CI/CD pipeline автоматичний запуск backend з E2E_MODE.

### Sanity Check як захист

Global setup **fail-fast** якщо:
- Seed command падає → Exception з логом
- API не повертає слоти → Exception з інструкцією про E2E_MODE

Це гарантує, що тести не запустяться на неправильно налаштованому backend.

---

## 🚀 Наступні кроки (опціонально)

1. **CI/CD Integration**: Додати автоматичний запуск backend з E2E_MODE в pipeline
2. **Parallel tests**: Розширити на інші calendar test suites
3. **Data cleanup**: Додати teardown для очищення тестових даних після прогону
4. **Monitoring**: Додати метрики стабільності тестів (pass rate, duration)

---

## ⏸️ Поточний статус (2026-01-05 21:37)

- **Тестування призупинено.** Під час останнього прогону `createLesson.spec.ts` happy-path тест не зміг завантажити сторінку через `Failed to fetch dynamically imported module: http://127.0.0.1:5173/src/modules/booking/views/TutorCalendarView.vue`.
- **Причина:** одночасно підняті кілька Vite dev-server'ів. Плейрайт звертається до `127.0.0.1:5173`, але фронтенд то перемикається на інший порт, то повертає модулі з іншого інстансу → виникають `net::ERR_CONNECTION_FAILED`.
- **Що робити далі:** запускати лише один фронтенд на час E2E прогону (або виділити окремий порт/окрему машину), після чого повторити тестування й зібрати 3 зелених прогони.
- **Без вирішення цієї інфраструктурної колізії подальше тестування не дасть стабільного результату.**

---

## 📊 Metrics

- **Spec file size**: 343 → 126 рядків (-63%)
- **Complexity**: Видалено retry loops, fallbacks, DOM hacks
- **Maintainability**: Чіткі функції з коментарями, детерміновані селектори
- **Stability**: Fail-fast механізм, sanity check, ідемпотентний seed

---

**Статус**: ✅ Готово до запуску  
**Блокер**: Backend повинен працювати з `E2E_MODE=1` (ручний крок)

Для запуску тестів дивіться секцію "Інструкції для запуску" вище.
