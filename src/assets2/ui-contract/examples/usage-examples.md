# Приклади використання UI Contract

## Повна форма з валідацією

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { Button, FormField, Select, Modal } from '@/assets2/ui-contract';

const form = ref({
  name: '',
  email: '',
  country: null,
  bio: '',
});

const errors = ref<Record<string, string>>({});
const isSubmitting = ref(false);
const showSuccess = ref(false);

const countries = [
  { value: 'ua', label: 'Україна' },
  { value: 'pl', label: 'Польща' },
  { value: 'de', label: 'Німеччина' },
];

const validate = () => {
  errors.value = {};

  if (!form.value.name.trim()) {
    errors.value.name = "Ім'я обов'язкове";
  }

  if (!form.value.email.includes('@')) {
    errors.value.email = 'Невірний формат email';
  }

  if (!form.value.country) {
    errors.value.country = 'Оберіть країну';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;

  isSubmitting.value = true;
  // API call...
  await new Promise(r => setTimeout(r, 1500));
  isSubmitting.value = false;
  showSuccess.value = true;
};
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4 max-w-md">
    <FormField
      v-model="form.name"
      label="Ім'я"
      placeholder="Введіть ваше ім'я"
      required
      :error-text="errors.name"
    />

    <FormField
      v-model="form.email"
      label="Email"
      type="email"
      placeholder="your@email.com"
      required
      :error-text="errors.email"
    />

    <div>
      <label class="block text-sm font-medium mb-1">Країна *</label>
      <Select
        v-model="form.country"
        :options="countries"
        placeholder="Оберіть країну"
        :error="!!errors.country"
      />
      <p v-if="errors.country" class="text-red-500 text-xs mt-1">{{ errors.country }}</p>
    </div>

    <FormField
      v-model="form.bio"
      label="Про себе"
      type="textarea"
      :max-length="300"
      show-char-count
      helper-text="Необов'язково"
    />

    <Button type="submit" :loading="isSubmitting" full-width>
      Зберегти
    </Button>
  </form>

  <Modal v-model="showSuccess" title="Успіх!" type="info" size="sm">
    <p>Ваші дані збережено!</p>
    <template #footer>
      <Button @click="showSuccess = false">OK</Button>
    </template>
  </Modal>
</template>
```

---

## Confirm Dialog Pattern

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Button, Modal } from '@/assets2/ui-contract';

const showConfirm = ref(false);
const itemToDelete = ref<{ id: number; name: string } | null>(null);

const openDeleteConfirm = (item: { id: number; name: string }) => {
  itemToDelete.value = item;
  showConfirm.value = true;
};

const confirmDelete = async () => {
  if (!itemToDelete.value) return;
  // await api.delete(itemToDelete.value.id);
  showConfirm.value = false;
  itemToDelete.value = null;
};
</script>

<template>
  <Button variant="danger" @click="openDeleteConfirm({ id: 1, name: 'Item' })">
    Видалити
  </Button>

  <Modal
    v-model="showConfirm"
    title="Підтвердження видалення"
    type="confirm"
    size="sm"
  >
    <p>Ви впевнені, що хочете видалити "{{ itemToDelete?.name }}"?</p>
    <p class="text-sm text-gray-500 mt-2">Цю дію неможливо відмінити.</p>

    <template #footer>
      <Button variant="secondary" @click="showConfirm = false">
        Скасувати
      </Button>
      <Button variant="danger" @click="confirmDelete">
        Видалити
      </Button>
    </template>
  </Modal>
</template>
```

---

## Dropdown Menu з діями

```vue
<script setup lang="ts">
import { Dropdown, Button } from '@/assets2/ui-contract';

interface User {
  id: number;
  name: string;
}

const props = defineProps<{ user: User }>();

const emit = defineEmits<{
  edit: [user: User];
  delete: [user: User];
}>();

const menuItems = [
  { id: 'view', label: 'Переглянути', icon: '👁️' },
  { id: 'edit', label: 'Редагувати', icon: '✏️' },
  'divider' as const,
  { id: 'delete', label: 'Видалити', icon: '🗑️', danger: true },
];

const handleAction = (item: { id: string }) => {
  switch (item.id) {
    case 'edit':
      emit('edit', props.user);
      break;
    case 'delete':
      emit('delete', props.user);
      break;
  }
};
</script>

<template>
  <Dropdown :items="menuItems" position="bottom-right" @select="handleAction">
    <template #trigger>
      <Button variant="ghost" icon-only aria-label="Меню">
        <template #iconLeft>⋮</template>
      </Button>
    </template>
  </Dropdown>
</template>
```

---

## Async Select з API

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { Select } from '@/assets2/ui-contract';

interface City {
  id: number;
  name: string;
}

const selectedCity = ref<number | null>(null);
const cities = ref<{ value: number; label: string }[]>([]);
const loading = ref(false);

const loadCities = async () => {
  loading.value = true;
  try {
    const response = await fetch('/api/cities');
    const data: City[] = await response.json();
    cities.value = data.map(c => ({ value: c.id, label: c.name }));
  } finally {
    loading.value = false;
  }
};

// Load on mount
loadCities();
</script>

<template>
  <Select
    v-model="selectedCity"
    :options="cities"
    :loading="loading"
    searchable
    clearable
    placeholder="Оберіть місто"
    empty-message="Міст не знайдено"
    loading-message="Завантаження міст..."
  />
</template>
```

---

## Button Group

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Button } from '@/assets2/ui-contract';

const activeView = ref<'list' | 'grid' | 'calendar'>('list');
</script>

<template>
  <div class="inline-flex gap-1 p-1 bg-gray-100 rounded-lg">
    <Button
      v-for="view in ['list', 'grid', 'calendar']"
      :key="view"
      :variant="activeView === view ? 'primary' : 'ghost'"
      size="sm"
      @click="activeView = view"
    >
      {{ view === 'list' ? '📋' : view === 'grid' ? '⊞' : '📅' }}
    </Button>
  </div>
</template>
```

---

## Form з горизонтальним layout

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Button, FormField, Select } from '@/assets2/ui-contract';

const settings = ref({
  language: 'uk',
  timezone: 'Europe/Kyiv',
  notifications: true,
});

const languages = [
  { value: 'uk', label: 'Українська' },
  { value: 'en', label: 'English' },
];
</script>

<template>
  <div class="space-y-4">
    <FormField
      v-model="settings.language"
      label="Мова"
      horizontal
    >
      <!-- Custom content via default slot would require wrapper -->
    </FormField>

    <div class="flex items-start gap-3">
      <label class="min-w-32 pt-2 text-sm font-medium">Мова</label>
      <Select
        v-model="settings.language"
        :options="languages"
        class="flex-1"
      />
    </div>

    <div class="flex justify-end gap-2 pt-4 border-t">
      <Button variant="secondary">Скасувати</Button>
      <Button>Зберегти</Button>
    </div>
  </div>
</template>
```
