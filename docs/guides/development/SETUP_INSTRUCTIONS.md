# Інструкції для запуску фронтенду з Accept Availability Badge

## Що було виправлено

1. **API Proxy налаштування** — видалено `VITE_API_BASE_URL` з `.env` та `.env.development`, щоб використовувався Vite proxy з `vite.config.js`
2. **Навігація на дашборді** — додано помітний блок з посиланням на сторінку inquiries у `DashboardTutor.vue`
3. **Accept Availability Badge** — новий компонент показує кількість доступних accept'ів на `/tutor/inquiries`

## Як запустити

### 1. Перезапустіть frontend dev сервер

```bash
# Зупиніть поточний процес (Ctrl+C)
# Потім запустіть знову:
cd D:\m4sh_v1\frontend
npm run dev
```

**ВАЖЛИВО:** Після зміни `.env` файлів потрібен повний перезапуск Vite.

### 2. Переконайтеся що backend працює

```bash
# В окремому терміналі:
cd D:\m4sh_v1\backend
.venv\Scripts\activate
python manage.py runserver 127.0.0.1:8000
```

### 3. Перевірте що proxy працює

Відкрийте DevTools → Network і перевірте запити:

- ✅ `GET http://localhost:5173/api/tutor/accept-availability/` → має проксуватися на `http://127.0.0.1:8000/api/tutor/accept-availability/`
- ✅ Статус має бути `200 OK`, а не `404` чи `429`

## Де знайти Accept Availability Badge

### Варіант 1: Через дашборд (НОВИЙ спосіб)

1. Відкрийте `http://localhost:5173/dashboard`
2. Побачите помітний блок з синьою рамкою **"Запити від студентів"**
3. Натисніть кнопку **"Переглянути запити"**
4. Відкриється `/tutor/inquiries` з бейджем у верхній частині

### Варіант 2: Прямий URL

1. Відкрийте `http://localhost:5173/tutor/inquiries`
2. У верхній частині сторінки (під заголовком) побачите бейдж з кількістю accepts

## Що показує бейдж

- **Зелений** — більше 2 accepts доступно
- **Жовтий** — 1-2 accepts доступно
- **Червоний** — 0 accepts доступно

**Текст:** тільки число, наприклад "3 accepts available"

❌ **НЕ показує:** trial/billing/onboarding, причини, джерела

## Troubleshooting

### Проблема: 404 на /api/tutor/accept-availability/

**Причина:** Backend endpoint не існує або не запущений

**Рішення:**
```bash
# Перевірте що endpoint існує:
curl http://127.0.0.1:8000/api/tutor/accept-availability/

# Якщо 404 — потрібно додати endpoint на бекенді
```

### Проблема: 429 Too Many Requests

**Причина:** Запити йдуть на Vite dev server замість бекенду

**Рішення:**
1. Перевірте що `.env` та `.env.development` НЕ містять `VITE_API_BASE_URL`
2. Перезапустіть `npm run dev`
3. Перевірте `vite.config.js` — має бути proxy для `/api`

### Проблема: Бейдж не з'являється

**Причина:** API не повертає дані або помилка в консолі

**Рішення:**
1. Відкрийте DevTools → Console
2. Подивіться чи є помилки
3. Перевірте Network → `/api/tutor/accept-availability/` — має бути 200 OK
4. Якщо 401 — потрібно залогінитися як тьютор

## API Contract

### GET /api/tutor/accept-availability/

**Response:**
```json
{
  "can_accept": true,
  "remaining_accepts": 3,
  "grace_token": "eyJ...",
  "expires_at": "2026-02-02T12:00:45Z"
}
```

### POST /api/inquiries/:id/accept/

**Request:**
```json
{
  "grace_token": "eyJ..." // optional
}
```

**Response:**
```json
{
  "inquiry_id": "123",
  "status": "accepted",
  "accepted_at": "2026-02-02T12:00:00Z"
}
```

## Файли що були змінені

1. `.env` — видалено `VITE_API_BASE_URL`
2. `.env.development` — видалено `VITE_API_BASE_URL`
3. `src/modules/dashboard/views/DashboardTutor.vue` — додано блок з посиланням на inquiries

## Файли що були створені раніше

1. `src/types/acceptance.ts` — TypeScript types
2. `src/api/acceptance.ts` — API layer
3. `src/stores/acceptanceStore.ts` — Pinia store
4. `src/composables/useInquiryAccept.ts` — Accept flow composable
5. `src/components/acceptance/AcceptAvailabilityBadge.vue` — UI badge
6. Unit tests + E2E tests

---

**Дата:** 2026-02-02  
**Версія:** v0.70.0 (Acceptance Integration)
