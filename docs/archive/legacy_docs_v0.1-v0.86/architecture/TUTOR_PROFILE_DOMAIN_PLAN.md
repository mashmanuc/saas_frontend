# План реалізації Tutor Profile Domain

**Дата:** 2026-02-01  
**Версія:** v1.0.0  
**Статус:** READY FOR IMPLEMENTATION

---

## Мета

Створити **frozen frontend domain** для профілю тьютора як єдине джерело правди (SSOT), що унеможливлює регресії через випадкові мутації та забезпечує консистентність даних між усіма модулями.

---

## Принципи (INVARIANTS)

```
1. Tutor Profile — protected frontend domain
2. All profile mutations MUST go through this domain
3. Marketplace and other modules are READ-ONLY consumers
4. Fixing Marketplace by mutating profile logic is FORBIDDEN
5. If a profile change breaks Marketplace, the change is INVALID
```

---

## ФАЗА 0: Підготовка (нічого не ламаємо)

### Мета
Зафіксувати scope та заборонити розповзання.

### Крок 0.1: Визначити scope

**В scope:**
- ✅ Tutor Profile (edit / publish / unpublish)
- ✅ Дані профілю для Marketplace
- ✅ Дані профілю для ProfileEditor

**НЕ в scope:**
- ❌ Auth
- ❌ Notifications
- ❌ Lessons
- ❌ Network governor
- ❌ User profile (non-tutor)

### Крок 0.2: Створити документацію

**Файли:**
- `docs/architecture/TUTOR_PROFILE_DOMAIN_AUDIT.md` ✅ СТВОРЕНО
- `docs/architecture/TUTOR_PROFILE_DOMAIN_PLAN.md` ✅ ЦЕЙ ФАЙЛ

### Acceptance Criteria

- [x] Scope чітко визначений
- [x] Документація створена
- [ ] Team review пройдено

---

## ФАЗА 1: Створити домен (без інтеграції)

### Мета
Створити структуру домену та канонічну модель без підключення до UI.

### Крок 1.1: Створити структуру

**Файли для створення:**
```
src/domains/tutorProfile/
  index.ts          # Public API домену
  model.ts          # Канонічна модель
  validators.ts     # Валідація
  README.md         # Контракт домену
  __tests__/
    domain.spec.ts  # Unit tests
```

**Команда:**
```bash
mkdir -p src/domains/tutorProfile/__tests__
```

### Крок 1.2: model.ts — Канонічна модель

**Файл:** `src/domains/tutorProfile/model.ts`

```typescript
/**
 * Tutor Profile Domain Model
 * 
 * FROZEN: This is the canonical model for tutor profile.
 * DO NOT modify without domain review.
 */

export type TutorProfileStatus = 'DRAFT' | 'PUBLISHED'

export type Subject = {
  code: string
  tags: string[]
  custom_direction_text: string | null
}

export type Language = {
  code: string
  level: 'basic' | 'conversational' | 'fluent' | 'native'
}

export type TutorProfile = {
  // Identity
  id: number | null
  slug: string | null
  user_id: number | null
  
  // Status
  status: TutorProfileStatus
  is_published: boolean
  
  // Basic info
  headline: string
  bio: string
  
  // Professional
  subjects: Subject[]
  teaching_languages: Language[]
  experience_years: number
  
  // Pricing
  hourly_rate: number
  currency: string
  trial_lesson_price: number | null
  
  // Optional
  country: string | null
  timezone: string | null
  format: 'online' | 'offline' | 'hybrid' | null
  
  // Privacy
  gender: string | null
  show_gender: boolean
  birth_year: number | null
  show_age: boolean
  telegram_username: string | null
  
  // Media
  photo_url: string | null
  video_intro_url: string | null
  
  // Stats (read-only)
  total_lessons: number
  total_students: number
  average_rating: number
  total_reviews: number
  completeness_score: number | null
}

/**
 * Create empty profile (for new tutors)
 */
export function createEmptyProfile(): TutorProfile {
  return {
    id: null,
    slug: null,
    user_id: null,
    status: 'DRAFT',
    is_published: false,
    headline: '',
    bio: '',
    subjects: [],
    teaching_languages: [],
    experience_years: 0,
    hourly_rate: 0,
    currency: 'USD',
    trial_lesson_price: null,
    country: null,
    timezone: null,
    format: null,
    gender: null,
    show_gender: false,
    birth_year: null,
    show_age: false,
    telegram_username: null,
    photo_url: null,
    video_intro_url: null,
    total_lessons: 0,
    total_students: 0,
    average_rating: 0,
    total_reviews: 0,
    completeness_score: null,
  }
}
```

