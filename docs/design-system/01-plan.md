# M4SH — Глобальний план стилізації UI (Design System Stabilization)

> Мета: привести весь UI до єдиного вигляду "як застосунок" — однакові кнопки, модалки, форми, інпути, бейджі по всьому сайту. Перехід поступовий, безболісний, без зламу існуючого.

---

## 0. ПОТОЧНИЙ СТАН (Аудит)

### Що є:
- **19 UI-компонентів** в `src/ui/`: Button, Card, Alert, Badge, Avatar, Input, Select, Heading, EmptyState, LoadingSpinner, GlobalLoader, MenuItem, NotFound, NotificationDropdown, PageShell, PresenceDot, SideNav, ToastContainer, TopNav
- **5 CSS-файлів**: `main.css` (теми + компоненти), `m4sh.css` (типографіка), `tokens.css` (UI-аліаси), `ui-contract/tokens/tokens.css` (фоллбеки), `calendar-tokens.css`
- **3 теми**: Light (зелена), Dark (бірюзова), Classic (фіолетова)
- **Tailwind** з CSS-змінними, `data-theme` selector

### Що НЕ так (критичні проблеми):

| Проблема | Масштаб | Вплив |
|----------|---------|-------|
| **88% кнопок — сирий `<button>`** | 856 з 968 кнопок НЕ використовують `<Button>` | Різний вигляд кнопок по всьому сайту |
| **Немає `<Textarea>` компонента** | 20+ сирих `<textarea>` по проекту | Різне оформлення текстових полів |
| **Немає глобального `<Modal>`** | 63 модалки, кожна своя реалізація | Різні анімації, z-index, backdrop, Escape |
| **Форми без стандарту** | 214 різних `.form-*` класів | Різні відступи, радіуси, кольори |
| **Захардкоджені кольори** | CalendarFooter: `#1976D2`, модалки: `#d1d5db` | Не реагують на зміну теми |
| **3 різних border-radius** | Кнопки: 25px, інпути: 8px, модалки: 12-16px | Візуальний хаос |
| **Z-index конфлікти** | Модалки: 1000, ConfirmDialog: 1100, UI-contract: 210 | Перекриття елементів |
| **2 паралельні теми-системи** | Legacy (themeStore.js) + Modern (themeStore.ts) | Конфлікти, подвійне зберігання |
| **5 файлів з токенами** | Дублювання `--radius`, `--space` з різними значеннями | Непередбачуваність |

---

## 1. ФАЗА 1 — Токени та фундамент (1-2 дні)

### 1.1. Консолідація CSS-токенів

**Що робимо:** Об'єднати 5 файлів токенів в 1 єдиний `src/styles/tokens.css`.

**Файл:** `src/styles/tokens.css` (новий, замість розкиданих)

