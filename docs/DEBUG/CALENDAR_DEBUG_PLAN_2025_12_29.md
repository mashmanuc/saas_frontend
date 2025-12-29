---
description: План діагностичного модуля календаря
---

# Діагностичний модуль календаря

## 1. Ціль та обсяг
- Зібрати фактичні payload'и, які ми отримуємо при завантаженні календаря (v0.55 snapshot, legacy week, event details, словники, metadata, websocket повідомлення).
- Надати швидкий візуальний спосіб переглянути ці дані у UI (вкладка/панель), а також можливість експортувати JSON для документації.
- Усе має бути ізольовано, щоб модуль можна було підключити/відключити однією точкою без зміни основної логіки.

## 2. Структура директорій
```
frontend/src/modules/booking/debug/
  ├── components/
  │   ├── CalendarDebugPanel.vue        // головна панель
  │   ├── SnapshotSection.vue           // відображення v0.55 snapshot
  │   ├── LegacySnapshotSection.vue     // дані legacy API
  │   ├── MetadataSection.vue           // meta/dictionaries + варта/статистика
  │   ├── LogsSection.vue               // історія запитів/консоль
  │   └── DebugToggleButton.vue         // кнопка відкриття панелі (для сайдбару)
  ├── composables/
  │   └── useCalendarDebugSnapshot.ts   // абстракція над store + дебагові стани
  ├── types/
  │   └── calendarDebug.ts              // інтерфейси для payload'ів і експорту
  └── index.ts                          // єдина точка експорту компонентів/тоглів
```

## 3. Джерела даних
1. **Pinia store `useCalendarWeekStore`**:
   - snapshot/meta/dictionaries/blockedRanges/events/accessible (v0.55)
   - legacy snapshot (`weekMeta`, `legacyDays`, `legacyMeta`, `eventsById`, `eventIdsByDay`, `accessibleIdsByDay`).
   - Потрібно додати у store допоміжні computed/APIs, що віддають "сирі" відповіді беку (наприклад, `lastFetchedSnapshotPayload`).
2. **API виклики**:
   - `calendarV055Api.getCalendarWeek`
   - `calendarWeekApi.getWeekSnapshot`
   - (опційно) `getEventDetails`, `reschedulePreview` — якщо потрібно відслідковувати під час тестів.
3. **WebSocket / Push** (другий етап): зберігати останні повідомлення, щоб бачити диф між snapshot та live-оновленнями.

## 4. UX / інтеграція
1. **Кнопка в боковому барі**:
   - `CalendarSidebar.vue` отримає проп `showDebugControls` (за замовчуванням `false`).
   - Якщо прапорець увімкнено (через `.env` або feature-flag у Pinia/LocalStorage), показуємо `DebugToggleButton`.
2. **Debug panel**:
   - Розташована у верхній частині `CalendarWeekView` або як drawer зліва/справа.
   - Має вкладки: "Snapshot", "Legacy", "Metadata", "Logs".
   - JSON виводимо у collapsible блоках з кнопкою `Copy / Download`.
3. **Відключення**:
   - Feature-flag `VITE_CALENDAR_DEBUG=true`. Якщо `false`, модуль не імпортується (tree-shaking, умовний `defineAsyncComponent`).
   - Для QA можна вручну викликати `window.__M4_DEBUG__.calendar.toggle()` (глобальний хук у dev оточенні).

## 5. Дані та формат
| Секція | Поля | Коментар |
| --- | --- | --- |
| Snapshot | meta, days, events, accessible, blockedRanges | показ diff між snapshot та live state |
| Legacy | week/meta/days/events/accessible | окремий блок для старого API |
| Dictionaries | noShowReasons, cancelReasons, blockReasons | додаємо timestamp оновлення |
| Raw request info | URL, query params, response headers (etag, cache status) | потрібні для бекенд команди |
| Logs | час запиту, статус (success/error), payload size | для діагностики продуктивності |

## 6. Безпека та продуктивність
- Дані лише для авторизованих користувачів (не виносити на публічні сторінки).
- У production приховано за flag'ом, щоб уникнути витоку приватних даних.
- Максимальний розмір відображуваного JSON (наприклад, 1MB) з попередженням.
- Вимкнення heavy-логів у production (тільки ручний тригер).

## 7. Кроки реалізації
1. **Store**: додати універсальний хук для збереження сирих відповідей (`recordSnapshotResponse(type, payload)`), який буде використовуватися лише в debug-режимі.
2. **Директорія `debug/`**: створити базові компоненти та типи.
3. **Компонент `CalendarDebugPanel`**: підключити до store через новий composable (`useCalendarDebugSnapshot`).
4. **Feature flag**: додати у `vite.config`/`.env` змінну `VITE_CALENDAR_DEBUG`. У `CalendarWeekView` імпортувати компонент умовно.
5. **Sidebar integration**: додати кнопку/іконку для відкриття панелі (працює тільки коли flag true).
6. **Документація**: описати в `frontend/docs/CALENDAR_DEBUG_PLAN_2025_12_29.md` (цей файл) і при необхідності додати README до директорії.

## 8. Backlog / наступні кроки
- Додати можливість зберігати snapshot в localStorage або скачувати JSON.
- Інтегрувати WebSocket log-viewer (події, які оновлюють календар без повного рефрешу).
- Додати diif-view між двома snapshot'ами, щоб бачити, що змінилося між тижнями.
- Прив'язати панель до QA-скриптів (наприклад, автоікспортувати дані при проходженні E2E тестів).
