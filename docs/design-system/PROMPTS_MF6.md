# MF6 — Фінальне очищення: destructive fix + залишки .btn-primary scoped

> Дата: 2026-02-20
> Попередня фаза: MF5 (Button self-contained + дублікати) — ✅ PASS
> Мета: Виправити variant="destructive", мігрувати 3 файли з raw `<button>` на `<Button>`, видалити 4 залишки scoped `.btn-primary/.btn-secondary`

---

## Контекст

### Findings з MF5 QA

1. **`variant="destructive"`** в 2 файлах — невалідний варіант, fallback на `primary` замість `danger`
2. **~7 файлів** з `.btn-primary/.btn-secondary` scoped стилями — частина використовує raw `<button>`, частина вже `<Button>` (залишки)

### Аудит залишків

| Файл | Використовує | Стилі | Дія |
|------|-------------|-------|-----|
| `admin/AdminArchiveUserModal.vue` | `<Button>` | ~~`variant="destructive"`~~ | ✅ Вже виправлено → `danger` |
| `profile/settings/PrivacySettingsTab.vue` | `<Button>` | ~~`variant="destructive"`~~ | ✅ Вже виправлено → `danger` |
| `components/ErrorBoundary.vue` | raw `<button class="btn-primary">` | hex кольори | Мігрувати на `<Button>` |
| `components/Notifications/PushHandler.vue` | raw `<button class="btn-primary/secondary">` | hex + `background: white` | Мігрувати на `<Button>` + токени |
| `components/relations/RelationActionButton.vue` | raw `<button>` з кастомним variant | hex кольори | Мігрувати стилі на CSS vars |
| `booking/availability/AvailabilityTemplateEditor.vue` | `<Button>` (вже!) | залишок `.btn-primary/.btn-secondary` | Видалити дублікати |
| `booking/calendar/CalendarFooter.vue` | `<Button>` (вже!) | залишок `.btn-primary` + responsive | Видалити дублікати, responsive → `:deep` |
| `booking/calendar/CalendarWeekView.vue` | `<Button>` (вже!) | залишок `.btn-primary` | Видалити дублікати |
| `marketplace/TutorAvailabilityCalendar.vue` | `<Button>` (вже!) | залишок `.btn-secondary` hex | Видалити дублікати |

### Масштаб

- **2 файли** — вже виправлені (destructive → danger)
- **3 файли** — міграція raw `<button>` → `<Button>` (ErrorBoundary, PushHandler, RelationActionButton)
- **4 файли** — видалення залишків scoped `.btn-primary/.btn-secondary`
- **Разом: 7 файлів** для редагування

---

## Порядок роботи

```
Агент A (4 файли: booking + marketplace)  ║  Агент B (3 файли: components/)
                    ↓                                        ↓
                         Агент C — QA + build
```

A і B працюють **паралельно** — нуль перетинів файлів.

---

## Агент A — Видалення залишків scoped `.btn-primary/.btn-secondary`

### Зона файлів

```
src/modules/booking/components/availability/AvailabilityTemplateEditor.vue
src/modules/booking/components/calendar/CalendarFooter.vue
src/modules/booking/components/calendar/CalendarWeekView.vue
src/modules/marketplace/components/TutorAvailabilityCalendar.vue
```

### A-6.1: `AvailabilityTemplateEditor.vue`

Файл вже використовує `<Button>` з `@/ui/Button.vue`. Видалити scoped стилі:

```
Видалити (рядки ~505–543):
.btn-primary { ... }
.btn-primary:hover:not(:disabled) { ... }
.btn-primary:disabled { ... }
.btn-secondary { ... }
.btn-secondary:hover:not(:disabled) { ... }
.btn-secondary:disabled { ... }
```

### A-6.2: `CalendarFooter.vue`

Файл вже використовує `<Button>` з `@/ui/Button.vue`. Видалити scoped стилі:

```
Видалити (рядки ~420–440):
.btn-primary { ... }
.btn-primary:hover:not(:disabled) { ... }
.btn-primary:disabled { ... }
```

**Responsive (рядок ~453):**
```css
/* БУЛО: */
.copy-btn, .btn-secondary, .btn-tertiary {
  width: 100%;
  justify-content: center;
}

/* СТАЄ: */
.copy-btn, :deep(.btn-secondary), :deep(.btn-tertiary) {
  width: 100%;
  justify-content: center;
}
```

### A-6.3: `CalendarWeekView.vue`

Файл вже використовує `<Button>` з `@/ui/Button.vue`. Видалити scoped стилі:

```
Видалити (рядки ~1041–1055):
.btn-primary { ... }
.btn-primary:hover { ... }
```

