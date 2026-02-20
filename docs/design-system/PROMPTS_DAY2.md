# Design System — Промти День 2

> Всі 3 агенти працюють ПАРАЛЕЛЬНО
> Залежність: MF0 завершена (tokens.css існує, підключений в main.js)

---

## 🅰️ Агент A — День 2: MF1 CSS-класи для форм

> Копіювати цілком в чат агенту

---

```
Ти — Агент A (Tokens & CSS) в проєкті M4SH Design System.

Прочитай документацію:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md — загальний план
- D:\m4sh_v1\frontend\docs\design-system\05-tz-phase-4.md — детальне ТЗ Фази 4

Твоя зона файлів: src/styles/, src/assets/main.css, tailwind.config.js
НЕ ЧІПАЙ: src/ui/, src/modules/

Передумова: MF0 завершена — src/styles/tokens.css існує і підключений в main.js.

---

ЗАДАЧА: Виконай MF1 для Агента A — CSS-класи для форм (4 задачі).
Всі зміни в ОДНОМУ файлі: src/assets/main.css

### A-1.1. Додати форм-layout класи

Додай в src/assets/main.css всередині існуючого @layer components { ... }, ПІСЛЯ блоку .input (рядок ~300):

/* ─── Form Layout (Design System Phase 4) ─── */
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
  .form-row {
    grid-template-columns: 1fr;
  }
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  padding-top: var(--space-md);
}

### A-1.2. Уніфікувати .input і .form-control

Зараз в main.css є .input з хардкодженими значеннями:

.input {
  width: 100%;
  border-radius: 0.5rem;           ← хардкод
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  padding: 0.5rem 0.75rem;         ← хардкод
  transition: border-color 0.2s ease, box-shadow 0.2s ease;  ← хардкод
}

Заміни на токени і додай .form-control як аліас:

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

Також оновити :focus, .error, .disabled стейти — додати .form-control до кожного:

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
.input.disabled,
.form-control:disabled,
.form-control.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

ВАЖЛИВО: .form-control вже використовується в 214 місцях по проєкту. Додаючи його до .input, ми уніфікуємо обидва БЕЗ зміни HTML.

### A-1.3. Додати стилі для label/error/hint

Додай після блоку .form-actions:

/* ─── Form Labels (Design System Phase 4) ─── */
.form-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}
.form-error {
  font-size: var(--text-xs);
  color: var(--danger-bg);
  margin-top: var(--space-2xs);
}
.form-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-2xs);
}

### A-1.4. Уніфікувати .form-group

Додай глобальний .form-group щоб існуючі 214 використань стали консистентні:

/* ─── Form Group (backward-compatible global) ─── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}
.form-group label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

### ПЕРЕВІРКА

1. npm run build — OK
2. .form-control і .input виглядають однаково
3. Focus ring однаковий на всіх полях
4. .form-group label — однаковий розмір/вага
5. .form-stack — вертикальний layout з gap
6. .form-row — 2 колонки desktop, 1 колонка mobile
7. 3 теми — OK

### КОМІТ

git add -A
git commit -m "design(A-1): add form CSS classes, unify .input/.form-control with tokens"
git push

Після завершення оновити progress.md — задачі A-1.1 до A-1.4 позначити ✅.
```

---

## 🅱️ Агент B — День 2: MF1 UI-компоненти

> Копіювати цілком в чат агенту

---