```
:root {
  /* ─── Radius ─── */
  --radius-xs:   4px;     /* маленькі елементи: бейджі, тоглі */
  --radius-sm:   6px;     /* чіпси, теги */
  --radius-md:   8px;     /* інпути, кнопки */
  --radius-lg:   12px;    /* картки, модалки */
  --radius-xl:   16px;    /* великі картки, секції */
  --radius-full: 9999px;  /* аватари, піли */

  /* ─── Spacing ─── */
  --space-2xs: 0.25rem;   /* 4px */
  --space-xs:  0.5rem;    /* 8px */
  --space-sm:  0.75rem;   /* 12px */
  --space-md:  1rem;      /* 16px */
  --space-lg:  1.5rem;    /* 24px */
  --space-xl:  2rem;      /* 32px */
  --space-2xl: 3rem;      /* 48px */

  /* ─── Typography ─── */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.125rem;  /* 18px */
  --text-xl:   1.25rem;   /* 20px */
  --text-2xl:  1.5rem;    /* 24px */

  /* ─── Shadows ─── */
  --shadow-xs:  0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm:  0 2px 4px rgba(0,0,0,0.06);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg:  0 8px 25px var(--shadow);
  --shadow-xl:  0 12px 35px var(--shadow-strong);

  /* ─── Z-index ─── */
  --z-dropdown:  100;
  --z-sticky:    150;
  --z-overlay:   200;
  --z-modal:     210;
  --z-toast:     300;
  --z-tooltip:   400;

  /* ─── Transition ─── */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Дії:**
1. Створити `src/styles/tokens.css` з єдиними значеннями
2. Поступово замінити посилання з `ui/tokens.css`, `m4sh.css`, `assets2/ui-contract/tokens/tokens.css`
3. Старі файли НЕ видаляти — додати `/* @deprecated — use src/styles/tokens.css */`
4. Оновити імпорт в `main.js`: додати `import './styles/tokens.css'` першим

---

### 1.2. Оновити tailwind.config.js

**Що робимо:** Синхронізувати Tailwind конфіг з новими токенами.

```js
// tailwind.config.js — додати/оновити:
theme: {
  extend: {
    borderRadius: {
      xs:   'var(--radius-xs)',
      sm:   'var(--radius-sm)',
      md:   'var(--radius-md)',
      lg:   'var(--radius-lg)',
      xl:   'var(--radius-xl)',
      full: 'var(--radius-full)',
    },
    zIndex: {
      dropdown: 'var(--z-dropdown)',
      sticky:   'var(--z-sticky)',
      overlay:  'var(--z-overlay)',
      modal:    'var(--z-modal)',
      toast:    'var(--z-toast)',
      tooltip:  'var(--z-tooltip)',
    },
  }
}
```

---

## 2. ФАЗА 2 — Базові UI-компоненти (2-3 дні)

### 2.1. Стандартизація `Button.vue`

**Поточний стан:** Працює добре, але `main.css` задає `.btn { border-radius: 25px }` (піл), а компонент використовує Tailwind класи — конфлікт.

**Що робимо:**
1. Привести радіус кнопки до `--radius-md` (8px) для звичайних, `--radius-full` для pill-варіанту
2. Додати варіант `pill` (поточний стиль 25px)
3. Оновити `.btn` в `main.css`: `border-radius: var(--radius-md)`
4. Кнопки в модалках і формах стануть однакові автоматично

**Цільовий API:**
```vue
<Button variant="primary" size="md">Зберегти</Button>
<Button variant="outline" size="sm" pill>Фільтр</Button>
<Button variant="danger" size="sm">Видалити</Button>
<Button variant="ghost" size="sm" icon-only><IconX /></Button>
```

**Нові пропси:**
- `pill: boolean` — закруглений як пілюля (border-radius: full)
- `iconOnly: boolean` — квадратна кнопка для іконки
- `fullWidth: boolean` — width: 100%

---

### 2.2. Створити `Textarea.vue`

**Чому:** 20+ сирих `<textarea>` по проекту з різним оформленням.

**Файл:** `src/ui/Textarea.vue`

**API:**
```vue
<Textarea
  v-model="text"
  label="Опис"
  :rows="4"
  :maxlength="500"
  :error="errorMsg"
  :help="helpText"
  required
/>
```

**Пропси:** `modelValue`, `label`, `rows`, `maxlength`, `error`, `help`, `required`, `disabled`, `placeholder`, `id`

**Стилі:** Використовує `.input` клас з `main.css` + `resize: vertical`, `min-height` автоматична по `rows`.

---

### 2.3. Створити `FormField.vue` (обгортка)

**Чому:** 214 різних `.form-group` реалізацій. Потрібна єдина обгортка.

**Файл:** `src/ui/FormField.vue`

**API:**
```vue
<FormField label="Email" :error="emailError" required>
  <Input v-model="email" type="email" />
</FormField>

<FormField label="Повідомлення" :error="msgError" :hint="`${msg.length}/500`">
  <Textarea v-model="msg" :maxlength="500" />
</FormField>
```

**Пропси:** `label`, `error`, `hint`, `required`, `htmlFor`

**Стилі:**
```css
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}
.form-field__label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}
.form-field__error {
  font-size: var(--text-xs);
  color: var(--danger-bg);
}
.form-field__hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
```

---

### 2.4. Стандартизація `Input.vue` і `Select.vue`

**Що робимо:**
1. `Input.vue` — привести до єдиних токенів (`--radius-md`, `--space-sm`)
2. `Select.vue` — прибрати скопований CSS, використати `.input` клас
3. Обидва компоненти: єдиний фокус-стейт `box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent)`
4. Єдиний error-стейт: `border-color: var(--danger-bg)`

---

## 3. ФАЗА 3 — Глобальна модалка (2-3 дні)

### 3.1. Створити `Modal.vue` в `src/ui/`

**Поточний стан:** 63 модалки, 2 реалізації (`components/ui/Modal.vue` — бідна; `assets2/ui-contract/Modal.vue` — крута, але ніхто не використовує), решта — кастомні overlay-и.

**Що робимо:** Створити ОДНУ стандартну модалку в `src/ui/Modal.vue` на базі `ui-contract/Modal.vue`, але спрощену.

**Файл:** `src/ui/Modal.vue`

**API:**
```vue
<Modal
  :open="showModal"
  @close="showModal = false"
  title="Підтвердження"
  size="md"