### A-6.4: `TutorAvailabilityCalendar.vue`

Файл вже використовує `<Button>` з `@/ui/Button.vue`. Видалити scoped стилі та замінити hex на CSS vars:

```
Видалити (рядки ~413–424):
.btn-secondary { ... }
.btn-secondary:hover { ... }
```

### A-6.5: `npm run build` + коміт

```
design(A-6): remove 4 remaining .btn-primary/.btn-secondary scoped duplicates (booking + marketplace)
```

### DoD Агент A

- [ ] 4 файли очищені від `.btn-primary/.btn-secondary` дублікатів
- [ ] Responsive стилі збережені через `:deep()`
- [ ] `npm run build` OK

---

## Агент B — Міграція raw `<button>` → `<Button>` + CSS vars

### Зона файлів

```
src/components/ErrorBoundary.vue
src/components/Notifications/PushHandler.vue
src/components/relations/RelationActionButton.vue
```

### B-7.1: `ErrorBoundary.vue`

**Зараз:**
```html
<button @click="handleRetry" class="btn-primary">
  <RefreshCwIcon class="w-4 h-4" />
  {{ $t('common.retry') }}
</button>
```

**Стає:**
```html
<Button variant="primary" @click="handleRetry">
  <template #iconLeft><RefreshCwIcon class="w-4 h-4" /></template>
  {{ $t('common.retry') }}
</Button>
```

**Також:**
1. Додати `import Button from '@/ui/Button.vue'`
2. Видалити scoped `.btn-primary` стилі (рядки ~63–80)
3. Замінити hex кольори на CSS vars:
   - `.error-title`: `color: #1f2937` → `color: var(--text-primary)`
   - `.error-message`: `color: #6b7280` → `color: var(--text-secondary)`

### B-7.2: `PushHandler.vue`

**Зараз (banner-actions):**
```html
<button type="button" class="btn-secondary" @click="dismissBanner">
  {{ $t('common.later') }}
</button>
<button type="button" class="btn-primary" :disabled="isEnabling" @click="enablePush">
  <Loader2 v-if="isEnabling" class="btn-icon spinning" />
  {{ $t('push.enable') }}
</button>
```

**Стає:**
```html
<Button variant="secondary" size="sm" @click="dismissBanner">
  {{ $t('common.later') }}
</Button>
<Button variant="primary" size="sm" :disabled="isEnabling" :loading="isEnabling" @click="enablePush">
  {{ $t('push.enable') }}
</Button>
```

**Також:**
1. Додати `import Button from '@/ui/Button.vue'`
2. Видалити `Loader2` з імпортів (Button має вбудований loading)
3. Видалити scoped `.btn-primary`, `.btn-secondary` стилі (рядки ~396–432)
4. Видалити `.btn-icon`, `.spinning`, `@keyframes spin` (рядки ~434–446) — Button має вбудований spinner
5. Замінити хардкоджені кольори на CSS vars:
   - `.permission-banner`: `background: white` → `background: var(--bg-primary, white)`
   - `.push-toast`: `background: white` → `background: var(--bg-primary, white)`
   - Toast icon wrappers: hex → CSS vars з fallback
6. Видалити `@media (prefers-color-scheme: dark)` блок — теми керуються через `data-theme`, не media query

### B-7.3: `RelationActionButton.vue`

Цей файл — **кастомний компонент** з власним `variant` prop. Міграція на `<Button>` тут **не підходить**, бо є специфічні стилі для типів дій (`btn-request`, `btn-locked`).

**Дія:** Замінити hex кольори на CSS vars:

```css
/* БУЛО: */
.btn-primary { background-color: #3b82f6; color: white; }
.btn-primary:hover:not(:disabled) { background-color: #2563eb; }
.btn-primary:active:not(:disabled) { background-color: #1d4ed8; }
.btn-secondary { background-color: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
.btn-secondary:hover:not(:disabled) { background-color: #e5e7eb; }
.btn-secondary:active:not(:disabled) { background-color: #d1d5db; }
.btn-request { background-color: #10b981; }
.btn-request:hover:not(:disabled) { background-color: #059669; }
.btn-locked { background-color: #f59e0b; }
.btn-locked:hover:not(:disabled) { background-color: #d97706; }

/* СТАЄ: */
.btn-primary { background-color: var(--accent); color: white; }
.btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
.btn-primary:active:not(:disabled) { filter: brightness(0.95); }
.btn-secondary { background-color: var(--color-bg-secondary, #f3f4f6); color: var(--text-primary); border: 1px solid var(--border-color); }
.btn-secondary:hover:not(:disabled) { background-color: var(--color-bg-tertiary, #e5e7eb); }
.btn-secondary:active:not(:disabled) { background-color: var(--border-color); }
.btn-request { background-color: var(--color-success, #10b981); }
.btn-request:hover:not(:disabled) { filter: brightness(1.1); }
.btn-locked { background-color: var(--color-warning, #f59e0b); }
.btn-locked:hover:not(:disabled) { filter: brightness(1.1); }
```

