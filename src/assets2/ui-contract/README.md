# UI Contract System

Ізольована UI система для M4SH проєкту. Використовує CSS modules для ізоляції стилів та CSS variables для theming.

## Встановлення

```ts
// main.ts або App.vue
import '@/assets2/ui-contract/tokens/tokens.css';
```

## Компоненти

### Button

```vue
<script setup>
import { Button } from '@/assets2/ui-contract';
</script>

<template>
  <!-- Базове використання -->
  <Button>Зберегти</Button>

  <!-- Варіанти -->
  <Button variant="primary">Primary</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="danger">Danger</Button>
  <Button variant="outline">Outline</Button>
  <Button variant="ghost">Ghost</Button>

  <!-- Розміри -->
  <Button size="sm">Small</Button>
  <Button size="md">Medium</Button>
  <Button size="lg">Large</Button>

  <!-- Стани -->
  <Button loading>Завантаження...</Button>
  <Button disabled>Вимкнено</Button>
  <Button active>Активний</Button>

  <!-- З іконками -->
  <Button>
    <template #iconLeft>➕</template>
    Додати
  </Button>

  <!-- Тільки іконка -->
  <Button icon-only aria-label="Налаштування">
    <template #iconLeft>⚙️</template>
  </Button>
</template>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | 'primary' \| 'secondary' \| 'danger' \| 'outline' \| 'ghost' | 'primary' | Візуальний варіант |
| size | 'sm' \| 'md' \| 'lg' | 'md' | Розмір кнопки |
| loading | boolean | false | Показує спінер |
| disabled | boolean | false | Вимикає кнопку |
| active | boolean | false | Активний стан |
| fullWidth | boolean | false | На всю ширину |
| iconOnly | boolean | false | Тільки іконка |

---

### Modal

```vue
<script setup>
import { ref } from 'vue';
import { Modal, Button } from '@/assets2/ui-contract';

const isOpen = ref(false);
</script>

<template>
  <Button @click="isOpen = true">Відкрити</Button>

  <Modal v-model="isOpen" title="Заголовок">
    <p>Контент модального вікна</p>

    <template #footer>
      <Button variant="secondary" @click="isOpen = false">Скасувати</Button>
      <Button @click="save">Зберегти</Button>
    </template>
  </Modal>
</template>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| modelValue | boolean | required | v-model для відкриття/закриття |
| title | string | - | Заголовок |
| type | 'confirm' \| 'form' \| 'info' | 'info' | Тип модалки |
| size | 'sm' \| 'md' \| 'lg' \| 'fullscreen' | 'md' | Розмір |
| showCloseButton | boolean | true | Показувати кнопку закриття |
| closeOnOverlay | boolean | true | Закривати при кліку на overlay |
| closeOnEsc | boolean | true | Закривати по ESC |
| footerAlign | 'left' \| 'center' \| 'right' \| 'space-between' | 'right' | Вирівнювання footer |

**Features:**
- Focus trap (Tab циклічно переміщує фокус всередині модалки)
- ESC для закриття
- Блокує scroll body
- Повертає фокус після закриття

---

### Select

```vue
<script setup>
import { ref } from 'vue';
import { Select } from '@/assets2/ui-contract';

const selected = ref(null);
const options = [
  { value: 'ua', label: 'Україна' },
  { value: 'pl', label: 'Польща' },
  { value: 'de', label: 'Німеччина', group: 'EU' },
];
</script>

<template>
  <Select
    v-model="selected"
    :options="options"
    placeholder="Оберіть країну"
    searchable
    clearable
  />
</template>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| modelValue | T \| null | null | v-model значення |
| options | SelectOption[] | required | Масив опцій |
| placeholder | string | 'Оберіть...' | Placeholder |
| disabled | boolean | false | Вимкнений |
| error | boolean | false | Стан помилки |
| loading | boolean | false | Завантаження |
| searchable | boolean | false | Показувати пошук |
| searchThreshold | number | 5 | Авто-пошук якщо > N опцій |
| clearable | boolean | false | Можна очистити |

**Keyboard:**
- `ArrowDown/Up` - навігація
- `Enter` - вибір
- `Escape` - закрити

---

### Dropdown

```vue
<script setup>
import { Dropdown, Button } from '@/assets2/ui-contract';