```
Ти — Агент B (Components) в проєкті M4SH Design System.

Прочитай документацію:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md — загальний план
- D:\m4sh_v1\frontend\docs\design-system\03-tz-phase-2.md — детальне ТЗ Фази 2
- D:\m4sh_v1\frontend\docs\design-system\04-tz-phase-3.md — детальне ТЗ Фази 3

Твоя зона файлів: src/ui/
НЕ ЧІПАЙ: src/styles/, src/assets/, src/modules/, tailwind.config.js

Передумова: MF0 завершена — src/styles/tokens.css існує з токенами --radius-md, --space-xs, --text-sm тощо.

---

ЗАДАЧА: Виконай MF1 для Агента B — 7 задач (5 компонентів + Modal + ConfirmModal).
Роби по порядку, кожну задачу окремим комітом.

### B-1.1. Оновити Button.vue

Файл: src/ui/Button.vue

Поточний стан: Працює, варіанти primary/secondary/outline/danger/ghost, розміри sm/md/lg. Але немає pill, iconOnly, fullWidth.

Додай 3 нових пропси:

props: {
  // ... існуючі variant, size, loading, disabled
  pill: { type: Boolean, default: false },
  iconOnly: { type: Boolean, default: false },
  fullWidth: { type: Boolean, default: false },
}

Оновити computed classes — додати:
- pill → 'btn-pill'
- iconOnly → 'btn-icon-only'
- fullWidth → 'w-full'

Додати CSS (або в main.css якщо .btn там — координуй з Агентом A):
Ні, краще додай в <style scoped> в Button.vue:

.btn-pill {
  border-radius: var(--radius-full) !important;
}
.btn-icon-only {
  padding: 0.5rem !important;
  aspect-ratio: 1;
}

ВАЖЛИВО: Всі існуючі використання <Button> повинні працювати без змін.

Коміт: git commit -m "design(B-1.1): add pill, iconOnly, fullWidth props to Button"

### B-1.2. Створити Textarea.vue

Файл: src/ui/Textarea.vue (НОВИЙ)

Пропси: modelValue (string), label (string), rows (number, default 3), maxlength (number), error (string), help (string), placeholder (string), required (boolean), disabled (boolean), id (string, auto-generated)

Подія: update:modelValue

Template:
<div class="form-field">
  <label v-if="label" :for="inputId" class="form-field__label">
    {{ label }}<span v-if="required" class="text-danger"> *</span>
  </label>
  <textarea
    :id="inputId"
    :value="modelValue"
    :rows="rows"
    :maxlength="maxlength"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    class="input"
    :class="{ error: !!error }"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
  <div v-if="maxlength" class="form-field__hint" style="text-align: right;">
    {{ modelValue?.length || 0 }}/{{ maxlength }}
  </div>
  <div v-if="error" class="form-field__error">{{ error }}</div>
  <div v-else-if="help" class="form-field__hint">{{ help }}</div>
</div>

Scoped styles:
textarea.input {
  resize: vertical;
  min-height: 4.5rem;
}
.form-field { display: flex; flex-direction: column; gap: var(--space-2xs); }
.form-field__label { font-size: var(--text-sm); font-weight: 500; color: var(--text-primary); }
.form-field__error { font-size: var(--text-xs); color: var(--danger-bg); }
.form-field__hint { font-size: var(--text-xs); color: var(--text-secondary); }

Коміт: git commit -m "design(B-1.2): create Textarea.vue component"

### B-1.3. Створити FormField.vue

Файл: src/ui/FormField.vue (НОВИЙ)

Пропси: label (string), error (string), hint (string), required (boolean), htmlFor (string)

Template:
<div class="form-field">
  <label v-if="label" :for="htmlFor" class="form-field__label">
    {{ label }}<span v-if="required" class="text-danger"> *</span>
  </label>
  <slot />
  <div v-if="error" class="form-field__error">{{ error }}</div>
  <div v-else-if="hint" class="form-field__hint">{{ hint }}</div>
</div>

Ті ж scoped styles що в Textarea (.form-field, __label, __error, __hint).

Коміт: git commit -m "design(B-1.3): create FormField.vue wrapper component"

### B-1.4. Оновити Input.vue на токени

Файл: src/ui/Input.vue

Поточний стан: Використовує inline style="color: var(--text-primary)" і Tailwind класи (block mb-1 text-sm font-medium). Input використовує клас .input з main.css.

Зміни:
1. Label: замінити class="block mb-1 text-sm font-medium" style="color: var(--text-primary)" → class="form-field__label"
2. Error: замінити class="mt-1 text-sm" style="color: var(--danger-bg)" → class="form-field__error"
3. Help: замінити class="mt-1 text-sm" style="color: var(--text-secondary)" → class="form-field__hint"
4. Обгорнути все в <div class="form-field"> замість <div class="w-full">

НЕ ЗМІНЮВАТИ логіку, пропси, emit — тільки template/styles.

Коміт: git commit -m "design(B-1.4): update Input.vue to use design tokens"

### B-1.5. Оновити Select.vue на токени

Файл: src/ui/Select.vue

Поточний стан: Має scoped CSS з хардкодженими значеннями:
- .select-field__label: font-size: 0.875rem → var(--text-sm)
- .select-field__label: color: var(--text-muted, #4f5565) → var(--text-primary)
- .select: border-radius: var(--radius-md, 8px) → var(--radius-md)
- .select: border: 1px solid rgba(18, 28, 45, 0.14) → var(--border-color)
- .select: padding: 0.5rem 0.75rem → var(--space-xs) var(--space-sm)
- .select: background: #fff → var(--bg-secondary)

Також додати .select:focus стейт:
.select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

Коміт: git commit -m "design(B-1.5): update Select.vue to use design tokens"

### B-2.1. Створити Modal.vue

Файл: src/ui/Modal.vue (НОВИЙ)

Це найбільша задача. Детальне ТЗ в 04-tz-phase-3.md.

Ключові вимоги:
- Teleport to="body"
- Focus trap (Tab/Shift+Tab циклічний)
- Focus restore при закритті
- Escape закриває (якщо closeOnEsc && !persistent)
- Body scroll lock
- Backdrop blur
- Анімація fadeIn/slideUp
- role="dialog", aria-modal="true", aria-labelledby
- Розміри: sm (24rem), md (32rem), lg (48rem), full
- Слоти: default, #header, #footer

Пропси: open (boolean), title (string), size ('sm'|'md'|'lg'|'full', default 'md'), closeOnOverlay (boolean, default true), closeOnEsc (boolean, default true), persistent (boolean, default false)

Подія: @close

Повний CSS і HTML — в 04-tz-phase-3.md, секція 3.1.

Коміт: git commit -m "design(B-2.1): create Modal.vue with focus trap, a11y, animations"

### B-2.2. Створити ConfirmModal.vue

Файл: src/ui/ConfirmModal.vue (НОВИЙ)

Обгортка навколо Modal.vue:

<Modal :open="open" :title="title" size="sm" @close="$emit('cancel')">
  <p class="text-sm" style="color: var(--text-secondary);">{{ message }}</p>
  <slot />
  <template #footer>
    <Button variant="outline" @click="$emit('cancel')">{{ cancelText }}</Button>
    <Button :variant="variant" :loading="loading" @click="$emit('confirm')">{{ confirmText }}</Button>
  </template>
</Modal>

Пропси: open, title (default 'Підтвердження'), message, confirmText (default 'Підтвердити'), cancelText (default 'Скасувати'), variant ('primary'|'danger', default 'primary'), loading (boolean)

Події: @confirm, @cancel

Коміт: git commit -m "design(B-2.2): create ConfirmModal.vue"

### ПЕРЕВІРКА

1. npm run build — OK
2. Всі нові компоненти створені: Textarea.vue, FormField.vue, Modal.vue, ConfirmModal.vue
3. Button.vue — pill/iconOnly/fullWidth працюють
4. Input/Select — використовують токени
5. Modal — focus trap, Escape, анімація
6. 3 теми — OK

Після завершення оновити progress.md — задачі B-1.1 до B-2.2 позначити ✅.
```

