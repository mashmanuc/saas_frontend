# TypeCheck Errors — Final Cleanup v0.49.4

**Дата:** 24.12.2024 21:40  
**Статус:** 16 помилок після видалення legacy файлів

---

## 📋 Список помилок

### Група 1: ExceptionManager.vue (3 помилки)
**Проблема:** `bookingApi.getExceptions()` потребує 2 аргументи (start, end)

**Файли:**
- ExceptionManager.vue:26
- ExceptionManager.vue:64
- ExceptionManager.vue:76

**Рішення:** Передати start/end дати

---

### Група 2: Імпорти calendarStore (6 помилок)
**Проблема:** Файл видалено, але імпорти залишились

**Файли:**
- SlotPicker.vue:5
- BookingModal.vue:76
- BookingSettings.vue:5
- matches/AvailabilityEditor.vue:5
- booking/index.ts:11
- booking/index.ts:15

**Рішення:** Видалити або замінити імпорти

---

### Група 3: Імпорти types/calendar.ts (5 помилок)
**Проблема:** Файл видалено, але імпорти залишились

**Файли:**
- BookingRequestModal.vue:71
- CalendarCell.vue:38
- CalendarPopover.vue:77
- CellGrid.vue:22
- ManualBookingModal.vue:98

**Рішення:** Замінити на нові типи з calendarWeek.ts

---

### Група 4: Імпорти draftStore (2 помилки)
**Проблема:** Файл видалено, але імпорти залишились

**Файли:**
- CalendarPopover.vue:79
- CellGrid.vue:25

**Рішення:** Видалити функціонал draft або замінити

---

## 🎯 План виправлення

### Крок 1: ExceptionManager.vue (2 хв)
```typescript
// Додати дати для getExceptions
const start = new Date().toISOString().split('T')[0]
const end = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
exceptions.value = await bookingApi.getExceptions(start, end)
```

### Крок 2: Видалити exports з booking/index.ts (1 хв)
```typescript
// Видалити:
export { useCalendarStore } from './stores/calendarStore'
export { useCalendar } from './composables/useCalendar'
```

### Крок 3: Замінити CalendarCell типи (5 хв)
```typescript
// Замінити:
import type { CalendarCell } from '@/modules/booking/types/calendar'
// На:
import type { CalendarEvent } from '@/modules/booking/types/calendarWeek'
```

### Крок 4: Видалити/замінити компоненти з draftStore (5 хв)
- CalendarPopover.vue — видалити draft функціонал
- CellGrid.vue — видалити draft функціонал

### Крок 5: Видалити/замінити компоненти з calendarStore (10 хв)
- SlotPicker.vue — замінити на локальний state
- BookingModal.vue — замінити на локальний state
- BookingSettings.vue — замінити на bookingApi
- matches/AvailabilityEditor.vue — замінити на bookingApi

---

## ⏱️ Загальний час: 23 хвилини

---

**Наступний крок:** Виправлення ExceptionManager.vue