### Крок 1.3: README.md — Контракт домену

**Файл:** `src/domains/tutorProfile/README.md`

```markdown
# Tutor Profile Domain (FROZEN)

Tutor Profile is a **protected frontend domain**.

## Rules

1. **All profile mutations MUST go through this domain.**
2. **Marketplace and other modules are READ-ONLY consumers.**
3. **Fixing Marketplace by mutating profile logic is forbidden.**
4. **If a profile change breaks Marketplace, the change is invalid.**

This domain exists to prevent cross-module regressions.

## Public API

```typescript
import { tutorProfile } from '@/domains/tutorProfile'

// Read
const profile = tutorProfile.get()

// Initialize (once, from API)
tutorProfile.init(apiProfile)

// Update
tutorProfile.update({
  headline: 'New headline',
  bio: 'New bio',
})

// Publish/Unpublish
tutorProfile.publish()
tutorProfile.unpublish()

// Check state
const isComplete = tutorProfile.isComplete()
const canPublish = tutorProfile.canPublish()
```

## Forbidden

```typescript
// ❌ NO direct mutations
profile.headline = 'new'
profile.subjects.push(...)

// ❌ NO setProfile
tutorProfile.setProfile(...)

// ❌ NO duplicate state in stores
const myProfile = ref(...)  // in marketplaceStore
```

## Migration Guide

See `docs/architecture/TUTOR_PROFILE_DOMAIN_MIGRATION.md`
```

### Acceptance Criteria

- [ ] Структура створена
- [ ] `model.ts` з канонічною моделлю
- [ ] `README.md` з контрактом
- [ ] Код компілюється без помилок

---

## ФАЗА 2: Єдина точка запису

### Мета
Створити Public API домену з семантичними діями (не setters).

### Крок 2.1: index.ts — Public API

**Файл:** `src/domains/tutorProfile/index.ts`

