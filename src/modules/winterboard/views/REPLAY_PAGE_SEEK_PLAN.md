# Replay: Page arrows → seek to first op on that page

## Проблема
В публічному replay (WBPublicView) стрілки сторінок (← →) перемикають видиму сторінку,
але timeline продовжує грати з поточної позиції. Користувач очікує що при переключенні
сторінки replay покаже ops з початку тієї сторінки.

## Файли для зміни
- `WBPublicView.vue` — основний файл (page nav + replay seek)
- Можливо `WBSoloRoom.vue` — якщо teacher replay має ту ж проблему

## НЕ чіпати
- `applyReplayOperation.ts` — REPLAY INVARIANT #5: no page resolution changes
- `useReplayRecorder.ts` — recording pipeline
- `boardStore.ts` — store actions
- `useReplay.ts` — replay engine core (тільки викликати існуючий seek API)

## Підхід

### Крок 1: Зрозуміти структуру даних
Ops в timeline мають `page_id`. Pages в store мають `id` і index.
Потрібно: page index → page_id → знайти перший op з тим page_id → seek.

### Крок 2: Знайти де page nav обробляється
В WBPublicView шукати:
- template: стрілки ← → (компонент пагінації сторінок)
- handler: `goToPage` або подібний
- Перехопити цей handler і додати seek

### Крок 3: Реалізація (WBPublicView)
```
function onPageArrowClick(pageIndex: number) {
  // 1. Знайти page_id по index
  const pageId = store.pages[pageIndex]?.id
  if (!pageId) return

  // 2. Знайти перший op з цим page_id в timeline
  const ops = replay.operations  // або як вони зберігаються
  const firstOpIndex = ops.findIndex(op => op.page_id === pageId)

  // 3. Seek replay до цієї позиції
  if (firstOpIndex >= 0) {
    replay.seekTo(firstOpIndex)
  }

  // 4. Перемкнути сторінку
  store.goToPage(pageIndex)
}
```

### Крок 4: Перевірити useReplay API
Перевірити що `useReplay` має `seekTo(opIndex)` або подібний метод.
Якщо ні — треба використати існуючий механізм (наприклад slider seek).

## Ризики

### 🔴 Високий ризик
- **НЕ модифікувати replay engine** (applyReplayOperation.ts) — попередній рефакторинг
  page resolution зламав replay повністю. INVARIANT #5.
- **НЕ додавати нові ops** — це UI-only фіча, не нова операція.

### 🟡 Середній ризик
- `useReplay.seekTo()` може не існувати або працювати по-іншому. Треба спочатку
  прочитати API useReplay і зрозуміти як seek працює (snapshot + apply ops).
- Seek може бути async (підвантаження snapshot) — треба показати loading state.
- При seek на сторінку де немає ops (пуста сторінка) — треба просто goToPage без seek.

### 🟢 Низький ризик
- Template зміни в WBPublicView — додати @click handler до page arrows.
- Те саме для WBSoloRoom якщо потрібно.

## Ключове правило
Ця фіча — ТІЛЬКИ UI wiring: page arrow click → find op index → call existing seek.
Якщо існуючий seek API не підходить — НЕ модифікувати його, а адаптувати UI.

## Тестування
1. Створити сесію з 3+ сторінками
2. Намалювати щось на кожній сторінці
3. Зупинити запис
4. Відкрити публічний replay
5. Натиснути стрілку → → → і перевірити що timeline переходить на початок кожної сторінки
6. Натиснути play — ops починаються з правильної сторінки
7. Натиснути ← назад — timeline повертається на початок попередньої сторінки
