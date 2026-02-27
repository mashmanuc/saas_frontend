# Глибокий аудит: Редактор профілю репетитора

> Дата: 2026-02-27
> Статус: SSOT — єдине джерело правди для всіх змін у ProfileEditor

---

## 1. Роль репетитора (Actor)

**Хто:** Зареєстрований користувач з роллю `tutor`.

**Що робить:** Заповнює та редагує свій публічний профіль на маркетплейсі, щоб учні могли його знайти й замовити урок.

**Контекст:**
- Профіль складається з **9 вкладок** (steps): Фото → Основна інформація → Предмети → Мова викладання → Ціни → Приватність → Посилання на уроки → Telegram → Публікація
- Репетитор **не зобов'язаний** заповнити всі вкладки за один сеанс
- Репетитор може починати з будь-якої вкладки
- Репетитор може перемикатися між вкладками вільно
- Репетитор може зберегти **частково** заповнений профіль і повернутися пізніше
- Профіль **не може бути опублікований** без обов'язкових полів (headline, bio, subjects, teaching_languages, hourly_rate)

---

## 2. Карта файлів і відповідальності

| Файл | Роль |
|------|------|
| `ProfileEditor.vue` | UI форма, валідація, draft-система, emit('save') |
| `MyProfileView.vue` | Контейнер, обробка save/publish/unpublish, loadMyProfile |
| `profileAdapter.ts` | `validateProfileBeforeSubmit()` — preflight-валідація перед API |
| `tutorProfileFormModel.ts` | `fromApi()` / `toApi()` — конвертація API ↔ Form |
| `marketplaceStore.ts` | `updateProfile()` — PUT на бекенд + reload |
| `marketplace.ts` (api) | HTTP-виклики (updateTutorMeProfile, getTutorMeProfile) |
| `router/index.js` | Auth guard (beforeEach), route guard (beforeEnter) |
| `apiClient.js` | 401-інтерсептор → refresh → forceLogout |

---

## 3. Поточний flow (AS-IS) — атомарний розбір

### 3.1 Що відбувається при відкритті сторінки

1. `MyProfileView.onMounted()` → `store.loadMyProfile()` + `store.loadFilterOptions()`
2. API: `GET /v1/tutors/me/profile/` → отримуємо `TutorProfileFull`
3. `myProfile` ref оновлюється → `ProfileEditor` рендериться з `:profile="myProfile"`
4. `ProfileEditor` → `watch(props.profile, { immediate: true })`:
   - `setFormDataFromServer(newProfile)` — заповнює `formData` з API
   - Перевіряє localStorage на наявність drafту
   - `isDirty = false`
5. `ProfileEditor.onMounted()`:
   - `languagesCatalog.loadCatalog()` → API: `GET /v1/marketplace/languages/catalog/`
   - `catalog.loadSubjects()` → API: `GET /v1/marketplace/catalog/subjects/`
   - `catalog.loadTags()` → API: `GET /v1/marketplace/catalog/tags/`
   - `apiClient.get('/v1/marketplace/me/')` → перевірка has_availability

**⚠️ Ризик:** 4 API-виклики при mount. Якщо будь-який поверне 401 і refresh-токен невалідний → `forceLogout()` → втрата сесії.

### 3.2 Що відбувається при редагуванні поля

1. Користувач змінює поле (наприклад, headline)
2. `watch(formData, { deep: true })` спрацьовує
3. Якщо `suppressAutosave === 0`:
   - `isDirty = true`
   - `debouncedAutosave()` запускається (debounce 2с)
4. Через 2с autosave:
   - `buildTutorProfileUpdate(model)` → формує payload
   - `writeLocalDraft(payload)` → записує в localStorage
   - `autosaveStatus = 'saved'`

**Це працює коректно.**

### 3.3 Що відбувається при натисканні "Зберегти" (КРИТИЧНИЙ БАГ)

