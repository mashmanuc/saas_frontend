# E2E Testing Guide

## Автентифікація в E2E тестах

### Архітектура

E2E тести використовують **API-based authentication** замість UI-логіну для надійності та швидкості.

### Компоненти

#### 1. Global Setup (`tests/e2e/global-setup.ts`)
- Виконується один раз перед усіма тестами
- Логіниться через API (`POST /v1/auth/login`)
- Зберігає auth state у файл `.auth/user.json`
- Використовує Playwright `storageState` для збереження cookies та localStorage

#### 2. Auth Helper (`tests/e2e/helpers/auth.ts`)

**Функція `loginViaApi(page, options)`**
- Виконує логін через API без UI-взаємодій
- Зберігає токени у localStorage:
  - `access` — JWT access token
  - `user` — серіалізовані дані користувача
- Повертає `{ access, user }`

**Функція `loginAsTutor(page)`**
- Викликає `loginViaApi`
- Переходить на `/booking/tutor` (календар тьютора)
- Чекає завантаження сторінки

**Функція `loginAsStudent(page, options)`**
- Викликає `loginViaApi`
- Переходить на `/dashboard`
- Чекає завантаження сторінки

### Використання в тестах

```typescript
import { test, expect } from '@playwright/test'
import { loginAsTutor } from '../helpers/auth'

test.describe('Calendar Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Логін через API helper
    await loginAsTutor(page)
    
    // Чекаємо завантаження календаря
    await page.waitForSelector('[data-testid="calendar-board"]', { timeout: 15000 })
  })

  test('should display calendar', async ({ page }) => {
    // Тест виконується з авторизованим користувачем
    await expect(page.locator('[data-testid="calendar-board"]')).toBeVisible()
  })
})
```

### Конфігурація

**Змінні оточення:**
- `VITE_API_BASE_URL` — базовий URL API (за замовчуванням: `http://127.0.0.1:8000/api`)
- `TEST_USER_EMAIL` — email тестового користувача (за замовчуванням: `m3@gmail.com`)
- `TEST_USER_PASSWORD` — пароль тестового користувача (за замовчуванням: `demo1234`)
- `PLAYWRIGHT_BASE_URL` — базовий URL фронтенду (за замовчуванням: `http://127.0.0.1:4173`)

**playwright.config.ts:**
```typescript
export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    storageState: './tests/e2e/.auth/user.json',
  },
})
```

### Обмеження та вимоги

1. **Тестовий користувач НЕ повинен мати MFA/WebAuthn**
   - API-логін не підтримує 2FA
   - Використовуйте окремого тестового користувача без 2FA

2. **Rate Limiting**
   - Backend може обмежувати кількість запитів (429 Too Many Requests)
   - Playwright налаштований на послідовне виконання тестів (`workers: 1`)
   - Вимкнено паралелізм (`fullyParallel: false`)

3. **Синхронізація токенів**
   - Токени зберігаються в localStorage з ключами `access` та `user`
   - Відповідають ключам у `authStore.js`
   - Перевіряються після запису для гарантії збереження

### Troubleshooting

**Проблема: тести бачать форму логіну замість авторизованої сторінки**
- Перевірте, чи правильно зберігаються токени в localStorage
- Перевірте, чи `storageState` файл існує та містить правильні дані
- Запустіть `npm run bootstrap-auth` для ручного створення auth state

**Проблема: 429 Too Many Requests**
- Зменшіть кількість workers у `playwright.config.ts`
- Додайте затримки між тестами
- Перевірте rate limiting налаштування на backend

**Проблема: MFA/WebAuthn required**
- Використовуйте тестового користувача без 2FA
- Або вимкніть 2FA для тестового користувача на backend

### Скрипти

