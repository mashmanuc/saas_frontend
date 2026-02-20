# MF5 — Button Self-Contained + Видалення дублікатів

> Дата: 2026-02-20
> Попередня фаза: MF4 (Полірування + ThemeStore) — ✅ PASS
> Мета: Зробити `<Button>` self-contained, видалити 30 дублікатів `.btn` стилів

---

## Контекст

### Критична знахідка

`<Button>` компонент (`src/ui/Button.vue`) генерує класи `btn btn-primary` тощо, але **не має власних стилів** для них. Глобальні `.btn-*` стилі були видалені з `main.css` в MF3.

Зараз `<Button>` працює тільки тому, що **кожен батьківський файл** (30 штук) має свої scoped `.btn` стилі. Це антипатерн — 30 дублікатів одних і тих же стилів.

### Що потрібно зробити

1. Перенести стилі `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`, `.btn-ghost` всередину `Button.vue`
2. Видалити дубльовані scoped `.btn` стилі з 30 батьківських файлів
3. Перевірити що все працює

### Масштаб

| Метрика | Значення |
|---------|----------|
| Файлів з дубльованими `.btn` стилями | **30** |
| Варіанти: `.btn-primary` | 27 файлів |
| Варіанти: `.btn-secondary` | 27 файлів |
| Варіанти: `.btn-danger` | 4 файли |
| Варіанти: `.btn-ghost` | 3 файли |
| Варіанти: `.btn-outline` | 1 файл |

---

## Порядок роботи

```
ФАЗА 1: Агент A — Button.vue self-contained (БЛОКУЮЧИЙ)
         ↓
ФАЗА 2: Агент A (15 файлів) ║ Агент B (15 файлів) — видалення дублікатів
         ↓
ФАЗА 3: Агент C — QA
```

**Агент A — БЛОКУЮЧИЙ.** Агент B починає тільки після завершення Фази 1 агентом A.

---

## Агент A — Button.vue Self-Contained + Видалення дублікатів (група 1)

### Фаза 1: Button.vue (БЛОКУЮЧИЙ)

#### A-5.1: Додати стилі в `Button.vue`

**Файл:** `src/ui/Button.vue`

Додати в `<style scoped>` повний набір стилів для всіх варіантів. Стилі мають використовувати CSS variables з `tokens.css`.

**Еталонні стилі** (зібрані з 30 файлів, консолідовані):

```css
/* Base */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: var(--radius-md, 6px);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.4;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Primary */
.btn-primary {
  background: var(--accent);
  color: white;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

/* Secondary */
.btn-secondary {
  background: var(--surface-card, var(--color-bg-secondary, #f3f4f6));
  color: var(--text-primary, var(--color-text-primary, #111827));
  border: 1px solid var(--border-color, var(--color-border, #e5e7eb));
}
.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary, #e5e7eb);
}

/* Outline */
.btn-outline {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
}
.btn-outline:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

/* Danger */
.btn-danger {
  background: var(--color-danger, #ef4444);
  color: white;
}
.btn-danger:hover:not(:disabled) {
  filter: brightness(1.1);
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--text-primary);
}
```

**ВАЖЛИВО:**
- Стилі мають бути в `<style scoped>` (не глобальні!)
- Зберегти існуючі `.btn-pill` та `.btn-icon-only` стилі
- Використовувати CSS variables з `tokens.css` де можливо
- Fallback значення для змінних, які можуть бути відсутні

**Також:** замінити Tailwind size classes на CSS:

Зараз `Button.vue` використовує Tailwind для розмірів:
```js
const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-5 py-3 text-lg',
}
```

Замінити на scoped CSS:
```css
.btn-sm { padding: 6px 12px; font-size: 0.8125rem; }
.btn-md { padding: 8px 16px; font-size: 0.875rem; }
.btn-lg { padding: 12px 20px; font-size: 1rem; }
```

І оновити `sizeClasses` в script:
```js
const sizeClasses = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
}
```

#### A-5.2: `npm run build` + коміт

```
design(A-5.1): make Button.vue self-contained — all .btn-* styles inside scoped CSS
```

### Фаза 2: Видалення дублікатів (група A — 15 файлів)

Після підтвердження що build OK, видалити дубльовані `.btn` стилі з цих файлів:

#### ЗОНА A (booking + classroom):

