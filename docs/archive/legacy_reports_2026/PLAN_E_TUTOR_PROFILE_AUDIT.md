# PLAN E — Аудит профілю тьютора: збереження, UX, навігація

> Глибокий аудит на атомарному рівні з прослідковуванням логіки
> Дата: 2026-02-27

---

## 1. АРХІТЕКТУРА ПРОФІЛЮ ТЬЮТОРА

### 1.1 Стек компонентів

```
MyProfileView.vue (контейнер)
  ├─ ProfileEditor.vue (9-кроковий візард, 2089 рядків)
  │    ├─ SubjectsTab.vue
  │    ├─ TeachingLanguagesManager.vue
  │    ├─ LessonLinksEditor.vue
  │    └─ TelegramSection.vue
  ├─ CreateProfilePrompt.vue (створення нового профілю)
  ├─ ProfileStatusBadge.vue
  └─ ActivityStatusBanner.vue
```

### 1.2 Потік даних

```
API GET /v1/tutors/me/profile/
  → marketplaceStore.myProfile
    → MyProfileView.vue (props.profile)
      → ProfileEditor.vue (fromApi() → formData ref)
        → localStorage draft (autosave 2s debounce)
          → API PUT /v1/tutors/me/profile/ (тільки при "Зберегти зміни")
```

### 1.3 Системи збереження (3 окремі, не інтегровані!)

| Система | Сховище | Файл | Статус |
|---------|---------|------|--------|
| **localStorage draft** | `marketplace:profile:draft:{slug}` | ProfileEditor.vue:470 | ✅ Активна |
| **API autosave** | `PATCH /me/profile/autosave/` | profileStore.js:238 | ❌ НЕ підключена до marketplace editor |
| **IndexedDB draft** | `marketplace_drafts` DB | draftCache.ts | ❌ НЕ підключена до marketplace editor |

---

## 2. ЗНАЙДЕНІ ПРОБЛЕМИ

### P1 — КРИТИЧНА: Кнопка "Відкрити календар" веде на student route

**Файл:** `DashboardTutor.vue` рядок 23
**Симптом:** Кнопка не працює — тьютор натискає, але нічого не відбувається або редірект
**Причина:** `<router-link to="/calendar">` веде на route `calendar` з `meta: { roles: [USER_ROLES.STUDENT] }`. Тьютор не має доступу → guard редіректить
**Правильний route:** `tutor-calendar` → `/booking/tutor`

```vue
// ЗАРАЗ (рядок 23):
<router-link to="/calendar" class="hint-btn">

// МАЄ БУТИ:
<router-link :to="{ name: 'tutor-calendar' }" class="hint-btn">
```

**Пріоритет:** S1 (блокер)

---

### P2 — КРИТИЧНА: Дані форми втрачаються при навігації

**Файл:** `ProfileEditor.vue` рядки 565-592
**Симптом:** Тьютор заповнює 3 поля, переходить на іншу вкладку, повертається — поля порожні, банер "Виявлено чернетку" не з'являється

**Root cause — ланцюг подій:**

1. Тьютор редагує `formData` → debounce 2s запускається
2. Тьютор йде на іншу сторінку **до спрацювання debounce** (< 2с)
3. `onBeforeUnmount` (рядок 552) намагається зберегти draft...
4. ...але `draftKey = marketplace:profile:draft:{slug}` — `slug` може бути `undefined` при демонтажі
5. Тьютор повертається → `store.loadMyProfile()` → watch(props.profile) спрацьовує
6. Watch (рядок 565) **перезаписує formData з API** → все незбережене втрачено
7. `readLocalDraft()` повертає `null` (draft не було збережено через п.4)
8. Банер не з'являється

**Додаткова проблема:** watch `{ deep: true }` на `props.profile` (рядок 591) спрацьовує при кожній зміні store — навіть якщо профіль не змінився. Це перезаписує `formData` кожен раз.

**Додаткова проблема 2:** `clearLocalDraft()` викликається в watch `props.saving` (рядок 611) — після будь-якого save draft зникає, навіть якщо зміни не були фактично збережені на сервері.

**Пріоритет:** S1 (блокер)

---

### P3 — СЕРЕДНЯ: Country select — placeholder замість дефолту

**Файл:** `ProfileEditor.vue` рядки 1356-1361
**Симптом:** Показується "Напр. Україна" як placeholder (порожній option), а не дефолтне значення `UA`

