# ТЗ: Frontend — Contact Access UI & Integration

**Дата:** 2026-02-03  
**Базовий документ:** `DDR_RELATION_VS_CONTACT_ACCESS.md` (CANONICAL)  
**Пріоритет:** 🔴 КРИТИЧНИЙ (архітектурний фундамент)  
**Статус:** READY FOR IMPLEMENTATION

---

## МЕТА

Реалізувати UI та інтеграцію з Contact Access Domain для керування доступом до контактів студентів. Забезпечити, щоб контакти показувалися ТІЛЬКИ після явного unlock. Додатково надати **прозорий precondition** для інших доменів (наприклад, Chat), але не змішувати логіку контактів із комунікаціями.

---

## ПРИНЦИПИ (з DDR)

1. **Accept ≠ Unlock** — після прийняття запиту показується кнопка "Відкрити контакти"
2. **No Implicit Access** — контакти НЕ показуються автоматично
3. **Revoke > All** — якщо доступ відкликано, контакти миттєво приховуються
4. **SSOT for Contacts** — контакти отримуються ТІЛЬКИ через Contact API
5. **Communication consumes precondition** — Chat/Communication домен лише зчитує сигнал "contacts unlocked" через публічний API, але його логіка живе окремо

---

## ARCHITECTURAL RULE (Process Guard)

**Розділення відповідальності між Store та Composables:**

```
contactAccessStore — ТІЛЬКИ state management (кеш, CRUD операції)
composables/guards — вся логіка доступу та політики
```

❌ **НЕПРАВИЛЬНО:**
```javascript
// ❌ Store визначає політику доступу
export const useContactAccessStore = defineStore('contactAccess', () => {
  const canAccessChat = computed(() => (studentId) => {
    const level = getAccessLevel(studentId)
    // ❌ Логіка політики в store
    return level !== 'NONE'
  })
})
```

✅ **ПРАВИЛЬНО:**
```javascript
// ✅ Store тільки зберігає state
export const useContactAccessStore = defineStore('contactAccess', () => {
  const getAccessLevel = computed(() => (studentId) => {
    return contactsCache.value.get(studentId)?.access_level || 'NONE'
  })
})

// ✅ Логіка політики в composable (споживачами можуть бути чат, дзвінки тощо)
export function useContactAccessPolicy(studentId) {
  const contactAccessStore = useContactAccessStore()
  
  const hasSharedContacts = computed(() => {
    const level = contactAccessStore.getAccessLevel(studentId)
    return level !== 'NONE'
  })
  
  return { hasSharedContacts }
}
```

**Чому це важливо:**
- Політика доступу може змінюватися (нові рівні, тимчасові пакети)
- Store має бути "тупим" — тільки CRUD
- Composables легше тестувати та змінювати

---

## UI STYLING RULE (Process Guard)

**Dynamic UI styles, variants, themes — БЕЗ логіки доступу.**

> Усі рішення "кому що показувати" ухвалюються ДО рендера (в composables / guards). Стилі лише відображають уже прийняті рішення.

❌ **НЕПРАВИЛЬНО:**
```vue
<button :class="relation.status === 'active' ? 'primary' : 'ghost'">
  <!-- ❌ вирішує доступ у стилях -->
</button>
```

✅ **ПРАВИЛЬНО:**
```vue
<button
  :class="buttonVariant"
  :disabled="!canSeeContacts"
>
  {{ $t('contacts.unlockButton') }}
</button>

// buttonVariant визначено ПОЗА шаблоном:
const buttonVariant = computed(() => (canSeeContacts.value ? 'ghost' : 'primary'))
```

**Правило:** якщо дизайнер хоче новий варіант, він отримує лише сигнал `canSeeContacts` / `sharedContactsPrecondition`, а не впроваджує власну перевірку доступу в CSS/класах/темах.

---

## ЗАВДАННЯ 1: Створити Contact Access API Client

### Файл
`src/api/contacts.js`

### API Client

