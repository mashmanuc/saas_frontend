# E2E Test Failures Analysis — 2026-02-02

**Статус:** 225 failed / 32 passed / 25 skipped  
**Тривалість:** 47.8 minutes  
**Критичність:** 🔴 HIGH — Масові падіння тестів

---

## Executive Summary

Виявлено **3 основні root causes**, які викликають каскадні падіння тестів:

1. **Calendar Board Timeout (P0)** — `[data-testid="calendar-board"]` не завантажується
2. **Auth LocalStorage Failure (P0)** — токени не зберігаються в localStorage
3. **Modal/UI Elements Not Found (P1)** — `text=Створити урок`, кнопки не знаходяться

---

## 1. Категоризація помилок

### 1.1 Calendar Board Timeout (89 tests)

**Помилка:**
```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="calendar-board"]') to be visible
```

**Файли:**
- `tests/e2e/calendar-suite/calendar-crud-v068.spec.ts` (7 tests)
- `tests/e2e/calendar-suite/event-modal.spec.ts` (3 tests)
- `tests/e2e/booking/calendar-week-view.spec.ts` (12 tests)
- `tests/e2e/booking/dst-handling.spec.ts` (5 tests)
- `tests/e2e/booking/error-recovery.spec.ts` (8 tests)
- `tests/e2e/booking/manual-booking-flow.spec.ts` (11 tests)
- `tests/e2e/booking/v047-end-to-end-flow.spec.ts` (4 tests)
- `tests/e2e/availability/*.spec.ts` (15 tests)
- `tests/e2e/calendar/student-calendar.spec.ts` (14 tests)

**Root Cause:**
- Компонент `CalendarBoard` не рендериться або має інший `data-testid`
- Можлива зміна структури компонента після рефакторингу
- Проблема з роутингом `/booking/tutor`

**Impact:** 🔴 CRITICAL — блокує всі календарні тести

---

### 1.2 Auth LocalStorage Failure (47 tests)

**Помилка:**
```
Error: Failed to store auth tokens in localStorage. 
Stored access: false, stored user: false
```

**Файли:**
- `tests/e2e/auth/billing-auth.spec.ts` (4 tests)
- `tests/e2e/auth/login-errors-v082.spec.ts` (4 tests)
- `tests/e2e/auth-unlock-flow.spec.ts` (3 tests)
- `tests/e2e/calendar-suite/calendar-crud-v068.spec.ts` (1 test)
- Всі тести, що використовують `loginViaApi()` helper

**Root Cause:**
- `tests/e2e/helpers/auth.ts:76` — localStorage.setItem() не працює
- Можлива зміна API response structure
- Проблема з cookies/session в headless browser

**Impact:** 🔴 CRITICAL — блокує всі authenticated тести

---

### 1.3 Modal/UI Elements Not Found (53 tests)

**Помилка:**
```
Error: expect(locator).toBeVisible() failed
Locator: locator('text=Створити урок')
Expected: visible
Timeout: 10000ms
Error: element(s) not found
```

**Файли:**
- `tests/e2e/calendar-suite/calendar-crud-v068.spec.ts` (2 tests)
- `tests/e2e/calendar-suite/createLesson.spec.ts` (2 tests)
- `tests/e2e/inquiries/inquiry-flow.spec.ts` (8 tests)
- `tests/e2e/marketplace/*.spec.ts` (15 tests)

**Root Cause:**
- i18n ключі змінені або не завантажуються
- Модальні вікна не відкриваються через JS errors
- Селектори застаріли після UI рефакторингу

**Impact:** 🟡 MEDIUM — блокує створення уроків та inquiries

---

### 1.4 Network/API Timeouts (21 tests)

**Помилка:**
```
TimeoutError: page.waitForResponse: Timeout 20000ms exceeded
```

**Файли:**
- `tests/e2e/calendar-suite/event-modal.spec.ts` (1 test)
- `tests/e2e/marketplace/marketplace-availability-smoke.spec.ts` (3 tests)