**Причина:** `fromApi()` в `tutorProfileFormModel.ts:125` повертає `country: ''` для нового профілю. Select має `<option value="">placeholder</option>` першим, що і вибирається.

**Виправлення:** Встановити `UA` як дефолт при порожньому значенні:

```typescript
// tutorProfileFormModel.ts рядок 125:
country: asString((profile as any)?.country).trim() || 'UA',
```

Аналогічно timezone:
```typescript
// рядок 126:
timezone: asString(profile?.availability_summary?.timezone).trim() || 'Europe/Kyiv',
```

**Росія (RU):** НЕ присутня ні у FALLBACK_COUNTRIES, ні у COUNTRY_NAMES backend — виключена by design ✅

**Пріоритет:** S3 (UX)

---

### P4 — СЕРЕДНЯ: Прогрес-бар — дві різні метрики, обидві неточні

**Компонент 1:** `MyProfileView.vue:46-52` — "Заповнено 15%"
- Джерело: `myProfile.completeness_score` з бекенду
- Формула: `completeness_service.py` — 10 полів з вагами (avatar 15%, bio 20%, headline 10%...)
- Backend вимагає bio ≥100 символів, headline ≥20 символів
- Включає certifications (5%), education (5%), video_intro (5%) — яких немає в UI-кроках

**Компонент 2:** `ProfileEditor.vue:904-924` — "4/9 кроків заповнено"
- Джерело: локальна `stepCompletion` computed
- Формула: 9 кроків, з них 3 завжди `true` (privacy, lesson-links, telegram)
- Frontend вимагає bio ≥10 символів, headline ≥3 символи

**Невідповідності:**
| Поле | Backend мінімум | Frontend мінімум | Проблема |
|------|-----------------|------------------|----------|
| headline | ≥20 chars | ≥3 chars | Крок "зелений" але completeness не рахує |
| bio | ≥100 chars | ≥10 chars | Крок "зелений" але completeness не рахує |
| education | враховується (5%) | не має кроку | Неможливо заповнити через UI |
| certifications | враховується (5%) | не має кроку | Неможливо заповнити через UI |
| video_intro | враховується (5%) | крок прихований | Неможливо набрати 100% |

**Тьютор бачить:** "4/9 кроків" + "15%" — це плутає.

**Пріоритет:** S2 (функціональність)

---

### P5 — НИЗЬКА: console.log у production

**Файл:** `ProfileEditor.vue` рядки 524-525, 534-535, 543-544, 475-476, 481-483, 597-598
**Симптом:** У DEV mode 6+ console.log при кожній зміні поля
**Ефект:** Хоча обгорнуті в `import.meta.env.DEV`, вони створюють шум при розробці

**Пріоритет:** S4 (чистота коду)

---

### P6 — СЕРЕДНЯ: Дублювання систем збереження

**Проблема:** Є 3 окремі системи drafts (localStorage, API autosave, IndexedDB) і жодна не інтегрована. Marketplace editor використовує тільки localStorage, яка:
- Не синхронізується між пристроями
- Обмежена ~5MB
- Не має конфлікт-резолюції
- Видаляється при очистці браузера

API endpoints для drafts (`PUT /v1/marketplace/me/profile/draft`) визначені в `marketplace.ts:1229` але НЕ використовуються в editor.

**Пріоритет:** S3 (надійність)

---

### P7 — СЕРЕДНЯ: "Зберегти зміни" не зберігає за кроками

**Файл:** `MyProfileView.vue:61-64`
**Симптом:** Кнопка "Зберегти зміни" знизу сторінки зберігає ВСІ поля. Тьютор не знає, чи зберіг крок чи ні.
**Очікуване:** Auto-save за кроком або explicit save per step

**Пріоритет:** S3 (UX)

---

### P8 — НИЗЬКА: Step pills не мають tooltip

**Файл:** `ProfileEditor.vue:1126-1138`
**Симптом:** Кнопки кроків не мають підказок при hover

**Пріоритет:** S4 (UX)

---

## 3. ПЛАН ВИПРАВЛЕНЬ

### Крок 1 — Критичні виправлення (S1)

#### 1.1 Fix кнопки "Відкрити календар"

**Файл:** `frontend/src/modules/dashboard/views/DashboardTutor.vue`

```vue
// Рядок 23: замінити
<router-link to="/calendar" class="hint-btn">
// На:
<router-link :to="{ name: 'tutor-calendar' }" class="hint-btn">
```

#### 1.2 Fix втрати даних при навігації

**Файл:** `frontend/src/modules/marketplace/components/editor/ProfileEditor.vue`

