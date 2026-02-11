# Getting Started — M4SH Frontend Development

**Швидкий старт для нових розробників**

---

## 📋 Передумови

### Системні вимоги

- **Node.js:** 18+ (рекомендовано 20 LTS)
- **npm:** 9+
- **Git:** 2.40+

### Рекомендовані інструменти

- **IDE:** VS Code з розширеннями:
  - Volar (Vue Language Features)
  - TypeScript Vue Plugin
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
- **Browser:** Chrome/Edge з Vue DevTools
- **API Client:** Postman або Insomnia (для тестування API)

---

## 🚀 Налаштування середовища

### 1. Клонувати репозиторій

```bash
cd D:/m4sh_v1/
# Репозиторій вже клонований
```

### 2. Встановити залежності

```bash
cd frontend
npm install
```

### 3. Налаштувати .env

```bash
# Скопіювати приклад
cp .env.development.example .env.development

# Відредагувати .env.development
# Додати VITE_API_URL, VITE_WS_URL
```

### 4. Запустити dev server

```bash
npm run dev
```

Додаток буде доступний на `http://localhost:5173`

---

## 📚 Обов'язково прочитати

### Перед початком роботи

1. **Backend MANIFEST.md** — `../backend/docs/manifest/MANIFEST.md`
2. **Frontend README.md** — `docs/README.md`
3. **FRONTEND_GUIDE.md** — `docs/guides/development/FRONTEND_GUIDE.md`

### Для роботи з доменом

1. Знайди backend SSOT у `../backend/docs/domains/[domain]/`
2. Перевір API контракти в `../backend/docs/api/contracts/`
3. Подивись frontend документацію в `docs/domains/[domain]/`

---

## 🧪 Запуск тестів

### Unit тести (Vitest)

```bash
# Запустити всі тести
npm run test:unit

# Watch mode
npm run test:unit:watch

# Coverage
npm run test:unit:coverage
```

### E2E тести (Playwright)

```bash
# Запустити всі E2E тести
npm run test:e2e

# UI mode (рекомендовано для розробки)
npm run test:e2e:ui

# Конкретний тест
npm run test:e2e -- tests/e2e/marketplace.spec.ts
```

### Type checking

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
│   │   ├── ui/             # Базові UI компоненти (shadcn/ui)
│   │   ├── marketplace/    # Marketplace компоненти
│   │   ├── calendar/       # Calendar компоненти
│   │   └── [domain]/       # Доменні компоненти
│   │
│   ├── composables/         # Vue composables
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   └── [feature].ts
│   │
│   ├── stores/              # Pinia stores
│   │   ├── auth.ts
│   │   ├── marketplace.ts
│   │   └── [domain].ts
│   │
│   ├── services/            # API сервіси
│   │   ├── api.ts          # Axios instance
│   │   ├── auth.service.ts
│   │   └── [domain].service.ts
│   │
│   ├── router/              # Vue Router
│   │   ├── index.ts
│   │   └── routes/
│   │
│   ├── i18n/                # Переклади
│   │   ├── locales/
│   │   │   ├── ua.json
│   │   │   └── en.json
│   │   └── index.ts
│   │
│   ├── types/               # TypeScript типи
│   │   ├── api.ts
│   │   └── [domain].ts
│   │
│   ├── assets/              # Статичні ресурси
│   ├── utils/               # Утиліти
│   └── App.vue              # Root компонент
│
├── tests/
│   ├── unit/                # Unit тести (Vitest)
│   └── e2e/                 # E2E тести (Playwright)
│
├── docs/                    # Документація
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

**Компоненти:**
```vue
<script setup lang="ts">
// Composition API
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>

<template>
  <div>{{ count }} * 2 = {{ doubled }}</div>
</template>
```

**Stores (Pinia):**
```typescript
import { defineStore } from 'pinia'

export const useMarketplaceStore = defineStore('marketplace', () => {
  const tutors = ref<Tutor[]>([])
  
  async function fetchTutors() {
    // API call
  }
  
  return { tutors, fetchTutors }
})
```

**API Services:**
```typescript
import api from './api'

export const marketplaceService = {
  async getTutors(filters: TutorFilters) {
    const response = await api.get('/api/v1/marketplace/tutors', {
      params: filters
    })
    return response.data
  }
}
```

### 4. Написати тести

**Unit тест (Vitest):**
```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TutorCard from '@/components/marketplace/TutorCard.vue'

describe('TutorCard', () => {
  it('renders tutor name', () => {
    const wrapper = mount(TutorCard, {
      props: { tutor: { name: 'John' } }
    })
    expect(wrapper.text()).toContain('John')
  })
})
```

**E2E тест (Playwright):**
```typescript
import { test, expect } from '@playwright/test'

test('marketplace filters work', async ({ page }) => {
  await page.goto('/marketplace')
  await page.fill('[data-testid="search-input"]', 'Math')
  await expect(page.locator('.tutor-card')).toHaveCount(5)
})
```

### 5. Перевірити якість

```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Tests
npm run test:unit
npm run test:e2e

# Build
npm run build
```

### 6. Оновити документацію

- Оновити domain docs якщо змінились flows
- Додати component docs якщо новий компонент
- Оновити i18n ключі

### 7. Створити PR

- Опис змін
- Screenshots/video для UI
- Результати тестів

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

### Проблема: TypeScript помилки

```bash
# Перевірити типи
npm run type-check

# Перезапустити TS server в VS Code
# Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

### Проблема: E2E тести падають

```bash
# Оновити Playwright browsers
npx playwright install

# Запустити в UI mode для debugging
npm run test:e2e:ui
```

### Проблема: i18n ключі не працюють

```bash
# Перевірити наявність ключів
npm run i18n:check

# Додати відсутні ключі в locales/
```

---

## 📞 Допомога

**Не знаєш з чого почати?**
- Прочитай Backend MANIFEST.md
- Подивись FRONTEND_GUIDE.md
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

**Версія:** v1.0.0  
**Останнє оновлення:** 2026-02-11  
**Статус:** ✅ Active
