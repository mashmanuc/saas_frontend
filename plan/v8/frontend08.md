FRONTEND v0.8.0 — TECHNICAL SPECIFICATION
0. Overview

Фокус на:

UX студент ↔ тьютор

autosave профілю

marketplace stability

правильна обробка всіх нових BE endpoint

підтримка 3 глобальних тем

1. Relations UI
1.1 Student dashboard

Показувати 3 стани:

(1) Немає тьютора
Тьютор не призначений


CTA:

“Знайти тьютора” → marketplace

(2) invited

Card:

Вас запросив тьютор
[імʼя]  
[аватар]  
Кнопки: Прийняти / Відхилити

(3) active

Показувати:

профіль тьютора

CTA “Написати повідомлення”

CTA “Перейти до уроків” (календар)

2. Tutor dashboard

Список студентів з фільтром:

invited

active

На invited:

кнопка “Повторити запрошення”

кнопка “Скасувати”

3. Autosave Profile
Функціонал:

debounce 800–1000 мс

відображення статусів:

“Зміни не збережено”

“Збереження…”

“Чернетка збережена о 14:32”

“Помилка збереження”

Вимоги:

поля редагування мають оновлювати store

autosave працює лише по dirty-полям

при відкритті сторінки:

якщо є draft → показати діалог:

Виявлено чернетку. Відновити?

4. Marketplace
4.1. Новий формат пагінації

store зберігає:

results[]
cursor
hasMore
filters

4.2. Покращити UX:

error state

offline state

skeleton loading

debounce search 300 ms

запам’ятовувати останній стан сторінки (memory cache 10 хв)

5. Themes QA

Пройти всі компоненти в 3 темах:

Primary Button

Secondary Button

Card

Modal

Input

Badge

Table

Перевірити:

контрастність

тіні

кольори border

hover/active

6. Dev Playground

Створити сторінку:

/dev/theme


Відображає:

кнопку

інпут

картку

бейдж

таблицю

З перемикачем тем.

7. Документація

Додати до /docs/frontend/v0.8.md:

опис нових endpoint

приклади payload

діаграми UX flow

інструкцію з тестування тем