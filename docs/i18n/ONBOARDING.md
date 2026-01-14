---
title: i18n Onboarding Guide
description: Інструкція для розробників по роботі з інтернаціоналізацією в M4SH Platform
last_updated: 2026-01-14
---

# i18n Onboarding Guide

Цей документ описує процес роботи з ключами інтернаціоналізації (i18n) у M4SH Platform.

## 1. Базові принципи

### 1.1. Джерело правди
- **`src/i18n/locales/uk.json`** — єдине джерело правди для структури ключів
- Усі інші локалі (`en.json`, майбутні мови) повторюють структуру `uk.json` без відхилень
- Зміни структури завжди починаються з `uk.json`

### 1.2. Доменні неймспейси
Ключі групуються за бізнес-доменами:
- `calendar.*` — календар, слоти, доступність
- `auth.*` — автентифікація, реєстрація
- `billing.*` — підписки, платежі
- `booking.*` — бронювання уроків
- `notifications.*` — сповіщення
- `ui.*` — загальні UI-компоненти
- `common.*` / `commonExtended.*` — загальні тексти (кнопки, статуси)

**Заборонено** змішувати сутності з різних доменів в одному namespace.

### 1.3. Конвенції іменування
```
domain.feature.state.field
```

Приклади:
- `calendar.lessonModal.title` — заголовок модального вікна уроку
- `billing.error.checkoutFailed` — помилка оформлення платежу
- `auth.login.submitButton` — кнопка входу

**Плейсхолдери:**
- Використовуйте зрозумілі назви: `{studentName}`, `{count}`, `{date}`
- Динамічні ключі позначаються як `${variable}`: `common.weekdays.${day}`

## 2. Процес додавання нових ключів

### 2.1. Перед додаванням
1. Перевірте, чи немає подібного ключа:
   ```bash
   grep -r "yourText" src/i18n/locales/uk.json
   ```
2. Визначте правильний домен згідно з MANIFEST.md
3. Переконайтеся, що namespace відповідає структурі

### 2.2. Додавання ключа
1. Додайте ключ у `uk.json` з українським текстом:
   ```json
   "calendar": {
     "newFeature": {
       "title": "Новий функціонал",
       "description": "Опис функціоналу"
     }
   }
   ```

2. Запустіть перевірку:
   ```bash
   pnpm i18n:check
   ```

3. Якщо з'явилася помилка "Missing in en.json", синхронізуйте:
   ```bash
   node scripts/sync-missing-keys.mjs
   ```

4. Перевірте ще раз:
   ```bash
   pnpm i18n:check
   ```

### 2.3. Використання в коді
```vue
<template>
  <h1>{{ $t('calendar.newFeature.title') }}</h1>
  <p>{{ $t('calendar.newFeature.description') }}</p>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

// В JS/TS коді
const message = t('calendar.newFeature.title')
</script>
```

## 3. Валідація та інструменти

### 3.1. Основна перевірка
```bash
pnpm i18n:check
```

Перевіряє:
- ✅ Паритет uk.json ↔ en.json (всі ключі присутні в обох)
- ✅ Відсутність дублікатів
- ✅ Порожні значення (окрім template placeholders)
- ⚠️ Unused keys (ключі, що не використовуються в коді)

### 3.2. Детальний звіт
```bash
pnpm i18n:check --report
```

Генерує `i18n-check-report.json` з детальною інформацією:
- `missing` — відсутні ключі в локалях
- `extra` — зайві ключі (є в en.json, але немає в uk.json)
- `empty` — порожні значення
- `unusedKeys` — ключі, що не знайдені в коді

### 3.3. Автоматична синхронізація
```bash
node scripts/sync-missing-keys.mjs
```

Автоматично:
- Додає відсутні ключі з `uk.json` в `en.json`
- Видаляє зайві ключі з `en.json`
- Копіює значення з `uk.json` як fallback

### 3.4. Аналіз unused keys
```bash
node scripts/cleanup-unused-keys.mjs
```

Категоризує unused ключі:
- **Placeholders** (`${...}`) — залишити (динамічне використання)
- **Legacy** — кандидати на видалення (застарілі)
- **Risky** (`common.*`, `nav.*`) — залишити (можуть використовуватись динамічно)
- **Safe** — потребують ручного аудиту

## 4. Читання звітів i18n:check

### 4.1. Missing keys
```
[i18n-check] Missing in en.json (3):
  - billing.newFeature.title
  - billing.newFeature.description
  - billing.newFeature.cta
```

**Дія:** Запустіть `node scripts/sync-missing-keys.mjs`

### 4.2. Extra keys
```
[i18n-check] Extra keys in en.json (2):
  - oldFeature.title
  - oldFeature.description
```

**Дія:** Ці ключі є в `en.json`, але відсутні в `uk.json`. Або додайте їх у `uk.json`, або видаліть з `en.json`.

### 4.3. Empty values
```
[i18n-check] Empty values in en.json (5):
  - calendar.status.${status}
  - common.weekdays.${day}
```