**Підхід: негайний autosave + розумний watch**

A) Замінити debounced autosave на негайний при зміні кроку:
```typescript
// Додати watch на stepIndex — при зміні кроку одразу зберегти draft:
watch(stepIndex, () => {
  debouncedAutosave.cancel?.()
  try {
    const { newLanguageCode, newLanguageLevel, ...model } = formData.value
    const apiPayload = buildTutorProfileUpdate(model)
    writeLocalDraft(apiPayload as any)
  } catch { /* silent */ }
})
```

B) Виправити watch(props.profile) щоб не перезаписувати при наявності draft:
```typescript
// Рядок 565-592: додати перевірку draft перед перезаписом
watch(
  () => props.profile,
  (newProfile) => {
    isUpdatingFromProps.value = true

    const draft = readLocalDraft()
    if (draft) {
      // Draft є — НЕ перезаписувати formData з API
      hasLocalDraft.value = true
      lastAutosavedAt.value = draft.savedAt
      showDraftBanner.value = true
      isUpdatingFromProps.value = false
      return  // <-- ключова зміна
    }

    formData.value = {
      ...fromApi(newProfile),
      newLanguageCode: '',
      newLanguageLevel: 'fluent' as LanguageLevel,
    }
    hasLocalDraft.value = false
    showDraftBanner.value = false
    lastAutosavedAt.value = null

    setTimeout(() => {
      isUpdatingFromProps.value = false
    }, 0)
  },
  { deep: true, immediate: true }
)
```

C) Додати `beforeRouteLeave` guard у `MyProfileView.vue`:
```typescript
import { onBeforeRouteLeave } from 'vue-router'

onBeforeRouteLeave((_to, _from, next) => {
  // Якщо є незбережені зміни — зберегти draft перед виходом
  editorRef.value?.flushDraft?.()
  next()
})
```

D) Expose `flushDraft` з ProfileEditor:
```typescript
defineExpose({
  getSubmitPayload,
  flushDraft() {
    debouncedAutosave.cancel?.()
    try {
      const { newLanguageCode, newLanguageLevel, ...model } = formData.value
      const apiPayload = buildTutorProfileUpdate(model)
      writeLocalDraft(apiPayload as any)
    } catch { /* silent */ }
  }
})
```

---

### Крок 2 — Функціональні виправлення (S2)

#### 2.1 Синхронізація метрик прогресу

**Підхід:** Прибрати backend completeness_score з UI і залишити тільки "X/9 кроків".

**Альтернатива:** Синхронізувати вимоги frontend і backend:

```typescript
// ProfileEditor.vue — stepCompletion
basic: (f.headline?.trim() || '').length >= 20 &&  // замість 3
       (f.bio?.trim() || '').length >= 100 &&        // замість 10
       f.experience_years >= 0,
```

Або навпаки — зменшити backend вимоги до frontend значень. Залежить від бізнес-логіки.

---

### Крок 3 — UX покращення (S3)

#### 3.1 Country default = UA

**Файл:** `frontend/src/modules/marketplace/tutorProfileFormModel.ts`

```typescript
// Рядок 125:
country: asString((profile as any)?.country).trim() || 'UA',
// Рядок 126:
timezone: asString(profile?.availability_summary?.timezone).trim() || 'Europe/Kyiv',
```

#### 3.2 Auto-restore draft замість банера

**Файл:** `ProfileEditor.vue`

Замість показу банера "Виявлено чернетку" — автоматично відновлювати draft:

```typescript
watch(
  () => props.profile,
  (newProfile) => {
    const draft = readLocalDraft()
    if (draft) {
      // Автоматично відновити draft
      restoreLocalDraft()
      return
    }
    // ... звичайна ініціалізація
  },
  { immediate: true }
)
```

#### 3.3 Підказки для кроків

Додати hint під кожний крок з коротким поясненням що потрібно заповнити і навіщо. Можливість відключити через `localStorage` toggle.

---

### Крок 4 — i18n ключі

Нові ключі, які потрібно додати:

```json
{
  "marketplace.profile.editor.autoSaved": "Автозбережено",
  "marketplace.profile.editor.draftAutoRestored": "Чернетку відновлено",
  "marketplace.profile.editor.unsavedChanges": "Є незбережені зміни. Зберегти перед виходом?",
  "marketplace.profile.editor.stepHint.photo": "Додайте фото, щоб учні бачили, з ким працюють",
  "marketplace.profile.editor.stepHint.basic": "Розкажіть про себе — це перше, що бачать учні",
  "marketplace.profile.editor.stepHint.subjects": "Оберіть предмети, які ви викладаєте",
  "marketplace.profile.editor.stepHint.teachingLanguages": "На яких мовах ви проводите уроки?",
  "marketplace.profile.editor.stepHint.pricing": "Встановіть ціну за годину заняття"
}
```

