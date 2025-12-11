B5.1 — API «Мій профіль» (student/tutor)

Ціль: щоб фронт міг показати/редагувати профіль користувача в одному місці (dashboard/profile).

1) Моделі / серіалізатори

Використати існуючі:

User (apps.users)

TutorProfile / StudentProfile (ти їх вже маєш — видно по tutorprofile_profile, studentprofile_profile в dir()).

UserSettings / Settings (атрибут settings на User).

Створити/оновити DRF-серіалізатори, наприклад:

UserProfileSerializer (базові поля):

first_name, last_name, full_name, email (read-only), timezone, role, is_self_learning.

TutorProfileSerializer:

bio, subjects, hourly_rate, experience_years, is_public.

StudentProfileSerializer:

grade, preferred_subjects, goal (NMT, school, etc).

UserSettingsSerializer:

locale, ui_theme, notifications_email, notifications_push і т.п.

2) Ендпоінти

В окремому файлі, наприклад apps.users.api.views_profile.py:

GET /api/me/profile/

Повертає:

{
  "user": {...},
  "tutor_profile": {...} | null,
  "student_profile": {...} | null,
  "settings": {...}
}


PATCH /api/me/profile/

Приймає часткове оновлення:

{
  "user": { "first_name": "...", "timezone": "Europe/Kyiv" },
  "tutor_profile": { "bio": "...", "subjects": ["math"] },
  "student_profile": { "grade": 10 },
  "settings": { "locale": "uk", "ui_theme": "dark" }
}


Оновлює тільки ті частини, які присутні в тілі.

3) Доступ / права

Тільки IsAuthenticated.

Операції завжди над request.user (жодних id у URL).

4) Тести

Тест на GET /api/me/profile/ для:

студента (із student_profile),

тьютора (з tutor_profile),

superadmin (без специфічного профілю, але з settings).

Тест на PATCH:

зміна імені;

зміна is_self_learning заборонена через цей ендпоінт (якщо ми хочемо це контролювати через бізнес-логіку, а не руками).

B5.2 — Скелет для «тестів» (курси/теми/тести) — тільки читання

Ціль: дати фронту read-only ендпоінти для списку курсів/тем/тестів без глибокої логіки перевірки.

1) Моделі (якщо ще нема)

У apps.courses або apps.tests:

Course:

id, title, description, subject, level (наприклад, 8_class, NMT).

Topic:

id, course, title, order.

TestTemplate:

id, topic, title, description, max_score, is_published.

(Поки без Question/Answer, це можна винести на v0.6–0.7.)

2) Ендпоінти

Наприклад, apps.courses.api.views:

GET /api/courses/

Список курсів.

GET /api/courses/<id>/topics/

Теми курсу.

GET /api/tests/ (фільтр по course/topic):

?course=<id>, ?topic=<id>.

3) Доступ

IsAuthenticated (поки що усі ролі можуть читати).

Пізніше можна додати ролі/права на рівні курсу.

B5.3 — «Дошки» / BoardSession — бекенд-заглушка

Ціль: підготувати просту бекенд-модель, куди фронт зможе зберігати стан дошки (поки без realtime/socket).

1) Модель

У apps.boards.models:

BoardSession:

id

classroom (FK на Classroom, nullable, щоб можна було приватну дошку тьютора/студента)

owner (FK на User)

title (наприклад, "Алгебра, тема 3")

state (JSONField) — сирцевий стан дошки з фронта

created_at, updated_at

2) Ендпоінти

У apps.boards.api.views:

GET /api/boards/ — список доступних дошок користувача:

фільтр: ?classroom=<id>.

POST /api/boards/:

{
  "title": "Алгебра 8 клас · Тема 2",
  "classroom_id": 10,
  "state": { ... }   // JSON від фронту
}


GET /api/boards/<id>/

PATCH /api/boards/<id>/ — оновити title/state.

(опційно) DELETE /api/boards/<id>/.

3) Права

Тільки власник або тьютор класу (якщо прив’язана до classroom) може читати/оновлювати.

Студенти класу — read-only, якщо дошка прив’язана до класу.

B5.4 — Мінімальний чат по класу (Classroom Chat)

Ціль: зробити простий «чат по класу», який потім можна буде обгорнути socket’ами, але API вже буде стабільне.

1) Модель

У apps.chat.models:

ClassroomMessage:

id

classroom (FK)

sender (FK User)

text (TextField)

created_at

(опційно) message_type ("text" | "system")

2) Ендпоінти

У apps.chat.api.views:

GET /api/classrooms/<id>/messages/

Параметри:

?limit=50

?before=<message_id> / ?after=<message_id> (простий пагінг).

POST /api/classrooms/<id>/messages/

{ "text": "Привіт, завтра буде дз?" }

3) Права

Доступ мають:

classroom.tutor,

active студенти з ClassroomMembership.

POST:

перевірити, що request.user належить classroom.

B5.5 — Адмінські вьюхи/ендпоінти для «модератора» (під майбутню адмінку)

Ціль: мати технічний фундамент, щоб потім накласти UI-адмінку (React/Vue окремо або Django admin/DRF UI).

1) Перевірити та допиляти ролі

У User.Role:

переконатись, що є SUPERADMIN / ADMIN / TUTOR / STUDENT.

Додати DRF-пермісію типу IsAdminOrReadOnly / IsSuperAdmin.

2) Ендпоінти (тільки для admin/superadmin)

У, наприклад, apps.adminpanel.api.views:

GET /api/admin/users/ (мінімальний список з фільтрами: ?role=tutor).

GET /api/admin/classrooms/ (перегляд усіх класів, не тільки свого).

GET /api/admin/stats/:

{
  "users_total": 123,
  "students_total": 80,
  "tutors_total": 10,
  "classrooms_total": 15
}


Поки без редагування — просто read-only огляд для майбутньої адмінки.

B5.6 — Технічний борг: тести, документація, демо-дані

Ціль: закріпити те, що зробили у v0.4–0.5, щоб потім не боліло.

1) Unit/Integration тести

Покрити тестами:

/api/me/profile/ (B5.1),

/api/tutor/classrooms/ та /api/tutor/classrooms/<id>/ (з v0.4),

/api/boards/ (B5.3),

/api/classrooms/<id>/messages/ (B5.4).

2) Management-команда з демо-даними

У apps.core.management.commands.seed_demo:

Створити:

2–3 тьюторів (public),

5–10 студентів,

1–2 класруми з membership’ами,

одну-дві дошки BoardSession,

кілька повідомлень у чаті.

Команда:

python manage.py seed_demo

3) Оновити документацію / Swagger

Додати/оновити опис:

/api/me/profile/

/api/courses/, /api/courses/<id>/topics/, /api/tests/

/api/boards/…

/api/classrooms/<id>/messages/…