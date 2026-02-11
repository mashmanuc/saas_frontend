# E2E Testing Setup Guide

## Огляд

Цей документ описує налаштування E2E тестів з Playwright для проєкту, включаючи автоматичну авторизацію, WebAuthn моки та оптимізацію health polling.

## Передумови

1. **Backend сервер** має бути запущений на `http://127.0.0.1:8000`
2. **Тестовий користувач** має існувати в базі даних:
   - Email: `m3@gmail.com`
   - Password: `demo1234`
   - Role: `tutor`

## Автоматична авторизація

### Global Setup

Playwright автоматично виконує авторизацію перед запуском тестів через `global-setup.ts`:

```bash
# Авторизація відбувається автоматично при запуску
npm run e2e
```

### Ручна авторизація (опціонально)

Якщо потрібно вручну оновити auth state:

```bash
npm run bootstrap-auth
```

Скрипт:
- Перевіряє health backend
- Виконує логін через API
- Зберігає auth state у `tests/e2e/.auth/user.json`
- Зберігає credentials у `tests/e2e/.auth/credentials.json`

### Структура Auth State

```
tests/e2e/.auth/
├── user.json          # Playwright storage state (cookies, localStorage)
└── credentials.json   # Access token, user data, CSRF token
```

Auth state автоматично оновлюється якщо:
- Файл не існує
- Минуло більше 1 години з останньої авторизації

## WebAuthn Mocks

WebAuthn endpoints мокаються автоматично у тестах через `fixtures/webauthn-mocks.ts`.

### Використання у тестах

```typescript
import { setupWebAuthnMocks } from './fixtures/webauthn-mocks'

test.beforeEach(async ({ page }) => {
  // Автоматично мокає всі WebAuthn endpoints
  await setupWebAuthnMocks(page)
})
```

### Мокані endpoints

- `POST /api/v1/auth/webauthn/challenge` - генерація challenge
- `GET /api/v1/auth/webauthn/credentials/**` - список credentials
- `DELETE /api/v1/auth/webauthn/credentials/**` - видалення credential
- `POST /api/v1/auth/webauthn/verify` - верифікація
- `POST /api/v1/auth/webauthn/register` - реєстрація

### Відключення моків

```typescript
import { disableWebAuthnMocks } from './fixtures/webauthn-mocks'

test('real webauthn test', async ({ page }) => {
  await disableWebAuthnMocks(page)
  // Тест з реальними WebAuthn endpoints
})
```

## Health Polling Оптимізація

### Проблема

Раніше `realtimeStore` викликав health check без перевірки авторизації, що призводило до:
- 401 Unauthorized помилок
- 429 Too Many Requests (rate limiting)

### Рішення

`realtimeStore.refreshHealth()` тепер:
1. Перевіряє наявність `access` token перед викликом
2. Пропускає health check якщо користувач не авторизований
3. Логує причину пропуску для debugging

```javascript
async refreshHealth() {
  const auth = useAuthStore()
  if (!auth.access) {
    console.log('[realtimeStore] Skipping health check - no access token')
    return
  }
  // ... виклик API
}
```

## Availability Job Debounce

### Проблема

Повторні виклики `startTracking()` могли створювати кілька активних jobs, що порушувало rate limit API (1 job на 30 секунд).

### Рішення

`useAvailabilityJob` тепер має:

1. **Debounce активних jobs**: не дозволяє запускати новий job якщо попередній у статусі `pending` або `running`
2. **Rate limiting**: мінімум 30 секунд між запусками jobs
3. **User-friendly помилки**: показує скільки секунд залишилося до наступного дозволеного запуску

```typescript
// Приклад використання
const { startTracking, currentJob } = useAvailabilityJob()

// Автоматично пропустить якщо job вже активний
await startTracking(jobId)
```

## Запуск тестів

### Smoke Tests

```bash
npm run e2e:smoke
```

Запускає тільки smoke tests (файли `*.smoke.spec.ts`).

### Всі E2E тести

```bash
npm run e2e
```

Запускає всі E2E тести включаючи smoke та full-e2e.

### Окремий тест

```bash
npx playwright test tests/e2e/availability-editor.spec.ts
```

### Debug режим

```bash
npx playwright test --debug
```

## Конфігурація

### Environment Variables

Створіть `.env.development` для локальної розробки:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
TEST_USER_EMAIL=m3@gmail.com
TEST_USER_PASSWORD=demo1234
```

### Playwright Config

`playwright.config.ts` налаштований на:
- **Global Setup**: автоматична авторизація
- **Storage State**: збереження auth state між тестами
- **Timeouts**: 30s для тестів, 5s для assertions
- **Retries**: 1 retry у CI, 0 локально
- **Workers**: 2 у CI, unlimited локально

## Troubleshooting

### 401 Unauthorized

**Причина**: Auth state застарів або відсутній

**Рішення**:
```bash
npm run bootstrap-auth
npm run e2e
```

### 404 Not Found (WebAuthn)

**Причина**: WebAuthn endpoints не мокані

**Рішення**: Переконайтесь що `setupWebAuthnMocks(page)` викликається у `beforeEach`

### 429 Too Many Requests

**Причина**: Занадто часті health checks або availability jobs

**Рішення**: 
- Health polling тепер автоматично обмежений
- Availability jobs мають 30-секундний debounce
- Якщо проблема залишається, перезапустіть backend

### ECONNREFUSED

**Причина**: Backend не запущений

**Рішення**:
```bash
# У окремому терміналі
cd d:\m4sh_v1\backend
python manage.py runserver
```

## Best Practices

1. **Завжди запускайте backend** перед E2E тестами
2. **Не hardcode credentials** у тестах - використовуйте env variables
3. **Використовуйте WebAuthn моки** для тестів що не потребують реального WebAuthn
4. **Перевіряйте auth state** якщо тести падають з 401
5. **Дотримуйтесь rate limits** - не викликайте API занадто часто

## Workflow

Рекомендований workflow для розробки з E2E тестами:

```bash
# 1. Запустити backend
cd d:\m4sh_v1\backend
python manage.py runserver

# 2. У новому терміналі - frontend dev server
cd d:\m4sh_v1\frontend
npm run dev

# 3. У третьому терміналі - E2E тести
cd d:\m4sh_v1\frontend
npm run e2e:smoke  # або npm run e2e для всіх тестів
```

## Додаткові ресурси

- [Playwright Documentation](https://playwright.dev/)
- [API Contract v0.49.5](../backend/docs/plan/v0.49.5/API_CONTRACT_v0495.md)
- [Implementation Report v0.49.5](./zvit/v0.49.5/IMPLEMENTATION_REPORT_v0495.md)