```typescript
import type { TutorProfile } from './model'
import { createEmptyProfile } from './model'
import { validateProfile, type ValidationErrors } from './validators'
import { marketplaceApi } from '@/modules/marketplace/api/marketplace'

/**
 * Tutor Profile Domain
 * 
 * FROZEN: Single source of truth for tutor profile.
 */

let state: TutorProfile | null = null
let isInitialized = false

/**
 * Get current profile (throws if not initialized)
 */
export function get(): TutorProfile {
  if (!state) {
    throw new Error('[TutorProfileDomain] Profile not initialized. Call init() first.')
  }
  
  // Return frozen copy in DEV
  if (import.meta.env.DEV) {
    return Object.freeze({ ...state })
  }
  
  return { ...state }
}

/**
 * Initialize profile from API response
 * Should be called ONCE after fetching from backend
 */
export function init(apiProfile: any): void {
  if (isInitialized) {
    console.warn('[TutorProfileDomain] Already initialized. Use update() instead.')
    return
  }
  
  state = normalizeFromApi(apiProfile)
  isInitialized = true
  
  if (import.meta.env.DEV) {
    console.log('[TutorProfileDomain] Initialized:', state)
  }
}

/**
 * Update profile (with validation)
 */
export async function update(patch: Partial<TutorProfile>): Promise<void> {
  if (!state) {
    throw new Error('[TutorProfileDomain] Cannot update uninitialized profile')
  }
  
  const next = { ...state, ...patch }
  
  // Validate
  const errors = validateProfile(next)
  if (errors) {
    throw new Error(`[TutorProfileDomain] Validation failed: ${JSON.stringify(errors)}`)
  }
  
  // Call API
  const payload = normalizeToApi(next)
  await marketplaceApi.updateTutorMeProfile(payload as any)
  
  // Update state only after successful API call
  state = next
  
  if (import.meta.env.DEV) {
    console.log('[TutorProfileDomain] Updated:', state)
  }
}

/**
 * Publish profile
 */
export async function publish(): Promise<void> {
  if (!state) {
    throw new Error('[TutorProfileDomain] Cannot publish uninitialized profile')
  }
  
  if (!canPublish()) {
    throw new Error('[TutorProfileDomain] Profile is incomplete, cannot publish')
  }
  
  await marketplaceApi.publishProfile()
  
  state = { ...state, is_published: true, status: 'PUBLISHED' }
  
  if (import.meta.env.DEV) {
    console.log('[TutorProfileDomain] Published')
  }
}

/**
 * Unpublish profile
 */
export async function unpublish(): Promise<void> {
  if (!state) {
    throw new Error('[TutorProfileDomain] Cannot unpublish uninitialized profile')
  }
  
  await marketplaceApi.unpublishProfile()
  
  state = { ...state, is_published: false }
  
  if (import.meta.env.DEV) {
    console.log('[TutorProfileDomain] Unpublished')
  }
}

/**
 * Check if profile is complete
 */
export function isComplete(): boolean {
  if (!state) return false
  
  return Boolean(
    state.headline?.trim() &&
    state.bio?.trim() &&
    state.subjects.length > 0 &&
    state.teaching_languages.length > 0 &&
    state.hourly_rate > 0
  )
}

/**
 * Check if can publish
 */
export function canPublish(): boolean {
  return isComplete()
}

/**
 * Reset domain (for tests / logout)
 */
export function reset(): void {
  state = null
  isInitialized = false
}

// Helper: normalize from API
function normalizeFromApi(apiProfile: any): TutorProfile {
  // Transform API response to domain model
  // (implementation based on existing tutorProfileFormModel.fromApi)
  return {
    id: apiProfile.user_id || null,
    slug: apiProfile.slug || null,
    user_id: apiProfile.user_id || null,
    status: apiProfile.is_published ? 'PUBLISHED' : 'DRAFT',
    is_published: apiProfile.is_published || false,
    headline: apiProfile.headline || '',
    bio: apiProfile.bio || '',
    subjects: apiProfile.subjects || [],
    teaching_languages: apiProfile.teaching_languages || apiProfile.languages || [],
    experience_years: apiProfile.experience_years || 0,
    hourly_rate: apiProfile.pricing?.hourly_rate || 0,
    currency: apiProfile.pricing?.currency || 'USD',
    trial_lesson_price: apiProfile.pricing?.trial_lesson_price || null,
    country: apiProfile.country || null,
    timezone: apiProfile.availability_summary?.timezone || apiProfile.timezone || null,
    format: apiProfile.format || null,
    gender: apiProfile.gender || null,
    show_gender: apiProfile.show_gender || false,
    birth_year: apiProfile.birth_year || null,
    show_age: apiProfile.show_age || false,
    telegram_username: apiProfile.telegram_username || null,
    photo_url: apiProfile.media?.photo_url || null,
    video_intro_url: apiProfile.media?.video_intro_url || null,
    total_lessons: apiProfile.stats?.total_lessons || 0,
    total_students: apiProfile.stats?.total_students || 0,
    average_rating: apiProfile.stats?.average_rating || 0,
    total_reviews: apiProfile.stats?.total_reviews || 0,
    completeness_score: apiProfile.completeness_score || null,
  }
}

// Helper: normalize to API
function normalizeToApi(profile: TutorProfile): any {
  // Transform domain model to API payload
  return {
    headline: profile.headline,
    bio: profile.bio,
    subjects: profile.subjects,
    teaching_languages: profile.teaching_languages,
    languages: profile.teaching_languages,  // backward compat
    experience_years: profile.experience_years,
    is_published: profile.is_published,
    country: profile.country,
    timezone: profile.timezone,
    format: profile.format,
    gender: profile.gender,
    show_gender: profile.show_gender,
    birth_year: profile.birth_year,
    show_age: profile.show_age,
    telegram_username: profile.telegram_username,
    pricing: {
      hourly_rate: profile.hourly_rate,
      currency: profile.currency,
      trial_lesson_price: profile.trial_lesson_price,
    },
    media: {
      photo_url: profile.photo_url,
      video_intro_url: profile.video_intro_url,
    },
  }
}

// Export as namespace
export const tutorProfile = {
  get,
  init,
  update,
  publish,
  unpublish,
  isComplete,
  canPublish,
  reset,
}
```

### Крок 2.2: validators.ts

**Файл:** `src/domains/tutorProfile/validators.ts`

```typescript
import type { TutorProfile } from './model'

export type ValidationErrors = Record<string, string[]>

export function validateProfile(profile: TutorProfile): ValidationErrors | null {
  const errors: ValidationErrors = {}
  
  if (!profile.headline?.trim()) {
    errors.headline = ['Headline is required']
  }
  
  if (!profile.bio?.trim()) {
    errors.bio = ['Bio is required']
  }
  
  if (profile.subjects.length === 0) {
    errors.subjects = ['At least one subject is required']
  }
  
  if (profile.teaching_languages.length === 0) {
    errors.teaching_languages = ['At least one teaching language is required']
  }
  
  if (profile.hourly_rate <= 0) {
    errors.hourly_rate = ['Hourly rate must be greater than 0']
  }
  
  return Object.keys(errors).length > 0 ? errors : null
}
```

