1. Relations Dashboard API v3 — остаточний контракт
1.1. Пагінація

Так — потрібна cursor-пагінація як для списку students, так і для recent_actions.

Формат:

results: […]
cursor: "opaque-string"
has_more: true/false

1.2. Масові дії (bulk accept/archive)

Ми фіксуємо частковий успіх:

POST /api/tutor/relations/batch/accept/

{
  "ids": [1,2,3]
}

→

{
  "processed": [1,2],
  "failed": [
    { "id": 3, "error": "already active" }
  ]
}

1.3. Audit Log

Так — створюємо окрему модель:

RelationStatusLog:
  id
  relation_id (index)
  prev_status
  new_status
  actor_id
  timestamp (index)
  metadata (JSONField)


Це потрібно для майбутнього аналітичного модуля та timeline студента.

2. Lessons & Scheduling — остаточні вимоги
2.1. Зони часу

Усі значення зберігаємо в UTC.

На відповідь фронту повертаємо:

utc_start
utc_end
user_local_start
user_local_end
timezone


Фронт використовує timezone з профілю користувача.

2.2. Майбутня підтримка повторюваних уроків

У v0.9.0 повторюваних занять немає, але:

у моделі уроку додаємо поле series_id = nullable (UUID)

BE поки не використовує, але структура готова для v1.1

Це дозволить не ламати міграції в майбутньому.

2.3. API календаря — фіксуємо
GET /api/lessons/my/?from=2025-01-01&to=2025-01-31&status=scheduled|completed|cancelled
POST /api/lessons/
PATCH /api/lessons/{id}/reschedule/
POST /api/lessons/{id}/cancel/

Ліміти:

max events у відповіді: 500

поведінка при overflow: has_more_events: true

3. Marketplace Performance — остаточна політика
3.1. Інвалідація кешу

Кеш відноситься до ключа:

marketplace:list:{filters_hash}


Кеш очищається при:

зміні профілю тьютора (headline, price, subjects…)

зміні availability

створенні або архівуванні relations (опціонально — врахуємо в v1.0)

3.2. Телеметрія

Логи часу виконання необхідні.

Мінімальний набір:

metric: marketplace_query_duration_ms
metric: marketplace_cache_hit
metric: marketplace_cache_miss
metric: marketplace_result_count


Зберігаємо:

локально — у DB таблицю MarketplaceMetrics

у production — у Prometheus (готові підключити)

Threshold:

150ms (miss) → warning

300ms → error-level log

4. Autosave Diff Endpoint — формальний контракт
4.1. Вхід

Фронт НЕ надсилає локальний snapshot.

BE сам порівнює:

autosave_blob vs persisted_profile

4.2. Вихід
GET /api/me/profile/autosave/diff/

{
  "dirty": [
      "headline",
      "description",
      "settings.hourly_rate",
      "settings.subjects[2]"
  ]
}

4.3. Глибина diff

допускається глибина до 3 рівнів вкладеності

масиви вважаються dirty повністю при будь-якій зміні

5. Coverage — остаточні вимоги

Ми фіксуємо мінімальні пороги:

apps/users → 70%

apps/lessons → 70%

apps/marketplace → 60%

integration tests → обов’язковий покривний набір (5–7 сценаріїв)

Тестовий стек:

Django TestCase + pytest над важкими сценаріями

уроки / календар — тестування API (створення, перенос, відміна)

relations / bulk actions — edge cases (конкурентність, часткові помилки)

6. Acceptance Criteria — фінальна фіксація

Кожен endpoint у v0.9.0 повинен мати:

✔ повний опис request/response
✔ приклади (3 мінімум: success / validation error / forbidden state)
✔ edge cases (rate-limit, conflict, expired, foreign ownership…)
✔ мінімальний load-тест (10–30 одночасних запитів)
✔ покриття тестами
✔ логування у structured JSON

Після цього endpoint вважається “готовим до інтеграції”.



<!-- ************************************************************************************* -->
Створюємо новий застосунок apps.lessons

Причини:

Уроки — це окремий домен, який буде працювати не лише в classroom, а й у marketplace, аналітиці, історії навчання.

Уроки можуть існувати поза Classroom: приватні уроки, групові уроки, корпоративні, серії уроків.

Модуль стане базою для:

календаря

історії уроків

lesson series (v0.10+)

lesson recordings

sync з realtime module

Тому — новий модуль.

2️⃣ Модель розміщуємо в apps/lessons/models.py
class Lesson(models.Model):
    tutor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="lessons_as_tutor")
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="lessons_as_student")
    status = models.CharField(choices=LessonStatus.choices, default=LessonStatus.SCHEDULED)
    start = models.DateTimeField()
    end = models.DateTimeField()
    series_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


Усі часи зберігаються в UTC.

3️⃣ API реєструємо окремо: apps/lessons/api/urls.py

Підтримуємо контракт, який фронт уже отримав:

POST /api/lessons/

— створення уроку

PATCH /api/lessons/{id}/reschedule/

— перенесення уроку (drag-drop у календарі)

POST /api/lessons/{id}/cancel/

— скасування уроку

GET /api/lessons/my/?role=tutor|student&start=...&end=...

— список уроків у діапазоні для календаря

4️⃣ НІЧОГО не додаємо до apps.classrooms

Classroom займається процесом уроку (чат, дошка, матеріали).

Lessons — коли, з ким, який статус.

Ці модулі пов’язані, але НЕ змішуються.

У майбутньому:

Lesson → може створювати ClassroomSession

ClassroomSession → лінкується назад через lesson_id

5️⃣ Namespaces і структура URL
/api/lessons/...
namespace="lessons"


Фронт повністю прив’язується до нового namespace.