| # | Файл | Що видалити |
|---|------|-------------|
| A-5.3 | `booking/components/availability/SlotEditor.vue` | `.btn`, `.btn-primary`, `.btn-secondary` + responsive `.btn` |
| A-5.4 | `booking/components/availability/CreateSlotModal.vue` | `.btn`, `.btn-primary`, `.btn-secondary` + responsive `.btn` |
| A-5.5 | `booking/components/availability/BlockSlotModal.vue` | `.btn`, `.btn-primary`, `.btn-secondary` + responsive `.btn` |
| A-5.6 | `booking/components/availability/AvailabilityEditor.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| A-5.7 | `booking/components/availability/ExceptionManager.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| A-5.8 | `booking/components/availability/ConflictResolver.vue` | `.btn`, `.btn-primary`, `.btn-secondary` + responsive `.btn` |
| A-5.9 | `booking/components/availability/ConflictWarning.vue` | `.btn`, `.btn-primary`, `.btn-secondary` + responsive `.btn` |
| A-5.10 | `booking/components/booking/BookingActions.vue` | `.btn`, `.btn-primary`, `.btn-secondary` + responsive `.btn` |
| A-5.11 | `booking/components/booking/BookingCard.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| A-5.12 | `booking/components/modals/ManualBookingModal.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| A-5.13 | `booking/components/common/DraftToolbar.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| A-5.14 | `booking/views/MyLessonsView.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| A-5.15 | `classroom/views/ClassroomBoard.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| A-5.16 | `classroom/views/ReconnectView.vue` | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger` |
| A-5.17 | `classroom/views/LessonHistory.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |

#### Правила видалення

1. Видаляти **тільки** `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`, `.btn-ghost` та їх `:hover`, `:disabled` варіанти
2. **НЕ видаляти** responsive media queries, які змінюють layout (`.btn { width: 100% }` в `@media`) — ці стилі **перенести** як кастомні класи або залишити
3. **НЕ видаляти** інші scoped стилі файлу
4. Після видалення перевірити що `<style scoped>` не порожній

#### Проблема з responsive `.btn`

Деякі файли мають responsive стилі типу:
```css
@media (max-width: 640px) {
  .btn { width: 100%; justify-content: center; }
}
```

Ці стилі **специфічні для layout файлу**, не для Button. Їх потрібно **залишити**, але перейменувати селектор. Варіанти:
- Додати wrapper клас: `.modal-footer .btn` → `.modal-footer :deep(.btn)`
- Або використати `:deep(.btn)` для scoped targeting дочірнього компонента

**Рекомендація:** замінити `.btn` в responsive на `:deep(.btn)`:
```css
@media (max-width: 640px) {
  :deep(.btn) { width: 100%; justify-content: center; }
}
```

#### A-5.18: `npm run build` + коміт

```
design(A-5): remove 15 duplicated .btn scoped styles (booking + classroom)
```

### DoD Агент A

- [ ] `Button.vue` має всі `.btn-*` стилі в scoped CSS
- [ ] Tailwind size classes замінені на CSS
- [ ] 15 файлів очищені від дублікатів
- [ ] Responsive `.btn` стилі збережені через `:deep(.btn)`
- [ ] `npm run build` OK

---

## Агент B — Видалення дублікатів (група 2 — 15 файлів)

### Передумова

Агент B починає **тільки після** завершення A-5.1 + A-5.2 (Button.vue self-contained + build OK).

#### ЗОНА B (marketplace + operator + інші):

| # | Файл | Що видалити |
|---|------|-------------|
| B-6.1 | `marketplace/components/MarketplaceSearch.vue` | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` |
| B-6.2 | `marketplace/components/MergeConfirmationModal.vue` | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger` |
| B-6.3 | `marketplace/components/PublishGuardModal.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| B-6.4 | `marketplace/components/DraftConflictModal.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| B-6.5 | `marketplace/components/catalog/AdvancedFiltersModal.vue` | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` |
| B-6.6 | `operator/views/ActivityConsoleView.vue` | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger` |
| B-6.7 | `operator/components/OperatorActionModal.vue` | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger` |
| B-6.8 | `operator/components/MatchesConsole.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| B-6.9 | `inquiries/components/SpamReportModal.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| B-6.10 | `classroom/history/SnapshotViewer.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| B-6.11 | `classroom/history/SnapshotExport.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| B-6.12 | `board/components/ErrorBoundary.vue` | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` |
| B-6.13 | `payments/views/SubscriptionView.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| B-6.14 | `views/BillingView.vue` | `.btn`, `.btn-primary`, `.btn-secondary` |
| B-6.15 | `components/trust/ReportModal.vue` | responsive `.btn` |

#### Правила

Ті ж самі що для Агента A:
1. Видаляти тільки `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`, `.btn-ghost`
2. Responsive `.btn` → `:deep(.btn)`
3. Не видаляти інші стилі
4. `npm run build` після кожної групи

#### B-6.16: `npm run build` + коміт

```
design(B-6): remove 15 duplicated .btn scoped styles (marketplace + operator + misc)
```

### DoD Агент B

