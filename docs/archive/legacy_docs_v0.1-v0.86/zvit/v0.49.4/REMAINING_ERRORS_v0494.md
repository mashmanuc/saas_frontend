# Залишилось 9 помилок typecheck

**Дата:** 24.12.2024 21:45  
**Прогрес:** 16 → 9 помилок (виправлено 7)

---

## ✅ Виправлено (7 помилок)
1. ✅ ExceptionManager.vue (3 помилки) — додано параметри start/end
2. ✅ booking/index.ts (2 помилки) — видалено exports
3. ✅ BookingModal.vue — замінено на локальний state
4. ✅ BookingSettings.vue — замінено на bookingApi

---

## 🔴 Залишилось (9 помилок)

### 1. SlotPicker.vue (1 помилка)
**Файл:** `src/modules/booking/components/booking/SlotPicker.vue:5`  
**Проблема:** Імпорт calendarStore  
**Рішення:** Замінити на локальний state або видалити компонент

### 2. BookingRequestModal.vue (1 помилка)
**Файл:** `src/modules/booking/components/BookingRequestModal.vue:71`  
**Проблема:** Імпорт CalendarCell з types/calendar  
**Рішення:** Замінити на CalendarEvent з calendarWeek.ts

### 3. CalendarCell.vue (1 помилка)
**Файл:** `src/modules/booking/components/calendar/CalendarCell.vue:38`  
**Проблема:** Імпорт CalendarCell з types/calendar  
**Рішення:** Замінити на CalendarEvent з calendarWeek.ts

### 4. CalendarPopover.vue (2 помилки)
**Файл:** `src/modules/booking/components/calendar/CalendarPopover.vue:77,79`  
**Проблема:** Імпорт CalendarCell та draftStore  
**Рішення:** Замінити типи, видалити draft функціонал

### 5. CellGrid.vue (2 помилки)
**Файл:** `src/modules/booking/components/calendar/CellGrid.vue:22,25`  
**Проблема:** Імпорт CalendarCell та draftStore  
**Рішення:** Замінити типи, видалити draft функціонал

### 6. ManualBookingModal.vue (1 помилка)
**Файл:** `src/modules/booking/components/modals/ManualBookingModal.vue:98`  
**Проблема:** Імпорт CalendarCell з types/calendar  
**Рішення:** Замінити на CalendarEvent з calendarWeek.ts

### 7. matches/AvailabilityEditor.vue (1 помилка)
**Файл:** `src/modules/matches/components/AvailabilityEditor.vue:5`  
**Проблема:** Імпорт calendarStore  
**Рішення:** Копіювати з booking/AvailabilityEditor.vue

---

## 🎯 Швидка стратегія (10 хв)

### Варіант A: Замінити типи (5 хв)
```typescript
// Замінити у всіх файлах:
import type { CalendarCell } from '@/modules/booking/types/calendar'
// На:
import type { CalendarEvent } from '@/modules/booking/types/calendarWeek'
```

### Варіант B: Видалити компоненти (2 хв)
Якщо компоненти не використовуються:
- CalendarCell.vue
- CalendarPopover.vue
- CellGrid.vue
- BookingRequestModal.vue
- ManualBookingModal.vue

### Варіант C: Комбінований (7 хв)
1. Замінити типи у критичних компонентах (3 хв)
2. Видалити draft функціонал (2 хв)
3. Мігрувати matches/AvailabilityEditor (2 хв)

---

## ✅ Рекомендація: Варіант C

Продовжую виправлення...