**Дія:** Якщо це template placeholders (`${...}`), це нормально. Інакше — заповніть значення.

### 4.4. Unused keys
```
[i18n-check] Unused keys in uk.json (543):
  - oldModule.feature.title
  - deprecatedFeature.description
```

**Дія:** 
1. Перевірте, чи дійсно ключ не використовується:
   ```bash
   grep -r "oldModule.feature.title" src/
   ```
2. Якщо не знайдено — кандидат на видалення
3. Якщо це placeholder або risky key — залишити

## 5. CI/CD та автоматизація

### 5.1. Pre-commit hook
Автоматично запускається `pnpm i18n:check` перед кожним комітом. Якщо є помилки — коміт блокується.

### 5.2. GitHub Actions
Workflow `.github/workflows/i18n-check.yml` запускається на кожен PR:
- Виконує `pnpm i18n:check --report`
- Коментує PR з результатами
- Блокує merge при наявності помилок
- Зберігає артефакт звіту (7 днів)

### 5.3. Weekly cron (планується)
Щотижневий job публікуватиме звіт у Slack канал `#l10n-status`.

## 6. Типові сценарії

### 6.1. Додати новий екран
1. Створіть структуру ключів у `uk.json`:
   ```json
   "newScreen": {
     "title": "Заголовок",
     "subtitle": "Підзаголовок",
     "actions": {
       "submit": "Відправити",
       "cancel": "Скасувати"
     }
   }
   ```
2. Синхронізуйте: `node scripts/sync-missing-keys.mjs`
3. Перевірте: `pnpm i18n:check`

### 6.2. Видалити застарілий функціонал
1. Видаліть ключі з `uk.json`
2. Синхронізуйте: `node scripts/sync-missing-keys.mjs` (видалить з `en.json`)
3. Перевірте: `pnpm i18n:check`

### 6.3. Перейменувати ключ
1. Додайте новий ключ у `uk.json`
2. Оновіть всі використання в коді:
   ```bash
   grep -r "oldKey" src/ --include="*.vue" --include="*.ts"
   ```
3. Видаліть старий ключ з `uk.json`
4. Синхронізуйте та перевірте

### 6.4. Виправити помилку в тексті
1. Знайдіть ключ у `uk.json`
2. Виправте значення
3. Оновіть `en.json` (якщо потрібно)
4. Перевірте: `pnpm i18n:check`

## 7. Troubleshooting

### Помилка: "Duplicate object key"
**Причина:** Один і той самий ключ визначений двічі в JSON.

**Рішення:** Знайдіть дублікат у файлі та видаліть один з них.

### Помилка: "Missing in en.json"
**Причина:** Ключ є в `uk.json`, але відсутній в `en.json`.

**Рішення:** `node scripts/sync-missing-keys.mjs`

### Помилка: "Extra keys in en.json"
**Причина:** Ключ є в `en.json`, але відсутній в `uk.json`.

**Рішення:** Або додайте в `uk.json`, або видаліть з `en.json`, потім синхронізуйте.

### Unused keys не зникають
**Причина:** Usage-сканер не знаходить використання ключа в коді.

**Можливі причини:**
- Ключ використовується динамічно: `t(\`domain.\${variable}\`)`
- Ключ є template placeholder: `domain.${variable}`
- Ключ дійсно не використовується

**Рішення:** Перевірте вручну через grep, якщо не знайдено — видаліть.

## 8. Best Practices

### ✅ DO
- Завжди починайте з `uk.json`
- Використовуйте доменні неймспейси
- Запускайте `pnpm i18n:check` перед комітом
- Пишіть зрозумілі назви ключів
- Групуйте пов'язані ключі разом
- Використовуйте плейсхолдери для динамічних значень

### ❌ DON'T
- Не хардкодьте тексти в компонентах
- Не змішуйте домени в одному namespace
- Не створюйте дублікатів ключів
- Не видаляйте ключі без перевірки використання
- Не ігноруйте помилки `i18n:check`
- Не комітьте без синхронізації локалей

## 9. Корисні команди

```bash
# Основна перевірка
pnpm i18n:check

# Детальний звіт
pnpm i18n:check --report

# Синхронізація локалей
node scripts/sync-missing-keys.mjs

# Аналіз unused keys
node scripts/cleanup-unused-keys.mjs

# Пошук ключа в коді
grep -r "keyName" src/ --include="*.vue" --include="*.ts" --include="*.js"

# Пошук тексту в локалях
grep -r "текст" src/i18n/locales/

# Перевірка без usage-сканера (швидше)
pnpm i18n:check --no-usage
```

## 10. Додаткові ресурси

- **MANIFEST.md** — повна політика i18n
- **PLAN.md** — план впровадження i18n
- **scripts/i18n-check.mjs** — код валідатора
- **scripts/sync-missing-keys.mjs** — код синхронізатора
- **scripts/cleanup-unused-keys.mjs** — код аналізатора unused keys

---

**Питання?** Зверніться до Language Platform Lead або створіть issue в репозиторії.
