# Profile V2 Module

## Статус: Active Development

Це V2-версія модуля профілю, побудована на **UI Contract System** (`assets2/ui-contract`).

## Архітектурна політика

### ⚠️ UI Migration Policy
Цей модуль створено згідно з [UI Contract Integration TZ](../../docs/architecture/UI_CONTRACT_INTEGRATION_TZ.md).

**Ключові правила:**
- Використовуються **виключно** компоненти з `@/assets2/ui-contract`
- Заборонено імпортувати legacy стилі з `src/modules/profile`
- Заборонено використовувати старі UI-компоненти
- Всі тексти через i18n (немає hardcoded strings)

### Legacy vs V2
- **Legacy:** `src/modules/profile` (read-only, тільки критичні bugfix)
- **V2:** `src/modules/profileV2` (активна розробка, ui-contract only)

## Структура

```
profileV2/
├── services/          # Бізнес-логіка (скопійовано з legacy)
│   └── profileStore.js
├── views/             # UI екрани (нова реалізація на ui-contract)
│   ├── ProfileEditView.vue
│   ├── ProfileOverviewView.vue
│   └── UserAccountView.vue
├── components/        # UI компоненти (обгортки над ui-contract)
│   └── ...
├── forms/             # Форм-компоненти
│   └── ...
└── README.md          # Цей файл
```

## Використання UI Contract

### Імпорт компонентів
```vue
<script setup>
import { Button, FormField, Modal } from '@/assets2/ui-contract'
</script>
```

### Приклад форми
```vue
<template>
  <form @submit.prevent="handleSubmit">
    <FormField
      v-model="form.firstName"
      :label="$t('profile.fields.firstName')"
      type="text"
      required
    />
    
    <Button type="submit" :loading="saving">
      {{ $t('common.save') }}
    </Button>
  </form>
</template>
```

## Роутинг

V2 маршрути доступні через feature-flag:
- `/profile-v2/edit` → ProfileEditView V2
- `/profile-v2/overview` → ProfileOverviewView V2
- `/profile-v2/account` → UserAccountView V2

## Тестування

### Unit тести
```bash
npm run test:unit -- profileV2
```

### E2E тести
```bash
npm run test:e2e -- --spec "**/profileV2/**"
```

## Міграція з Legacy

1. **Не міксуйте Legacy та V2** в одному компоненті
2. **Копіюйте сервіси** без змін (позначено `Legacy-compatible`)
3. **Переписуйте UI** повністю на ui-contract
4. **Тестуйте** перед деплоєм

## Контакти

- Технічне завдання: `docs/architecture/UI_CONTRACT_INTEGRATION_TZ.md`
- QA Checklist: `docs/QA_CHECKLIST_UI_CONTRACT.md`
- UI Contract README: `src/assets2/ui-contract/README.md`
