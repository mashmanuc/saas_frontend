# Subject Tag Filtering - FAIL-CLOSED Fix

**Date:** 2026-01-22  
**Version:** v0.87  
**Status:** ✅ Completed

## Проблема

### Симптоми
- Мовні теги (business_language, conversational_language, grammar) показувалися для STEM предметів (математика, інформатика, фізика)
- UI дозволяв вибирати неправильні теги, що призводило до некоректних даних у профілях

### Корінь проблеми
Фільтрація тегів була **fail-open** замість **fail-closed**:

```typescript
// ❌ БУЛО (fail-open - небезпечно)
function getAvailableTagsForSubject(subjectCode: string) {
  const tagMap = marketplaceStore.subjectTagMap
  
  if (!tagMap) {
    return props.subjectTagCatalog  // Показує ВСІ теги!
  }
  // ...
}
```

**Наслідки:**
- Якщо `subjectTagMap` не завантажена → показуються всі теги
- Race condition: UI рендериться до завантаження мапи → неправильні теги
- Предмети без конфігурації в мапі → показуються всі теги

---

## Рішення

### 1. FAIL-CLOSED фільтрація

Створено нову функцію `filterTagsForSubjectSafe`:

```typescript
// ✅ СТАЛО (fail-closed - безпечно)
export function filterTagsForSubjectSafe<T extends { code: string; group: string }>(
  subjectCode: string,
  allTags: T[],
  tagMap: SubjectTagMap | null
): T[] {
  // FAIL-CLOSED: No map loaded → return empty array
  if (!tagMap) {
    return []
  }
  
  // FAIL-CLOSED: Subject not in map → return empty array
  if (!tagMap.subjects || !tagMap.subjects[subjectCode]) {
    return []
  }
  
  try {
    const config = resolveSubjectTags(subjectCode, tagMap)
    return filterTagsForSubject(allTags, config)
  } catch (err) {
    // FAIL-CLOSED: Error → return empty array
    console.error(`[subjectTagResolver] Error filtering tags for ${subjectCode}:`, err)
    return []
  }
}
```

**Інваріант:** Без мапи = без тегів (замість "всі теги")

### 2. Loading State в Store

Додано tracking стану завантаження:

```typescript
// marketplaceStore.ts
const isFilterOptionsLoading = ref(false)
const filterOptionsError = ref<string | null>(null)

async function loadFilterOptions(): Promise<void> {
  // Prevent concurrent loading
  if (isFilterOptionsLoading.value) return
  
  // Skip if already loaded (idempotent)
  if (subjectTagMap.value && catalogVersion.value) return
  
  isFilterOptionsLoading.value = true
  filterOptionsError.value = null
  
  try {
    const options = await marketplaceApi.getFilterOptions()
    // ... store data
  } catch (err) {
    filterOptionsError.value = mapApiError(err, 'Failed to load filter options')
    throw err
  } finally {
    isFilterOptionsLoading.value = false
  }
}
```

### 3. Гарантоване завантаження перед рендером

```typescript
// SubjectsTab.vue
onMounted(async () => {
  // Load subject tag map (idempotent, won't reload if already loaded)
  await marketplaceStore.loadFilterOptions()
  
  // ... rest of initialization
})
```

### 4. Warning UI для предметів без мапи

Додано візуальне попередження коли предмет не налаштований:

```vue
<!-- TabbedCard.vue -->
<div v-if="showTagMapWarning" class="tag-map-warning" role="alert">
  <span class="warning-icon">⚠️</span>
  <div class="warning-content">
    <strong>Теги не налаштовані</strong>
    <p>Для цього предмета ще не налаштовано список доступних тегів. 
       Ви можете заповнити опис у вкладці "Опис".</p>
  </div>
</div>
```

---

## Змінені файли

### Frontend

1. **`subjectTagResolver.ts`** - додано `filterTagsForSubjectSafe()`
   - FAIL-CLOSED логіка
   - Повертає `[]` якщо мапи нема або предмет не налаштований

2. **`marketplaceStore.ts`** - додано loading state
   - `isFilterOptionsLoading`
   - `filterOptionsError`
   - Ідемпотентний `loadFilterOptions()`

3. **`SubjectsTab.vue`** - гарантоване завантаження
   - `await loadFilterOptions()` в `onMounted`
   - Використання `filterTagsForSubjectSafe`

4. **`SubjectCardList.vue`** - передача `availableTags`
   - Додано `availableTags?: SpecialtyTagCatalog[]` в інтерфейс