>
  <p>Ви впевнені?</p>
  <template #footer>
    <Button variant="outline" @click="showModal = false">Скасувати</Button>
    <Button variant="primary" @click="confirm">Підтвердити</Button>
  </template>
</Modal>
```

**Пропси:**
- `open: boolean` — видимість
- `title?: string` — заголовок (опціонально, можна через slot)
- `size: 'sm' | 'md' | 'lg' | 'full'` — ширина (24rem / 32rem / 48rem / 100%)
- `closeOnOverlay: boolean` — закриття по кліку на backdrop (default: true)
- `closeOnEsc: boolean` — закриття по Escape (default: true)
- `persistent: boolean` — не закривати по overlay/esc (для форм)

**Обов'язкові фічі:**
- `<Teleport to="body">`
- Focus trap (Tab циклічний)
- Збереження і відновлення фокусу
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Backdrop: `rgba(0,0,0,0.5)` + `backdrop-filter: blur(4px)`
- Анімація: fadeIn overlay + slideUp контент
- Z-index: `var(--z-modal)` = 210

**Слоти:** `default` (body), `#header`, `#footer`

**Стилі:**
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-md);
}
.modal-content {
  z-index: var(--z-modal);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  width: 100%;
}
.modal-content--sm { max-width: 24rem; }
.modal-content--md { max-width: 32rem; }
.modal-content--lg { max-width: 48rem; }
.modal-content--full { max-width: calc(100vw - 2rem); }
.modal-header {
  padding: var(--space-lg) var(--space-lg) var(--space-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.modal-body {
  padding: var(--space-sm) var(--space-lg);
}
.modal-footer {
  padding: var(--space-sm) var(--space-lg) var(--space-lg);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
}
```

---

### 3.2. Створити `ConfirmModal.vue`

**Чому:** Часто потрібне просте "Ви впевнені?" — зараз це `ConfirmDialog.vue` з іншим z-index і стилями.

**Файл:** `src/ui/ConfirmModal.vue`

**API:**
```vue
<ConfirmModal
  :open="showConfirm"
  @confirm="handleDelete"
  @cancel="showConfirm = false"
  title="Видалення"
  message="Цю дію не можна скасувати."
  confirm-text="Видалити"
  variant="danger"
/>
```

**Реалізація:** Обгортка навколо `Modal.vue` з preset-контентом.

---

## 4. ФАЗА 4 — Глобальні CSS-класи для форм (1 день)

### 4.1. Додати форм-стилі в `main.css`

**Що робимо:** Додати в `@layer components` стандартні класи для форм, щоб навіть сирі HTML-елементи виглядали добре.

```css
@layer components {
  /* ─── Form Layout ─── */
  .form-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
  }
  @media (max-width: 640px) {
    .form-row { grid-template-columns: 1fr; }
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-xs);
    padding-top: var(--space-md);
  }

  /* ─── Form Elements (глобальний фоллбек) ─── */
  .input,
  .form-control {
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }
  .input:focus,
  .form-control:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
  }
  .input.error,
  .form-control.error {
    border-color: var(--danger-bg);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger-bg) 15%, transparent);
  }
  .input:disabled,
  .form-control:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ─── Labels ─── */
  .form-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-primary);
  }
  .form-error {
    font-size: var(--text-xs);
    color: var(--danger-bg);
  }
  .form-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
}
```

---

## 5. ФАЗА 5 — Поступова міграція модулів (5-7 днів)

### Стратегія: модуль за модулем, без великого рефакторингу

Кожен модуль мігрується незалежно. Для кожного модуля:
1. Замінити сирі `<button>` на `<Button>`
2. Замінити сирі `<textarea>` на `<Textarea>`
3. Замінити кастомні overlay-модалки на `<Modal>`
4. Замінити `.form-group` на `<FormField>` або `.form-stack`
5. Прибрати захардкоджені кольори на CSS-змінні
6. Перевірити темну тему

### Порядок міграції (за пріоритетом):

| # | Модуль | Файлів | Кнопок сирих | Модалок | Пріоритет |
|---|--------|--------|-------------|---------|-----------|
| 1 | **inquiries/** | 5 | ~15 | 3 (InquiryFormModal, RejectInquiry, CreateInquiry) | 🔴 Високий — видно студенту |
| 2 | **dashboard/** | 8 | ~20 | 0 | 🔴 Високий — перша сторінка |
| 3 | **auth/** | 12 | ~30 | 4 (MFA, WebAuthn, Backup, Unlock) | 🔴 Високий — перше враження |
| 4 | **marketplace/** | 15 | ~40 | 5 (Draft, Filters, Merge, Publish, Review) | 🟡 Середній |
| 5 | **profile/** | 10 | ~25 | 2 (Telegram, settings) | 🟡 Середній |
| 6 | **booking/** | 20 | ~150 | 7 (CreateLesson, Booking, Reschedule, etc.) | 🟡 Середній — найбільший модуль |
| 7 | **payments/** | 5 | ~10 | 2 (Cancel, SubscriptionRequired) | 🟡 Середній |
| 8 | **chat/** | 8 | ~20 | 2 (ChatModal, MessageEdit) | 🟢 Низький |
| 9 | **classroom/** | 6 | ~15 | 2 (Invite, History) | 🟢 Низький |
| 10 | **winterboard/** | 30 | ~100 | 1 (Export) | 🟢 Низький — специфічний UI |
| 11 | **staff/** (admin) | 10 | ~30 | 3 (Grant, Finalize, Report) | 🟢 Низький — не бачить клієнт |

### Приклад міграції модуля (inquiries):

**До:**
```vue
<!-- InquiryFormModal.vue — ЗАРАЗ -->
<div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center">
  <div class="fixed inset-0 bg-black/50" @click="close" />
  <div class="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
    <h2 class="text-xl font-bold mb-4">Створити запит</h2>
    <div class="form-group">
      <label>Повідомлення</label>
      <textarea v-model="form.message" class="form-control" rows="4" />
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <button class="btn btn-outline" @click="close">Скасувати</button>
      <button class="btn btn-primary" @click="submit">Надіслати</button>
    </div>
  </div>
