# M4SH Frontend Documentation

**Навігаційний центр документації фронтенду платформи**

---

## 📚 Структура документації

### 🎯 Manifest (посилання на backend)
Єдине джерело істини для всієї платформи знаходиться в backend:
- **Backend MANIFEST.md** — `../../saas_docs/manifest/MANIFEST.md`
- **SSOT_REGISTRY.md** — `../../saas_docs/manifest/SSOT_REGISTRY.md`

### 📦 [domains/](./domains/) — Доменна документація
Фронтенд-специфічна документація для кожного домену:
- `auth/` — Автентифікація (login, refresh, CSRF)
- `users/` — Користувачі та профілі
- `marketplace/` — Маркетплейс тьюторів
- `calendar/` — Календар та availability
- `booking/` — Бронювання уроків
- `contacts/` — Контакти та розблокування
- `inquiries/` — Запити студентів
- `chat/` — Чат система
- `notifications/` — Нотифікації
- `i18n/` — Інтернаціоналізація (UA/EN)

### 🔌 [api/](./api/) — API інтеграції
Документація інтеграції з backend API:
- **[rest/](./api/rest/)** — REST API клієнти та сервіси
- **[websocket/](./api/websocket/)** — WebSocket підключення
- **[contracts/](./api/contracts/)** — Версійні контракти (синхронізовані з backend)

### 📖 [guides/](./guides/) — Інструкції та гайди
Практичні гайди для команди:
- **[development/](./guides/development/)** — Як розробляти (setup, hot reload, debugging)
- **[deployment/](./guides/deployment/)** — Як деплоїти (build, preview, production)
- **[testing/](./guides/testing/)** — Як тестувати (unit, e2e, visual regression)
- **[components/](./guides/components/)** — UI компоненти та patterns

### 📝 [adr/](./adr/) — Architecture Decision Records
Записи архітектурних рішень фронтенду:
- `001-vue3-composition-api.md` — Чому Composition API
- `002-pinia-state-management.md` — Чому Pinia замість Vuex
- `[date]-[decision].md` — Формат: YYYY-MM-DD-short-title.md

### 🗄️ [archive/](./archive/) — Історичний архів
Заморожена документація версій v0.1-v0.86:
- **[legacy_docs_v0.1-v0.86/](./archive/legacy_docs_v0.1-v0.86/)** — Стара документація
- **[legacy_scripts/](./archive/legacy_scripts/)** — Застарілі скрипти
- **[migration_reports/](./archive/migration_reports/)** — Історичні репорти

---

## 🚀 Швидкий старт

### Для нових розробників
1. Прочитай **Backend MANIFEST.md** — зрозумій філософію платформи
2. Вивчи **[guides/development/GETTING_STARTED.md](./guides/development/GETTING_STARTED.md)** — налаштуй середовище
3. Подивись **[guides/components/](./guides/components/)** — вивчи UI patterns

### Для роботи з доменом
1. Знайди свій домен у **[domains/](./domains/)**
2. Перевір backend SSOT у `../backend/docs/domains/[domain]/`
3. Перевір API контракти в **[api/contracts/](./api/contracts/)**

### Для роботи з компонентами
1. Шукай документацію в **[guides/components/](./guides/components/)**
2. Перевір Storybook (якщо доступний)
3. Дивись приклади в `src/components/`

---

## 🧪 Запуск тестів

### Unit тести (Vitest)
```bash
npm run test:unit
```

### E2E тести (Playwright)
```bash
npm run test:e2e
```

### Typecheck
```bash
npm run type-check
```

---

## 🛠️ Корисні команди

### Development

```bash
# Запустити dev server
npm run dev

# Build для production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint

# Format
npm run format
```

### Testing

```bash
# Unit тести
npm run test:unit

# E2E тести
npm run test:e2e

# E2E UI mode
npm run test:e2e:ui

# Typecheck
npm run type-check
```

---

## 📂 Структура проєкту