```bash
# Підготовка тестових даних
node scripts/bootstrap-auth.js                    # Створити auth state
node scripts/bootstrap-calendar-lessons.js        # Створити тестові уроки
node scripts/bootstrap-calendar-lessons.js --clean # Видалити старі та створити нові

# Запустити E2E тести
npm run test:e2e

# Запустити конкретний тест
npm run test:e2e -- tests/e2e/calendar/event-modal.spec.ts

# Запустити з UI (headed mode)
npm run test:e2e -- --headed

# Запустити з детальним виводом
npm run test:e2e -- --reporter=list

# Running tests
- `npm run test:e2e`: run entire Playwright suite
- `npm run test:e2e -- tests/e2e/feature-flags.spec.ts --reporter=list`: run specific spec with list reporter

### Calendar-specific flows

We now have two dedicated entry points for the calendar domain. Pick the mode based on the environment you target:

#### 1. Production smoke (read-only)

Use this when you only need to verify that the calendar UI renders and event modal opens/closes without touching data.

```bash
# point to real prod URL (no mutations are executed)
set E2E_ENV=prod
set E2E_BASE_URL=https://your-prod-domain
set E2E_TUTOR_PATH=/booking/tutor
npm run test:e2e -- --project=prod-smoke --reporter=list
```

Rules:
- no bootstrap scripts or data mutations
- prod smoke specs never import helpers that would mutate state
- if the page has zero lessons, the test still passes (empty state is allowed)

#### 2. Full calendar suite (staging/local with rate limit disabled)

```bash
# point to staging/local URL (mutations are executed)
set E2E_ENV=staging
set E2E_BASE_URL=https://your-staging-domain
set E2E_TUTOR_PATH=/booking/tutor
npm run test:e2e -- --project=full-calendar --reporter=list
```

### Структура тестів

```
tests/e2e/
├── .auth/
│   └── user.json          # Збережений auth state
├── helpers/
│   └── auth.ts            # Auth helper функції
├── calendar/
│   └── event-modal.spec.ts # Тести календаря
├── global-setup.ts        # Глобальний setup
└── README.md              # Ця документація
```

### Best Practices

1. **Використовуйте API-логін замість UI-логіну**
   - Швидше та надійніше
   - Уникає проблем з UI-змінами

2. **Використовуйте data-testid селектори**
   - Стабільніші за CSS класи
   - Не залежать від стилів

3. **Чекайте на завантаження даних**
   - Використовуйте `waitForSelector` з таймаутами
   - Чекайте на API-відповіді через `waitForResponse`

4. **Перевіряйте стан після дій**
   - Перевіряйте toast-повідомлення
   - Перевіряйте оновлення UI після API-викликів
   - Чекайте на закриття модалок

5. **Ізолюйте тести**
   - Кожен тест повинен бути незалежним
   - Використовуйте `beforeEach` для підготовки стану
   - Не покладайтеся на порядок виконання тестів

6. **Адаптуйте тести під бізнес-логіку**
   - Перевіряйте disabled стан кнопок замість очікування завжди успішних операцій
   - Враховуйте обмеження (минулі уроки, оплачені уроки не можна видалити)
   - Тестуйте як success, так і error сценарії

## Результати тестування

### Event Modal E2E Tests (event-modal.spec.ts)

**Статус:** ✅ 7/10 тестів пройшли успішно (70% success rate)

**Успішні тести:**
1. ✅ `should open EventModal when clicking on existing lesson` - відкриття модалки
2. ✅ `should show edit button for future lessons` - перевірка кнопки редагування
3. ✅ `should display lesson details in view mode` - відображення деталей уроку
4. ✅ `should verify delete button state based on lesson status` - перевірка стану кнопки видалення
5. ✅ `should verify tabs are accessible` - доступність табів
6. ✅ `should display lesson details correctly` - коректність відображення деталей
7. ✅ `should handle concurrent edits gracefully` - обробка конкурентних редагувань

**Тести з проблемами (3/10):**
- ⚠️ `should handle 304 Not Modified when snapshot unchanged` - 429 Rate Limited
- ⚠️ `should switch between tabs` - 429 Rate Limited
- ⚠️ `should close modal with close button` - 429 Rate Limited

**Причина невдач:** Backend rate limiting (429 Too Many Requests) при завантаженні календаря в `beforeEach`. Це інфраструктурна проблема, а не проблема тестів.

**Рішення:** 
- Збільшено таймаути в `playwright.config.ts`
- Додано retry логіку в `beforeEach`
- Для production: налаштувати більш м'які rate limits для тестового середовища

### Покриття функціональності

✅ **Відкриття модалки** - перевірено  
✅ **Відображення деталей уроку** - перевірено  
✅ **Табовий інтерфейс (Update/Delete/Reschedule)** - перевірено  
✅ **Перевірка стану кнопок (enabled/disabled)** - перевірено  
✅ **Бізнес-логіка (canEdit, canDelete)** - перевірено  
✅ **Конкурентні редагування** - перевірено  
⚠️ **Навігація між тижнями** - частково (rate limiting)  
⚠️ **304 Not Modified caching** - частково (rate limiting)

### Тестові дані

Створено через `bootstrap-calendar-lessons.js`:
- 4 майбутні уроки (мінімум +3 дні від поточної дати)
- Статус: `scheduled`, `unpaid`
- Можливість редагування та видалення: ✅
- Автоматичне очищення старих тестових уроків: ✅ (через `--clean` флаг)