</div>
```

**Після:**
```vue
<!-- InquiryFormModal.vue — ПІСЛЯ МІГРАЦІЇ -->
<Modal :open="isOpen" @close="close" title="Створити запит" size="md">
  <div class="form-stack">
    <FormField label="Повідомлення" :error="msgError" required>
      <Textarea v-model="form.message" :rows="4" :maxlength="500" />
    </FormField>
  </div>
  <template #footer>
    <Button variant="outline" @click="close">Скасувати</Button>
    <Button variant="primary" :loading="submitting" @click="submit">Надіслати</Button>
  </template>
</Modal>
```

---

## 6. ФАЗА 6 — Очищення CSS і теми (1-2 дні)

### 6.1. Консолідація тем
- Вирішити конфлікт Legacy themeStore.js vs Modern themeStore.ts
- Рекомендація: залишити Legacy (light/dark/classic) — він вже працює на проді
- Modern themeStore.ts — видалити або використати тільки для Winterboard

### 6.2. Видалення дублікатів
- `src/ui/tokens.css` → `@deprecated`, посилання на `styles/tokens.css`
- `src/assets2/ui-contract/tokens/tokens.css` → `@deprecated`
- `src/styles/m4sh.css` → перенести потрібне в `tokens.css` + `main.css`
- `src/components/ui/Modal.vue` → видалити, замінити на `src/ui/Modal.vue`

### 6.3. Аудит захардкоджених кольорів
Файли з хардкодом (замінити на CSS-змінні):
- `CalendarFooter.vue`: `#1976D2`, `#1565C0`, `#f5f7fa` → `var(--accent)`, `var(--bg-secondary)`
- `CreateLessonModal.vue`: `#d1d5db`, `#3b82f6` → `var(--border-color)`, `var(--accent)`
- `TelegramNotifications.vue`: `#229ED9` → залишити (бренд Telegram)
- Всі `rgba(0,0,0,0.5)` для overlay → `var(--color-overlay, rgba(0,0,0,0.5))`

