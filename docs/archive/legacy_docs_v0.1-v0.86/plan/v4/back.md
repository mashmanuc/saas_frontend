v0.4.0 — BACKEND PLAN (B-tasks)

Файл: docs/v0.4.0_backend_plan.md

# v0.4.0 — Backend Plan

## 🎯 Цілі версії
- Додати повний TutorProfile API (CRUD + public profile)
- Підготувати систему multiple relations (історіЯ репетиторів)
- Додати предмети (subjects) як окрему сутність
- Створити базовий модуль lessons
- Покращити /users/me/ (профіль + активний тьютор)

---

# 🟣 B1 — Tutor Profile API
Створити ендпоінти:

### GET /api/tutors/<id>/public-profile/
- дані:
  - id, full_name, timezone
  - bio, subjects, hourly_rate, country, rating
  - is_public

### GET /api/tutor/profile/
Приватний профіль тьютора.

### PATCH /api/tutor/profile/
Дозволити оновлення:
- bio
- subjects[]
- hourly_rate
- country
- timezone
- is_public

---

# 🟣 B2 — Student Profile API
### GET /api/student/profile/
Повертає:


user: { id, email, first_name, last_name, timezone }
active_tutor_relation: {...} або null
past_tutors: [... archived relations ...]
subjects: від активного тьютора


### PATCH /api/student/profile/
Дозволити:
- first_name
- last_name
- timezone

---

# 🟣 B3 — Relations v2 (історія)
Реалізувати soft-архівацію:

### PATCH /api/tutor/relation/<id>/archive/
- тьютор може архівувати зв’язок
- студент стає is_self_learning = true

Додати поля:
- archived_reason
- archived_at

---

# 🟣 B4 — Subjects Module
Ввести модель Subject:


Subject:
id
name_uk
name_en
code


Ендпоінти:
- GET /api/subjects/
- POST /api/subjects/ (для admin)
- PATCH /api/subjects/<id>/

Зв’язок:
- TutorProfile.subjects → ManyToMany
- Lesson.subject → FK

---

# 🟣 B5 — Lessons Module MVP
Моделі:


Lesson:
id
tutor
student
subject
title
start_at
duration
status


Ендпоінти:
- GET /api/lessons/
- GET /api/lessons/<id>/
- POST /api/lessons/
- PATCH /api/lessons/<id>/

---

# 🟣 B6 — Improve /users/me/
Додати:


active_tutor: {id, full_name} або null
subjects_from_tutor: [...]


---

# 🟣 B7 — OpenAPI / Документація
Оновити:
- TutorProfile API
- Student Profile API
- Lessons API
- Subjects API
- Relations v2
- /users/me/

---

# 📌 Підсумок бекенд-версії
v0.4.0 переносить платформу з рівня “репетитор + студент”  
на рівень “Освітня екосистема з профілями, предметами, уроками і історією”.