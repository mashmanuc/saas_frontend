# Синхронізація ru.json з uk.json

## Швидкий старт

```bash
# Тільки критичні ключі (UI що бачить користувач)
npm run i18n:sync-ru -- --critical

# По блоках (поетапно)
npm run i18n:sync-ru -- --block=nav
npm run i18n:sync-ru -- --block=dashboard
npm run i18n:sync-ru -- --block=auth

# Всі ключі (не рекомендовано - буде багато)
npm run i18n:sync-ru
```

## Доступні блоки

| Блок | Що включає | Приклад ключів |
|------|------------|----------------|
| `nav` | Навігація, sidebar, меню | `nav.*`, `sidebar.*`, `menu.*` |
| `dashboard` | Дашборд, статистика | `dashboard.*`, `stats.*`, `greeting.*` |
| `auth` | Авторизація, реєстрація | `auth.*`, `login.*`, `register.*` |
| `profile` | Профіль користувача | `profile.*`, `tutor.*`, `student.*` |
| `booking` | Бронювання, календар | `booking.*`, `calendar.*`, `lesson.*` |
| `marketplace` | Маркетплейс | `marketplace.*`, `filters.*`, `search.*` |
| `chat` | Чат, повідомлення | `chat.*`, `messages.*` |
| `notifications` | Сповіщення | `notifications.*`, `bell.*`, `push.*` |
| `billing` | Оплата, підписки | `billing.*`, `payment.*`, `subscription.*` |
| `common` | Загальні елементи | `common.*`, `button.*`, `form.*`, `error.*` |

## Рекомендований порядок синхронізації

### 1. Критичні ключі (обов'язково)
```bash
npm run i18n:sync-ru -- --critical
```
**Що додасть:** ~50-100 ключів (UI елементи)

### 2. Навігація
```bash
npm run i18n:sync-ru -- --block=nav
```
**Що додасть:** sidebar, menu, navigation

### 3. Дашборд
```bash
npm run i18n:sync-ru -- --block=dashboard
```
**Що додасть:** greeting, stats, quick actions, schedule

### 4. Авторизація
```bash
npm run i18n:sync-ru -- --block=auth
```
**Що додасть:** login, register, password reset

### 5. Інші блоки (за потребою)
```bash
npm run i18n:sync-ru -- --block=profile
npm run i18n:sync-ru -- --block=booking
npm run i18n:sync-ru -- --block=marketplace
```

## Що робить скрипт

1. ✅ Порівнює uk.json і ru.json
2. ✅ Знаходить відсутні ключі
3. ✅ Автоматично перекладає прості фрази (Головна → Главная)
4. ⚠️ Позначає складні фрази як `[TODO-RU]` для ручного перекладу
5. ✅ Зберігає оновлений ru.json

## Після запуску скрипта

1. Відкрийте `src/i18n/locales/ru.json`
2. Знайдіть ключі з `[TODO-RU]` (Ctrl+F)
3. Перекладіть їх вручно
4. Видаліть префікс `[TODO-RU]`

## Приклад виводу

```
🔍 Читаю uk.json та ru.json...

📊 Всього ключів в uk.json: 5288
⚡ Режим: тільки критичні ключі (UI)

❌ Відсутніх ключів в ru.json: 45
⏭️  Пропущено (не входять в фільтр): 824

📝 Додані ключі (показано 45 з 45):

✅ nav.avatar.settings
   UK: "Налаштування"
   RU: "Настройки"

⚠️ dashboard.greeting.morning
   UK: "Доброго ранку"
   RU: "[TODO-RU] Доброго ранку"

✅ Файл ru.json оновлено!
   Додано ключів: 45
   Автоматично перекладено: 30
   Потребують ручного перекладу: 15
   Пропущено (фільтр): 824
```

## Troubleshooting

### Скрипт не знаходить відсутніх ключів
Можливо всі ключі вже синхронізовані для обраного блоку. Спробуйте інший блок.

### Занадто багато ключів з [TODO-RU]
Використовуйте режим `--critical` або синхронізуйте по блоках.

### Потрібно додати свій блок
Відредагуйте `scripts/sync-ru-from-uk.mjs`, додайте новий блок в `BLOCKS`.

## Автоматичний переклад

Скрипт автоматично перекладає ~100 найпоширеніших фраз:
- Головна → Главная
- Налаштування → Настройки
- Розклад → Расписание
- Повідомлення → Сообщения
- і т.д.

Для складних фраз використовується позначка `[TODO-RU]`.