```
frontend/
├── src/
│   ├── components/          # UI компоненти
│   ├── composables/         # Vue composables
│   ├── stores/              # Pinia stores
│   ├── services/            # API сервіси
│   ├── router/              # Vue Router
│   ├── i18n/                # Переклади (UA/EN)
│   ├── assets/              # Статичні ресурси
│   └── types/               # TypeScript типи
│
├── docs/                    # Документація
│   ├── domains/             # Доменна документація
│   ├── api/                 # API інтеграції
│   ├── guides/              # Гайди
│   └── adr/                 # Architecture Decision Records
│
├── tests/
│   ├── unit/                # Unit тести (Vitest)
│   └── e2e/                 # E2E тести (Playwright)
│
├── scripts/                 # Утилітні скрипти
└── public/                  # Публічні файли
```

---

## 🎯 Workflow розробки

### 1. Взяти задачу

- Подивись backend SSOT домену
- Перевір API контракт
- Зрозумій UX flow

### 2. Створити гілку

```bash
git checkout -b feature/[domain]-[short-description]
# Приклад: feature/marketplace-tutor-filters
```

### 3. Написати код

- Компоненти в `src/components/`
- Логіка в `src/composables/`
- State в `src/stores/`
- API в `src/services/`

### 4. Написати тести

```bash
# Unit тести
npm run test:unit

# E2E тести
npm run test:e2e
```

### 5. Перевірити якість

```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Build
npm run build
```

### 6. Оновити документацію

- Оновити domain docs якщо змінились flows
- Додати ADR якщо важливе рішення
- Оновити component docs

### 7. Створити PR

- Опис змін
- Screenshots/video для UI
- Результати тестів

---

## 📐 Принципи документації

### 1. Синхронізація з Backend
API контракти синхронізовані з backend `docs/api/contracts/`

### 2. Component-First
Кожен важливий компонент має документацію в `guides/components/`

### 3. Living Documentation
Документація оновлюється **разом** з кодом у тому ж PR

### 4. i18n-First
Всі user-facing тексти через i18n ключі, без hardcode

---

## 🔄 Lifecycle документів

### Актуальна документація
- Зберігається в `domains/`, `api/`, `guides/`
- Оновлюється з кожним релізом
- Версіонується через Git

### Архівна документація
- Переміщується в `archive/` після major refactor
- Зберігається для історичного контексту
- Не оновлюється

---

## 🛠️ Як додати нову документацію

### Новий домен
1. Створи папку `domains/[domain_name]/`
2. Додай `[DOMAIN]_FRONTEND.md`
3. Синхронізуй з backend SSOT

### Новий компонент
1. Додай документацію в `guides/components/[ComponentName].md`
2. Додай приклади використання
3. Додай props/events/slots

### Нове архітектурне рішення
1. Створи файл `adr/YYYY-MM-DD-decision-name.md`
2. Використай формат ADR (Context, Decision, Consequences)

---

## 🐛 Troubleshooting

### Проблема: Dev server не запускається

```bash
# Очистити node_modules
rm -rf node_modules
npm install

# Очистити кеш Vite
rm -rf node_modules/.vite
```

### Проблема: Тести падають

```bash
# Оновити snapshots
npm run test:unit -- -u

# Запустити конкретний тест
npm run test:unit -- ComponentName
```

### Проблема: TypeScript помилки

```bash
# Перевірити типи
npm run type-check

# Перегенерувати типи (якщо є codegen)
npm run codegen
```

---

## 📞 Допомога

**Не знаєш з чого почати?**
- Прочитай Backend MANIFEST.md
- Подивись GETTING_STARTED.md
- Вивчи існуючі компоненти

**Знайшов баг?**
- Створи issue з описом
- Додай кроки для відтворення
- Додай screenshots/video

**Маєш питання по архітектурі?**
- Перевір ADR в `docs/adr/`
- Подивись backend SSOT
- Обговори з архітектором

---

**Версія документації:** v1.0.0  
**Останнє оновлення:** 2026-02-11  
**Статус:** ✅ Production Ready
