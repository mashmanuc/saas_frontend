# Architecture Decision Records (ADR) — Frontend

**Записи архітектурних рішень фронтенду M4SH**

---

## 📝 Що таке ADR?

**Architecture Decision Record (ADR)** — це документ, який фіксує важливе архітектурне рішення разом з його контекстом та наслідками.

Для загальної інформації про ADR дивись: `../../backend/docs/adr/README.md`

---

## 🗂️ Існуючі ADR (Frontend)

### UI Framework & State Management

- **ADR-001: Vue 3 Composition API** _(pending)_  
  Чому обрали Composition API замість Options API

- **ADR-002: Pinia State Management** _(pending)_  
  Чому Pinia замість Vuex

- **ADR-003: TypeScript Strict Mode** _(pending)_  
  Чому використовуємо strict TypeScript

### Styling & UI

- **ADR-004: TailwindCSS** _(pending)_  
  Чому TailwindCSS замість CSS-in-JS

- **ADR-005: shadcn/ui Components** _(pending)_  
  Чому shadcn/ui для базових компонентів

### Testing

- **ADR-006: Vitest for Unit Tests** _(pending)_  
  Чому Vitest замість Jest

- **ADR-007: Playwright for E2E** _(pending)_  
  Чому Playwright замість Cypress

### i18n & Localization

- **ADR-008: vue-i18n** _(pending)_  
  Чому vue-i18n для інтернаціоналізації

- **ADR-009: UA/EN Only** _(pending)_  
  Чому тільки українська та англійська мови в v1

---

## 📋 Як створити новий ADR?

### 1. Визначити номер

Наступний доступний номер: **ADR-010**

### 2. Створити файл

```bash
# Формат назви: YYYY-MM-DD-short-title.md
docs/adr/2026-02-11-vue3-composition-api.md
```

### 3. Заповнити шаблон

Використай формат з backend ADR README та опиши:
- Контекст (чому це важливо?)
- Рішення (що робимо?)
- Наслідки (що це означає?)

### 4. Додати в цей README

Оновити список існуючих ADR вище.

---

## 🔄 Lifecycle ADR

Дивись backend `../../backend/docs/adr/README.md` для деталей.

---

## 📚 Приклади важливих рішень для ADR

### UI/UX
- Чому Composition API, а не Options API?
- Чому TailwindCSS, а не styled-components?
- Чому shadcn/ui, а не Vuetify?

### State Management
- Чому Pinia, а не Vuex?
- Чому не Redux?
- Як організовуємо stores?

### Testing
- Чому Vitest, а не Jest?
- Чому Playwright, а не Cypress?
- Яка стратегія E2E тестування?

### Performance
- Чому lazy loading для routes?
- Чому code splitting для компонентів?
- Яка стратегія кешування?

---

## 🔗 Зв'язок з Backend ADR

Frontend ADR доповнюють backend ADR:
- Backend ADR: `../../backend/docs/adr/`
- Платформні рішення: backend ADR
- Frontend-специфічні рішення: frontend ADR

---

**Версія:** v1.0.0  
**Останнє оновлення:** 2026-02-11  
**Статус:** ✅ Active
