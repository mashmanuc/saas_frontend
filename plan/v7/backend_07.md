Backend v0.7 — Technical Specification (згідно Технічного Маніфесту MASH)

Версія: v0.7.0 — Marketplace + Activity 2.0 + Profile Snapshots

Це офіційне ТЗ для бекендника, яке можна без змін вішати в GitHub Issues / Wiki / Jira.

🔵 0. Архітектурні принципи, яких треба дотримуватися

(коротко — на основі маніфесту)

SRP: кожен модуль відповідає за одну доменну зону.

UPM (Unified Profile Model): профіль має єдину точку правди.

Extensibility First: кожен API має бути розширюваним.

Event-driven backend: будь-яка зміна сутності → подія Activity.

Namespaces apps.profile, apps.analytics, apps.marketplace.

Backward compatibility: існуючі фронтенд-контракти не ламаємо.

🟩 1. Marketplace Backend (новий модуль apps.marketplace)
🎯 Мета:

Дати можливість студентам переглядати публічні профілі тьюторів.
Побудувати базу для майбутніх фільтрів, рейтингу і монетизації.

1.1. Створити новий app: apps.marketplace

Структура:

apps/marketplace/
    models.py
    services/
       search.py
    serializers.py
    views.py
    urls.py
    filters.py

1.2. Додати поле для публічності профілю (розширення UPM)

У UserSettings v2 додати:

public_profile_enabled = BooleanField(default=True)
hourly_rate = PositiveIntegerField(null=True, blank=True)
experience_years = PositiveIntegerField(null=True, blank=True)
headline = CharField(max_length=120, blank=True)
bio = TextField(blank=True)
subjects = ArrayField(CharField(...))
certifications = ArrayField(CharField(...), default=list)


👉 Ці поля НЕ впливають на приватні дані й не ламають UPM.

1.3. API для marketplace
GET /api/marketplace/tutors/

Повертає список тьюторів, які:

активні

мають public_profile_enabled = True

Підтримувані фільтри:

subject=math

price_min, price_max

experience_min

language=uk/en/pl

has_certifications=true

search=query (по headline/bio)

Реалізація через:

Django-filter

пошуковий сервіс marketplace_search()

1.4. API публічного профілю
GET /api/marketplace/tutors/<id>/

Повертає:

{
  "id": 12,
  "full_name": "...",
  "headline": "...",
  "bio": "...",
  "avatar_url": "...",
  "subjects": [...],
  "experience_years": 5,
  "hourly_rate": 350,
  "certifications": [...],
  "languages": [...],
  "rating": 4.8, (майбутнє)
  "reviews_count": 12, (майбутнє)
}

🟧 2. ActivityLog 2.0 (apps.analytics)
🎯 Мета:

Зробити повноцінний канал аналітики подій + підготовку до realtime feed.

2.1. Додати cursor pagination у /api/me/activity/

Потрібно:

замінити limit/before/after на cursor-based pagination

підтримати:

cursor

page_size

action

entity_type

Алгоритм: Django CursorPagination з ordering (-timestamp, id).

2.2. Нові події для marketplace

При кожній дії юзера:

Подія	Коли спрацьовує
marketplace.search	GET marketplace/tutors/?query=…
profile.viewed	Студент переглядає публічний профіль тьютора
marketplace.filter.applied	Коли застосовано фільтр
marketplace.sort.changed	Якщо додамо сортування

Metadata:

{
  "action": "marketplace.search",
  "query": "math tutor",
  "filters": {...},
  "result_count": 128
}

2.3. Підтримка undo / snapshots

Для PATCH /api/me/profile/ додати:

snapshot_before = serializer.data


і логувати через:

activity.log(
    action="profile.snapshot",
    metadata={"before": snapshot_before}
)

2.4. Activity Trigger Endpoint (телеметрія)
POST /api/me/activity/trigger/

Фронт викликає його для lightweight-трекінгу кліків.

Передає:

{
  "action": "ui.click",
  "entity_type": "profile",
  "entity_id": null,
  "metadata": {"button": "save"}
}


Backend зберігає це у ActivityLog через activity.log().

🟩 3. Profile Autosave (apps.users)
🎯 Мета:

Впровадити UX автозбереження профілю.

3.1. Новий endpoint
PATCH /api/me/profile/autosave/

Повинен:

приймати часткові зміни профілю

НЕ впливати на валідність обов’язкових полів

писати ActivityLog: profile.autosave

повертати профіль зі штампом:

"autosaved_at": "2025-02-15T10:22:33Z"

3.2. Логіка autosave

Дозволяє зберігати draft

Не змінює published profile

Зберігається в окрему таблицю:

ProfileDraft
user = OneToOne
data = JSONField
updated_at

🟦 4. Privacy Layer v3
🎯 Мета:

Розділити приватний та публічний профіль.

Додати у UserSettings:
show_email_publicly = False
show_avatar_publicly = True
show_certifications_publicly = True
show_subjects_publicly = True
show_bio_publicly = True

При GET /api/marketplace/tutors/<id>/

враховувати приватність полів.

🟧 5. Seed + Demo Fixtures v0.7

Додати:

тьюторів з різними тарифами

кілька предметів

демонстраційні сертифікати

50 demo-дій у ActivityLog

демо-пошук marketplace

🟩 6. Swagger + Документація

Документація повинна включати:

схему MarketplaceTutorSerializer

приклади фільтрів

приклади пошуку

приклад події profile.snapshot

опис autosave endpoint

🟦 7. Тести (обов'язково)
Marketplace:

фільтри

пошук

приватність

публічний профіль

Activity:

cursor pagination

snapshot

trigger

Profile draft:

autosave

validate merge