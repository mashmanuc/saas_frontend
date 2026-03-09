# PROFILE VALIDATION AUDIT — Повний аудит валідації профілю тьютора

**Дата:** 2026-02-28
**Контекст:** Юзер бачить `Subject 'language_en' not found or inactive` замість зрозумілого повідомлення.
**Метод:** Повний trace від UI form → adapter → API payload → backend validation → error response → UI display.

---

## 1. Архітектура валідації (поточна)

```
ProfileEditor.vue           profileAdapter.ts          Backend
─────────────────          ──────────────────         ──────────
formData (reactive)  ──→   buildTutorProfileUpdate()  ──→  PUT /v1/tutors/me/profile/
 │                          │                               │
 │ localErrors (computed)   │ subjects: [{code, tags}]     ProfileUpdateSerializer
 │ allErrors (computed)     │ teaching_languages            │ validate_subjects()
 │ errors (filtered by      │ pricing, bio, headline...    │ TutorSubjectWriteSerializer
 │   touchedFields)         │                              │   validate_code() ← Subject.objects.get(slug=code)
 │                          │                              │
 └── stepErrors (per tab)   │                              ↓ 400 VALIDATION_ERROR
                            │                              {error: {fields: {subjects: {code: [...]}}}}
                            │                              
                            │                              ↓ parseMarketplaceApiError()
                            │                              ↓ mapMarketplaceErrorToMessage()
                            │                              ↓ toast: "subjects: code: Subject 'language_en'..."
```

### Проблеми з поточною архітектурою:

1. **Subject code mismatch** — фронт шле `language_en`, бекенд має `english`
2. **Raw backend errors** — юзер бачить `"Subject 'language_en' not found or inactive"` 
3. **Нема маппінгу field → user-friendly message** — `subjects.code` = що це?
4. **Toast-only errors** — немає inline помилок під полями
5. **Немає автопереключення** на вкладку де помилка

---

## 2. ROOT CAUSE: Subject Code Mismatch

### Що відбувається:

```
SubjectsTab.vue:
  handleTogglePopularLanguage('en')
    → subjectCode = 'language_en'      ← фронтенд-код для мов як предметів
    → handleSelect('language_en')
    → formData.subjects.push({ code: 'language_en', ... })

profileAdapter.ts:
  buildTutorProfileUpdate()
    → subjects: [{ code: 'language_en', tags: [], ... }]   ← ЦЕ ЙДЕТЬСЯ В API

Backend:
  TutorSubjectWriteSerializer.validate_code('language_en')
    → Subject.objects.get(slug='language_en', is_active=True)
    → DoesNotExist!
    → ValidationError("Subject 'language_en' not found or inactive")
```

### Backend Subject slugs (SEED_CATEGORIES):

| Фронт-код | Backend slug | Статус |
|-----------|-------------|--------|
| `language_en` | `english` | ❌ MISMATCH |
| `language_de` | `german` | ❌ MISMATCH |
| `language_pl` | `polish` | ❌ MISMATCH |
| `language_fr` | `french` | ❌ MISMATCH |
| `language_es` | `spanish` | ❌ MISMATCH |
| `language_uk` | `ukrainian` | ❌ MISMATCH |
| `language_zh` | `chinese` | ❌ MISMATCH |
| `language_ja` | `japanese` | ❌ MISMATCH |
| `mathematics` | `mathematics` | ✅ OK |
| `physics` | `physics` | ✅ OK |

### SubjectsTab має маппінг, але тільки для тегів!

```typescript
// SubjectsTab.vue:137-158 — LANGUAGE_ISO_TO_SUBJECT
// Використовується ТІЛЬКИ в resolveSubjectCode() для тегів.
// НЕ впливає на API payload.
const LANGUAGE_ISO_TO_SUBJECT = {
  'en': 'english-language',  // Але бекенд має slug 'english', не 'english-language'!
  'de': 'german-language',
  ...
}
```

**Подвійна проблема:**
1. Маппінг є, але не використовується при формуванні payload
2. Маппінг вказує на `english-language`, а бекенд має `english`

---

## 3. Інваріанти валідації для кожної вкладки

### Tab 1: Фото (`photo`)

| Поле | Правило | Фронт-валідація | Бекенд-валідація |
|------|---------|-----------------|------------------|
| avatar | Рекомендовано, не обов'язково | Немає | Окремий endpoint `/v1/me/avatar` |

**Інваріанти:**
- I1.1: Фото завантажується окремим API, не через profile PUT
- I1.2: Відсутність фото блокує Publish, але не Save

### Tab 2: Основна інформація (`basic`)

| Поле | Правило | Фронт-валідація | Бекенд-валідація |
|------|---------|-----------------|------------------|
| `headline` | min 3 chars, max 100 | ✅ localErrors | ✅ CharField(max_length=100) |
| `bio` | min 10 chars, max 5000 | ✅ localErrors | ✅ CharField(max_length=5000) |
| `experience_years` | >= 0, integer | ✅ localErrors | ✅ IntegerField(min_value=0) |
| `country` | optional, max 64 | ❌ Немає | ✅ CharField(max_length=64) |
| `timezone` | optional, max 64 | ❌ Немає | ✅ CharField(max_length=64) |