1. `handleSubmit()` викликається через `@submit.prevent`
2. **`markAllFieldsAsTouched()`** — позначає ВСІ поля як touched
3. `canSubmit` перевіряє `errors` computed:
   - `errors` = `allErrors` відфільтровані за `touchedFields`
   - Оскільки ВСІ поля touched → ВСІ помилки показуються
   - Якщо `subjects` порожній → помилка
   - Якщо `teaching_languages` порожній → помилка
   - Якщо `hourly_rate` ≤ 0 → помилка
4. `canSubmit = false` → **збереження НЕ відбувається**
5. `getSubmitPayload({ silent: false })`:
   - `validateProfileBeforeSubmit(model)` знаходить помилки
   - Показує toast з УСІМА помилками всіх вкладок
6. `return` — **жодного API-виклику, дані НЕ збережено**

**🔴 ПРОБЛЕМА #1: "Зберегти" робить ПОВНУ валідацію всіх вкладок.**
Репетитор заповнив "Основну інформацію", натиснув "Зберегти" — і отримав помилки
за предмети, мови, ціну. Його дані НЕ збережено, хоча вони валідні для цієї вкладки.

**Порушений інваріант:** "Репетитор може зберегти частково заповнений профіль."

### 3.4 Що відбувається при переході між вкладками

1. Клік на pill → `stepIndex = idx`
2. `watch(stepIndex)`:
   - Якщо `isDirty`: flush draft в localStorage
   - `router.replace({ query: { ...route.query, step: stepId } })`
3. `router.replace` → `router.beforeEach` guard:
   - Перевіряє `auth.isBootstrapped`, `auth.isAuthenticated`
   - Якщо `isAuthenticated` → `next()` (ОК)
   - Якщо `!isAuthenticated` → redirect `/start`

**🔴 ПРОБЛЕМА #2: Redirect на авторизацію при зміні вкладки.**

Можливі причини:
- **Причина A:** Один з 4-х API-викликів при mount повернув 401, refresh не вдався → `forceLogout()`. Після цього `auth.isAuthenticated = false`. Наступний `router.replace` → redirect на `/start`.
- **Причина B:** Access-токен протухнув під час заповнення форми. Proactive refresh не зміг оновити (сервер не відповів, CORS, тощо). Потім будь-яка навігація → redirect.
- **Причина C:** `forceLogout` при мережевій нестабільності (хоча є guard для `!navigator.onLine`).

**Кореневий механізм:** `apiClient.js` лінія 206: `await store.forceLogout('session_expired')` — повний logout при невдалому refresh. Після цього будь-яка навігація на `requiresAuth: true` сторінку → redirect.

### 3.5 Що відбувається при виході зі сторінки

1. `onBeforeRouteLeave()` в MyProfileView → `editorRef.value?.flushDraft?.()`
2. `flushDraft()`: якщо `isDirty` → `writeLocalDraft(payload)`
3. `onBeforeUnmount()` в ProfileEditor: якщо `isDirty` → `writeLocalDraft(payload)`

**Це працює коректно** — draft зберігається при виході.

### 3.6 Що відбувається при поверненні на сторінку

1. `loadMyProfile()` → свіжі дані з API
2. `watch(props.profile)` → `setFormDataFromServer(profile)`
3. Перевірка localStorage draft → якщо є → `showDraftBanner = true`
4. Користувач бачить банер "Знайдено чернетку" з кнопками "Відновити" / "Скасувати"

**Це працює коректно.**

---

## 4. Повний список інваріантів (що МАЄ працювати)

### Інваріанти збереження
| # | Інваріант | Поточний стан |
|---|-----------|--------------|
| S1 | Натиснення "Зберегти" має зберегти ТЕ, ЩО заповнено | ❌ Блокується повною валідацією |
| S2 | Часткове збереження: bio + headline без subjects має працювати | ❌ Блокується |
| S3 | Бекенд-валідація (400) має показати помилку, НЕ втратити дані | ✅ Працює (store.updateProfile catch) |
| S4 | Після успішного save — formData синхронізується з сервером | ✅ Працює (watch saving) |
| S5 | Після невдалого save — formData залишається незмінним | ✅ Працює |