### B-7.4: `npm run build` + коміт

```
design(B-7): migrate ErrorBoundary + PushHandler to <Button>, tokenize RelationActionButton
```

### DoD Агент B

- [ ] `ErrorBoundary.vue` — raw `<button>` → `<Button>`, hex → CSS vars
- [ ] `PushHandler.vue` — raw `<button>` → `<Button>`, hex → CSS vars, dark mode через `data-theme`
- [ ] `RelationActionButton.vue` — hex → CSS vars (залишається raw `<button>` з кастомним variant)
- [ ] `npm run build` OK

---

## Агент C — QA

### Передумова

Агент C починає **тільки після** завершення A + B.

### Задачі

| # | Задача |
|---|--------|
| C-6.1 | Перевірити `ErrorBoundary` — кнопка Retry в 3 темах |
| C-6.2 | Перевірити `PushHandler` — banner + toast в 3 темах |
| C-6.3 | Перевірити `RelationActionButton` — 4 стейти (message, request, book, locked) в 3 темах |
| C-6.4 | Перевірити booking модалки (AvailabilityTemplateEditor, CalendarFooter, CalendarWeekView) |
| C-6.5 | Перевірити `TutorAvailabilityCalendar` — кнопки навігації |
| C-6.6 | Перевірити `AdminArchiveUserModal` — variant="danger" працює (destructive fix) |
| C-6.7 | Перевірити `PrivacySettingsTab` — variant="danger" працює |
| C-6.8 | `npm run build` фінальний |
| C-6.9 | Оновити `docs/design-system/MF5_QA_REPORT.md` або створити `MF6_QA_REPORT.md` |

### Фінальні метрики

| Метрика | Було (MF5) | Ціль MF6 | Перевірка |
|---------|-----------|----------|-----------|
| `.btn {` дублікати | 1 (Button.vue) | 1 | `grep -rl '\.btn\s*{' src/` |
| `.btn-primary` scoped (не Button.vue) | 6 | 0 | `grep -rl '\.btn-primary' src/ \| grep -v Button.vue` |
| `.btn-secondary` scoped (не Button.vue) | 6 | 0 | аналогічно |
| `variant="destructive"` | 0 ✅ | 0 | `grep -rl 'destructive' src/` |
| Hex кольори в button стилях | ~20 | 0 | Ручна перевірка |
| Build | OK | OK | `npm run build` |

### DoD

- [ ] Всі findings з MF5 QA закриті
- [ ] 0 файлів з `.btn-primary` scoped (крім Button.vue)
- [ ] 0 hex кольорів в button стилях
- [ ] `npm run build` OK
- [ ] QA report створено

### Коміт

```
design(C-6): MF6 QA — final cleanup verified, 0 .btn duplicates remaining
```

---

## Розподіл файлів — НУЛЬ ПЕРЕТИНІВ

```
Агент A:
  src/modules/booking/components/availability/AvailabilityTemplateEditor.vue
  src/modules/booking/components/calendar/CalendarFooter.vue
  src/modules/booking/components/calendar/CalendarWeekView.vue
  src/modules/marketplace/components/TutorAvailabilityCalendar.vue

Агент B:
  src/components/ErrorBoundary.vue
  src/components/Notifications/PushHandler.vue
  src/components/relations/RelationActionButton.vue

Агент C (після A + B):
  docs/design-system/MF6_QA_REPORT.md (створити)
  НЕ редагує .vue файли

Вже виправлено (destructive → danger):
  src/modules/admin/components/AdminArchiveUserModal.vue      ✅
  src/modules/profile/components/settings/PrivacySettingsTab.vue  ✅
```

---

## Що НЕ входить в MF6

| Елемент | Причина |
|---------|---------|
| Raw `<button class="...">` в marketplace profile | Scoped з CSS vars, працюють з темами |
| Canvas/board кнопки | Специфічний UI |
| Chat inline кнопки | Chat-specific |
| Form-specific кнопки (remove, add slot) | Inline UI |
| PushHandler toast hex кольори для icon wrappers | Можна залишити як fallback |

---

## Після MF6

**Design System міграція вважається ЗАВЕРШЕНОЮ.**

Залишки — form-specific UI з scoped стилями та CSS variables, які коректно працюють з усіма темами. Подальша міграція — за потребою при рефакторингу окремих модулів.