---

## 7. ФАЗА 7 — Тестування і QA (1-2 дні)

### 7.1. Чеклист по темах
Для кожної теми (Light, Dark, Classic) перевірити:
- [ ] Кнопки: всі варіанти видимі, контрастні
- [ ] Модалки: backdrop не зливається, контент читабельний
- [ ] Форми: інпути видимі, фокус помітний, помилки червоні
- [ ] Картки: межі видимі, тіні помірні
- [ ] Бейджі: текст читабельний на фоні
- [ ] Тости: помітні, не зливаються

### 7.2. Responsive чеклист
- [ ] Мобільний (375px): модалки full-width, кнопки стекаються
- [ ] Планшет (768px): форми 2-колонкові, sidebar ховається
- [ ] Desktop (1280px): повний layout

### 7.3. Accessibility
- [ ] Focus visible на всіх інтерактивних елементах
- [ ] Escape закриває всі модалки
- [ ] Tab-порядок логічний в модалках (focus trap)
- [ ] Color contrast ratio >= 4.5:1 для тексту

---

## 8. РЕЗУЛЬТАТ

### Компоненти після міграції:

| Компонент | Файл | Статус |
|-----------|------|--------|
| `Button` | `src/ui/Button.vue` | Оновити (pill, iconOnly, fullWidth) |
| `Input` | `src/ui/Input.vue` | Оновити (токени) |
| `Select` | `src/ui/Select.vue` | Оновити (токени) |
| `Textarea` | `src/ui/Textarea.vue` | **НОВИЙ** |
| `FormField` | `src/ui/FormField.vue` | **НОВИЙ** |
| `Modal` | `src/ui/Modal.vue` | **НОВИЙ** (заміна 63 кастомних) |
| `ConfirmModal` | `src/ui/ConfirmModal.vue` | **НОВИЙ** (заміна ConfirmDialog) |
| `Card` | `src/ui/Card.vue` | Без змін |
| `Alert` | `src/ui/Alert.vue` | Без змін |
| `Badge` | `src/ui/Badge.vue` | Без змін |
| `Avatar` | `src/ui/Avatar.vue` | Без змін |
| `Heading` | `src/ui/Heading.vue` | Без змін |

### CSS після очищення:

| Файл | Роль |
|------|------|
| `src/styles/tokens.css` | **ЄДИНЕ джерело** токенів (radius, spacing, z-index, shadows, transitions) |
| `src/assets/main.css` | Tailwind + 3 теми + component classes (.btn, .card, .input, .form-*) |
| `src/styles/m4sh.css` | Тільки типографіка (headline-*, text-muted) |

### Метрики успіху:
- ✅ 0 кастомних overlay-модалок (всі через `<Modal>`)
- ✅ 0 сирих `<textarea>` (всі через `<Textarea>`)
- ✅ < 50 сирих `<button>` (залишаться тільки в Winterboard canvas)
- ✅ 0 захардкоджених кольорів поза бренд-кольорами (Telegram blue)
- ✅ 1 файл токенів замість 5
- ✅ Єдиний z-index для всіх модалок
- ✅ Всі 3 теми працюють коректно

---

## ПРАВИЛА БЕЗБОЛІСНОГО ПЕРЕХОДУ

1. **Не ламати існуюче.** Старі CSS-класи (.form-group, .form-control) продовжують працювати — їх стилі уніфікуються через `main.css`
2. **Backward compatible.** Нові компоненти додаються, старі НЕ видаляються одразу
3. **Модуль за модулем.** Кожна міграція — окремий коміт, окремий деплой
4. **Deprecated маркери.** Старі файли/компоненти позначати `@deprecated` з посиланням на новий
5. **Тестувати кожну тему.** Після кожної фази перевіряти Light, Dark, Classic
6. **Не чіпати Winterboard.** Він має специфічний canvas UI — мігрувати останнім або не мігрувати

---

*Дата створення: 2025-02-20*
*Оцінка загального часу: 12-18 днів*
*Пріоритет: Фаза 1-3 (фундамент + компоненти) — критично, решта — поступово*