```javascript
import apiClient from './apiClient'

const CONTACTS_ENDPOINTS = Object.freeze({
  UNLOCK: '/api/v1/contacts/unlock/',
  REVOKE: '/api/v1/contacts/revoke/',
  DETAIL: (studentId) => `/api/v1/contacts/${studentId}/`,
})

export const contactsApi = {
  /**
   * Unlock контактів студента (тільки для тьютора)
   * @param {number} studentId - ID студента
   * @returns {Promise<{unlocked: boolean, access_level: string, contacts: object}>}
   */
  unlockContacts(studentId) {
    return apiClient.post(CONTACTS_ENDPOINTS.UNLOCK, { student_id: studentId })
  },

  /**
   * Revoke доступу до контактів
   * @param {number} studentId - ID студента
   * @param {string} reason - Причина відкликання
   * @returns {Promise<{revoked: boolean}>}
   */
  revokeContacts(studentId, reason = '') {
    return apiClient.post(CONTACTS_ENDPOINTS.REVOKE, {
      student_id: studentId,
      reason,
    })
  },

  /**
   * Отримати контакти студента (якщо є доступ)
   * @param {number} studentId - ID студента
   * @returns {Promise<{contacts: {phone: string, telegram: string, email: string}}>}
   */
  getContacts(studentId) {
    return apiClient.get(CONTACTS_ENDPOINTS.DETAIL(studentId))
  },
}

export default contactsApi
```

### Acceptance Criteria

- [ ] Файл `src/api/contacts.js` створено
- [ ] Методи `unlockContacts`, `revokeContacts`, `getContacts`
- [ ] Використовує `apiClient` (CSRF, auth headers)
- [ ] Endpoints відповідають DDR

---

## ЗАВДАННЯ 2: Створити Contact Access Store (State Only)

### Файл
`src/stores/contactAccessStore.js`

### Store (тільки state, БЕЗ логіки політики)

```javascript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import contactsApi from '@/api/contacts'
import { notifySuccess, notifyError } from '@/utils/notifications'
import { translate } from '@/utils/i18n'

export const useContactAccessStore = defineStore('contactAccess', () => {
  // State
  const contactsCache = ref(new Map()) // studentId -> {contacts, access_level, unlocked_at}
  const loading = ref(false)

  // Getters (тільки доступ до state, БЕЗ інтерпретації)
  function hasContactAccess(studentId) {
    return contactsCache.value.has(studentId)
  }

  function getStudentContacts(studentId) {
    return contactsCache.value.get(studentId)?.contacts || null
  }

  function getAccessLevel(studentId) {
    return contactsCache.value.get(studentId)?.access_level || 'NONE'
  }

  // Actions (CRUD операції)
  async function unlockContacts(studentId) {
    loading.value = true
    try {
      const response = await contactsApi.unlockContacts(studentId)
      
      // Кешуємо контакти
      contactsCache.value.set(studentId, {
        contacts: response.data.contacts,
        access_level: response.data.access_level,
        unlocked_at: new Date().toISOString(),
      })

      if (response.data.was_already_unlocked) {
        notifySuccess(translate('contacts.alreadyUnlocked'))
      } else {
        notifySuccess(translate('contacts.unlockSuccess'))
      }

      return response.data
    } catch (error) {
      notifyError(
        error?.response?.data?.detail || translate('contacts.unlockError')
      )
      throw error
    } finally {
      loading.value = false
    }
  }

  async function revokeContacts(studentId, reason = '') {
    loading.value = true
    try {
      await contactsApi.revokeContacts(studentId, reason)

      // Видаляємо з кешу
      contactsCache.value.delete(studentId)

      notifySuccess(translate('contacts.revokeSuccess'))
    } catch (error) {
      notifyError(
        error?.response?.data?.detail || translate('contacts.revokeError')
      )
      throw error
    } finally {
      loading.value = false
    }
  }

  async function fetchContacts(studentId) {
    loading.value = true
    try {
      const response = await contactsApi.getContacts(studentId)

      contactsCache.value.set(studentId, {
        contacts: response.data.contacts,
        access_level: 'CONTACTS_SHARED',
        unlocked_at: new Date().toISOString(),
      })

      return response.data.contacts
    } catch (error) {
      if (error?.response?.status === 403) {
        contactsCache.value.delete(studentId)
      }
      throw error
    } finally {
      loading.value = false
    }
  }

  function clearCache() {
    contactsCache.value.clear()
  }

  return {
    // State
    loading,
    contactsCache,

    // Getters (тільки state access)
    hasContactAccess,
    getStudentContacts,
    getAccessLevel,

    // Actions (CRUD)
    unlockContacts,
    revokeContacts,
    fetchContacts,
    clearCache,
  }
})
```

