### 1.6.1 ActivityLog (BE‑620 … BE‑626)

#### Модель `ActivityLog`

| Поле        | Тип                 | Опис                                      |
|-------------|---------------------|-------------------------------------------|
| `id`        | UUID (primary key)  | Ідентифікатор запису                      |
| `user`      | FK → `users.User`   | Користувач, якого стосується подія (може бути `null` для системних) |
| `action`    | `CharField(100)`    | Код події                                 |
| `entity_type` | `CharField(100)`  | Тип сутності (`profile`, `avatar`, `system`…) |
| `entity_id` | `CharField(64)`     | Ідентифікатор сутності (user id, avatar id) |
| `metadata`  | `JSONField`         | Додаткові дані                            |
| `timestamp` | `DateTime`          | `auto_now_add=True`                       |
| `ip_address`| `GenericIPAddressField` | IP клієнта (якщо є `request`)         |
| `user_agent`| `TextField`         | User-Agent                                |

#### Каталог подій (поточний v0.6)

| Група      | Подія              | Коли виникає                                           |
|------------|--------------------|--------------------------------------------------------|
| Профіль    | `profile.updated`  | PATCH `/api/me/profile/` (user/tutor/student diff)     |
| Профіль    | `settings.updated` | PATCH `/api/me/profile/` (секція settings)             |
| Аватар     | `avatar.uploaded`  | POST `/api/me/avatar/`                                 |
| Аватар     | `avatar.deleted`   | DELETE `/api/me/avatar/`                               |
| Системні   | `system.login`     | seed_demo (приклад логіну)                             |
| Системні   | `system.profile.initialized` | seed_demo (початковий профіль)              |

> У майбутніх релізах можна додати `profile.snapshot`/`profile.undo`, але у v0.6 ці події ще не генеруються.

#### GET `/api/me/activity/`

**Параметри запиту**

| Параметр | Тип    | Опис                                               |
|----------|--------|----------------------------------------------------|
| `limit`  | int    | Макс. кількість записів (1…100, дефолт 50)         |
| `before` | ISO8601 timestamp | Повернути записи з `timestamp < before` |
| `after`  | ISO8601 timestamp | Повернути записи з `timestamp > after`  |
| `action` | str    | Фільтр за кодом події (наприклад `avatar.deleted`) |

**Приклад відповіді**

```json
[
  {
    "id": "9c1f532b-9a3d-4b13-8af5-41c8ac0a8450",
    "action": "profile.updated",
    "entity_type": "profile",
    "entity_id": "42",
    "metadata": { "changed": ["first_name", "timezone"] },
    "timestamp": "2025-01-12T10:15:32Z",
    "ip_address": "192.168.1.10",
    "user_agent": "Mozilla/5.0"
  },
  {
    "id": "cfa1c628-69ad-4e25-93c1-e6d2b38dcd11",
    "action": "avatar.uploaded",
    "entity_type": "avatar",
    "entity_id": "42",
    "metadata": { "file_size": 321415 },
    "timestamp": "2025-01-12T10:04:11Z",
    "ip_address": "192.168.1.10",
    "user_agent": "Mozilla/5.0"
  }
]
```

#### Приклади логів для PATCH /profile/ та POST/DELETE /avatar/

```json
{
  "action": "profile.updated",
  "entity_type": "profile",
  "entity_id": 42,
  "metadata": {
    "changes": {
      "user": {
        "old": { "first_name": "Alex" },
        "new": { "first_name": "Oleksandr" }
      },
      "tutor_profile": { ... }
    }
  }
}
```

```json
{
  "action": "settings.updated",
  "entity_type": "settings",
  "entity_id": 42,
  "metadata": {
    "before": { "timezone": "UTC" },
    "after": { "timezone": "Europe/Kyiv" }
  }
}
```

```json
{
  "action": "avatar.uploaded",
  "entity_type": "avatar",
  "entity_id": 42,
  "metadata": {
    "avatar_url": "/media/avatars/2025/01/user42.png",
    "file_size": 123456
  }
}
```

```json
{
  "action": "avatar.deleted",
  "entity_type": "avatar",
  "entity_id": 42,
  "metadata": {
    "previous_url": "/media/avatars/2024/12/user42.png"
  }
}
```
Затверджений архітектурний план із внесеними правками бекенда.
🟥 0. Архітектурний фокус

