# ТЗ — Фаза 4: Глобальні CSS-класи для форм

> Тривалість: 1 день
> Залежності: Фаза 1 (токени)
> Ризик зламу: мінімальний (додаємо CSS, не змінюємо HTML)

---

## Мета

Додати стандартні CSS-класи для layout форм в `main.css`. Це зробить навіть сирі HTML-форми (які ще не мігровані на компоненти) однаковими по всьому сайті.

---

## Задачі

### 4.1. Додати форм-стилі в `main.css`

**Файл:** `src/assets/main.css`

**Де:** Всередині існуючого `@layer components { ... }`, після блоку `.card`.

**Що додати:**

```css
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
```

---

### 4.2. Уніфікувати існуючі `.input` і `.form-control`

**Файл:** `src/assets/main.css`

**Що:** Замінити хардкоджені значення на токени в існуючому `.input` блоці:

**Було:**
```css
.input {
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  padding: 0.5rem 0.75rem;
}
```

**Стає:**
```css
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
```

**Важливо:** `.form-control` — це клас який вже використовується в 214 місцях. Додаючи його до `.input`, ми уніфікуємо обидва без зміни HTML.

---

### 4.3. Додати стилі для label/error/hint

**Файл:** `src/assets/main.css`

```css
/* ─── Form Labels ─── */
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
```

---

### 4.4. Уніфікувати `.form-group`

**Файл:** `src/assets/main.css`

**Що:** Додати глобальний `.form-group` щоб існуючі 214 використань стали консистентні:

```css
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
```

**Це backward-compatible:** `.form-group` вже використовується в HTML — додаємо йому стилі глобально.

---

## Перевірка

- [ ] `npm run build` — OK
- [ ] `.form-control` і `.input` виглядають однаково
- [ ] Focus ring однаковий на всіх полях
- [ ] `.form-group label` — однаковий розмір/вага тексту
- [ ] `.form-stack` — вертикальний layout з gap
- [ ] `.form-row` — 2-колонковий на desktop, 1-колонковий на mobile
- [ ] `.form-actions` — кнопки справа
- [ ] 3 теми — OK

---

## Що НЕ робимо в цій фазі

- Не змінюємо HTML в модулях
- Не замінюємо `.form-group` на `<FormField>` (це Фаза 5)
- Не рефакторимо компоненти