**Root Cause:**
- Backend не відповідає на `/api/booking/week/` endpoint
- Mock API не налаштовані правильно
- Реальний backend не запущений

**Impact:** 🟡 MEDIUM — тести залежать від backend

---

### 1.5 WebSocket/Realtime Issues (15 tests)

**Помилка:**
```
Error: WS connection failed
```

**Файли:**
- `tests/e2e/ws-reconnect.spec.ts` (6 tests)
- `tests/e2e/feature-flags.spec.ts` (4 tests)
- `tests/e2e/chat/chat-with-tutor.spec.ts` (5 tests)

**Root Cause:**
- WebSocket server не запущений в E2E environment
- WS URL неправильний для тестів

**Impact:** 🟢 LOW — тільки realtime features

---

## 2. Root Cause Analysis

### 2.1 Calendar Board Issue

**Hypothesis 1:** `data-testid` змінено
```bash
# Перевірити поточний testid
grep -r "data-testid.*calendar-board" src/
```

**Hypothesis 2:** Компонент не рендериться
- Перевірити `/booking/tutor` route
- Перевірити `CalendarBoard.vue` component
- Перевірити store initialization

**Hypothesis 3:** CSS/visibility issue
- Компонент рендериться, але `visibility: hidden`
- Перевірити styles

---

### 2.2 Auth LocalStorage Issue

**Hypothesis 1:** API response structure змінена
```typescript
// Очікується:
{ access: "token", user: {...} }

// Можливо повертається:
{ data: { access: "token", user: {...} } }
```

**Hypothesis 2:** localStorage blocked в headless mode
- Playwright config issue
- Permissions issue

**Hypothesis 3:** Timing issue
- Токени зберігаються асинхронно
- Потрібен `await page.waitForFunction()`

---

### 2.3 Modal Issue

**Hypothesis 1:** i18n не завантажується
```typescript
// Замість:
locator('text=Створити урок')

// Використати:
locator('[data-testid="create-lesson-button"]')
```

**Hypothesis 2:** Modal animation затримка
- Потрібен `waitForSelector` з більшим timeout
- Перевірити CSS transitions

---

## 3. Пріоритизація виправлень

### P0 — Critical (блокують 80% тестів)

1. **Fix Calendar Board Timeout**
   - Перевірити `data-testid="calendar-board"` існує
   - Виправити роутинг `/booking/tutor`
   - Додати fallback для завантаження
   - **ETA:** 2-4 години

2. **Fix Auth LocalStorage**
   - Перевірити `loginViaApi()` helper
   - Виправити localStorage.setItem()
   - Додати retry logic
   - **ETA:** 1-2 години

### P1 — High (блокують 20% тестів)

3. **Fix Modal/UI Elements**
   - Замінити text selectors на data-testid
   - Виправити i18n завантаження
   - Додати waitForSelector з timeout
   - **ETA:** 2-3 години

### P2 — Medium (не блокують інші тести)

4. **Fix Network Timeouts**
   - Налаштувати mock API
   - Збільшити timeouts
   - **ETA:** 1 година

5. **Fix WebSocket Issues**
   - Налаштувати WS mock server
   - **ETA:** 1 година

---

## 4. План виправлення

### Phase 1: Діагностика (30 хв)

**Крок 1.1:** Перевірити Calendar Board
```bash
# Знайти компонент
find src/ -name "*CalendarBoard*"

# Перевірити data-testid
grep -r "data-testid.*calendar" src/components/
```

**Крок 1.2:** Перевірити Auth Helper
```bash
# Переглянути auth.ts
cat tests/e2e/helpers/auth.ts

# Перевірити API response
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

**Крок 1.3:** Перевірити Modal
```bash
# Знайти CreateLesson modal
find src/ -name "*CreateLesson*"

# Перевірити i18n keys
grep "Створити урок" src/locales/
```

---

### Phase 2: Виправлення P0 (3-6 годин)

**Fix 1: Calendar Board**

Файл: `src/modules/booking/views/TutorCalendarView.vue`

```vue
<template>
  <div class="tutor-calendar-view">
    <!-- ДОДАТИ data-testid -->
    <CalendarBoard 
      data-testid="calendar-board"
      :week-data="weekData"
    />
  </div>