Створити універсальний профільний модуль (UPM), який стане базою для marketplace, ролей, організацій, психологів і мобільних додатків.

🟦## 1. BACKEND v0.6 — Доповнений і деталізований план

1.1. Media / Storage інфраструктура (НОВИЙ ПУНКТ)
Що робимо:

Додаємо в settings.py:

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


Додаємо вимогу у requirements: Pillow

Плануємо інтерфейс для майбутнього CDN/S3:

DEFAULT_FILE_STORAGE → локально,

але структура папок будується так, щоб легко перейти на S3/R2.

Мета:

Стабільна, передбачувана, переносима система медіафайлів, що стане основою не лише для аватарів, а й для уроків, дошок, прикріплених файлів, відео, матеріалів.

### 1.2. AbstractProfile + TutorProfile + StudentProfile
Додаємо обов’язково:

поле profile_type = "tutor" | "student"

валідатори списків (subjects), headline, bio

Мета:

Фронт не вгадує тип профілю, а читає його з API.

### 1.3. Аватари — уточнення бекендника
Ендпоінти:
POST /api/me/avatar/      # multipart/form-data { avatar: File }
DELETE /api/me/avatar/

Swagger:

приклади multipart форм

приклади відповідей з avatar_url

notifications_enabled

privacy_public_profile

Валідація:

timezone — must be valid pytz key

ui_language — вибір з підтримуваних мов

privacy_public_profile — bool

1.5. Patch-валідація профілю
Чітко прописуємо:

email → read-only

role → read-only

is_self_learning → read-only

subjects → список із перевіркою

headline → max 120 символів

bio → max N символів (наприклад 2000)

Мета:

Унеможливити майбутні проблеми в marketplace.

1.6. Сумісність із існуючими даними (НОВА ВИМОГА)

Усі існуючі записи повинні отримати:

default timezone

default privacy_public_profile=False

default notifications_enabled=True

Міграції додають дефолти автоматично.

Мета:

Платформа працює стабільно навіть із старими БД.

1.7. Контракт /api/me/profile/ — дедлайн перед злиттям

Бекенд дає:

mock JSON контракт (profile.json)

MR зі змінами, але НЕ зливає, поки фронт не зробить адаптацію

Мета:

Жодних падінь SPA після бекендівських змін.

BE-620 — Створити модель ActivityLog

У apps.core або apps.analytics (краще новий домен).

Структура:
ActivityLog:
  id (UUID)
  user (ForeignKey User, null=True для системних подій)
  action (CharField, max_length=100)
  entity_type (CharField)
  entity_id (IntegerField / UUIDField / TextField) 
  metadata (JSONField)
  timestamp (DateTime, auto_now_add=True)
  ip_address (GenericIPAddressField, null=True)
  user_agent (TextField)

Мета:

Базова таблиця для всіх подій системи.

🔵 BE-621 — Реалізувати сервіс activity.log()

Створити файл:

apps.analytics.services.activity.py


Метод:

def log(user, action, entity_type=None, entity_id=None, metadata=None, request=None)

Мета:

Уніфікований спосіб запису подій з будь-якого місця.

🔵 BE-622 — Додавання логування у Profile API

Події:

1. PATCH /api/me/profile/

action: "profile.updated"

entity_type: "profile"

entity_id: user.id

metadata:

поля, які змінено

2. POST /api/me/avatar/

action: "avatar.uploaded"

3. DELETE /api/me/avatar/

action: "avatar.deleted"

4. PATCH /api/me/settings/

action: "settings.updated"

metadata:

нові значення

старі значення (опціонально)

🔵 BE-623 — Автоматичне логування IP та User-Agent

У servicе:

request.META["REMOTE_ADDR"]

request.headers["User-Agent"]

Мета:

Підготовка до безпеки, analytics, antifraud, GDPR.

🔵 BE-624 — Створити DRF endpoint для перегляду власних логів

GET /api/me/activity/

Фільтри:

limit

before

after

action

Мета:

У майбутньому це стане основою для learning progress + приватної аналітики.

🔵 BE-625 — Swagger документація

Описати:

структуру ActivityLog

приклади

логовані події

параметри /api/me/activity/

🔵 BE-626 — Оновлення seed_demo

Додати:

хоча б 5 логів на користувача (profile updated, login, invite etc.)

settings поля за замовчуванням

Мета:

Фронтенд може бачити приклади у staging.