### Acceptance Criteria

- [ ] Store НЕ містить логіки політики доступу
- [ ] Getters повертають тільки raw state
- [ ] Actions виконують тільки CRUD операції

---

## ЗАВДАННЯ 3: Створити Access Policy Composables

### Файл
`src/composables/useContactAccessPolicy.js`

### Composable (вся логіка політики тут)

```javascript
import { computed } from 'vue'
import { useContactAccessStore } from '@/stores/contactAccessStore'

/**
 * Composable для перевірки доступу до контактів
 * ВСЯ логіка політики доступу тут, НЕ в store
 */
export function useContactAccessPolicy(studentId) {
  const contactAccessStore = useContactAccessStore()

  const accessLevel = computed(() => {
    return contactAccessStore.getAccessLevel(studentId)
  })

  const canSeeContacts = computed(() => {
    const level = accessLevel.value
    return level === 'CONTACTS_SHARED' || level === 'FULL_ACCESS'
  })

  const canAccessChat = computed(() => {
    const level = accessLevel.value
    return level === 'CHAT_ENABLED' || level === 'FULL_ACCESS'
  })

  const accessDeniedReason = computed(() => {
    if (!contactAccessStore.hasContactAccess(studentId)) {
      return 'Для доступу до контактів потрібно їх відкрити'
    }

    const level = accessLevel.value
    if (level === 'NONE') {
      return 'Доступ до контактів відкликано'
    }

    return null
  })

  return {
    accessLevel,
    canSeeContacts,
    accessDeniedReason,
    sharedContactsPrecondition: computed(() => canSeeContacts.value),
  }
}
```

### Acceptance Criteria

- [ ] Вся логіка політики в composable
- [ ] Store тільки надає raw state
- [ ] Легко змінювати правила доступу

---

## ЗАВДАННЯ 4: Оновити Relations Store

### Файл
`src/stores/relationsStore.js`

### Зміни

**Видалити показ контактів після accept:**

```javascript
async acceptRelation(id) {
  try {
    const { useAuthStore } = await import('../modules/auth/store/authStore')
    const authStore = useAuthStore()
    const userRole = authStore.user?.role?.toUpperCase()
    
    if (userRole === 'TUTOR') {
      await relationsApi.tutorAcceptRelation(id)
    } else if (userRole === 'STUDENT') {
      await relationsApi.studentAcceptRelation(id)
    }
    
    // ✅ ТІЛЬКИ повідомлення про прийняття
    notifySuccess(translate('relations.actions.acceptSuccess'))
    
    // ❌ НЕМАЄ показу контактів
  } catch (error) {
    notifyError(error?.response?.data?.detail || translate('relations.actions.acceptError'))
    throw error
  } finally {
    await this.fetchStudentRelations().catch(() => {})
    await this.fetchTutorRelations().catch(() => {})
  }
}
```

### Acceptance Criteria

- [ ] `acceptRelation` НЕ показує контакти
- [ ] Response від accept НЕ містить `contact_unlocked`
- [ ] Після accept показується тільки "Запит прийнято"

---

## ЗАВДАННЯ 5: Створити UI компонент для Unlock

### Файл
`src/modules/dashboard/components/StudentContactUnlock.vue`

### Компонент

