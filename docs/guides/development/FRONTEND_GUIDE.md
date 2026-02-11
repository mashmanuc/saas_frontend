# Frontend Developer Guide — M4SH Platform

**Версія:** v0.42 (актуалізовано 2025-12-22)

Цей посібник допоможе новим frontend-розробникам швидко зорієнтуватися в проекті M4SH.

---

## 📋 Зміст

1. [Швидкий старт](#швидкий-старт)
2. [Структура проекту](#структура-проекту)
3. [Design System](#design-system)
4. [State Management (Pinia)](#state-management-pinia)
5. [Routing та Navigation](#routing-та-navigation)
6. [Internationalization (i18n)](#internationalization-i18n)
7. [API Integration](#api-integration)
8. [Styling та Themes](#styling-та-themes)
9. [Components](#components)
10. [Testing](#testing)
11. [Best Practices](#best-practices)

---

## Швидкий старт

### Налаштування середовища

```bash
# 1. Перейти в frontend директорію
cd m4sh_v1/frontend

# 2. Встановити залежності
npm install

# 3. Налаштувати .env
cp .env.example .env
# Відредагувати .env (VITE_API_URL, тощо)

# 4. Запустити dev server
npm run dev

# 5. Відкрити в браузері
# http://localhost:5173
```

### Корисні команди

```bash
# Development
npm run dev              # Dev server з HMR
npm run build            # Production build
npm run preview          # Preview production build

# Linting & Formatting
npm run lint             # ESLint
npm run format           # Prettier

# Testing
npm run test             # Unit tests (Vitest)
npm run test:ui          # Test UI
npm run test:coverage    # Coverage report

# Type checking
npm run type-check       # TypeScript check
```

---

## Структура проекту

```
frontend/
├── src/
│   ├── modules/              # Feature modules
│   │   ├── auth/            # Authentication
│   │   │   ├── views/       # Login, Register, MFA
│   │   │   ├── components/  # Auth-specific components
│   │   │   ├── store/       # authStore
│   │   │   └── api/         # authApi
│   │   ├── dashboard/       # Student/Tutor dashboards
│   │   ├── marketplace/     # Tutor catalog
│   │   │   ├── views/       # MarketplaceView, TutorProfileView
│   │   │   ├── components/  # TutorCard, Filters
│   │   │   ├── store/       # marketplaceStore
│   │   │   └── api/         # marketplaceApi
│   │   ├── booking/         # Calendar, availability
│   │   ├── matches/         # Match management, messaging
│   │   └── classroom/       # Video rooms, whiteboard
│   ├── stores/              # Global Pinia stores
│   │   ├── authStore.js
│   │   ├── themeStore.js
│   │   ├── notifyStore.js
│   │   └── settingsStore.js
│   ├── ui/                  # Design System components
│   │   ├── Button.vue
│   │   ├── Input.vue
│   │   ├── Card.vue
│   │   └── ...
│   ├── utils/               # Utilities
│   │   ├── apiClient.js     # Axios instance
│   │   ├── telemetry.js     # Event tracking
│   │   ├── validators.js    # Form validation
│   │   └── formatters.js    # Date, currency formatters
│   ├── i18n/                # Internationalization
│   │   ├── index.js         # i18n setup
│   │   └── locales/
│   │       ├── en.json
│   │       └── uk.json
│   ├── router/              # Vue Router
│   │   ├── index.js         # Router config
│   │   └── guards.js        # Navigation guards
│   ├── assets/              # Static assets
│   │   ├── styles/          # Global styles
│   │   │   ├── main.css     # Main stylesheet
│   │   │   ├── themes.css   # Theme variables
│   │   │   └── tailwind.css # Tailwind imports
│   │   └── images/
│   ├── App.vue              # Root component
│   └── main.js              # Entry point
├── public/                  # Public assets
├── tests/                   # Tests
│   ├── unit/
│   └── e2e/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── package.json
└── .env.example
```

### Принципи організації

1. **Feature-based modules** — кожен модуль містить views, components, store, api
2. **Composition API** — використовуємо `<script setup>` де можливо
3. **Type safety** — TypeScript для критичних частин
4. **Reusable components** — Design System в `/ui`
5. **Single source of truth** — Pinia stores для state

---

## Design System

### Компоненти

#### Button

```vue
<template>
  <Button variant="primary" size="md" @click="handleClick">
    Click me
  </Button>
</template>

<script setup>
import Button from '@/ui/Button.vue'

const handleClick = () => {
  console.log('Clicked!')
}
</script>
```

**Props:**
- `variant`: `primary`, `secondary`, `outline`, `ghost`, `danger`
- `size`: `sm`, `md`, `lg`
- `disabled`: boolean
- `loading`: boolean
- `icon`: Lucide icon component

#### Input

```vue
<template>
  <Input
    v-model="email"
    type="email"
    label="Email"
    placeholder="Enter your email"
    :error="errors.email"
    required
  />
</template>

<script setup>
import { ref } from 'vue'
import Input from '@/ui/Input.vue'

const email = ref('')
const errors = ref({})
</script>
```

**Props:**
- `modelValue`: v-model value
- `type`: input type
- `label`: label text
- `placeholder`: placeholder text
- `error`: error message
- `disabled`, `required`, `readonly`

#### Card

```vue
<template>
  <Card>
    <template #header>
      <h2>Card Title</h2>
    </template>
    
    <p>Card content goes here</p>
    
    <template #footer>
      <Button>Action</Button>
    </template>
  </Card>
</template>

<script setup>
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
</script>
```

#### Alert

```vue
<template>
  <Alert type="success" :dismissible="true" @dismiss="handleDismiss">
    Operation completed successfully!
  </Alert>
</template>

<script setup>
import Alert from '@/ui/Alert.vue'

const handleDismiss = () => {
  console.log('Alert dismissed')
}
</script>
```

**Props:**
- `type`: `info`, `success`, `warning`, `error`
- `dismissible`: boolean
- `icon`: custom icon

#### Modal

```vue
<template>
  <Modal v-model="isOpen" title="Confirm Action">
    <p>Are you sure you want to proceed?</p>
    
    <template #footer>
      <Button variant="outline" @click="isOpen = false">Cancel</Button>
      <Button variant="primary" @click="confirm">Confirm</Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref } from 'vue'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'

const isOpen = ref(false)

const confirm = () => {
  // Handle confirmation
  isOpen.value = false
}
</script>
```

#### Toast Notifications

```vue
<script setup>
import { useNotifyStore } from '@/stores/notifyStore'

const notify = useNotifyStore()

const showSuccess = () => {
  notify.success('Profile updated successfully!')
}

const showError = () => {
  notify.error('Failed to save changes')
}

const showInfo = () => {
  notify.info('New message received', { duration: 5000 })
}
</script>
```

### Layout Components

#### PageShell

```vue
<template>
  <PageShell>
    <template #header>
      <h1>Page Title</h1>
    </template>
    
    <template #sidebar>
      <SideNav :items="navItems" />
    </template>
    
    <div>Main content</div>
  </PageShell>
</template>

<script setup>
import PageShell from '@/ui/PageShell.vue'
import SideNav from '@/ui/SideNav.vue'

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: 'Home' },
  { label: 'Profile', to: '/profile', icon: 'User' }
]
</script>
```

---

## State Management (Pinia)

### Створення Store

```javascript
// stores/exampleStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useExampleStore = defineStore('example', () => {
  // State
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)
  
  // Getters
  const itemCount = computed(() => items.value.length)
  const hasItems = computed(() => items.value.length > 0)
  
  // Actions
  async function fetchItems() {
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.get('/api/v1/items/')
      items.value = response.data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }
  
  function addItem(item) {
    items.value.push(item)
  }
  
  function removeItem(id) {
    items.value = items.value.filter(item => item.id !== id)
  }
  
  function $reset() {
    items.value = []
    loading.value = false
    error.value = null
  }
  
  return {
    // State
    items,
    loading,
    error,
    // Getters
    itemCount,
    hasItems,
    // Actions
    fetchItems,
    addItem,
    removeItem,
    $reset
  }
})
```

### Використання Store

```vue
<template>
  <div>
    <Loader v-if="store.loading" />
    <Alert v-else-if="store.error" type="error">{{ store.error }}</Alert>
    
    <div v-else>
      <p>Total items: {{ store.itemCount }}</p>
      
      <div v-for="item in store.items" :key="item.id">
        {{ item.name }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useExampleStore } from '@/stores/exampleStore'
import Loader from '@/ui/Loader.vue'
import Alert from '@/ui/Alert.vue'

const store = useExampleStore()

onMounted(async () => {
  await store.fetchItems()
})
</script>
```

### Global Stores

#### authStore

```javascript
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()

// State
auth.user          // Current user object
auth.isAuthenticated  // Boolean
auth.permissions   // User permissions

// Actions
await auth.login(email, password)
await auth.logout()
await auth.refreshToken()
await auth.fetchUser()
```

#### themeStore

```javascript
import { useThemeStore } from '@/stores/themeStore'

const theme = useThemeStore()

// State
theme.currentTheme  // 'light', 'dark', 'classic'

// Actions
theme.setTheme('dark')
theme.toggleTheme()
```

#### notifyStore

```javascript
import { useNotifyStore } from '@/stores/notifyStore'

const notify = useNotifyStore()

// Actions
notify.success('Success message')
notify.error('Error message')
notify.info('Info message')
notify.warning('Warning message')
```

---

## Routing та Navigation

### Route Definition

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { authGuard, roleGuard } from './guards'

const routes = [
  {
    path: '/auth/login',
    name: 'Login',
    component: () => import('@/modules/auth/views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/student',
    name: 'StudentDashboard',
    component: () => import('@/modules/dashboard/views/StudentDashboardView.vue'),
    meta: { requiresAuth: true, role: 'student' }
  },
  {
    path: '/tutor',
    name: 'TutorDashboard',
    component: () => import('@/modules/dashboard/views/TutorDashboardView.vue'),
    meta: { requiresAuth: true, role: 'tutor' }
  },
  {
    path: '/marketplace',
    name: 'Marketplace',
    component: () => import('@/modules/marketplace/views/MarketplaceView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/marketplace/tutors/:slug',
    name: 'TutorProfile',
    component: () => import('@/modules/marketplace/views/TutorProfileView.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Global guards
router.beforeEach(authGuard)
router.beforeEach(roleGuard)

export default router
```

### Navigation Guards

```javascript
// router/guards.js
import { useAuthStore } from '@/stores/authStore'

export function authGuard(to, from, next) {
  const auth = useAuthStore()
  
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
}

export function roleGuard(to, from, next) {
  const auth = useAuthStore()
  
  if (to.meta.role && auth.user?.role !== to.meta.role) {
    next({ name: 'Forbidden' })
  } else {
    next()
  }
}
```

### Programmatic Navigation

```vue
<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

// Navigate to route
const goToProfile = () => {
  router.push({ name: 'TutorProfile', params: { slug: 'john-doe' } })
}

// Navigate with query
const goToMarketplace = () => {
  router.push({ 
    name: 'Marketplace', 
    query: { subject: 'math', minRate: 20 } 
  })
}

// Go back
const goBack = () => {
  router.back()
}

// Replace (no history entry)
const replaceRoute = () => {
  router.replace({ name: 'Dashboard' })
}
</script>
```

### RouterLink

```vue
<template>
  <!-- Basic link -->
  <RouterLink to="/marketplace">Marketplace</RouterLink>
  
  <!-- Named route with params -->
  <RouterLink :to="{ name: 'TutorProfile', params: { slug: tutor.slug } }">
    View Profile
  </RouterLink>
  
  <!-- With query -->
  <RouterLink :to="{ name: 'Marketplace', query: { subject: 'math' } }">
    Math Tutors
  </RouterLink>
  
  <!-- Active class -->
  <RouterLink 
    to="/dashboard" 
    active-class="active"
    exact-active-class="exact-active"
  >
    Dashboard
  </RouterLink>
</template>
```

---

## Internationalization (i18n)

### Структура локалей

```json
// i18n/locales/en.json
{
  "common": {
    "buttons": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete"
    },
    "errors": {
      "required": "This field is required",
      "invalid_email": "Invalid email address"
    }
  },
  "auth": {
    "login": {
      "title": "Log In",
      "email": "Email",
      "password": "Password",
      "submit": "Log In",
      "forgot_password": "Forgot password?"
    }
  },
  "marketplace": {
    "title": "Find a Tutor",
    "filters": {
      "subject": "Subject",
      "price_range": "Price Range",
      "rating": "Rating"
    },
    "tutor_card": {
      "hourly_rate": "${rate}/hour",
      "lessons_count": "{count} lessons | {count} lesson | {count} lessons"
    }
  }
}
```

### Використання в компонентах

```vue
<template>
  <div>
    <!-- Simple translation -->
    <h1>{{ t('marketplace.title') }}</h1>
    
    <!-- With interpolation -->
    <p>{{ t('marketplace.tutor_card.hourly_rate', { rate: tutor.hourlyRate }) }}</p>
    
    <!-- Pluralization -->
    <p>{{ t('marketplace.tutor_card.lessons_count', tutor.totalLessons) }}</p>
    
    <!-- In attributes -->
    <input :placeholder="t('auth.login.email')" />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

// Change locale
const switchToUkrainian = () => {
  locale.value = 'uk'
}
</script>
```

### Додавання нових ключів

1. Додати ключ в `en.json`:
```json
{
  "booking": {
    "calendar": {
      "select_slot": "Select a time slot"
    }
  }
}
```

2. Додати переклад в `uk.json`:
```json
{
  "booking": {
    "calendar": {
      "select_slot": "Оберіть часовий слот"
    }
  }
}
```

3. Використати в компоненті:
```vue
<p>{{ t('booking.calendar.select_slot') }}</p>
```

### Налаштування локалі

```javascript
// stores/settingsStore.js
export const useSettingsStore = defineStore('settings', () => {
  const locale = ref(localStorage.getItem('locale') || 'uk')
  
  function setLocale(newLocale) {
    locale.value = newLocale
    localStorage.setItem('locale', newLocale)
    // Update i18n
    i18n.global.locale.value = newLocale
  }
  
  return { locale, setLocale }
})
```

---

## API Integration

### API Client Setup

```javascript
// utils/apiClient.js
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { useNotifyStore } from '@/stores/notifyStore'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // For refresh token cookie
})

// Request interceptor - add access token
apiClient.interceptors.request.use(
  (config) => {
    const auth = useAuthStore()
    if (auth.accessToken) {
      config.headers.Authorization = `Bearer ${auth.accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle 401, refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const auth = useAuthStore()
        await auth.refreshToken()
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${auth.accessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        // Refresh failed, logout
        const auth = useAuthStore()
        auth.forceLogout()
        return Promise.reject(refreshError)
      }
    }
    
    // Show error notification
    const notify = useNotifyStore()
    const message = error.response?.data?.detail || 'An error occurred'
    notify.error(message)
    
    return Promise.reject(error)
  }
)

export default apiClient
```

### API Module Example

```javascript
// modules/marketplace/api/marketplaceApi.js
import apiClient from '@/utils/apiClient'

export default {
  async getTutors(params = {}) {
    const response = await apiClient.get('/api/v1/marketplace/tutors/', { params })
    return response.data
  },
  
  async getTutorBySlug(slug) {
    const response = await apiClient.get(`/api/v1/marketplace/tutors/${slug}/`)
    return response.data
  },
  
  async updateMyProfile(data) {
    const response = await apiClient.put('/api/v1/tutors/me/profile/', data)
    return response.data
  },
  
  async publishProfile() {
    const response = await apiClient.post('/api/v1/tutors/me/profile/publish/')
    return response.data
  }
}
```

### Using API in Store

```javascript
// modules/marketplace/store/marketplaceStore.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import marketplaceApi from '../api/marketplaceApi'
import { trackEvent } from '@/utils/telemetry'

export const useMarketplaceStore = defineStore('marketplace', () => {
  const tutors = ref([])
  const currentTutor = ref(null)
  const filters = ref({
    subject: null,
    minRate: null,
    maxRate: null,
    rating: null
  })
  const loading = ref(false)
  const error = ref(null)
  
  async function fetchTutors() {
    loading.value = true
    error.value = null
    
    try {
      const data = await marketplaceApi.getTutors(filters.value)
      tutors.value = data.results || data
      
      trackEvent('marketplace.tutors_fetched', {
        count: tutors.value.length,
        filters: filters.value
      })
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }
  
  async function fetchTutorBySlug(slug) {
    loading.value = true
    error.value = null
    
    try {
      currentTutor.value = await marketplaceApi.getTutorBySlug(slug)
      
      trackEvent('marketplace.tutor_viewed', {
        tutor_slug: slug,
        tutor_id: currentTutor.value.id
      })
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }
  
  function setFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
  }
  
  function clearFilters() {
    filters.value = {
      subject: null,
      minRate: null,
      maxRate: null,
      rating: null
    }
  }
  
  return {
    tutors,
    currentTutor,
    filters,
    loading,
    error,
    fetchTutors,
    fetchTutorBySlug,
    setFilters,
    clearFilters
  }
})
```

---

## Styling та Themes

### TailwindCSS

```vue
<template>
  <!-- Utility classes -->
  <div class="flex items-center justify-between p-4 bg-white rounded-lg shadow">
    <h2 class="text-xl font-semibold text-gray-900">Title</h2>
    <button class="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700">
      Click me
    </button>
  </div>
  
  <!-- Responsive -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <!-- Cards -->
  </div>
  
  <!-- Dark mode -->
  <div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
    Content
  </div>
</template>
```

### CSS Variables (Themes)

```css
/* assets/styles/themes.css */

/* Light theme (default) */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --border-color: #e5e7eb;
  --accent: #3b82f6;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
}

/* Dark theme */
[data-theme="dark"] {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-tertiary: #9ca3af;
  --border-color: #374151;
  --accent: #60a5fa;
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #f87171;
}

/* Classic theme */
[data-theme="classic"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f3ff;
  --text-primary: #1e1b4b;
  --text-secondary: #6366f1;
  --accent: #8b5cf6;
  /* ... */
}
```

### Використання CSS Variables

```vue
<template>
  <div class="card">
    <h2>Card Title</h2>
    <p>Card content</p>
  </div>
</template>

<style scoped>
.card {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
}

.card h2 {
  color: var(--accent);
  margin-bottom: 0.5rem;
}
</style>
```

### Theme Switching

```vue
<script setup>
import { useThemeStore } from '@/stores/themeStore'

const theme = useThemeStore()

const themes = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'classic', label: 'Classic' }
]
</script>

<template>
  <select v-model="theme.currentTheme" @change="theme.setTheme(theme.currentTheme)">
    <option v-for="t in themes" :key="t.value" :value="t.value">
      {{ t.label }}
    </option>
  </select>
</template>
```

---

## Components

### Composition API Best Practices

```vue
<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

// Props
const props = defineProps({
  tutorSlug: {
    type: String,
    required: true
  },
  showActions: {
    type: Boolean,
    default: true
  }
})

// Emits
const emit = defineEmits(['update', 'delete'])

// Composables
const router = useRouter()
const { t } = useI18n()

// State
const loading = ref(false)
const data = ref(null)

// Computed
const displayName = computed(() => {
  return data.value ? `${data.value.firstName} ${data.value.lastName}` : ''
})

// Methods
async function fetchData() {
  loading.value = true
  try {
    // Fetch logic
  } finally {
    loading.value = false
  }
}

function handleUpdate() {
  emit('update', data.value)
}

// Watchers
watch(() => props.tutorSlug, (newSlug) => {
  if (newSlug) {
    fetchData()
  }
})

// Lifecycle
onMounted(() => {
  fetchData()
})
</script>

<template>
  <div>
    <!-- Template -->
  </div>
</template>

<style scoped>
/* Scoped styles */
</style>
```

### Composables (Reusable Logic)

```javascript
// composables/useForm.js
import { ref, reactive } from 'vue'

export function useForm(initialValues = {}) {
  const values = reactive({ ...initialValues })
  const errors = reactive({})
  const touched = reactive({})
  const isSubmitting = ref(false)
  
  function setFieldValue(field, value) {
    values[field] = value
    touched[field] = true
  }
  
  function setFieldError(field, error) {
    errors[field] = error
  }
  
  function clearErrors() {
    Object.keys(errors).forEach(key => {
      delete errors[key]
    })
  }
  
  async function handleSubmit(onSubmit) {
    clearErrors()
    isSubmitting.value = true
    
    try {
      await onSubmit(values)
    } catch (err) {
      if (err.response?.data?.fields) {
        Object.assign(errors, err.response.data.fields)
      }
      throw err
    } finally {
      isSubmitting.value = false
    }
  }
  
  function reset() {
    Object.assign(values, initialValues)
    clearErrors()
    Object.keys(touched).forEach(key => {
      touched[key] = false
    })
  }
  
  return {
    values,
    errors,
    touched,
    isSubmitting,
    setFieldValue,
    setFieldError,
    clearErrors,
    handleSubmit,
    reset
  }
}
```

**Використання:**

```vue
<script setup>
import { useForm } from '@/composables/useForm'
import marketplaceApi from '@/modules/marketplace/api/marketplaceApi'

const { values, errors, isSubmitting, handleSubmit } = useForm({
  headline: '',
  bio: '',
  hourlyRate: 0
})

const onSubmit = async (formValues) => {
  await marketplaceApi.updateMyProfile(formValues)
  // Success handling
}
</script>

<template>
  <form @submit.prevent="handleSubmit(onSubmit)">
    <Input v-model="values.headline" :error="errors.headline" label="Headline" />
    <Input v-model="values.bio" :error="errors.bio" label="Bio" />
    <Input v-model="values.hourlyRate" :error="errors.hourlyRate" label="Hourly Rate" type="number" />
    
    <Button type="submit" :loading="isSubmitting">Save</Button>
  </form>
</template>
```

---

## Testing

### Unit Tests (Vitest)

```javascript
// tests/unit/components/Button.spec.js
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '@/ui/Button.vue'

describe('Button', () => {
  it('renders correctly', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary' },
      slots: { default: 'Click me' }
    })
    
    expect(wrapper.text()).toBe('Click me')
    expect(wrapper.classes()).toContain('btn-primary')
  })
  
  it('emits click event', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    
    expect(wrapper.emitted()).toHaveProperty('click')
  })
  
  it('is disabled when loading', () => {
    const wrapper = mount(Button, {
      props: { loading: true }
    })
    
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
```

### Store Tests

```javascript
// tests/unit/stores/authStore.spec.js
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/authStore'

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  
  it('initializes with default state', () => {
    const auth = useAuthStore()
    
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })
  
  it('sets user on login', async () => {
    const auth = useAuthStore()
    
    await auth.login('test@example.com', 'password')
    
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user).toBeDefined()
  })
})
```

### Component Tests with Store

```javascript
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import TutorCard from '@/modules/marketplace/components/TutorCard.vue'

describe('TutorCard', () => {
  it('displays tutor information', () => {
    const wrapper = mount(TutorCard, {
      global: {
        plugins: [createPinia()]
      },
      props: {
        tutor: {
          slug: 'john-doe',
          fullName: 'John Doe',
          headline: 'Math Tutor',
          hourlyRate: 50,
          rating: 4.8
        }
      }
    })
    
    expect(wrapper.text()).toContain('John Doe')
    expect(wrapper.text()).toContain('Math Tutor')
    expect(wrapper.text()).toContain('$50')
  })
})
```

---

## Best Practices

### 1. Composition API

```vue
<!-- ✅ Good -->
<script setup>
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>

<!-- ❌ Avoid Options API for new components -->
<script>
export default {
  data() {
    return { count: 0 }
  },
  computed: {
    doubled() {
      return this.count * 2
    }
  }
}
</script>
```

### 2. Props Validation

```vue
<script setup>
// ✅ Good - with validation
defineProps({
  tutorSlug: {
    type: String,
    required: true
  },
  showActions: {
    type: Boolean,
    default: true
  },
  maxResults: {
    type: Number,
    default: 20,
    validator: (value) => value > 0 && value <= 100
  }
})
</script>
```

### 3. Emits Declaration

```vue
<script setup>
// ✅ Good - declare emits
const emit = defineEmits(['update', 'delete', 'cancel'])

function handleUpdate(data) {
  emit('update', data)
}
</script>
```

### 4. Computed vs Methods

```vue
<script setup>
import { ref, computed } from 'vue'

const items = ref([1, 2, 3, 4, 5])

// ✅ Good - use computed for derived state
const evenItems = computed(() => items.value.filter(i => i % 2 === 0))

// ❌ Avoid - method called on every render
function getEvenItems() {
  return items.value.filter(i => i % 2 === 0)
}
</script>

<template>
  <!-- ✅ Cached -->
  <div v-for="item in evenItems" :key="item">{{ item }}</div>
  
  <!-- ❌ Recalculated every render -->
  <div v-for="item in getEvenItems()" :key="item">{{ item }}</div>
</template>
```

### 5. Async/Await

```vue
<script setup>
// ✅ Good - proper error handling
async function fetchData() {
  loading.value = true
  error.value = null
  
  try {
    const data = await api.getData()
    items.value = data
  } catch (err) {
    error.value = err.message
    notify.error('Failed to load data')
  } finally {
    loading.value = false
  }
}
</script>
```

### 6. Reactivity

```vue
<script setup>
import { ref, reactive } from 'vue'

// ✅ Good - ref for primitives
const count = ref(0)
const name = ref('')

// ✅ Good - reactive for objects
const user = reactive({
  name: '',
  email: '',
  role: 'student'
})

// ❌ Avoid - losing reactivity
const { name: userName } = user  // Not reactive!

// ✅ Good - use toRefs
import { toRefs } from 'vue'
const { name: userName } = toRefs(user)  // Reactive!
</script>
```

### 7. Component Organization

```vue
<script setup>
// 1. Imports
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import SomeComponent from './SomeComponent.vue'

// 2. Props & Emits
const props = defineProps({ ... })
const emit = defineEmits([...])

// 3. Composables
const router = useRouter()
const store = useSomeStore()

// 4. State
const loading = ref(false)
const data = ref(null)

// 5. Computed
const displayData = computed(() => ...)

// 6. Methods
function handleClick() { ... }

// 7. Watchers
watch(() => props.id, () => ...)

// 8. Lifecycle
onMounted(() => ...)
</script>
```

### 8. Telemetry

```vue
<script setup>
import { trackEvent } from '@/utils/telemetry'

function handleBooking() {
  // Track user action
  trackEvent('booking.trial_requested', {
    tutor_slug: props.tutorSlug,
    slot_id: selectedSlot.value.id
  })
  
  // Proceed with booking
}
</script>
```

---

## Корисні ресурси

- **Vue 3 Docs:** https://vuejs.org/
- **Pinia Docs:** https://pinia.vuejs.org/
- **Vue Router Docs:** https://router.vuejs.org/
- **TailwindCSS Docs:** https://tailwindcss.com/
- **Vite Docs:** https://vitejs.dev/
- **Internal Docs:** `/frontend/docs/`

Для питань звертайтесь до frontend tech lead або створюйте issue в репозиторії.
