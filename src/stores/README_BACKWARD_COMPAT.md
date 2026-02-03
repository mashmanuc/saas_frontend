# inquiriesStore - Backward Compatibility Guide

## Phase 2.2 Changes (Student Inquiry Flow v2)

### Додані computed properties:

```typescript
// Phase 2.2: Role-specific inquiry lists
studentItems: ComputedRef<InquiryDTO[]>  // Inquiries where current user is student
tutorItems: ComputedRef<InquiryDTO[]>    // Inquiries where current user is tutor
studentOpenCount: ComputedRef<number>     // Count of OPEN inquiries for student
```

### Backward Compatibility:

**✅ Існуючі споживачі НЕ ЛАМАЮТЬСЯ:**

```typescript
// OLD CODE (продовжує працювати)
const { items, pendingCount } = storeToRefs(useInquiriesStore())

// NEW CODE (рекомендовано для нових компонентів)
const { studentItems, tutorItems, studentOpenCount } = storeToRefs(useInquiriesStore())
```

### Міграційний шлях:

1. **Компоненти, що читають всі inquiries** → продовжують використовувати `items`
2. **Компоненти, що фільтрують по ролі** → мігрувати на `studentItems` / `tutorItems`
3. **Badge з кількістю OPEN** → мігрувати з `pendingCount` на `studentOpenCount` (якщо для студента)

### Гарантії:

- `items` - містить ВСІ inquiries (як і раніше)
- `pendingCount` - рахує OPEN inquiries (як і раніше)
- `studentItems` / `tutorItems` - фільтрують `items` по ролі
- `studentOpenCount` - рахує OPEN з `items`

**Жодних breaking changes немає.**

### Приклад міграції:

```typescript
// BEFORE
const items = computed(() => 
  useInquiriesStore().items.filter(i => i.student.id === currentUserId)
)

// AFTER
const { studentItems } = storeToRefs(useInquiriesStore())
```

### Тести:

Backward compatibility покрито в `src/stores/__tests__/inquiriesStore.spec.ts`:
- ✅ `items` повертає всі inquiries
- ✅ `pendingCount` рахує OPEN
- ✅ `studentItems` фільтрує по student role
- ✅ `tutorItems` фільтрує по tutor role
- ✅ `studentOpenCount` рахує OPEN для студента
