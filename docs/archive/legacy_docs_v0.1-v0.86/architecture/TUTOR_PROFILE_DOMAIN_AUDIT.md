# Аудит поточного стану Tutor Profile Domain

**Дата:** 2026-02-01  
**Версія:** v0.1.0  
**Статус:** КРИТИЧНИЙ — потребує негайної уваги

---

## Executive Summary

**Проблема:** Профіль тьютора зберігається та мутується в **3+ різних місцях** без єдиного джерела правди (SSOT). Це призводить до:
- Регресій при змінах у Marketplace
- Неможливості гарантувати консистентність даних
- Дублювання логіки валідації та трансформації
- Складності тестування та підтримки

**Рішення:** Створити `src/domains/tutorProfile` як frozen domain з єдиним API для всіх операцій з профілем.

---

## 1. Поточні джерела стану профілю

### 1.1 `marketplaceStore` (PRIMARY)
**Файл:** `src/modules/marketplace/stores/marketplaceStore.ts`

**State:**
```typescript
const myProfile = ref<TutorProfileFull | null>(null)
const isLoadingMyProfile = ref(false)
const isSaving = ref(false)
```

**Мутації:**
- `loadMyProfile()` — GET `/v1/tutors/me/profile/`
- `createProfile(data)` — POST `/marketplace/profile/`
- `updateProfile(data)` — PUT `/v1/tutors/me/profile/`
- `publishProfile()` — POST `/v1/marketplace/tutors/me/publish/`
- `unpublishProfile()` — POST `/v1/marketplace/tutors/me/unpublish/`

**Проблеми:**
- ❌ Прямі мутації `myProfile.value = ...` у 5+ місцях
- ❌ Немає валідації перед мутацією
- ❌ Marketplace store відповідає за профіль (порушення SRP)

---

### 1.2 `profileStore` (LEGACY)
**Файл:** `src/modules/profile/store/profileStore.js`

**State:**
```javascript
profile: null,
user: null,
avatarUrl: null,
loading: false,
saving: false
```

**Мутації:**
- `loadProfile()` — GET `/v1/me/profile/`
- `saveProfile(payload)` — PATCH `/v1/me/profile/`
- `uploadAvatar(file)` — POST avatar

**Проблеми:**
- ❌ Дублює частину функціональності `marketplaceStore`
- ❌ Використовує інший endpoint (`/v1/me/profile/` vs `/v1/tutors/me/profile/`)
- ❌ Не синхронізується з `marketplaceStore`

---

### 1.3 Локальний state у компонентах

**ProfileEditor.vue:**
```typescript
const formData = ref<TutorProfileFormModel>({...})
```

**MyProfileView.vue:**
```typescript
const editorRef = ref<InstanceType<typeof ProfileEditor> | null>(null)
```

**TutorProfileEditView_NEW.vue:**
```typescript
const formData = ref({
  headline: '',
  bio: '',
  experience: 0,
  // ...
})
```

**Проблеми:**
- ❌ Кожен компонент має власну копію даних
- ❌ Синхронізація через emit/props (крихка)
- ❌ Неможливо гарантувати консистентність

---

## 2. API Endpoints (Backend)

### 2.1 Основні endpoints

| Endpoint | Method | Призначення | Використовується |
|----------|--------|-------------|------------------|
| `/v1/tutors/me/profile/` | GET | Отримати власний профіль | ✅ marketplaceStore |
| `/v1/tutors/me/profile/` | PUT | Оновити профіль | ✅ marketplaceStore |
| `/marketplace/profile/` | POST | Створити профіль | ✅ marketplaceStore |
| `/v1/marketplace/tutors/me/publish/` | POST | Опублікувати | ✅ marketplaceStore |
| `/v1/marketplace/tutors/me/unpublish/` | POST | Зняти з публікації | ✅ marketplaceStore |
| `/v1/me/profile/` | GET | Legacy профіль | ⚠️ profileStore (DEPRECATED) |
| `/v1/me/profile/` | PATCH | Legacy оновлення | ⚠️ profileStore (DEPRECATED) |

### 2.2 Публічні endpoints (read-only)

| Endpoint | Method | Призначення |
|----------|--------|-------------|
| `/v1/marketplace/tutors/<slug>/profile/` | GET | Публічний профіль |
| `/v1/marketplace/tutors/` | GET | Список тьюторів |

---

## 3. Типи даних

### 3.1 Канонічний тип (Backend → Frontend)

