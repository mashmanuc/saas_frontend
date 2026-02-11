# Звіт про проблему зі збереженням слотів

**Дата:** 26 грудня 2025  
**Статус:** 🔴 КРИТИЧНА ПОМИЛКА  
**Компоненти:** SlotEditor, SlotEditorModal, CalendarWeekView

---

## Проблема

Після реалізації P0.1 (інтеграція SlotEditor у календар), користувач не може зберегти зміни в слотах. Кнопка "Зберегти" показується, але запит на backend не відправляється або падає з помилкою.

## Симптоми

1. ✅ Клік на availability блок відкриває модалку
2. ✅ Кнопка "Зберегти" показується (після виправлення)
3. ✅ Можна змінити час у select
4. ✅ Кнопка "Зберегти" стає активною після зміни
5. ❌ Після кліку на "Зберегти" модалка не закривається
6. ❌ Toast повідомлення не показується
7. ❌ Зміни не зберігаються

## Root Cause Analysis

### Проблема 1: Неправильна трансформація даних

**AccessibleSlot** (з API):
```typescript
{
  id: number
  type: 'available_slot'
  start: "2025-12-25T10:00:00+02:00"  // ISO datetime з timezone
  end: "2025-12-25T16:00:00+02:00"
  regularity: 'single' | 'once_a_week'
}
```

**Slot** (очікує SlotEditor):
```typescript
{
  id: string
  date: "2025-12-25"  // YYYY-MM-DD
  start: "10:00"      // HH:MM
  end: "16:00"        // HH:MM
  status: 'available'
  source: 'template'
  createdAt: string
  updatedAt: string
}
```

**Проблема в SlotEditorModal.vue:**
```typescript
const transformedSlot = computed<Slot>(() => {
  const startDate = new Date(props.slot.start)
  const endDate = new Date(props.slot.end)
  
  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }
  
  return {
    id: String(props.slot.id),
    date: startDate.toISOString().split('T')[0],
    start: formatTime(startDate),  // ❌ Може бути неправильний через timezone
    end: formatTime(endDate),
    status: 'available',
    source: 'template',
    createdAt: props.slot.start,
    updatedAt: props.slot.start
  }
})
```

**Що відбувається:**
- `new Date("2025-12-25T10:00:00+02:00")` створює Date об'єкт
- `getHours()` повертає години в **локальному timezone браузера**
- Якщо timezone браузера != timezone слоту → час буде неправильний
- `hasChanges` в SlotEditor порівнює `localStart` з `props.slot.start`
- Якщо час не співпадає → `hasChanges = false` → кнопка disabled

### Проблема 2: Backend API очікує TimeField

**Backend serializer:**
```python
class SlotEditSerializer(serializers.Serializer):
    start_time = serializers.TimeField()  # Очікує "HH:MM:SS" або "HH:MM"
    end_time = serializers.TimeField()
    strategy = serializers.ChoiceField(...)
```

**Frontend відправляє:**
```typescript
await bookingApi.editSlot(slotId, {
  start_time: "11:00",  // ✅ Правильний формат
  end_time: "16:00",
  strategy: "user_choice"
})
```

**Backend обробляє:**
```python
def edit_single_slot(
    self,
    tutor_id: int,
    slot_id: int,
    start_time: dt_time,  # datetime.time object
    end_time: dt_time,
    strategy: str = 'override',
    override_reason: Optional[str] = None,
):
    # Використовує slot.date + start_time для створення datetime
    slot = TutorAvailabilitySlot.objects.get(id=slot_id)
    slot.start_time = start_time
    slot.end_time = end_time
    slot.save()
```

**Висновок:** Backend API працює правильно, проблема на frontend.

## Виправлення

### Виправлення 1: Правильна трансформація часу

```typescript
// SlotEditorModal.vue
const transformedSlot = computed<Slot>(() => {
  // Парсимо ISO datetime з timezone
  const startDate = new Date(props.slot.start)
  const endDate = new Date(props.slot.end)
  
  // Форматуємо час у локальному timezone (як показується користувачу)
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  }
  
  return {
    id: String(props.slot.id),
    date: startDate.toISOString().split('T')[0],
    start: formatTime(startDate),
    end: formatTime(endDate),
    status: 'available',
    source: 'template',
    createdAt: props.slot.start,
    updatedAt: props.slot.start
  }
})
```

### Виправлення 2: Показувати кнопку "Зберегти" завжди

```typescript
// SlotEditor.vue
<button
  class="btn btn-primary"
  :disabled="isLoading || hasConflicts || !hasChanges"  // ✅ Disabled якщо немає змін
  @click="handleSave"
>
  {{ t('common.save') }}
</button>
```

**Було:** `v-if="hasChanges"` → кнопка не показувалась  
**Стало:** Завжди показується, але disabled якщо немає змін

### Виправлення 3: Додати логування для debug

```typescript
// useSlotEditor.ts
async function editSlot(...) {
  console.log('[useSlotEditor] editSlot called:', { slotId, newStart, newEnd, strategy })
  
  try {
    const response = await bookingApi.editSlot(slotId, { ... })
    console.log('[useSlotEditor] editSlot response:', response)
    toast.success(t('availability.slotEditor.saveSuccess'))
    return response.slot || response
  } catch (error: any) {
    console.error('[useSlotEditor] editSlot error:', error)
    toast.error(t('availability.slotEditor.saveError'))
    throw error
  }
}
```

## Тестування

### Ручне тестування

1. ✅ Відкрити календар `/booking/tutor`
2. ✅ Клікнути на жовтий availability блок
3. ✅ Модалка відкривається з правильним часом
4. ✅ Кнопка "Зберегти" показується (disabled)
5. ⏳ Змінити час початку на 11:00
6. ⏳ Кнопка "Зберегти" стає активною
7. ⏳ Клікнути "Зберегти"
8. ⏳ Модалка закривається
9. ⏳ Toast "Слот успішно збережено"
10. ⏳ Календар оновлюється з новим часом

### Очікувані логи в консолі

```
[SlotEditor] handleSave called: { slotId: "123", localStart: "11:00", localEnd: "16:00", strategy: "user_choice" }
[useSlotEditor] editSlot called: { slotId: "123", newStart: "11:00", newEnd: "16:00", strategy: "user_choice" }
[useSlotEditor] editSlot response: { slot: { ... } }
[SlotEditor] Slot saved successfully: { ... }
```

## Наступні кроки

1. ✅ Виправити форматування часу в `SlotEditorModal`
2. ✅ Показувати кнопку "Зберегти" завжди
3. ✅ Додати логування для debug
4. ⏳ Протестувати збереження слоту
5. ⏳ Перевірити, чи працює видалення слоту
6. ⏳ Перевірити inline-кнопки (edit/delete)
7. ⏳ Створити E2E тест для slot editing

## Альтернативне рішення

Якщо проблема з timezone залишається, можна використовувати UTC час:

```typescript
const formatTime = (date: Date): string => {
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}
```

Але це потребує, щоб backend також працював з UTC, що може порушити існуючу логіку.

## Рекомендації

1. **Використовувати бібліотеку для роботи з датами** (date-fns, dayjs)
2. **Додати unit тести** для трансформації даних
3. **Додати E2E тести** для slot editing
4. **Документувати формати даних** в типах TypeScript
5. **Додати валідацію** на frontend перед відправкою на backend

---

**Автор:** AI Development Team  
**Пріоритет:** P0 (КРИТИЧНО)  
**ETA:** 1 година