```vue
<template>
  <div class="student-contact-unlock">
    <!-- Якщо relation ACTIVE, але контакти НЕ unlock -->
    <div v-if="relation.status === 'active' && !canSeeContacts" class="unlock-prompt">
      <p class="unlock-message">
        {{ $t('contacts.unlockPrompt') }}
      </p>
      <button
        class="btn btn-primary"
        :disabled="loading"
        @click="handleUnlock"
      >
        <span v-if="!loading">{{ $t('contacts.unlockButton') }}</span>
        <span v-else>{{ $t('common.loading') }}</span>
      </button>
    </div>

    <!-- Якщо контакти unlock — показуємо -->
    <div v-if="canSeeContacts && contacts" class="contacts-display">
      <h4>{{ $t('contacts.studentContacts') }}</h4>
      <div class="contact-item" v-if="contacts.phone">
        <span class="contact-icon">📱</span>
        <span class="contact-value">{{ contacts.phone }}</span>
      </div>
      <div class="contact-item" v-if="contacts.telegram">
        <span class="contact-icon">💬</span>
        <span class="contact-value">@{{ contacts.telegram }}</span>
      </div>
      <div class="contact-item" v-if="contacts.email">
        <span class="contact-icon">📧</span>
        <span class="contact-value">{{ contacts.email }}</span>
      </div>

      <!-- Кнопка revoke (опціонально) -->
      <button
        v-if="showRevokeButton"
        class="btn btn-danger btn-sm"
        @click="handleRevoke"
      >
        {{ $t('contacts.revokeButton') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useContactAccessStore } from '@/stores/contactAccessStore'
import { useContactAccessPolicy } from '@/composables/useContactAccessPolicy'

const props = defineProps({
  relation: {
    type: Object,
    required: true,
  },
  showRevokeButton: {
    type: Boolean,
    default: false,
  },
})

const contactAccessStore = useContactAccessStore()
const { canSeeContacts } = useContactAccessPolicy(props.relation.student_id)

const loading = computed(() => contactAccessStore.loading)
const contacts = computed(() => 
  contactAccessStore.getStudentContacts(props.relation.student_id)
)

async function handleUnlock() {
  try {
    await contactAccessStore.unlockContacts(props.relation.student_id)
  } catch (error) {
    console.error('Unlock failed:', error)
  }
}

async function handleRevoke() {
  if (!confirm('Ви впевнені, що хочете відкликати доступ до контактів?')) {
    return
  }

  try {
    await contactAccessStore.revokeContacts(props.relation.student_id)
  } catch (error) {
    console.error('Revoke failed:', error)
  }
}
</script>

<style scoped>
.unlock-prompt {
  padding: 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.unlock-message {
  margin-bottom: 0.75rem;
  color: #0c4a6e;
}

.contacts-display {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.contact-icon {
  font-size: 1.25rem;
}

.contact-value {
  font-family: monospace;
  color: #374151;
}
</style>
```

### Acceptance Criteria

- [ ] Компонент використовує `useContactAccessPolicy` для логіки доступу
- [ ] Store використовується тільки для CRUD операцій
- [ ] Показує кнопку unlock якщо relation.status === 'active' && !canSeeContacts

---

## ЗАВДАННЯ 6: Експортувати precondition для Communication Domain

### Файл
`src/composables/useContactAccessPolicy.js`

### Оновлення

```javascript
export function useContactAccessPolicy(studentId) {
  // ...існуючий код...
  return {
    accessLevel,
    canSeeContacts,
    accessDeniedReason,
    sharedContactsPrecondition: computed(() => canSeeContacts.value),
  }
}

// Приклад використання в Chat (окремий домен)
import { useContactAccessPolicy } from '@/composables/useContactAccessPolicy'

export function useChatPreconditions(studentId) {
  const { sharedContactsPrecondition } = useContactAccessPolicy(studentId)
  
  return {
    chatAllowed: sharedContactsPrecondition, // Chat сам вирішує, що робити з цим сигналом
  }
}
```

### Acceptance Criteria

- [ ] ContactAccess не вміщує chat-specific логіку
- [ ] Composables повертають універсальний сигнал `sharedContactsPrecondition`
- [ ] Chat/Communication домен споживає цей сигнал окремо

---

## ЗАВДАННЯ 7: Додати i18n ключі

### Файл
`src/locales/uk.json`