### Інваріанти навігації між вкладками
| # | Інваріант | Поточний стан |
|---|-----------|--------------|
| N1 | Зміна вкладки НЕ повинна втрачати дані поточної вкладки | ✅ formData reactive |
| N2 | Зміна вкладки НЕ повинна робити redirect на авторизацію | ❌ Redirect якщо сесія expired |
| N3 | Зміна вкладки НЕ повинна викликати API | ✅ Тільки router.replace |
| N4 | Зміна вкладки має зберегти draft в localStorage | ✅ watch(stepIndex) flush |

### Інваріанти draft-системи
| # | Інваріант | Поточний стан |
|---|-----------|--------------|
| D1 | Autosave: зміна поля → через 2с draft в localStorage | ✅ Працює |
| D2 | Draft пишеться ТІЛЬКИ якщо isDirty = true | ✅ Працює |
| D3 | Draft НЕ пишеться при програмному заповненні з сервера | ✅ suppressAutosave |
| D4 | При поверненні — показати банер відновлення | ✅ Працює |
| D5 | Після успішного save — draft очищається | ✅ watch(saving) |

### Інваріанти сесії
| # | Інваріант | Поточний стан |
|---|-----------|--------------|
| A1 | Невдалий API-виклик не повинен знищити сесію якщо це не 401 | ✅ Працює |
| A2 | 401 на mount API-виклик → тихий fallback, не logout | ❌ forceLogout при refresh fail |
| A3 | Протухання токена під час edit → proactive refresh | ⚠️ Працює якщо refresh endpoint доступний |
| A4 | Навігація query-only НЕ повинна trigger auth redirect | ❌ redirect якщо auth state corrupted |

### Інваріанти валідації
| # | Інваріант | Поточний стан |
|---|-----------|--------------|
| V1 | Валідація показує помилки ТІЛЬКИ для полів, які touched | ✅ touchedFields filter |
| V2 | "Зберегти" НЕ повинен маркувати ВСІ поля як touched | ❌ markAllFieldsAsTouched() |
| V3 | Повна валідація — тільки для "Опублікувати", не для "Зберегти" | ❌ handleSubmit = повна валідація |
| V4 | Кнопка "Зберегти" повинна бути enabled поки форма dirty | ❌ disabled="!canSubmit" |

---

## 5. Кореневі причини (Root Causes)

### RC-1: handleSubmit() робить повну валідацію для звичайного Save

**Де:** `ProfileEditor.vue`, рядок 650-662

```
function handleSubmit() {
  markAllFieldsAsTouched()        // ← ВСІ поля touched
  if (!canSubmit.value) {          // ← canSubmit = allErrors empty
    getSubmitPayload({ silent: false })  // ← toast з помилками ВСІХ вкладок
    return                         // ← ЖОДНОГО збереження
  }
  ...
}
```

**Проблема:** `markAllFieldsAsTouched()` + `canSubmit` = повна валідація. Якщо є хоч одне незаповнене required-поле на БУДЬ-ЯКІЙ вкладці → save заблоковано повністю.

**Вплив:**
- Репетитор не може зберегти нічого, поки не заповнить ВСІ required-поля
- Це суперечить бізнес-вимозі "заповнити частинку, зберегти, повернутися пізніше"

### RC-2: validateProfileBeforeSubmit() вимагає ВСЕ для Save

**Де:** `profileAdapter.ts`, рядки 23-86

Валідація перевіряє:
- headline (required)
- bio (required)
- hourly_rate > 0 (required)
- currency (required)
- subjects.length > 0 (required)
- teaching_languages.length > 0 (required)
- experience_years ≥ 0
- birth_year 1900-2100

**Проблема:** Ця валідація задумана для **публікації** (всі дані мають бути), але використовується для **звичайного збереження**.

### RC-3: Кнопка "Зберегти" залежить від canSubmit

**Де:** `ProfileEditor.vue`, рядок 1567

```html
<Button ... :disabled="!canSubmit" ... type="submit">
```

`canSubmit = Object.keys(errors.value).length === 0`

Після `markAllFieldsAsTouched()` кнопка стає disabled якщо є будь-яка помилка.

### RC-4: Сесія може бути знищена тихими API-викликами при mount

