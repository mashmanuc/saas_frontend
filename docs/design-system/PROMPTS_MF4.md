# MF4 — Полірування + ThemeStore консолідація

> Дата: 2026-02-20
> Попередня фаза: MF3 (Очищення + QA) — ✅ PASS
> Мета: Виправити themeStore конфлікт, добити останні залишки, ручне QA модалок

---

## Контекст

MF0–MF3 завершені. Залишились:

| Проблема | Пріоритет | Деталі |
|----------|-----------|--------|
| **Два themeStore з однаковим Pinia ID** | 🔴 HIGH | `stores/themeStore.js` (data-theme + localStorage `theme`) vs `modules/ui/theme/themeStore.ts` (inline CSS vars + localStorage `m4sh_theme`). Конфлікт Pinia store ID `'theme'` — баг "тема скидається при навігації" |
| 3 файли з `class="btn"` (не scoped) | 🟡 MED | board/ExportModal, board/HistoryPanel, trust/TrustGuardBanner |
| 1 overlay-модалка | 🟡 MED | profile/AccountDeletionModal → @/ui/Modal |
| 32 файли з `class="btn"` (scoped) | 🟢 LOW | Вже мають scoped стилі, працюють без main.css .btn |
| 132 hex в CSS | 🟢 LOW | Переважно theme definitions |
| Модалки QA (focus trap, Esc) | 🟡 MED | Не тестовано в MF3 |

---

## Розподіл файлів між агентами

### ⚠️ КРИТИЧНЕ ПРАВИЛО: НУЛЬ ПЕРЕТИНІВ

Кожен агент працює **тільки** зі своїми файлами. Жоден файл не може бути в зоні двох агентів.

```
Агент A — ThemeStore консолідація
  ЗОНА: src/stores/themeStore.js
        src/modules/ui/theme/themeStore.ts
        src/modules/ui/theme/themes.ts (read-only reference)
        src/modules/ui/theme/index.ts
        src/modules/ui/theme/PageThemeProvider.vue
        src/modules/ui/theme/ThemeSwitcher.vue
        src/ui/TopNav.vue (тільки import themeStore)
        src/main.js (тільки import themeStore)
        src/modules/dev/views/DevThemePlayground.vue (тільки import themeStore)

Агент B — Залишки btn + overlay
  ЗОНА: src/modules/board/components/export/ExportModal.vue
        src/modules/board/components/history/HistoryPanel.vue
        src/modules/trust/components/TrustGuardBanner.vue
        src/modules/profile/components/AccountDeletionModal.vue

Агент C — QA модалок + фінальний звіт
  ЗОНА: Тільки читання + створення docs/design-system/MF4_QA_REPORT.md
        НЕ редагує жодних .vue файлів
```

### Залежності

```
A ──────────────────────────────> (незалежний)
B ──────────────────────────────> (незалежний)
C ─── чекає A + B ──────────────> QA
```

Агенти A і B працюють паралельно. Агент C починає після завершення A і B.

---

## Агент A — ThemeStore консолідація

### Проблема

Є два themeStore з **однаковим** Pinia store ID `'theme'`:

1. **`src/stores/themeStore.js`** (старий, активний)
   - Використовує `data-theme` атрибут на `<html>`
   - localStorage key: `theme`
   - Значення: `'light'`, `'dark'`, `'classic'`
   - Імпортується в: `main.js`, `TopNav.vue`, `DevThemePlayground.vue`

2. **`src/modules/ui/theme/themeStore.ts`** (новий, з Design System)
   - Використовує inline CSS vars через `root.style.setProperty()`
   - localStorage key: `m4sh_theme`
   - Значення: `'themeA'`, `'themeB'`, `'themeC'`
   - Імпортується в: `PageThemeProvider.vue`, `ThemeSwitcher.vue`

CSS теми працюють через `[data-theme="dark"]` селектори в `tokens.css` — тобто **старий** themeStore є правильним механізмом.