</template>
```

**Fix 2: Auth Helper**

Файл: `tests/e2e/helpers/auth.ts`

```typescript
export async function loginViaApi(page: Page) {
  const response = await page.request.post('/api/v1/auth/login', {
    data: { email: 'test@test.com', password: 'test' }
  })
  
  const data = await response.json()
  
  // FIX: Перевірити структуру response
  const access = data.access || data.data?.access
  const user = data.user || data.data?.user
  
  if (!access || !user) {
    throw new Error(`Invalid API response: ${JSON.stringify(data)}`)
  }
  
  // FIX: Використати page.evaluate для гарантованого запису
  await page.evaluate(({ access, user }) => {
    localStorage.setItem('access', access)
    localStorage.setItem('user', JSON.stringify(user))
  }, { access, user })
  
  // FIX: Перевірити що записалося
  const storedAccess = await page.evaluate(() => localStorage.getItem('access'))
  const storedUser = await page.evaluate(() => localStorage.getItem('user'))
  
  if (!storedAccess || !storedUser) {
    throw new Error(
      `Failed to store auth tokens. Stored access: ${!!storedAccess}, stored user: ${!!storedUser}`
    )
  }
}
```

**Fix 3: Modal Selectors**

Файл: `tests/e2e/calendar-suite/calendar-crud-v068.spec.ts`

```typescript
// ЗАМІНИТИ:
await expect(page.locator('text=Створити урок')).toBeVisible()

// НА:
await expect(page.locator('[data-testid="create-lesson-modal"]')).toBeVisible()
```

---

### Phase 3: Верифікація (1 година)

```bash
# Запустити тільки P0 тести
npm run test:e2e -- tests/e2e/calendar-suite/calendar-crud-v068.spec.ts

# Запустити auth тести
npm run test:e2e -- tests/e2e/auth/

# Запустити всі тести
npm run test:e2e
```

---

## 5. Очікувані результати

### Після Phase 2:

- ✅ Calendar Board тести: 89 → 85+ passed
- ✅ Auth тести: 47 → 45+ passed
- ✅ Modal тести: 53 → 50+ passed
- ⚠️ Network тести: залишаться failed (потрібен backend)
- ⚠️ WS тести: залишаться failed (потрібен WS server)

**Загальний результат:** 225 failed → **~50 failed** (78% improvement)

---

## 6. Файли для модифікації

### Критичні:

1. `src/modules/booking/views/TutorCalendarView.vue` — додати data-testid
2. `src/components/calendar/CalendarBoard.vue` — додати data-testid
3. `tests/e2e/helpers/auth.ts` — виправити localStorage logic
4. `tests/e2e/calendar-suite/*.spec.ts` — замінити text selectors

### Додаткові:

5. `src/components/modals/CreateLessonModal.vue` — додати data-testid
6. `playwright.config.ts` — збільшити timeouts
7. `tests/e2e/helpers/waitForCalendar.ts` — створити helper

---

## 7. Ризики та мітігація

### Ризик 1: Backend не запущений
**Мітігація:** Використати mock API для E2E тестів

### Ризик 2: Зміни ламають інші тести
**Мітігація:** Запускати regression suite після кожного fix

### Ризик 3: i18n keys змінені
**Мітігація:** Використати data-testid замість text selectors

---

## 8. Наступні кроки

1. ✅ **Діагностика** — перевірити Calendar Board, Auth, Modal (30 хв)
2. 🔧 **Fix P0** — виправити 3 критичні issues (3-6 годин)
3. ✅ **Verify** — запустити тести та перевірити результат (1 година)
4. 📊 **Report** — створити звіт про виправлення

**Total ETA:** 4-8 годин роботи

---

**Підготовлено:** Cascade AI Assistant  
**Дата:** 2026-02-02  
**Статус:** Ready for Implementation