**TutorProfileFull** (з `marketplace.ts`):
```typescript
{
  profile_version: number
  published_at: string
  slug: string
  user_id: number
  bio: string
  headline: string
  education: Education[]
  certifications: Certification[]
  languages: Language[]
  teaching_languages: Language[]  // v0.84
  subjects: SubjectPublic[]       // v0.60.1
  experience_years: number
  is_published: boolean
  pricing: { hourly_rate, currency, trial_lesson_price }
  media: { photo_url, video_intro_url }
  availability_summary: { weekly_hours, timezone }
  stats: { total_lessons, total_students, average_rating, ... }
  completeness_score: number      // v0.95.1
}
```

### 3.2 Form Model (UI)

**TutorProfileFormModel** (з `tutorProfileFormModel.ts`):
```typescript
{
  headline: string
  bio: string
  hourly_rate: number
  currency: string
  subjects: FormSubjectItem[]
  languages: FormLanguageItem[]
  teaching_languages: FormLanguageItem[]
  // ... інші поля
}
```

**Трансформації:**
- `fromApi(TutorProfileFull) → TutorProfileFormModel`
- `toApi(TutorProfileFormModel) → TutorProfilePatchPayload`

---

## 4. Місця мутації профілю

### 4.1 Прямі мутації state

**marketplaceStore.ts:**
```typescript
// ❌ Пряма мутація без валідації
myProfile.value = await marketplaceApi.getTutorMeProfile()
myProfile.value = await marketplaceApi.createTutorProfile(data)
```

**profileStore.js:**
```typescript
// ❌ Пряма мутація
this.profile = data
this.user = { ...this.user, avatar_url: avatarUrl }
```

### 4.2 Компоненти, що викликають мутації

1. **MyProfileView.vue** → `store.updateProfile()`, `store.publishProfile()`
2. **ProfileEditor.vue** → `emit('save')` → батьківський компонент → store
3. **TutorProfileEditView_NEW.vue** → `profileStore.saveProfile()`
4. **TutorProfileOverviewView_NEW.vue** → `profileStore.loadProfile()`

---

## 5. Проблеми та ризики

### 5.1 Архітектурні проблеми

| Проблема | Наслідок | Пріоритет |
|----------|----------|-----------|
| Немає SSOT для профілю | Регресії, баги синхронізації | 🔴 CRITICAL |
| Дублювання state (2+ stores) | Неконсистентні дані | 🔴 CRITICAL |
| Прямі мутації без валідації | Невалідні дані на бекенді | 🔴 CRITICAL |
| Marketplace store керує профілем | Порушення SRP, складність тестування | 🟡 HIGH |
| Legacy profileStore не deprecated | Плутанина, подвійна логіка | 🟡 HIGH |

### 5.2 Конкретні баги

1. **404 на публічному профілі** — профіль не має `status=APPROVED` після publish
2. **Втрата `teaching_languages`** — не всі компоненти підтримують нове поле
3. **Subjects migration** — legacy JSON vs normalized TutorSubject
4. **Completeness score** — рахується в кількох місцях по-різному

---

## 6. Залежності між модулями

```
ProfileEditor ──────┐
                    ├──> marketplaceStore.myProfile
MyProfileView ──────┤
                    │
TutorProfileEditView ──> profileStore.profile (LEGACY)
                    │
MarketplaceList ────┴──> marketplaceStore.tutors
                         (read currentProfile)
```

**Проблема:** Зміна профілю в одному місці не оновлює інші.

---

## 7. Рекомендації

### 7.1 Негайні дії (P0)

1. ✅ **Заборонити прямі мутації** — freeze profile у DEV mode
2. ✅ **Створити Tutor Profile Domain** — єдине джерело правди
3. ✅ **Мігрувати всі компоненти** — використовувати тільки domain API

### 7.2 Середньострокові (P1)

1. Deprecate `profileStore` — перенести функціональність у domain
2. Розділити `marketplaceStore` — профіль у domain, каталог у store
3. Додати integration tests — гарантувати консистентність

### 7.3 Довгострокові (P2)

1. Snapshot versioning — conflict resolution для concurrent edits
2. Optimistic updates — UX покращення
3. Profile analytics — telemetry для completeness, publish rate

---

## 8. Метрики поточного стану

| Метрика | Значення |
|---------|----------|
| Кількість stores з профілем | 2 (marketplaceStore, profileStore) |
| Кількість компонентів з локальним state | 3+ |
| Кількість API endpoints | 7 |
| Кількість типів даних | 4 (Full, FormModel, Patch, Upsert) |
| Кількість місць прямої мутації | 10+ |
| Test coverage для профілю | ~30% (тільки store tests) |

---

## 9. Висновки

**Поточний стан:** 🔴 **НЕПРИЙНЯТНИЙ для production**

**Причини:**
- Відсутність SSOT
- Дублювання логіки
- Неможливість гарантувати консистентність
- Високий ризик регресій

**Наступний крок:** Реалізація Tutor Profile Domain згідно з планом у `TUTOR_PROFILE_DOMAIN_PLAN.md`