**Інваріанти:**
- I2.1: headline і bio — ОБОВ'ЯЗКОВІ для Publish, опціональні для Save
- I2.2: experience_years — не може бути від'ємним
- I2.3: Помилка headline повинна показуватись БІЛЯ поля headline, а не тільки в toast

### Tab 3: Предмети (`subjects`)

| Поле | Правило | Фронт-валідація | Бекенд-валідація |
|------|---------|-----------------|------------------|
| `subjects` | >= 1 для Publish | ✅ localErrors | ❌ Немає (пусті дозволені) |
| `subjects[].code` | має бути slug з Subject table | ❌ **BROKEN** — шле `language_en` | ✅ Subject.objects.get(slug=code) |
| `subjects[].tags` | кожен тег з SpecialtyTag | ❌ Немає | ✅ SpecialtyTag.objects.get(code=tag) |
| `subjects[].custom_direction_text` | 300-800 chars або порожній | ✅ profileAdapter (50-800) | ✅ serializer (300-800) |

**Інваріанти:**
- I3.1: Subject code ПОВИНЕН бути валідним backend slug
- I3.2: `language_en` → `english` маппінг ПОВИНЕН відбуватись перед відправкою
- I3.3: Якщо subject code невалідний — показати "Предмет X не знайдено" БІЛЯ предмету
- I3.4: custom_direction_text min length: бекенд 300, фронт 50 — **INCONSISTENCY**

### Tab 4: Мови викладання (`teaching-languages`)

| Поле | Правило | Фронт-валідація | Бекенд-валідація |
|------|---------|-----------------|------------------|
| `teaching_languages` | >= 1 для Publish | ✅ localErrors | ❌ Немає |
| `teaching_languages[].code` | ISO code | ❌ Немає | ✅ LanguageEntrySerializer |
| `teaching_languages[].level` | enum | ❌ Немає | ✅ LanguageEntrySerializer |

**Інваріанти:**
- I4.1: Мінімум 1 мова викладання для Publish
- I4.2: Помилка повинна показувати: "Оберіть хоча б одну мову викладання"

### Tab 5: Ціна (`pricing`)

| Поле | Правило | Фронт-валідація | Бекенд-валідація |
|------|---------|-----------------|------------------|
| `hourly_rate` | > 0, number | ✅ localErrors | ✅ PricingSerializer |
| `currency` | enum | ✅ profileAdapter | ✅ PricingSerializer |
| `trial_lesson_price` | nullable, >= 0 | ❌ Немає | ✅ PricingSerializer |

**Інваріанти:**
- I5.1: hourly_rate > 0 — обов'язково для Publish
- I5.2: Помилка: "Вкажіть ціну за годину (більше 0)"

### Tab 6: Приватність (`privacy`)

| Поле | Правило | Фронт-валідація | Бекенд-валідація |
|------|---------|-----------------|------------------|
| `gender` | optional, max 32 | ❌ Немає | ✅ CharField(max_length=32) |
| `birth_year` | 1900-2100, nullable | ✅ localErrors | ✅ IntegerField(min/max) |
| `telegram_username` | optional, max 64 | ❌ Немає | ✅ CharField(max_length=64) |
| `city_code` | optional, з довідника | ❌ Немає | ✅ validate_city_code() |
| `is_city_public` | bool | ❌ Немає | ✅ BooleanField |

**Інваріанти:**
- I6.1: Всі поля опціональні
- I6.2: birth_year — якщо вказано, то 1900-2100
- I6.3: city_code — якщо вказано, мусить бути з довідника City

### Tab 7: Лінки уроків (`lesson-links`)

Окремий endpoint, не через profile PUT.

### Tab 8: Telegram (`telegram`)

Окремий функціонал, не через profile PUT.

### Tab 9: Публікація (`publish`)

**Інваріанти:**
- I9.1: Публікація блокується якщо не заповнені: headline, bio, subjects, teaching_languages, hourly_rate
- I9.2: Публікація використовує `getSubmitPayload()` з повною валідацією

---

## 4. Поточні проблеми UX (що бачить юзер)

### P1: Raw backend messages замість зрозумілих
```
ЗАРАЗ:  toast: "subjects: code: Subject 'language_en' not found or inactive"
ТРЕБА:  inline під предметом: "Предмет «English» не знайдено. Оберіть предмет зі списку."
```

### P2: Toast з технічними назвами полів
```
ЗАРАЗ:  "• subjects: code: Subject 'language_en' not found or inactive"
ТРЕБА:  "Предмети: невірний код предмету. Будь ласка, оберіть предмет зі списку."
```