### Acceptance Criteria

- [ ] `index.ts` створено з Public API
- [ ] `validators.ts` створено
- [ ] Немає прямого доступу до `state`
- [ ] Тільки семантичні дії (init/update/publish)
- [ ] DEV freeze працює

---

## ФАЗА 3: Підключення (найчутливіше)

### Мета
Мігрувати існуючі компоненти на використання domain API.

### Крок 3.1: Ініціалізація профілю

**Файл:** `src/modules/marketplace/stores/marketplaceStore.ts`

**Було:**
```typescript
async function loadMyProfile() {
  const response = await marketplaceApi.getTutorMeProfile()
  myProfile.value = response  // ❌ пряма мутація
}
```

**Стає:**
```typescript
import { tutorProfile } from '@/domains/tutorProfile'

async function loadMyProfile() {
  const response = await marketplaceApi.getTutorMeProfile()
  tutorProfile.init(response)  // ✅ через domain
}

// Getter замість ref
const myProfile = computed(() => tutorProfile.get())
```

### Крок 3.2: ProfileEditor → тільки через домен

**Файл:** `src/modules/marketplace/components/editor/ProfileEditor.vue`

**Було:**
```typescript
async function handleSubmit() {
  const payload = getSubmitPayload()
  emit('save', payload)  // батьківський компонент → store
}
```

**Стає:**
```typescript
import { tutorProfile } from '@/domains/tutorProfile'

async function handleSubmit() {
  const patch = {
    headline: formData.value.headline,
    bio: formData.value.bio,
    subjects: formData.value.subjects,
    teaching_languages: formData.value.teaching_languages,
    // ...
  }
  
  await tutorProfile.update(patch)  // ✅ прямо через domain
  emit('saved')  // тільки notification
}
```

### Крок 3.3: Marketplace → read-only

**Файл:** `src/modules/marketplace/views/MyProfileView.vue`

**Було:**
```typescript
const myProfile = computed(() => store.myProfile)
```

**Стає:**
```typescript
import { tutorProfile } from '@/domains/tutorProfile'

const myProfile = computed(() => tutorProfile.get())

// ❌ ЗАБОРОНЕНО
// myProfile.value.headline = 'new'
// myProfile.value.subjects.push(...)
```

### Крок 3.4: Видалити дублікати

**Файли для зміни:**
1. `marketplaceStore.ts` — видалити `myProfile` ref, залишити тільки computed
2. `profileStore.js` — deprecate або видалити (якщо не використовується)

### Acceptance Criteria

- [ ] `marketplaceStore` використовує domain API
- [ ] `ProfileEditor` використовує domain API
- [ ] Всі компоненти читають через `tutorProfile.get()`
- [ ] Немає прямих мутацій
- [ ] Старі refs видалені

---

## ФАЗА 4: Захист від "випадкових латок"

### Мета
Зробити неможливими випадкові мутації.

### Крок 4.1: DEV-freeze (runtime guard)

**Вже реалізовано в `index.ts`:**
```typescript
if (import.meta.env.DEV) {
  return Object.freeze({ ...state })
}
```

**Результат:** Будь-яка спроба мутації → runtime error у DEV.

### Крок 4.2: ESLint rule

**Файл:** `.eslintrc.js` (або `.eslintrc.json`)

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["**/profileStore", "**/profile/store/*"],
            "message": "Use tutorProfile domain API from @/domains/tutorProfile"
          }
        ]
      }
    ]
  }
}
```

### Крок 4.3: TypeScript strict mode

**Файл:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### Acceptance Criteria

- [ ] DEV freeze працює
- [ ] ESLint rule додано
- [ ] TypeScript strict mode увімкнено
- [ ] CI/CD перевіряє правила

---

## ФАЗА 5: Фіксація

### Мета
Зафіксувати domain як частину платформи.

### Крок 5.1: Написати правило команди

**Файл:** `docs/rules/TUTOR_PROFILE_DOMAIN_RULE.md`

```markdown
# Tutor Profile Domain Rule

**Tutor Profile — frozen frontend domain.**

Будь-які правки тільки через `src/domains/tutorProfile`.

## Що заборонено

- ❌ Прямі мутації профілю
- ❌ Дублювання state у stores
- ❌ Обхід domain API

