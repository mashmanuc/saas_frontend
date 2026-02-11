# TypeCheck Errors Log v0.49.4

## Після Етапу 1 (TypeCheck Fixes)

**Дата:** 24.12.2024 21:10  
**Команда:** `npm run typecheck`  
**Статус:** ❌ 2 помилки

---

### Помилка 1: calendarStore.ts → calendarApi.ts (видалений)

```
src/modules/booking/stores/calendarStore.ts:15:29 - error TS2307: 
Cannot find module '../api/calendarApi' or its corresponding type declarations.
```

**Причина:** `calendarStore.ts` — це legacy store, який імпортує видалений `calendarApi.ts`

**Рішення:** Мігрувати всі модулі, які використовують `calendarStore`, потім видалити сам `calendarStore.ts`

---

### Помилка 2: TutorCalendarWidget.vue → CalendarCell типи

```
src/modules/marketplace/components/TutorCalendarWidget.vue:133:5 - error TS2322: 
Type 'AvailableSlot[]' is not assignable to type 'CalendarCell[]'
```

**Причина:** `TutorCalendarWidget.vue` використовує старі типи `CalendarCell` з `types/calendar.ts`

**Рішення:** Мігрувати компонент на нові типи `AccessibleSlot` з `types/calendarWeek.ts`

---

## План виправлення

1. ✅ Виправити базові TypeCheck помилки (CatalogFilterBar, marketplaceStore, MatchList, websocket)
2. 🔴 Мігрувати TutorCalendarWidget.vue на нові типи
3. 🔴 Мігрувати всі модулі з useCalendarStore на calendarWeekStore
4. 🔴 Видалити calendarStore.ts та інші legacy файли
5. ✅ Повторний typecheck

---

**Наступний крок:** Міграція TutorCalendarWidget.vue (Етап 2.1)