### P3: Немає inline errors під полями
```
ЗАРАЗ:  Тільки toast зверху, зникає через 10 сек
ТРЕБА:  Червоний текст під кожним полем з помилкою (persistent)
```

### P4: Немає навігації до вкладки з помилкою
```
ЗАРАЗ:  Юзер на вкладці "Приватність", натиснув "Зберегти", помилка на "Предмети" — не видно
ТРЕБА:  Автопереключення на першу вкладку з помилкою + червоний індикатор на вкладці
```

### P5: Subject code mismatch — збереження взагалі не працює для мов
```
ЗАРАЗ:  Обрав English як предмет → Зберегти → 400 error → дані не зберігаються
ТРЕБА:  Маппінг language_en → english перед відправкою
```

---

## 5. План реалізації

### Phase 1: Critical Fix (блокуючий баг)

**FIX-A: Subject code mapping в profileAdapter**

```typescript
// profileAdapter.ts — buildTutorProfileUpdate()
// language_en → english (backend slug)
const LANGUAGE_CODE_TO_SUBJECT_SLUG: Record<string, string> = {
  'language_en': 'english',
  'language_es': 'spanish',
  'language_fr': 'french',
  'language_de': 'german',
  'language_uk': 'ukrainian',
  'language_pl': 'polish',
  'language_zh': 'chinese',
  'language_ja': 'japanese',
}

function resolveSubjectSlug(code: string): string {
  return LANGUAGE_CODE_TO_SUBJECT_SLUG[code] || code
}

// В buildTutorProfileUpdate():
const subjects = (model.subjects || [])
  .filter(s => s.code?.trim())
  .map(s => ({
    code: resolveSubjectSlug(s.code.trim()),
    tags: ...,
    custom_direction_text: ...
  }))
```

### Phase 2: User-friendly error messages

**FIX-B: Field-to-message mapper**

Новий файл: `utils/validationMessages.ts`

```typescript
// Маппінг backend field names → user-friendly i18n keys
const FIELD_LABEL_MAP: Record<string, string> = {
  'headline': 'marketplace.validation.fields.headline',
  'bio': 'marketplace.validation.fields.bio',
  'subjects': 'marketplace.validation.fields.subjects',
  'subjects.code': 'marketplace.validation.fields.subjectCode',
  'teaching_languages': 'marketplace.validation.fields.teachingLanguages',
  'hourly_rate': 'marketplace.validation.fields.hourlyRate',
  'pricing.hourly_rate': 'marketplace.validation.fields.hourlyRate',
  'experience_years': 'marketplace.validation.fields.experienceYears',
  'birth_year': 'marketplace.validation.fields.birthYear',
  'city_code': 'marketplace.validation.fields.city',
  'custom_direction_text': 'marketplace.validation.fields.customDirection',
}

// Маппінг backend error patterns → user-friendly messages
const ERROR_PATTERN_MAP: Array<{pattern: RegExp, key: string}> = [
  { pattern: /not found or inactive/i, key: 'marketplace.validation.errors.notFoundInCatalog' },
  { pattern: /this field is required/i, key: 'marketplace.validation.errors.required' },
  { pattern: /ensure this value is greater than/i, key: 'marketplace.validation.errors.tooSmall' },
  { pattern: /ensure this field has no more than/i, key: 'marketplace.validation.errors.tooLong' },
  { pattern: /minimum \d+ characters/i, key: 'marketplace.validation.errors.tooShort' },
  { pattern: /a valid integer/i, key: 'marketplace.validation.errors.mustBeNumber' },
]
```

### Phase 3: Inline field errors on each tab

**FIX-C: Inline error display під кожним полем**

Зміни в ProfileEditor.vue template:
- Кожне поле огорнути `<div class="field-group">`
- Під кожним полем: `<p v-if="errors.fieldName" class="field-error">{{ errors.fieldName }}</p>`
- CSS: `.field-error { color: var(--danger); font-size: 0.8rem; margin-top: 4px; }`

### Phase 4: Step error navigation

**FIX-D: Автопереключення на вкладку з помилкою після Save**

```typescript
// В MyProfileView.vue handleSave():
// Після отримання validation errors:
if (validationErrors.value) {
  const firstErrorTab = findFirstTabWithError(validationErrors.value)
  if (firstErrorTab) {
    router.replace({ query: { ...route.query, step: firstErrorTab } })
  }
}
```

### Phase 5: i18n keys

Додати ключі в всі 5 локалей для:
- Field labels (marketplace.validation.fields.*)
- Error patterns (marketplace.validation.errors.*)
- Tab-specific hints

---

## 6. Пріоритет реалізації

1. **FIX-A** — Critical: Subject code mapping (без цього Save не працює для мов)
2. **FIX-B** — High: User-friendly error messages в toast
3. **FIX-C** — High: Inline field errors (persistent, під кожним полем)
4. **FIX-D** — Medium: Auto-switch to error tab
5. **i18n** — High: Всі повідомлення через i18n