### Задачі

| # | Задача | Файли |
|---|--------|-------|
| A-4.1 | Консолідувати themeStore: зробити `modules/ui/theme/themeStore.ts` обгорткою навколо `stores/themeStore.js`, або навпаки — перенести все в один файл | `stores/themeStore.js`, `modules/ui/theme/themeStore.ts` |
| A-4.2 | Оновити `ThemeSwitcher.vue` — замінити `themeA/B/C` на `light/dark/classic` | `modules/ui/theme/ThemeSwitcher.vue` |
| A-4.3 | Оновити `PageThemeProvider.vue` — використовувати консолідований store | `modules/ui/theme/PageThemeProvider.vue` |
| A-4.4 | Оновити `index.ts` експорти | `modules/ui/theme/index.ts` |
| A-4.5 | Перевірити що `TopNav.vue`, `main.js`, `DevThemePlayground.vue` працюють | Ці файли |
| A-4.6 | `npm run build` + коміт | — |

### Рішення (рекомендоване)

**Варіант: Один store в `stores/themeStore.js`** (він вже правильно працює з `data-theme`).

`modules/ui/theme/themeStore.ts` стає **re-export + adapter**:

```ts
// modules/ui/theme/themeStore.ts
import { useThemeStore as useBaseThemeStore } from '@/stores/themeStore'

// Re-export for backward compatibility
export const useThemeStore = useBaseThemeStore

// Theme ID mapping for components that use themeA/B/C naming
export type ThemeId = 'light' | 'dark' | 'classic'
```

`ThemeSwitcher.vue` оновити значення:
```
themeA → light
themeB → dark  
themeC → classic
```

`PageThemeProvider.vue` — спростити, бо `data-theme` вже на `<html>`.

### DoD

- [ ] Один Pinia store `'theme'` без конфлікту
- [ ] localStorage key: `theme` (один)
- [ ] `data-theme` атрибут на `<html>` — єдиний механізм
- [ ] ThemeSwitcher працює з light/dark/classic
- [ ] Тема НЕ скидається при навігації
- [ ] `npm run build` OK
- [ ] Тести `themeStore.spec.ts` проходять або оновлені

### Коміт

```
design(A-4): consolidate themeStore — single Pinia store, fix theme reset on navigation
```

---

## Агент B — Залишки btn + overlay

### Задачі

| # | Задача | Файл | Що зробити |
|---|--------|------|------------|
| B-5.1 | `class="btn"` → `<Button>` | `board/export/ExportModal.vue` | 2 кнопки: `<button class="btn secondary">` → `<Button variant="secondary">`, `<button class="btn primary">` → `<Button variant="primary">` |
| B-5.2 | `class="btn"` → `<Button>` | `board/history/HistoryPanel.vue` | 2 кнопки: аналогічно |
| B-5.3 | `class="btn"` → `<Button>` | `trust/TrustGuardBanner.vue` | Dynamic `class="btn" :class="action.class"` → `<Button :variant="action.variant">` |
| B-5.4 | Overlay → `@/ui/Modal` | `profile/AccountDeletionModal.vue` | `fixed inset-0` overlay → `<Modal :open="..." @close="...">` |
| B-5.5 | `npm run build` + коміт | — | — |

### Правила

- **НЕ змінювати логіку** — тільки template/styles
- Імпортувати `Button` з `@/ui/Button.vue`
- Імпортувати `Modal` з `@/ui/Modal.vue`
- Видалити scoped `.btn` стилі після заміни на `<Button>`
- Зберегти всі `data-test` атрибути
- Зберегти всі `@click` обробники
- Зберегти всі `v-if`/`:disabled` умови

### ExportModal.vue — приклад

**Було:**
```html
<button class="btn secondary" @click="emit('close')">Cancel</button>
<button class="btn primary" :disabled="isExporting" @click="handleExport">
  <Download :size="18" />
  {{ isExporting ? 'Exporting...' : 'Export' }}
</button>
```