5. **`TabbedCard.vue`** - warning UI
   - Відображення попередження для предметів без мапи
   - Фільтрація тегів за `availableTags`

6. **`subjectTagResolver.spec.ts`** - тести
   - 6 нових тестів для `filterTagsForSubjectSafe`
   - Покриття всіх fail-closed сценаріїв

---

## Тести

### Unit Tests (22/22 passed ✅)

```bash
✓ filterTagsForSubjectSafe (FAIL-CLOSED) (6)
  ✓ FAIL-CLOSED: should return empty array when tagMap is null
  ✓ FAIL-CLOSED: should return empty array when subject not in map
  ✓ FAIL-CLOSED: should return empty array when subjects field is missing
  ✓ should return filtered tags when subject is configured
  ✓ should prevent language tags from appearing in STEM subjects
  ✓ FAIL-CLOSED: should handle errors gracefully and return empty array
```

### Сценарії покриття

| Сценарій | Очікувана поведінка | Статус |
|----------|---------------------|--------|
| `tagMap = null` | `return []` | ✅ |
| `subject` не в мапі | `return []` | ✅ |
| `subjects` field відсутній | `return []` | ✅ |
| Помилка при резолюції | `return []` | ✅ |
| STEM предмет + мовні теги | Теги відфільтровані | ✅ |
| Предмет налаштований | Правильні теги | ✅ |

---

## DoD (Definition of Done)

### ✅ Функціональні вимоги

- [x] Мовні теги НЕ показуються для STEM предметів
- [x] Якщо мапи нема → теги не показуються (fail-closed)
- [x] Якщо предмет не налаштований → показується warning
- [x] `await loadFilterOptions()` перед рендером тегів
- [x] Loading state для tracking завантаження

### ✅ Технічні вимоги

- [x] Створено `filterTagsForSubjectSafe()` з fail-closed логікою
- [x] Додано `isFilterOptionsLoading` та `filterOptionsError` в store
- [x] `loadFilterOptions()` є ідемпотентним
- [x] Warning UI для предметів без конфігурації
- [x] Всі юніт-тести проходять (22/22)

### ✅ UX вимоги

- [x] Користувач бачить warning замість порожнього списку
- [x] Опис можна заповнити навіть без тегів
- [x] Немає "протікання" неправильних тегів

---

## Приклад використання

### До виправлення ❌

```typescript
// Інформатика показувала мовні теги
getAvailableTagsForSubject('informatics')
// → [grammar, business_language, conversational_language, ...]
```

### Після виправлення ✅

```typescript
// Інформатика показує тільки дозволені теги
filterTagsForSubjectSafe('informatics', allTags, tagMap)
// → [class_1_4, class_5_9, exam_nmt, ...]

// Якщо мапи нема
filterTagsForSubjectSafe('informatics', allTags, null)
// → [] (fail-closed)

// Якщо предмет не налаштований
filterTagsForSubjectSafe('new_subject', allTags, tagMap)
// → [] + показується warning UI
```

---

## Архітектурні принципи

### FAIL-CLOSED vs FAIL-OPEN

**FAIL-OPEN (небезпечно):**
```typescript
if (!data) return ALL_DATA  // ❌ Протікання даних
```

**FAIL-CLOSED (безпечно):**
```typescript
if (!data) return []  // ✅ Контрольоване обмеження
```

### Чому це важливо

1. **Безпека даних:** Неправильні теги в профілі = некоректні фільтри = погана UX
2. **Консистентність:** Предмети завжди мають правильні теги
3. **Масштабованість:** Нові предмети не "протікають" теги автоматично
4. **Debuggability:** Явні помилки краще за тихі баги

---

## Наступні кроки

### Рекомендації

1. **Додати E2E тест:** Перевірити UI для інформатики (немає мовних тегів)
2. **Моніторинг:** Логувати випадки, коли `filterTagsForSubjectSafe` повертає `[]`
3. **Документація:** Оновити гайд для додавання нових предметів

### Backlog

- [ ] Додати tooltip з поясненням чому теги недоступні
- [ ] Автоматична валідація `subject_tag_map.json` в CI/CD
- [ ] Dashboard для перегляду покриття предметів в мапі

---

## Посилання

- **Issue:** Subject tags filtering (STEM + language tags bug)
- **Related:** `SUBJECT_TAG_MAP_FIX_v2.md`
- **Tests:** `subjectTagResolver.spec.ts`
- **Backend:** `subject_tag_map.json` format validation

---

**Автор:** Cascade AI  
**Reviewer:** —  
**Deployed:** —