```json
{
  "contacts": {
    "unlockPrompt": "Щоб бачити контакти студента та спілкуватися в чаті, відкрийте доступ",
    "unlockButton": "Відкрити контакти",
    "unlockSuccess": "Контакти успішно відкрито",
    "unlockError": "Помилка при відкритті контактів",
    "alreadyUnlocked": "Контакти вже відкриті",
    "revokeButton": "Відкликати доступ",
    "revokeSuccess": "Доступ до контактів відкликано",
    "revokeError": "Помилка при відкликанні доступу",
    "studentContacts": "Контакти студента",
    "chatAccessDenied": "Для доступу до чату потрібно відкрити контакти"
  }
}
```

### Acceptance Criteria

- [ ] i18n ключі додано для UA та EN
- [ ] Всі UI тексти використовують `$t()` або `translate()`

---

## FORBIDDEN UI SHORTCUTS (Process Guards)

**Ці правила запобігають "зручним" UI рішенням, що порушують архітектуру:**

❌ **Заборонено показувати контакти без contactAccessStore**
```vue
<!-- ❌ НЕПРАВИЛЬНО -->
<template>
  <div v-if="relation.status === 'active'">
    <p>{{ relation.student.phone }}</p>  <!-- ❌ ЗАБОРОНЕНО -->
  </div>
</template>
```

❌ **Заборонено використовувати relation.status для доступу до контактів чи передачі precondition іншим доменам**
```javascript
// ❌ НЕПРАВИЛЬНО
const canAccessChat = computed(() => {
  return relation.value.status === 'active'  // ❌ ЗАБОРОНЕНО
})
```

❌ **Заборонено додавати "тимчасові" поля в relation для контактів**
```javascript
// ❌ НЕПРАВИЛЬНО (у relationsStore)
const relation = {
  ...apiResponse,
  student_contacts: {...}  // ❌ ЗАБОРОНЕНО
}
```

✅ **ПРАВИЛЬНО:**
- Контакти ТІЛЬКИ через `contactAccessStore`
- Доступ ТІЛЬКИ через `useContactAccessPolicy` composable
- Chat/Communication отримує лише precondition, логіка живе в їх домені

---

## DOMAIN DONE WHEN (Definition of Done)

**Frontend Contact Access вважається завершеним, коли:**

### 1. Архітектурна ізоляція
- [ ] Логіка політики доступу ТІЛЬКИ в composables
- [ ] Store тільки state management (CRUD)
- [ ] Немає прямого доступу до `relation.student.phone/email/telegram`

### 2. UI Flow
- [ ] Після accept показується кнопка "Відкрити контакти"
- [ ] Після unlock показуються контакти
- [ ] Revoke приховує контакти та блокує чат
- [ ] Hard refresh зберігає unlock state

### 3. Communication Precondition
- [ ] Composables повертають сигнал `sharedContactsPrecondition`
- [ ] Жодна чатова логіка не прописана в ContactAccess UI
- [ ] Документація описує, що Chat домен самостійно вирішує, як реагувати на precondition

### 4. i18n
- [ ] Всі тексти в uk.json та en.json
- [ ] Немає hardcoded текстів

### 5. Testing
- [ ] E2E тест: accept → unlock → contacts
- [ ] E2E тест: revoke блокує чат
- [ ] Unit тести для composables

**Перевірка готовності:**
```bash
# 1. Немає прямого доступу до контактів
grep -r "relation.student.phone\|relation.student.email\|relation.student.telegram" src/ | wc -l  # Має бути 0

# 2. Чат не використовує relation.status
grep -r "relation.status.*chat\|chat.*relation.status" src/modules/chat/ | wc -l  # Має бути 0

# 3. Всі тести проходять
npm run test:unit
npm run test:e2e

# 4. i18n покриття
npm run i18n:check
```

---

## ПОСИЛАННЯ

- **DDR:** `DDR_RELATION_VS_CONTACT_ACCESS.md`
- **Backend TZ:** `TZ_BACKEND_CONTACT_ACCESS.md`
- **Rollback Report:** `ROLLBACK_REPORT.md`

---

**Документ готовий до реалізації.**  
**Всі зміни мають бути узгоджені з DDR (CANONICAL TRUTH).**
