ОФІЦІЙНІ ТЕХНІЧНІ ВИМОГИ v0.9.0 (В НАКАЗОВІЙ ФОРМІ)

Цей документ визначає, що саме фронтенд ОБОВ’ЯЗКОВО має реалізувати у v0.9.0.

1. Relations Dashboard v3 — РЕАЛІЗУВАТИ БЕЗ ВІДХИЛЕНЬ
1.1. Реалізувати підтримку бекенд-контракту:

Фронтенд ЗОБОВ’ЯЗАНИЙ використовувати такі ендпоінти:

GET    /api/tutor/relations/?status=all|invited|active|archived
POST   /api/tutor/relations/batch/accept/
POST   /api/tutor/relations/batch/archive/

1.2. Обробляти та відображати ВСІ вхідні дані:

Поля, які ОБОВ’ЯЗКОВО мають бути у UI:

id

student { id, name, avatar, timezone }

status

invited_at, accepted_at

lesson_count

recent_activity

1.3. Реалізувати cursor-based пагінацію:

У store забезпечити:

results

cursor

has_more

loadMore()

1.4. Впровадити 3 пустих стани:

no invited

no active

no archived

1.5. Реалізувати повні error states:

offline

backend error

rate-limit

1.6. Забезпечити повну локалізацію:

Усі тексти вкладок, кнопок, помилок та empty states мають бути локалізовані (uk/en).

2. Lessons Module + Calendar — РЕАЛІЗУВАТИ ТАК, ЯК ЗАЗНАЧЕНО
2.1. Використовувати такі статуси уроків:

scheduled

completed

cancelled

2.2. Приймати від бекенда дати ТІЛЬКИ у UTC:

Фронтенд МАЄ конвертувати час у timezone користувача.

2.3. Реалізувати такі дії КАЛЕНДАРЯ:

Створення уроку
→ POST /api/lessons/

Перенесення уроку (drag-drop, resize)
→ PATCH /api/lessons/{id}/reschedule/

Скасування уроку
→ POST /api/lessons/{id}/cancel/

2.4. Реалізувати polling:

Фронтенд МАЄ оновлювати календар кожні 30 секунд.
WebSocket буде в v0.10.

2.5. Recurring lessons НЕ реалізовувати.

Це пряма заборона на v0.9.0.

3. Marketplace Upgrade — ВИКОНАТИ ЗА KPI
3.1. Забезпечити такі показники:

максимальний час відповіді API — ≤ 120 ms

клієнтський кеш стору — 10 хвилин

3.2. Реалізувати централізований кеш у Pinia:

Єдиний ключ:

marketplace:list:{filters_hash}

3.3. Додати інвалюдацію кешу при:

зміні профілю тьютора

зміні ціни

зміні headline

3.4. Додати unit-тести:

пагінація

сорти

offline state

3.5. E2E переноситься у v0.10 — не виконувати.
4. Theme QA — ВИКОНАТИ АУДИТ ЗГІДНО ФОРМАТУ
4.1. Створити чекліст (обов’язковий пакет):

15 компонентів × 3 теми:

Button (усі стани)

Input (усі стани)

Card

Modal

Badge

Table

Dropdown

Tabs

Pagination

Alert

Tooltip

Avatar

Skeleton

Tag

Menu

4.2. Для кожного — створити два скріни:

screenshot-before

screenshot-after

4.3. Кожна проблема → статус:

pass

fail

note

4.4. Зберігати матеріали тут:
/docs/ui/theme-audit/v0.9/

4.5. Інструмент:

Manual QA + Dev Playground. Percy / Chromatic не використовувати.

5. Dev Theme Playground — РЕАЛІЗУВАТИ СТОРІНКУ /dev/theme
5.1. Обов’язкові компоненти Playground:

Button (всі варіанти та стани)

Input (норма, помилка, успіх)

Card

Modal

Badge

Table (з hover)

Select

Alert

5.2. Сторінка має:

перемикач тем (3 теми)

показувати реальні production tokens

6. E2E Smoke Tests — ВИКОНАТИ СТРУКТУРУ ТА ПІДГОТОВКУ
6.1. Стек: Playwright
6.2. Середовища:

локальне

staging

6.3. Підготувати тестові сценарії:

login → dashboard (student)

login → dashboard (tutor)

relations invited → accept → active

create lesson → reschedule → cancel

6.4. Обов’язково використовувати seed:
seed_demo_v9

6.5. Реальні тести виконуватимуться у v0.10.

Зараз — ПІДГОТОВКА структури.