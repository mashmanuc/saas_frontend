# ТЗ — Фаза 2: Базові UI-компоненти

> Тривалість: 2-3 дні
> Залежності: Фаза 1 (токени)
> Ризик зламу: низький (додаємо нові компоненти, оновлюємо існуючі backward-compatible)

---

## Мета

Створити і оновити базові UI-компоненти: Button (оновити), Textarea (новий), FormField (новий), Input/Select (оновити на токени). Після цього будуть всі "цеглинки" для уніфікації форм.

---

## Задачі

### 2.1. Оновити `Button.vue`

**Файл:** `src/ui/Button.vue`

**Поточний стан:** Працює, варіанти: primary, secondary, outline, danger, ghost. Розміри: sm, md, lg. Але `main.css` задає `.btn { border-radius: 25px }` (pill), а компонент це не контролює.

**Зміни:**

1. **Додати пропси:**
   - `pill: boolean` (default: false) — закруглений як пілюля
   - `iconOnly: boolean` (default: false) — квадратна кнопка під іконку
   - `fullWidth: boolean` (default: false) — width: 100%

2. **Оновити CSS:**
   - Звичайна кнопка: `border-radius: var(--radius-md)` (8px)
   - `pill=true`: `border-radius: var(--radius-full)` (9999px)
   - `iconOnly=true`: однаковий width/height, padding рівний

3. **Оновити `.btn` в `main.css`:**
   ```css
   .btn {
     border-radius: var(--radius-md); /* було: 25px */
   }
   .btn-pill {
     border-radius: var(--radius-full);
   }
   ```

**API після оновлення:**
```vue
<Button variant="primary" size="md">Зберегти</Button>
<Button variant="outline" size="sm" pill>Фільтр</Button>
<Button variant="danger" size="sm">Видалити</Button>
<Button variant="ghost" size="sm" icon-only>✕</Button>
<Button variant="primary" full-width>Увійти</Button>
```

**Критерій готовності:**
- Всі існуючі використання `<Button>` працюють без змін
- Нові пропси `pill`, `iconOnly`, `fullWidth` працюють
- `.btn` клас в CSS використовує `--radius-md`

---

### 2.2. Створити `Textarea.vue`

**Файл:** `src/ui/Textarea.vue` (новий)

**Пропси:**
| Проп | Тип | Default | Опис |
|------|-----|---------|------|
| `modelValue` | `string` | `''` | v-model |
| `label` | `string` | — | Лейбл над полем |
| `rows` | `number` | `3` | Кількість рядків |
| `maxlength` | `number` | — | Максимальна довжина |
| `error` | `string` | — | Текст помилки (червоний) |
| `help` | `string` | — | Підказка (сірий) |
| `placeholder` | `string` | — | Плейсхолдер |
| `required` | `boolean` | `false` | Зірочка біля label |
| `disabled` | `boolean` | `false` | Заблокований |
| `id` | `string` | auto | HTML id |

**Події:** `update:modelValue`

**Template:**
```vue
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
  <div v-if="maxlength" class="form-field__hint text-right">
    {{ modelValue?.length || 0 }}/{{ maxlength }}
  </div>
  <div v-if="error" class="form-field__error">{{ error }}</div>
  <div v-else-if="help" class="form-field__hint">{{ help }}</div>
</div>
```

**Стилі (scoped):**
```css
textarea.input {
  resize: vertical;
  min-height: calc(var(--text-sm) * 1.5 * v-bind(rows) + var(--space-xs) * 2);
}
```

**Критерій готовності:**
- Компонент створений
- `v-model` працює
- Error/help/maxlength counter відображаються
- Стилі відповідають існуючому `.input` класу
- Виглядає однаково у всіх 3 темах

---

### 2.3. Створити `FormField.vue`

**Файл:** `src/ui/FormField.vue` (новий)

**Призначення:** Обгортка для будь-якого поля форми — label + slot + error/hint. Замінює 214 різних `.form-group` реалізацій.

**Пропси:**
| Проп | Тип | Default | Опис |
|------|-----|---------|------|
| `label` | `string` | — | Текст лейблу |
| `error` | `string` | — | Текст помилки |
| `hint` | `string` | — | Підказка |
| `required` | `boolean` | `false` | Зірочка |
| `htmlFor` | `string` | — | Атрибут for (якщо потрібен) |

**Template:**
```vue
<div class="form-field">
  <label v-if="label" :for="htmlFor" class="form-field__label">
    {{ label }}<span v-if="required" class="text-danger"> *</span>
  </label>
  <slot />
  <div v-if="error" class="form-field__error">{{ error }}</div>
  <div v-else-if="hint" class="form-field__hint">{{ hint }}</div>
</div>
```

**Стилі (scoped):**
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

**Приклад використання:**
```vue
<FormField label="Email" :error="emailError" required>
  <Input v-model="email" type="email" />
</FormField>

<FormField label="Опис" :hint="`${desc.length}/500`">
  <Textarea v-model="desc" :maxlength="500" :rows="4" />
</FormField>
```

**Критерій готовності:**
- Компонент створений і експортований з `src/ui/`
- Працює з `<Input>`, `<Select>`, `<Textarea>`, та сирими `<input>`
- Label/error/hint відображаються коректно

---

### 2.4. Оновити `Input.vue` і `Select.vue` на токени

**Файли:** `src/ui/Input.vue`, `src/ui/Select.vue`

**Зміни для обох:**

1. **Border-radius:** Замінити хардкод на `var(--radius-md)`
2. **Padding:** Замінити на `var(--space-xs) var(--space-sm)`
3. **Focus ring:** Єдиний стиль:
   ```css
   outline: none;
   border-color: var(--accent);
   box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
   ```
4. **Error state:** Єдиний стиль:
   ```css
   border-color: var(--danger-bg);
   box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger-bg) 15%, transparent);
   ```
5. **Font-size:** `var(--text-sm)`
6. **Transition:** `var(--transition-fast)`

**Критерій готовності:**
- Input і Select використовують CSS-змінні
- Focus і error стейти однакові
- Зовнішній вигляд не змінився (значення токенів збігаються з поточними хардкодами)

---

## Перевірка

- [ ] `npm run build` — OK
- [ ] Нові компоненти: `Textarea.vue`, `FormField.vue` — створені
- [ ] `Button.vue` — pill/iconOnly/fullWidth працюють
- [ ] Input/Select — фокус і помилки однакові
- [ ] Всі 3 теми — OK
- [ ] Існуючі сторінки виглядають як раніше

---

## Що НЕ робимо в цій фазі

- Не замінюємо сирі `<textarea>` на `<Textarea>` (це Фаза 5)
- Не замінюємо `.form-group` на `<FormField>` (це Фаза 5)
- Не чіпаємо модулі — тільки `src/ui/`