- [ ] 15 файлів очищені від дублікатів
- [ ] Responsive `.btn` стилі збережені через `:deep(.btn)`
- [ ] `npm run build` OK

---

## Агент C — QA

### Передумова

Агент C починає **тільки після** завершення A + B.

### Задачі

| # | Задача |
|---|--------|
| C-5.1 | Перевірити `<Button>` в 3 темах (Light, Dark, Classic) — всі 5 варіантів |
| C-5.2 | Перевірити `<Button>` в 3 розмірах (sm, md, lg) |
| C-5.3 | Перевірити disabled + loading стани |
| C-5.4 | Перевірити responsive — кнопки в модалках на 375px |
| C-5.5 | Перевірити booking модалки (CreateSlot, BlockSlot, SlotEditor) |
| C-5.6 | Перевірити marketplace модалки (Merge, Publish, Draft) |
| C-5.7 | `npm run build` фінальний |
| C-5.8 | Створити `docs/design-system/MF5_QA_REPORT.md` |

### Чеклист для кожного варіанту Button

| Варіант | Light | Dark | Classic | Hover | Disabled |
|---------|-------|------|---------|-------|----------|
| primary | | | | | |
| secondary | | | | | |
| outline | | | | | |
| danger | | | | | |
| ghost | | | | | |

### DoD

- [ ] Всі 5 варіантів працюють в 3 темах
- [ ] Responsive OK
- [ ] Модалки OK
- [ ] `MF5_QA_REPORT.md` створено
- [ ] `npm run build` OK

### Коміт

```
design(C-5): MF5 QA report — Button self-contained, 30 duplicates removed
```

---

## Розподіл файлів — НУЛЬ ПЕРЕТИНІВ

```
Агент A:
  src/ui/Button.vue                                          ← БЛОКУЮЧИЙ
  src/modules/booking/components/availability/SlotEditor.vue
  src/modules/booking/components/availability/CreateSlotModal.vue
  src/modules/booking/components/availability/BlockSlotModal.vue
  src/modules/booking/components/availability/AvailabilityEditor.vue
  src/modules/booking/components/availability/ExceptionManager.vue
  src/modules/booking/components/availability/ConflictResolver.vue
  src/modules/booking/components/availability/ConflictWarning.vue
  src/modules/booking/components/booking/BookingActions.vue
  src/modules/booking/components/booking/BookingCard.vue
  src/modules/booking/components/modals/ManualBookingModal.vue
  src/modules/booking/components/common/DraftToolbar.vue
  src/modules/booking/views/MyLessonsView.vue
  src/modules/classroom/views/ClassroomBoard.vue
  src/modules/classroom/views/ReconnectView.vue
  src/modules/classroom/views/LessonHistory.vue

Агент B (починає після A-5.2):
  src/modules/marketplace/components/MarketplaceSearch.vue
  src/modules/marketplace/components/MergeConfirmationModal.vue
  src/modules/marketplace/components/PublishGuardModal.vue
  src/modules/marketplace/components/DraftConflictModal.vue
  src/modules/marketplace/components/catalog/AdvancedFiltersModal.vue
  src/modules/operator/views/ActivityConsoleView.vue
  src/modules/operator/components/OperatorActionModal.vue
  src/modules/operator/components/MatchesConsole.vue
  src/modules/inquiries/components/SpamReportModal.vue
  src/modules/classroom/history/SnapshotViewer.vue
  src/modules/classroom/history/SnapshotExport.vue
  src/modules/board/components/ErrorBoundary.vue
  src/modules/payments/views/SubscriptionView.vue
  src/views/BillingView.vue
  src/components/trust/ReportModal.vue

Агент C (починає після A + B):
  docs/design-system/MF5_QA_REPORT.md (створити)
  НЕ редагує .vue файли
```

---

## Що НЕ входить в MF5

| Елемент | Причина |
|---------|---------|
| Raw `<button class="...">` з scoped стилями | Вже працюють з темами, не потребують міграції |
| Canvas/board кнопки (zoom, page, action) | Специфічний UI |
| Chat inline кнопки | Chat-specific |
| Section headers/accordions | Form-specific UI |
| Remove/icon кнопки | Form-specific inline |

---

## Чеклист перед стартом

- [ ] `git pull` — актуальна гілка
- [ ] `npm run build` — OK перед початком
- [ ] Прочитати цей файл повністю
- [ ] Перевірити свою зону файлів

## Порядок роботи

```
1. Human: git pull
2. A: Button.vue self-contained (Фаза 1) → build → коміт
3. Human: git pull (щоб B мав Button.vue)
4. A (booking+classroom) ║ B (marketplace+operator+misc) — паралельно
5. Human: merge від обох, npm run build
6. C: QA
7. Human: git push
```