const items = [
  { id: 'edit', label: 'Редагувати', icon: '✏️' },
  { id: 'copy', label: 'Копіювати', shortcut: 'Ctrl+C' },
  'divider',
  { header: 'Небезпечні дії' },
  { id: 'delete', label: 'Видалити', danger: true },
];

const handleSelect = (item) => {
  console.log('Selected:', item.id);
};
</script>

<template>
  <Dropdown :items="items" @select="handleSelect">
    <template #trigger>
      <Button variant="secondary">Меню ▼</Button>
    </template>
  </Dropdown>
</template>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| items | DropdownItemType[] | required | Елементи меню |
| position | 'bottom-left' \| 'bottom-right' \| 'top-left' \| 'top-right' | 'bottom-left' | Позиція |
| closeOnSelect | boolean | true | Закривати після вибору |
| disabled | boolean | false | Вимкнений |

---

### FormField

```vue
<script setup>
import { ref } from 'vue';
import { FormField } from '@/assets2/ui-contract';

const email = ref('');
const bio = ref('');
</script>

<template>
  <!-- Базовий input -->
  <FormField
    v-model="email"
    label="Email"
    type="email"
    placeholder="your@email.com"
    required
  />

  <!-- З помилкою -->
  <FormField
    v-model="email"
    label="Email"
    error-text="Невірний формат email"
  />

  <!-- Textarea з лічильником -->
  <FormField
    v-model="bio"
    label="Про себе"
    type="textarea"
    :max-length="500"
    show-char-count
    helper-text="Розкажіть про себе"
  />

  <!-- З іконками -->
  <FormField v-model="search" placeholder="Пошук...">
    <template #iconLeft>🔍</template>
  </FormField>
</template>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| modelValue | string \| number | '' | v-model значення |
| label | string | - | Label |
| type | InputType | 'text' | Тип input |
| placeholder | string | - | Placeholder |
| helperText | string | - | Допоміжний текст |
| errorText | string | - | Текст помилки |
| required | boolean | false | Обов'язкове поле |
| disabled | boolean | false | Вимкнено |
| maxLength | number | - | Максимальна довжина |
| showCharCount | boolean | false | Показувати лічильник символів |

---

## UI Contract Rules

### ✅ ДОЗВОЛЕНО

1. **Використовувати компоненти як є**
   ```vue
   <Button variant="primary">OK</Button>
   ```

2. **Змінювати токени глобально**
   ```css
   :root {
     --ui-color-primary: #your-color;
   }
   ```

3. **Додавати className для позиціонування**
   ```vue
   <Button class="mt-4">Кнопка</Button>
   ```

### ❌ ЗАБОРОНЕНО

1. **Перевизначати внутрішні стилі компонентів**
   ```css
   /* НЕ РОБІТЬ ТАК */
   .button { background: red !important; }
   ```

2. **Використовувати inline styles для кольорів**
   ```vue
   <!-- НЕ РОБІТЬ ТАК -->
   <Button style="background: red">X</Button>
   ```

3. **Копіювати код компонентів**
   Завжди імпортуйте з ui-contract.

---

## Theming

Система використовує CSS variables з fallback до `assets/main.css`:

```css
/* tokens/tokens.css */
:root {
  --ui-color-primary: var(--accent, #059669);
  --ui-color-danger: var(--danger-bg, #ef4444);
  /* ... */
}
```

### Змінити тему

```css
/* Ваш custom-theme.css */
:root {
  --ui-color-primary: #6366f1;
  --ui-color-primary-hover: #4f46e5;
}
```

Або для конкретного блоку:

```css
.my-section {
  --ui-color-primary: #ec4899;
}
```

---

## Файлова структура

```
ui-contract/
├── index.ts              # Головний експорт
├── README.md             # Документація
├── tokens/
│   └── tokens.css        # CSS variables
├── components/
│   ├── index.ts          # Експорт компонентів
│   ├── Button/
│   │   ├── Button.vue
│   │   └── index.ts
│   ├── Modal/
│   ├── Select/
│   ├── Dropdown/
│   └── FormField/
└── examples/
    └── usage-examples.md
```