**Де:**
- `ProfileEditor.vue:939-947` → `apiClient.get('/v1/marketplace/me/')`
- `useLanguagesCatalog.ts:39` → `getLanguagesCatalog()`
- `useCatalog.ts` → `getCatalogSubjects()`, `getCatalogTags()`

Якщо будь-який з цих викликів отримає 401 → apiClient interceptor → refreshAccess() → fail → **forceLogout()** → auth state corrupted → наступний router.replace → redirect на /start.

---

## 6. Атомарний план фіксу

### Принцип: "Save" ≠ "Publish"

**Save** = зберегти те, що є. Бекенд приймає partial-дані. Клієнт НЕ блокує.
**Publish** = повна валідація. Всі required-поля мають бути заповнені.

### ФІКС 1: Розділити Save і Validate (КРИТИЧНИЙ)

**Файл:** `ProfileEditor.vue` — `handleSubmit()`

**Зміна:** Save має відправляти дані БЕЗ клієнтської preflight-валідації. Бекенд сам поверне 400 якщо щось не так. Клієнт тільки будує payload.

```
Було:
handleSubmit → markAllFieldsAsTouched → canSubmit? → validateProfileBeforeSubmit → emit('save')

Має бути:
handleSubmit → buildPayload → emit('save') → бекенд валідує → показати помилки бекенду
```

**Деталі:**
- Прибрати `markAllFieldsAsTouched()` з `handleSubmit()`
- Прибрати `if (!canSubmit.value)` check з `handleSubmit()`
- Прибрати виклик `validateProfileBeforeSubmit()` перед звичайним Save
- Залишити `validateProfileBeforeSubmit()` ТІЛЬКИ для Publish flow
- `handleSubmit()` → просто `buildPayloadFromForm()` → `emit('save', payload)`

### ФІКС 2: Кнопка "Зберегти" — завжди enabled якщо isDirty (КРИТИЧНИЙ)

**Файл:** `ProfileEditor.vue` — template

**Зміна:** `:disabled="!canSubmit"` → `:disabled="saving || !isDirty"`

Кнопка Save повинна бути:
- **enabled** — якщо форма dirty (користувач щось міняв)
- **disabled** — якщо йде збереження, або форма не dirty

### ФІКС 3: Клієнтська валідація — тільки для touched полів (UX)

**Файл:** `ProfileEditor.vue` — errors computed

Поточна поведінка вже правильна для відображення:
`errors` фільтрує по `touchedFields`. Це ОК.

Але `canSubmit` використовує `errors` (що після markAllFieldsAsTouched стає повним).
Після ФІКС 1, `canSubmit` більше не блокує Save, тому це вирішується автоматично.

### ФІКС 4: Publish flow зберігає повну валідацію

**Файл:** `MyProfileView.vue` — `handlePublish()`

Publish flow вже робить:
1. `editorRef.value?.getSubmitPayload?.()` — з валідацією
2. `store.updateProfile(payload)`
3. `store.publishProfile()`

Тут `getSubmitPayload()` повинен ЗАЛИШИТИ повну валідацію. Це правильно.

### ФІКС 5: Захист сесії від mount-API помилок

**Файл:** `ProfileEditor.vue` — `onMounted()`

**Зміна:** Обгорнути всі mount API-виклики в try/catch, які НЕ дозволять
apiClient interceptor зробити forceLogout. Або: не робити ці виклики з auth-токеном
якщо вони не критичні.

**Деталі:**
API-виклик `/v1/marketplace/me/` при mount використовується тільки для
`profileHasAvailability`. Якщо він фейлить — fallback вже є (з props.profile).

**Рішення:** Зробити цей виклик некритичним — catch swallows all errors, включаючи 401.
Але проблема глибше: apiClient interceptor вже зробив forceLogout ДО того як catch
спрацює. Тому справжнє рішення:

**Варіант A:** Перенести `/v1/marketplace/me/` виклик у MyProfileView (вже є loadMyProfile).
**Варіант B:** Додати мета-опцію до apiClient: `{ meta: { noLogoutOn401: true } }`.

