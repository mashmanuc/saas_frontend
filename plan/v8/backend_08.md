ФІНАЛЬНЕ, КРИСТАЛІЧНО ЧІТКЕ ТЗ v0.8.0 (backend)

Це версія, яку вже НЕ МОЖНА трактувати по-різному.
Після цього ніхто не матиме питань.

0. ТЕХНІЧНИЙ СТАНДАРТ ДЛЯ v0.8.0

Усі зміни цього релізу — тільки для backend.
Фронтенд не здогадується, не інтерпретує — він отримує стабільні контракти.

1. RELATIONS v2 (ФІКСАЦІЯ СТАТУСІВ)
1.1. Можливі стани

none — зв’язку немає

invited — студенту надіслано запрошення

active — чинний тютор

archived — колишні тютори (історія)

❗ У студента може бути тільки 1 active тьютор.

1.2. API-ендпоінти (фінальна версія)
✔ Прийняти запрошення

POST /api/relations/<id>/accept/

Очікувана поведінка:

транзакційно:

<id> → active

усі інші active → archived

повертає:

{"status": "active"}

✔ Відхилити запрошення

POST /api/relations/<id>/decline/

Очікувана поведінка:

<id> → archived

повертає:

{"status": "declined"}

✔ Повторно надіслати запрошення

POST /api/relations/<id>/resend/

Rate-limit: 1 раз / 5 хв
Зберігання: Redis ключ

relation:resend:<id>


Поведінка при перевищенні → 429
(жодних "silent drop")

✔ Скасувати запрошення (для тьютора)

POST /api/relations/<id>/cancel/

→ <id> → archived

1.3. Мій тьютор

GET /api/student/my_tutor/

Повертає один із 3 станів:

a) Є активний тьютор
{
  "status": "active",
  "tutor": { ... }
}

b) Є запрошення
{
  "status": "invited",
  "tutor": { ... },
  "relation_id": 123
}

c) Немає тьютора
{"status": "none"}


❗ Жодних 404.
Це стабільний контракт.

2. AUTOSAVE (ФІНАЛЬНА СПЕЦИФІКАЦІЯ)
2.1. Endpoint

PATCH /api/me/profile/autosave/

2.2. Формат payload

Тільки ті поля, які змінились.
Не deep-diff — фронт сам визначає dirty.

Приклад:

{
  "bio": "Новий текст",
  "hourly_rate": 350,
  "tags": ["math", "ukrainian"]
}

2.3. Алгоритм merge
✔ Поля-примітиви → перезапис
✔ Вкладені об’єкти → рекурсивний merge
✔ Масиви → повна заміна

Тобто:

object → merge
array → replace
primitive → replace


❗ Це остаточне правило.
Фронтенд більше не гадає.

2.4. Rate-limit autosave

Redis ключ:

profile:autosave:<user_id>


TTL: 10 секунд

при перевищенні → 429

Ніяких "silent ignore".

2.5. Зберігання autosave

Чітко:
✔ Використовуємо UserSettings.autosave_blob (JSONField)
❗ Ніяких альтернатив.

3. MARKETPLACE PAGINATION (ФІНАЛЬНИЙ КОНТРАКТ)
3.1. Формат відповіді
{
  "results": [...],
  "cursor": "opaque-token",
  "has_more": true
}

3.2. Немає:

count

page

page_size

total_pages

Це не баг — це остаточне рішення.

3.3. Цілі

пришвидшення запиту

стабільний UX endless scroll

однаковий контракт для веб + мобільного застосунку

4. SEED-ДАНІ (ОБОВʼЯЗКОВО)

Команда:

python manage.py seed_demo_v8


Створює конкретні дані, не "якісь там":

✔ 3 тьютори:

tutor_a (active)

tutor_b (invited)

tutor_c (free)

✔ 3 студенти:

student_1 → має active тьютора

student_2 → має invited

student_3 → none

✔ 1 active relation
✔ 1 invited relation
✔ 1 archived relation
✔ 1 marketplace dataset

10 профілів з випадковими rate/years/tags

Без цього фронт не зможе тестувати.

5. Тести (ЧІТКО, А НЕ "coverage 70%")
Обов'язкові тест-кейси:
✔ Relations

accept з архівацією інших

decline

cancel

resend (rate-limit)

my_tutor (3 стани)

✔ Autosave

merge rules (object/array)

rate-limit 10s

валідація payload

✔ Marketplace

cursor-пагінація (перший запит)

наступна сторінка

has_more = false