## Що дозволено

- ✅ Читання через `tutorProfile.get()`
- ✅ Оновлення через `tutorProfile.update()`
- ✅ Публікація через `tutorProfile.publish()`

## Виключення

Немає виключень.

## Процес зміни domain

1. Створити RFC у `docs/rfc/`
2. Domain review (мінімум 2 approvals)
3. Оновити тести
4. Оновити документацію
5. Merge

Це все.
```

### Крок 5.2: Додати до CI/CD

**Файл:** `.github/workflows/ci.yml` (або аналог)

```yaml
- name: Lint domain rules
  run: npm run lint

- name: Test domain
  run: npm run test -- src/domains/tutorProfile
```

### Acceptance Criteria

- [ ] Правило команди написано
- [ ] CI/CD перевіряє domain
- [ ] Документація оновлена
- [ ] Team trained

---

## Технічні завдання (для агентів)

### ТЗ-1: Створити структуру domain

**Файли:**
- `src/domains/tutorProfile/index.ts`
- `src/domains/tutorProfile/model.ts`
- `src/domains/tutorProfile/validators.ts`
- `src/domains/tutorProfile/README.md`
- `src/domains/tutorProfile/__tests__/domain.spec.ts`

**Acceptance:**
- Код компілюється
- Тести проходять
- README написано

**Час:** 2 години

---

### ТЗ-2: Реалізувати Public API

**Файл:** `src/domains/tutorProfile/index.ts`

**Функції:**
- `get()`, `init()`, `update()`, `publish()`, `unpublish()`
- `isComplete()`, `canPublish()`, `reset()`

**Acceptance:**
- Всі функції реалізовані
- DEV freeze працює
- Unit tests покривають 80%+

**Час:** 4 години

---

### ТЗ-3: Мігрувати marketplaceStore

**Файл:** `src/modules/marketplace/stores/marketplaceStore.ts`

**Зміни:**
- Видалити `myProfile` ref
- Додати `computed(() => tutorProfile.get())`
- Замінити `loadMyProfile()` на `tutorProfile.init()`
- Замінити `updateProfile()` на `tutorProfile.update()`

**Acceptance:**
- Немає прямих мутацій
- Всі тести проходять
- UI працює без змін

**Час:** 3 години

---

### ТЗ-4: Мігрувати ProfileEditor

**Файл:** `src/modules/marketplace/components/editor/ProfileEditor.vue`

**Зміни:**
- Замінити `emit('save')` на `tutorProfile.update()`
- Видалити проміжні трансформації

**Acceptance:**
- Компонент використовує domain API
- Валідація працює
- UI без змін

**Час:** 2 години

---

### ТЗ-5: Додати ESLint rules

**Файл:** `.eslintrc.js`

**Зміни:**
- Додати `no-restricted-imports` для profileStore

**Acceptance:**
- ESLint ловить заборонені імпорти
- CI/CD перевіряє

**Час:** 1 година

---

### ТЗ-6: Написати документацію

**Файли:**
- `docs/rules/TUTOR_PROFILE_DOMAIN_RULE.md`
- `docs/architecture/TUTOR_PROFILE_DOMAIN_MIGRATION.md`

**Acceptance:**
- Правила чіткі
- Міграційний гайд повний

**Час:** 2 години

---

## Загальний час реалізації

**Фаза 0:** 1 година (підготовка)  
**Фаза 1:** 2 години (структура + модель)  
**Фаза 2:** 4 години (Public API)  
**Фаза 3:** 5 годин (міграція)  
**Фаза 4:** 2 години (захист)  
**Фаза 5:** 2 години (фіксація)  

**Всього:** ~16 годин (2 робочі дні для агента)

---

## Ризики та мітігація

| Ризик | Ймовірність | Вплив | Мітігація |
|-------|-------------|-------|-----------|
| Ламається Marketplace | Середня | Високий | Поетапна міграція + тести |
| Конфлікт з profileStore | Висока | Середній | Deprecate profileStore спочатку |
| Performance regression | Низька | Низький | Benchmarks до/після |
| Team resistance | Середня | Середній | Чітка документація + training |

---

## Успішне завершення

**Критерії:**
- ✅ Всі компоненти використовують domain API
- ✅ Немає прямих мутацій
- ✅ Тести проходять
- ✅ CI/CD перевіряє правила
- ✅ Документація оновлена
- ✅ Marketplace працює без регресій

**Наступний крок:** Після завершення можна переходити до Network Governor.