---

## 4. ЗВЕДЕНА ТАБЛИЦЯ ПРОБЛЕМ

| ID | Пріоритет | Тип | Опис | Файл | Рядок | Статус |
|----|-----------|-----|------|------|-------|--------|
| P1 | S1 | Баг | Кнопка "Відкрити календар" → student route | DashboardTutor.vue | 23 | ✅ Вже виправлено (to="/booking/tutor") |
| P2 | S1 | Баг | Дані форми втрачаються при навігації | ProfileEditor.vue | 565-592, 552-563 | ✅ Виправлено 2026-02-27 |
| P3 | S3 | UX | Country placeholder замість default UA | tutorProfileFormModel.ts | 125 | ✅ Виправлено 2026-02-27 |
| P4 | S2 | UX | Дві різні метрики прогресу, обидві неточні | MyProfileView.vue | 46-52 | ✅ Виправлено 2026-02-27 |
| P5 | S4 | Якість | Console.log у DEV mode | ProfileEditor.vue | 524-598 | ⏸ Відкладено (DEV-only, не шкодять) |
| P6 | S3 | Архіт. | 3 системи drafts, жодна не інтегрована | marketplace.ts, draftCache.ts, profileStore.js | — | ⏸ Backlog |
| P7 | S3 | UX | "Зберегти" не дає зворотного зв'язку по кроках | MyProfileView.vue | 61-64 | ⏸ Backlog |
| P8 | S4 | UX | Step pills без tooltip | ProfileEditor.vue | 1126-1138 | ⏸ Backlog |

---

## 5. ФАЙЛИ ЗМІНЕНІ

### Виконані зміни (2026-02-27):

1. **`ProfileEditor.vue`** — P2:
   - `watch(props.profile)`: якщо draft існує і `!props.saving` → не перезаписувати formData, показати банер
   - `watch(stepIndex)`: flush draft одразу при зміні кроку (не чекати debounce 2с)
   - `defineExpose({ flushDraft })`: exposed для виклику з MyProfileView

2. **`MyProfileView.vue`** — P2, P4:
   - Додано `onBeforeRouteLeave` → `editorRef.flushDraft()` перед навігацією
   - Видалено conflicting `completenessPercent` / `shouldShowCompletenessWidget` computed
   - Видалено completeness % віджет з template (єдине джерело прогресу — editor "X/9 steps")
   - Видалено пов'язані CSS стилі

3. **`tutorProfileFormModel.ts`** — P3:
   - `country`: fallback `'UA'` при порожньому значенні
   - `timezone`: fallback `'Europe/Kyiv'` при порожньому значенні

### НЕ змінено (план був невірним):
- `DashboardTutor.vue` — P1 вже виправлена раніше (`to="/booking/tutor"`)

---

## 6. РЕЗУЛЬТАТ АУДИТУ

### Помилки в оригінальному плані:

1. **P1 — хибний позитив.** Рядок 23 DashboardTutor.vue вже містив `to="/booking/tutor"`, а не `to="/calendar"`. План базувався на застарілих даних.

2. **P2 — частково невірний root cause.** `slug` не може бути `undefined` при демонтажі — `draftKey` computed використовує fallback `'new'`. Справжня проблема: `watch(props.profile)` перезаписував formData ДО перевірки draft.

3. **Крок 3.2 (auto-restore) — відхилено як шкідливий.** Тихе авто-відновлення потенційно застарілих draft-даних — гірший UX, ніж банер з явним вибором. Залишено банер "Виявлено чернетку".

### Фактичний результат:

| Було | Стане |
|------|-------|
| Дані зникають при навігації (< 2с до debounce) | Draft зберігається одразу при зміні кроку + перед навігацією |
| watch(profile) перезаписував formData завжди | При наявності draft — formData зберігається, банер показується |
| Country = порожній placeholder | Country = Україна за замовчуванням |
| Timezone = порожній | Timezone = Europe/Kyiv за замовчуванням |
| "15%" ≠ "4/9 кроків" — конфлікт метрик | Єдина метрика прогресу (X/9 кроків в editor) |