---

## 🅲 Агент C — День 2: MF1 Аудит і підготовка до міграції

> Копіювати цілком в чат агенту

---

```
Ти — Агент C (Migration) в проєкті M4SH Design System.

Прочитай документацію:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md — загальний план
- D:\m4sh_v1\frontend\docs\design-system\06-tz-phase-5.md — детальне ТЗ Фази 5

Твоя зона файлів: src/modules/, docs/design-system/
НЕ ЧІПАЙ: src/ui/, src/styles/, src/assets/, tailwind.config.js

---

ЗАДАЧА: Виконай MF1 для Агента C — аудит і підготовка до міграції (4 задачі).
Поки Агенти A і B створюють компоненти, ти готуєш точний план міграції.

### C-1.1. Аудит сирих <button> по модулях

Порахуй кількість сирих <button> (не <Button>) в кожному модулі:

Виконай для кожного модуля:
grep -rn '<button ' src/modules/MODULE/ --include="*.vue" | wc -l

Модулі для аудиту:
- src/modules/auth/
- src/modules/dashboard/
- src/modules/inquiries/
- src/modules/marketplace/
- src/modules/profile/
- src/modules/booking/
- src/modules/payments/
- src/modules/chat/
- src/modules/classroom/
- src/modules/winterboard/
- src/modules/staff/

Також порахуй скільки вже використовують <Button>:
grep -rn '<Button ' src/modules/MODULE/ --include="*.vue" | wc -l

Запиши результати в таблицю.

### C-1.2. Аудит кастомних overlay-модалок

Знайди всі кастомні модалки (overlay-и) в кожному модулі:

grep -rn 'fixed inset-0\|fixed.*z-\[' src/modules/ --include="*.vue"

Також:
grep -rn 'v-if.*modal\|v-if.*dialog\|v-if.*overlay' src/modules/ --include="*.vue"

Для кожної знайденої модалки запиши:
- Файл
- Тип (confirm, form, info)
- Складність міграції (проста/середня/складна)

### C-1.3. Аудит хардкоджених кольорів

Знайди всі хардкоджені hex-кольори в модулях:

grep -rn '#[0-9a-fA-F]\{3,8\}' src/modules/ --include="*.vue"

Для кожного знайденого:
- Визнач чи це бренд-колір (Telegram #229ED9, GitHub #24292e) — залишити
- Чи це UI-колір — замінити на CSS-змінну
- Запропонуй заміну (наприклад #1976D2 → var(--accent))

Також знайди inline styles з кольорами:
grep -rn 'style=".*color:.*#\|style=".*background:.*#' src/modules/ --include="*.vue"

### C-1.4. Створити чеклист міграції

Створи файл docs/design-system/migration-checklist.md з результатами аудиту.

Формат:

# Design System — Чеклист міграції модулів

## Зведена таблиця

| Модуль | Сирих <button> | <Button> | Модалок | Hex-кольорів | Агент | Пріоритет |
|--------|---------------|----------|---------|-------------|-------|-----------|
| auth/ | ? | ? | ? | ? | A | 🔴 |
| dashboard/ | ? | ? | ? | ? | A | 🔴 |
| inquiries/ | ? | ? | ? | ? | B | 🔴 |
| marketplace/ | ? | ? | ? | ? | B | 🟡 |
| profile/ | ? | ? | ? | ? | B | 🟡 |
| booking/ | ? | ? | ? | ? | C | 🟡 |
| payments/ | ? | ? | ? | ? | A | 🟡 |
| chat/ | ? | ? | ? | ? | B | 🟢 |
| classroom/ | ? | ? | ? | ? | C | 🟢 |
| winterboard/ | ? | ? | ? | ? | C | 🟢 |
| staff/ | ? | ? | ? | ? | A | 🟢 |

## Детально по модулях

Для кожного модуля:

### MODULE_NAME (Агент X)

**Файли з сирими кнопками:**
- file1.vue (N кнопок)
- file2.vue (N кнопок)

**Модалки для заміни:**
- file.vue — тип: confirm/form, складність: проста/середня

**Хардкоджені кольори:**
- file.vue:123 — #XXXXXX → var(--xxx)

**Оцінка часу:** X годин

Заповни реальними даними з аудиту.

### КОМІТ

git add -A
git commit -m "design(C-1): audit modules — buttons, modals, hardcoded colors, migration checklist"
git push

Після завершення оновити progress.md — задачі C-1.1 до C-1.4 позначити ✅.
```