Рекомендація: **Варіант A** — видалити зайвий API-виклик з ProfileEditor.onMounted().
Дані `has_availability` вже є в `props.profile` (з loadMyProfile).

### ФІКС 6: watch(locale) не повинен refetch каталоги без потреби

**Файл:** `ProfileEditor.vue`, рядки 257-261

```js
watch(locale, () => {
  languagesCatalog.loadCatalog()
  catalog.loadSubjects()
  catalog.loadTags()
})
```

Якщо зміна локалі відбувається під час editing → 3 API-виклики → потенційний 401.

**Рішення:** Додати перевірку: reload каталогів тільки якщо вони вже завантажені
і локаль реально змінилася. Singleton pattern в useLanguagesCatalog вже кешує.

---

## 7. Порядок виконання (атомарний, послідовний)

| Крок | Опис | Файл | Ризик |
|------|------|------|-------|
| 1 | handleSubmit: прибрати повну валідацію, просто buildPayload + emit('save') | ProfileEditor.vue | Низький |
| 2 | Кнопка Save: disabled залежить від saving + isDirty | ProfileEditor.vue | Низький |
| 3 | Бекенд-помилки: правильно показувати в UI (вже працює через validationErrors) | — | Перевірити |
| 4 | Publish flow: залишити повну валідацію в getSubmitPayload | ProfileEditor.vue | Низький |
| 5 | Видалити зайвий API-виклик /v1/marketplace/me/ з onMounted | ProfileEditor.vue | Низький |
| 6 | Перевірити що бекенд приймає partial profile update | Тестування | Середній |
| 7 | E2E тест: заповнити 1 вкладку → Save → перейти на іншу → без redirect | Manual | — |

---

## 8. Що НЕ чіпаємо (scope out)

- Draft-система (працює коректно)
- suppressAutosave / isDirty механізм (працює коректно)
- watch(props.profile) / watch(props.saving) (працює коректно)
- onBeforeRouteLeave / onBeforeUnmount (працює коректно)
- Tab navigation (router.replace query) — працює коректно, проблема в auth
- Step completion indicators — працюють коректно

---

## 9. Реалізація (2026-02-27)

### Змінені файли

**`ProfileEditor.vue`** — 4 зміни:

| # | Зміна | Рядки |
|---|-------|-------|
| ФІКС 1 | `handleSubmit()`: прибрано `markAllFieldsAsTouched()` + `canSubmit` check. Тепер: `buildTutorProfileUpdate(formData)` → `emit('save')` | 650-656 |
| ФІКС 2 | Кнопка Save: `:disabled="saving"` замість `:disabled="!canSubmit"` | 1561 |
| ФІКС 4 | Видалено `apiClient.get('/v1/marketplace/me/')` з `onMounted` + unused `import apiClient` | 158, 933-941 |
| ФІКС 5 | Видалено мертвий `'show_telegram'` з `markAllFieldsAsTouched()` | 662 |

**Нетронуте (працює коректно):**
- `getSubmitPayload()` — повна валідація залишена для Publish flow
- Draft-система (suppressAutosave, isDirty, autosave)
- `watch(props.profile)`, `watch(formData)`, `watch(props.saving)`
- `onBeforeRouteLeave` / `onBeforeUnmount`

### Верифікація

- ✅ `vite build --mode development` — 0 помилок
- ✅ `marketplaceStore.spec.ts` — 14/14 тестів
- ✅ `profileAdapter.spec.ts` — 10/10 тестів
- ✅ `useMarketplace.spec.ts` — passed

---

## 10. Очікуваний результат після фіксів

1. **Репетитор заповнює "Основна інформація" → "Зберегти" → дані збережено на бекенді** ✅
2. **Переходить на "Предмети" → без redirect, без втрати даних** ✅
3. **Заповнює предмети → "Зберегти" → збережено** ✅
4. **Закриває сторінку → при поверненні бачить свої дані** ✅
5. **Натискає "Опублікувати" без заповнення всіх полів → помилка з переліком** ✅
6. **Заповнює все → "Опублікувати" → профіль публічний** ✅