**Стало:**
```html
<Button variant="secondary" @click="emit('close')">Cancel</Button>
<Button variant="primary" :disabled="isExporting" @click="handleExport">
  <Download :size="18" />
  {{ isExporting ? 'Exporting...' : 'Export' }}
</Button>
```

### TrustGuardBanner.vue — увага

Тут динамічний клас:
```html
<button class="btn" :class="action.class || 'btn-text'" @click="action.handler">
```

Потрібно:
1. Замінити на `<Button :variant="action.variant || 'ghost'">`
2. Оновити місця де створюються `actions` — замінити `class: 'btn-primary'` на `variant: 'primary'`
3. Перевірити що `action.class` / `action.variant` правильно маплять

### DoD

- [ ] 0 файлів з `class="btn"` (не scoped) в board/ та trust/
- [ ] AccountDeletionModal використовує `@/ui/Modal`
- [ ] `npm run build` OK

### Коміт

```
design(B-5): migrate last 3 btn remnants + AccountDeletionModal overlay→Modal
```

---

## Агент C — QA модалок + фінальний звіт

### Передумова

Агент C починає **тільки після** завершення A і B.

### Задачі

| # | Задача |
|---|--------|
| C-4.1 | Перевірити що тема **НЕ скидається** при навігації між сторінками |
| C-4.2 | Перевірити ThemeSwitcher — всі 3 теми перемикаються коректно |
| C-4.3 | Ручне QA модалок: focus trap, Esc закриття, backdrop click |
| C-4.4 | Перевірити AccountDeletionModal після міграції |
| C-4.5 | Перевірити board ExportModal/HistoryPanel після міграції |
| C-4.6 | `npm run build` фінальний |
| C-4.7 | Створити `docs/design-system/MF4_QA_REPORT.md` |

### Модалки для тестування (C-4.3)

| Модалка | Шлях | Як відкрити |
|---------|------|-------------|
| CreateLessonModal | `/booking/tutor` | Клік "Створити урок" |
| EditLessonModal | `/booking/tutor` | Клік на існуючий урок |
| BookingRequestModal | `/booking/tutor` | Клік на запит |
| AccountDeletionModal | `/settings` | "Видалити акаунт" |
| ExportModal | `/winterboard` | "Експорт" |
| InquiryFormModal | `/marketplace/tutor/:id` | "Написати" |

Для кожної перевірити:
- ✅ Esc закриває
- ✅ Клік на backdrop закриває
- ✅ Focus trap (Tab не виходить за межі модалки)
- ✅ Body scroll lock (фон не скролиться)

### DoD

- [ ] Тема стабільна при навігації
- [ ] Модалки: focus trap + Esc + backdrop — працюють
- [ ] `MF4_QA_REPORT.md` створено
- [ ] `npm run build` OK

### Коміт

```
design(C-4): MF4 QA report — theme stable, modals verified
```

---

## Що НЕ входить в MF4

| Елемент | Причина |
|---------|---------|
| 32 файли з scoped `class="btn"` | Вже мають власні scoped стилі, не залежать від main.css |
| 132 hex в CSS | Переважно theme definitions в tokens.css — це нормально |
| Legal pages без теми | Backend-rendered, не FE задача |
| Landing page без теми | Окремий дизайн, не частина DS |
| ChatModal overlay | Chat-specific UI, свідомо не мігрується |
| 211 файлів з raw `<button>` | Form-specific UI (tabs, chips, pickers) — свідомо не мігруються |

---

## Чеклист перед стартом

- [ ] `git pull` — актуальна гілка
- [ ] `npm run build` — OK перед початком
- [ ] Прочитати цей файл повністю
- [ ] Перевірити свою зону файлів — не чіпати чужі

## Порядок роботи

```
1. Human: git pull
2. A + B: паралельна робота (різні файли, 0 конфліктів)
3. Human: git pull від обох, npm run build
4. C: QA після merge
5. Human: git push
```
