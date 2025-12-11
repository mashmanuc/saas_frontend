1. Реалізувати Notifications Engine (обов’язково)
1.1. Створити застосунок apps.notifications.
1.2. Створити модель Notification:

id (UUID)

user (FK)

type (str, max 50)

payload (JSON)

read_at (datetime, null=True)

created_at (datetime)

1.3. Реалізувати API:

GET /api/notifications/ — список користувача, курсорна пагінація

POST /api/notifications/internal/ — внутрішній сервісний хук для створення нотифікацій

1.4. Тригери нотифікацій (виконати):

створення уроку

перенесення уроку

скасування уроку

прийняття тьютора

запрошення студента

1.5. Тести:

створення

отримання

маркування прочитаним

2. Реалізувати Audit Log v2 (без варіантів)
2.1. Створити застосунок apps.audit.
2.2. Створити модель AuditEvent:

id

user

action (string, обов’язково)

entity_type (string)

entity_id (UUID/string)

metadata (JSON)

created_at

2.3. Реалізувати сервіс audit.log_event(user, action, entity, metadata={}).
2.4. Обов’язкові автоматичні логи:

login

logout

оновлення профілю

accept / decline / cancel relations

створення уроку

перенесення уроку

скасування уроку

2.5. API:

GET /api/audit/?action=&from=&to= — курсорна пагінація

3. Реалізувати Global Search API (однотипно, без уточнень)
3.1. Endpoint /api/search/?q=
3.2. У відповіді повернути 4 масиви:

users

tutors

lessons

topics

3.3. Реалізувати індексацію Postgres:

trigram index

GIN index

3.4. Тестувати:

порожній запит

часткові збіги

нечіткий пошук

4. Оптимізувати Lessons Calendar API (виконати повністю)
4.1. Додати індекси на:

(user_id, utc_start)

4.2. Змінити API /api/lessons/my/:

обов’язкові параметри: from, to

повертати тільки події в діапазоні

максимум 500 об’єктів

4.3. Додати has_more_events = true/false.
5. Реалізувати autosave cleanup (обов’язково)
5.1. Створити команду:
python manage.py cleanup_autosave --older-than=30

5.2. Видаляти autosave записи старше X днів.
6. Додати series_id до Lesson (без функціоналу repeating)
6.1. Додати поле:
series_id = UUIDField(null=True, blank=True)

6.2. Зберігати значення, не використовувати логіку повторень.
7. Реалізувати Student Progress API (обов’язково)
7.1. Створити модель:
StudentProgress:
    user
    lessons_total
    lessons_completed
    minutes_total
    updated_at

7.2. API:

GET /api/students/{id}/progress/

7.3. Розрахунок:

lessons_total = кількість уроків

lessons_completed = статус completed

minutes_total = сума (end - start)

8. Реалізувати Email Templates Renderer (не чекаючи v1.0)
8.1. Створити сервіс:
render_email(template_name, context)

8.2. Додати шаблони:

invite_student

tutor_accept

lesson_scheduled

8.3. Формат — Jinja2.