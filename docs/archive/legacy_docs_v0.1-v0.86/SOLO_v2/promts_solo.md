# Claude Code Prompts для Solo Board

## 🎯 Загальні правила для ВСІХ промптів:

**🔴 КРИТИЧНО ВАЖЛИВО - РОБОЧА ДИРЕКТОРІЯ:**
```
ПРАЦЮЙ ТІЛЬКИ В: D:\m4sh_v1\frontend\docs\SOLO_v2
НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!
```

**📝 СИСТЕМА ДОКУМЕНТАЦІЇ (CHECKPOINT):**
```
ПІСЛЯ КОЖНОГО ПРОМПТА створюй/оновлюй файл:
D:\m4sh_v1\frontend\docs\SOLO_v2\PROGRESS_LOG.md

Цей файл містить:
1. Що було зроблено (список змін)
2. Які файли змінено (повні шляхи)
3. Що залишилось зробити
4. Поточний стан (на якому промпті зупинились)
5. Важливі нотатки для продовження

НАСТУПНОГО РАЗУ:
- СПОЧАТКУ читай PROGRESS_LOG.md
- Дивись що вже зроблено
- Продовжуй з того місця де зупинився
- НЕ переробляй те що вже готове!
```

**АБСОЛЮТНІ ПРАВИЛА:**
1. ❌ НЕ ЧІПАТИ backend код (`D:\m4sh_v1\frontend\docs\SOLO_v2\solo_BE\`)
2. ❌ НЕ ЗМІНЮВАТИ API контракти (endpoints, request/response formats)
3. ❌ НЕ ЗМІНЮВАТИ структуру БД
4. ❌ НЕ ВИХОДИТИ за межі `D:\m4sh_v1\frontend\docs\SOLO_v2\`
5. ❌ НЕ ЧІПАТИ файли в `D:\m4sh_v1\frontend\` (батьківська папка)
6. ✅ Працювати ТІЛЬКИ з frontend (`D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\`)
7. ✅ Зберігати backward compatibility для `state` JSON
8. ✅ Використовувати існуючі API через `soloApi.ts`
9. ✅ **ОБОВ'ЯЗКОВО** оновлювати PROGRESS_LOG.md після кожного промпта

---

## 📋 PROMPT 1: Аудит + Документація контрактів

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 CHECKPOINT СИСТЕМА:
Перед початком роботи:
1. ПЕРЕВІР чи існує файл PROGRESS_LOG.md
2. Якщо існує → ПРОЧИТАЙ його і продовжуй з того місця
3. Якщо не існує → почни з початку

Після завершення промпта:
1. СТВОРИ або ОНОВІТЬ файл PROGRESS_LOG.md
2. Запиши що зроблено, які файли змінено, що далі

Я працюю з Solo Board проектом (whiteboard додаток).

ВАЖЛИВО: У мене є backend (`solo_BE/`) та frontend (`solo_FE/`). 
Я хочу покращити frontend, але КРИТИЧНО важливо НЕ ЗМІНЮВАТИ backend API контракти.

Завдання:
1. Проаналізуй файл `solo_FE/api/soloApi.ts` та задокументуй всі API endpoints
2. Проаналізуй `solo_FE/types/solo.ts` та задокументуй структуру даних
3. Створи файл `API_CONTRACTS_LOCK.md` в корені (D:\m4sh_v1\frontend\docs\SOLO_v2\) з детальною документацією:
   - Всі endpoints (method, URL, request, response)
   - Структура state JSON
   - Типи даних (Stroke, Shape, TextElement, PageState)
   - Приклади request/response

4. Додай в файл правила:
   - "ЦІ КОНТРАКТИ НЕЗМІННІ"
   - "Всі нові features мають бути backward compatible"
   - "Backend не знає про нові tool types - він просто зберігає JSON"

Створи цей документ так, щоб я міг перевірити що нічого не зміниться в API.

ПІСЛЯ ЗАВЕРШЕННЯ:
Створи файл PROGRESS_LOG.md з таким змістом:
```markdown
# Solo Board Progress Log

## Останнє оновлення: [DATE]

### ✅ PROMPT 1 - ЗАВЕРШЕНО
**Що зроблено:**
- Створено API_CONTRACTS_LOCK.md
- Задокументовано всі endpoints
- Задокументовано структуру state

**Змінені файли:**
- D:\m4sh_v1\frontend\docs\SOLO_v2\API_CONTRACTS_LOCK.md (створено)

**Наступний крок:**
- PROMPT 2: Circle Tool

**Важливі нотатки:**
- API контракти зафіксовані
- Backend незмінний
```


---

## 📋 PROMPT 2: Circle Tool

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 ПЕРЕД ПОЧАТКОМ:
1. ПРОЧИТАЙ файл PROGRESS_LOG.md
2. Подивись що вже зроблено (щоб не повторювати)
3. Переконайся що PROMPT 1 завершено (є API_CONTRACTS_LOCK.md)

Контекст: Я працюю з Solo Board (whiteboard). Всі API контракти задокументовані в API_CONTRACTS_LOCK.md.

Завдання: Додати Circle tool (інструмент для малювання кіл).

Вимоги:
1. НЕ ЗМІНЮВАТИ backend - він просто зберігає JSON
2. Додати circle tool в `solo_FE/types/solo.ts`:
   - Додати 'circle' до Tool type
   - Розширити Shape interface (x, y, radius для кола)

3. Оновити `solo_FE/components/canvas/SoloCanvas.vue`:
   - Додати обробку circle tool в canvas rendering
   - Використовувати v-circle від Konva для відображення
   - Зберігати circle в існуючу структуру shapes[]

4. Додати circle button в toolbar (`solo_FE/components/toolbar/SoloToolbar.vue`)

5. Логіка малювання:
   - Mouse down → початкова точка (center)
   - Mouse move → radius = distance від center
   - Mouse up → зберегти в shapes[]

6. Переконайся що:
   - state.pages[].shapes[] зберігає circle в backward-compatible форматі
   - API PATCH запит використовує існуючий soloApi.updateSession()
   - Немає нових API endpoints

Після завершення покажи:
- Які файли змінено
- Приклад JSON для circle в state
- Доказ що API контракт не змінився

ПІСЛЯ ЗАВЕРШЕННЯ:
ОНОВІТЬ файл PROGRESS_LOG.md (ДОДАЙ в кінець, НЕ видаляй попереднє):
```markdown
### ✅ PROMPT 2 - ЗАВЕРШЕНО
**Що зроблено:**
- Додано Circle tool
- Оновлено типи (solo_FE/types/solo.ts)
- Оновлено canvas rendering (solo_FE/components/canvas/SoloCanvas.vue)
- Додано кнопку в toolbar

**Змінені файли:**
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\types\solo.ts
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\components\canvas\SoloCanvas.vue
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\components\toolbar\SoloToolbar.vue

**Перевірено:**
- API контракти НЕ ЗМІНЕНО ✅
- Backend НЕ ЧІПНУТО ✅
- Backward compatibility ✅

**Наступний крок:**
- PROMPT 3: Arrow Tool
```


---

## 📋 PROMPT 3: Arrow Tool

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 ПЕРЕД ПОЧАТКОМ:
ПРОЧИТАЙ PROGRESS_LOG.md - подивись що вже зроблено!

Контекст: Solo Board whiteboard з існуючими API контрактами (див. API_CONTRACTS_LOCK.md).

Завдання: Додати Arrow tool з різними стилями головок.

Вимоги:
1. НЕ ЧІПАТИ backend
2. Розширити існуючий line tool додавши опціональні поля:
   - arrowStart?: boolean  (стрілка на початку)
   - arrowEnd?: boolean    (стрілка в кінці)
   - arrowSize?: number    (розмір головки)

3. Оновити `SoloCanvas.vue`:
   - Render arrows використовуючи Konva v-arrow або custom SVG path
   - Зберігати в існуючу структуру shapes[]

4. Додати в toolbar:
   - Arrow button з dropdown меню
   - Опції: arrow-end, arrow-both, arrow-start
   - Size picker для головки

5. Backward compatibility:
   - Старі line без arrowStart/arrowEnd рендеряться як звичайні лінії
   - Нові arrow зберігаються з опціональними полями
   - Backend не парсить ці поля - просто зберігає JSON

Покажи:
- JSON приклад arrow в state
- Diff файлів (що змінилось)
- Тест що старі sessions відкриваються без помилок

ОНОВІТЬ PROGRESS_LOG.md:
```markdown
### ✅ PROMPT 3 - ЗАВЕРШЕНО
**Що зроблено:**
- Додано Arrow tool з різними стилями головок
- Розширено line tool (arrowStart, arrowEnd, arrowSize)
- Додано dropdown в toolbar для вибору стилю стрілки

**Змінені файли:**
- [список файлів]

**Backward compatibility:** ✅ Перевірено

**Наступний крок:**
- PROMPT 4: Toolbar + Color Picker
```
```

---

## 📋 PROMPT 4: Покращений Toolbar + Color Picker

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 ПЕРЕД ПОЧАТКОМ: ПРОЧИТАЙ PROGRESS_LOG.md

Контекст: Solo Board, API контракти незмінні.

Завдання: Покращити UI/UX toolbar та color picker.

Завдання 1: Новий Toolbar
Файл: `solo_FE/components/toolbar/SoloToolbar.vue`

Покращення:
- Іконки замість тексту (використай lucide-vue-next або heroicons)
- Tooltips з назвами інструментів + keyboard shortcuts
- Групування: Drawing tools | Shapes | Text | Selection
- Active state (підсвітка активного інструменту)
- Responsive (вертикальний на desktop, горизонтальний на mobile)

Завдання 2: Color Picker
Файл: `solo_FE/components/toolbar/ColorPicker.vue`

Features:
- Preset палітри (8-12 популярних кольорів)
- Custom color picker (HTML5 input type="color")
- Recent colors (останні 5 використаних кольорів → localStorage)
- Color picker popup (не inline, а dropdown)
- Показувати поточний колір в toolbar button

Завдання 3: Size Picker
Файл: `solo_FE/components/toolbar/SizePicker.vue`

Features:
- Slider для розміру (1-20px)
- Preview (показати крапку відповідного розміру)
- Presets: Small (2px), Medium (5px), Large (10px)
- Dropdown замість постійно відкритого

Вимоги:
- НЕ змінювати API
- Зберігати state в localStorage (не в backend)
- Використовувати існуючі Vue composables якщо є

Додатково:
- Додай CSS transitions для smooth UX
- Dark mode support (якщо є в проекті)

ОНОВІТЬ PROGRESS_LOG.md:
```markdown
### ✅ PROMPT 4 - ЗАВЕРШЕНО
**Що зроблено:**
- Новий toolbar з іконками та tooltips
- Color picker з preset палітрами + recent colors
- Size picker з preview та presets

**Змінені файли:**
- solo_FE/components/toolbar/SoloToolbar.vue
- solo_FE/components/toolbar/ColorPicker.vue
- solo_FE/components/toolbar/SizePicker.vue

**LocalStorage використано:** ✅ (recent colors)
**API НЕ ЗМІНЕНО:** ✅

**Наступний крок:**
- PROMPT 5: Keyboard Shortcuts
```
```

---

## 📋 PROMPT 5: Keyboard Shortcuts

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 ПЕРЕД ПОЧАТКОМ: ПРОЧИТАЙ PROGRESS_LOG.md

Контекст: Solo Board whiteboard, backend незмінний.

Завдання: Додати keyboard shortcuts для всіх інструментів та дій.

Shortcuts:
Drawing:
- P → Pen
- H → Highlighter  
- E → Eraser
- L → Line
- R → Rectangle
- C → Circle
- A → Arrow
- T → Text
- V → Select (lasso)

Actions:
- Ctrl+Z / Cmd+Z → Undo
- Ctrl+Shift+Z / Cmd+Shift+Z → Redo
- Delete / Backspace → Delete selected
- Ctrl+C / Cmd+C → Copy
- Ctrl+V / Cmd+V → Paste
- Ctrl+A / Cmd+A → Select All
- Escape → Deselect / Cancel current action
- Space (hold) → Pan mode
- Ctrl+0 / Cmd+0 → Reset zoom
- Ctrl++ / Cmd++ → Zoom in
- Ctrl+- / Cmd+- → Zoom out

Імплементація:
1. Створити composable: `solo_FE/composables/useKeyboardShortcuts.ts`
2. Використати в `SoloCanvas.vue`
3. Показувати shortcuts в tooltips (toolbar)
4. Документувати в Help modal або README

Вимоги:
- Cross-platform (Mac vs Windows)
- НЕ конфліктувати з browser shortcuts
- Disable коли textarea focused (text editing)
- Показувати shortcuts в UI (tooltips)

Додай файл `KEYBOARD_SHORTCUTS.md` з повним списком.

ОНОВІТЬ PROGRESS_LOG.md:
```markdown
### ✅ PROMPT 5 - ЗАВЕРШЕНО
**Що зроблено:**
- Створено composable useKeyboardShortcuts.ts
- Додано shortcuts для всіх інструментів та дій
- Оновлено tooltips з shortcuts
- Створено KEYBOARD_SHORTCUTS.md

**Змінені файли:**
- solo_FE/composables/useKeyboardShortcuts.ts (створено)
- solo_FE/components/canvas/SoloCanvas.vue
- KEYBOARD_SHORTCUTS.md (створено)

**Shortcuts додано:** 20+ комбінацій
**Cross-platform:** ✅ (Mac + Windows)

**Наступний крок:**
- PROMPT 6: Selection Tool
```
```

---

## 📋 PROMPT 6: Selection Tool (Lasso + Move/Resize)

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 ПЕРЕД ПОЧАТКОМ: ПРОЧИТАЙ PROGRESS_LOG.md

Контекст: Solo Board, API незмінні (API_CONTRACTS_LOCK.md).

Завдання: Додати Selection tool з можливістю вибору, переміщення та зміни розміру об'єктів.

Features:
1. Lasso Selection:
   - Freehand drawing для вибору об'єктів
   - Виділяються всі об'єкти що перетинаються з lasso
   - Multi-select (Ctrl+Click для додавання/видалення)

2. Rectangle Selection:
   - Drag rectangle для вибору
   - Виділяються об'єкти всередині rectangle

3. Move:
   - Drag виділені об'єкти
   - Snap to grid (optional, Shift to disable)
   - Update positions в state

4. Resize:
   - Corner handles для resize
   - Shift → maintain aspect ratio
   - Alt → resize from center
   - Update dimensions в state

5. Visual feedback:
   - Bounding box навколо виділених
   - Corner handles (8 points)
   - Highlight виділених об'єктів

Імплементація:
- Розширити `SoloCanvas.vue`
- Додати selection state в composable
- Зберігати в існуючий state format (просто update x, y, width, height)
- НЕ створювати нові API endpoints

State changes:
- Оновлюємо існуючі strokes/shapes з новими координатами
- Викликаємо soloApi.updateSession() з оновленим state
- Backward compatible (старі versions розуміють x, y, width, height)

Покажи:
- Як зберігаються зміни в state
- Proof що API не змінено

ОНОВІТЬ PROGRESS_LOG.md:
```markdown
### ✅ PROMPT 6 - ЗАВЕРШЕНО
**Що зроблено:**
- Selection tool (lasso + rectangle)
- Move selected objects
- Resize з corner handles
- Visual feedback (bounding box)

**Змінені файли:**
- solo_FE/components/canvas/SoloCanvas.vue
- [можливо composable для selection]

**State changes:** Оновлюємо x, y, width, height існуючих об'єктів
**API викликано:** soloApi.updateSession() ✅
**Backward compatible:** ✅

**Наступний крок:**
- PROMPT 7: Background Options
```
```

---

## 📋 PROMPT 7: Background Options

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 ПЕРЕД ПОЧАТКОМ: ПРОЧИТАЙ PROGRESS_LOG.md

Контекст: Solo Board, backend незмінний.

Завдання: Додати опції для background сторінок.

Background types:
1. White (default)
2. Grid (dots або lines)
3. Ruled (lined paper)
4. Graph (математична сітка)
5. Custom color

Імплементація:
1. Додати background field в PageState:
   ```typescript
   interface PageState {
     id: string
     name: string
     background?: {
       type: 'white' | 'grid' | 'dots' | 'ruled' | 'graph' | 'color'
       color?: string  // for 'color' type
       gridSize?: number  // for grid types
     }
     strokes: Stroke[]
     // ...
   }
   ```

2. Оновити `SoloCanvas.vue`:
   - Render background layer ПЕРЕД strokes
   - Використати Konva shapes для patterns
   - CSS background для simple colors

3. Додати Background picker в UI:
   - Button в toolbar або header
   - Dropdown з preview кожного background
   - Зберігається в state.pages[].background

4. Backward compatibility:
   - Якщо background відсутній → white (default)
   - Старі sessions працюють без змін

Вимоги:
- НЕ чіпати backend
- Зберігати через існуючий soloApi.updateSession()
- Grid має бути легким (не тормозити canvas)

Додатково:
- Export повинен включати background
- Thumbnail generation має показувати background

ОНОВІТЬ PROGRESS_LOG.md:
```markdown
### ✅ PROMPT 7 - ЗАВЕРШЕНО
**Що зроблено:**
- Background options (white, grid, dots, ruled, graph, color)
- Background picker в UI
- Render background layer в canvas

**Змінені файли:**
- solo_FE/types/solo.ts (додано background в PageState)
- solo_FE/components/canvas/SoloCanvas.vue
- [background picker component]

**Backward compatible:** ✅ (якщо background відсутній → white)
**API НЕ ЗМІНЕНО:** ✅

**Наступний крок:**
- PROMPT 8: PDF Import
```
```

---

## 📋 PROMPT 8: PDF Import (Frontend only)

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 ПЕРЕД ПОЧАТКОМ: ПРОЧИТАЙ PROGRESS_LOG.md

Контекст: Solo Board, backend має лише базовий file upload.

Завдання: Додати PDF import з конвертацією в зображення на FRONTEND.

Підхід:
1. Використати бібліотеку pdfjs-dist (Mozilla PDF.js)
2. Конвертувати PDF pages → PNG на клієнті
3. Завантажити PNG через існуючий asset upload endpoint
4. Додати як background або image layer

Імплементація:

Крок 1: Встановити залежність
```bash
npm install pdfjs-dist
```

Крок 2: Створити `solo_FE/composables/usePdfImport.ts`
```typescript
export function usePdfImport() {
  async function importPdf(file: File) {
    // 1. Load PDF with pdfjs
    // 2. Render each page to canvas
    // 3. Convert canvas → Blob (PNG)
    // 4. Upload через soloApi (існуючий endpoint)
    // 5. Додати в pages як background
  }
}
```

Крок 3: Додати PDF upload button
- File input accept=".pdf"
- Progress bar (processing X of Y pages)
- Створити нові pages або додати як assets

Вимоги:
- НЕ створювати нові backend endpoints
- Використовувати існуючий file upload API
- Показувати progress (PDF processing може бути довгим)
- Max file size check (10MB?)

Оптимізація:
- Render PDF pages в Web Worker (не блокувати UI)
- Compression PNG before upload
- Lazy loading для великих PDF

Покажи:
- Як використовуєш існуючий upload endpoint
- Proof що backend не змінено

ОНОВІТЬ PROGRESS_LOG.md:
```markdown
### ✅ PROMPT 8 - ЗАВЕРШЕНО
**Що зроблено:**
- PDF import з конвертацією на frontend (pdfjs-dist)
- Progress bar для PDF processing
- Створення нових pages з PDF

**Змінені файли:**
- solo_FE/composables/usePdfImport.ts (створено)
- [PDF upload button component]
- package.json (додано pdfjs-dist)

**Backend endpoints:** ІСНУЮЧІ використано ✅
**Нові endpoints створено:** ❌ (НІ)
**Web Worker:** ✅ (PDF processing не блокує UI)

**Наступний крок:**
- PROMPT 9: Performance Optimization
```
```

---

## 📋 PROMPT 9: Performance Optimization

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 ПЕРЕД ПОЧАТКОМ: ПРОЧИТАЙ PROGRESS_LOG.md

Контекст: Solo Board може мати багато strokes/shapes, треба оптимізувати.

Завдання: Покращити performance canvas rendering.

Оптимізації:

1. Lazy Rendering для Pages:
   - Render тільки visible pages (+ buffer 1 page above/below)
   - Unmount offscreen canvases
   - Файл: `solo_FE/components/pages/PageTabs.vue` або canvas wrapper

2. Stroke Optimization:
   - Group strokes by color/size (batch rendering)
   - Use Konva caching для складних shapes
   - Debounce autosave (save every 2-3 seconds, not on every stroke)

3. Better Autosave:
   ```typescript
   // Додати debounce в soloStore.ts
   const debouncedSave = useDebounceFn(
     (id, state) => soloApi.updateSession(id, { state }),
     2000  // 2 sec
   )
   ```

4. Undo/Redo Optimization:
   - Зберігати тільки останні 50 дій
   - Use structural sharing (не копіювати весь state)
   - localStorage для history (не backend)

5. Canvas Memory Management:
   - Clear unused canvas layers
   - Dispose Konva nodes коли unmount
   - Monitor memory usage в dev mode

Імплементація:
- Додати `solo_FE/composables/useCanvasOptimization.ts`
- Update SoloCanvas.vue з lazy rendering
- Add performance metrics (dev mode only)

Вимоги:
- НЕ змінювати API
- Зберігати UX (user не має відчувати затримки)
- Backward compatible

Metrics:
- Додай console.log в dev mode:
  - Render time per page
  - Number of active canvases
  - Memory usage (if available)

ОНОВІТЬ PROGRESS_LOG.md:
```markdown
### ✅ PROMPT 9 - ЗАВЕРШЕНО
**Що зроблено:**
- Lazy rendering для pages
- Stroke batching та Konva caching
- Debounced autosave (2 sec)
- Undo/redo optimization (last 50 actions)
- Canvas memory management

**Змінені файли:**
- solo_FE/composables/useCanvasOptimization.ts (створено)
- solo_FE/components/canvas/SoloCanvas.vue
- solo_FE/store/soloStore.ts (debounce)

**Performance metrics:** ✅ (dev mode)
**API НЕ ЗМІНЕНО:** ✅

**Наступний крок:**
- PROMPT 10: Testing + Documentation
```
```

---

## 📋 PROMPT 10: Testing + Documentation

```
🔴 РОБОЧА ДИРЕКТОРІЯ: D:\m4sh_v1\frontend\docs\SOLO_v2
🔴 НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!

📝 ПЕРЕД ПОЧАТКОМ: ПРОЧИТАЙ PROGRESS_LOG.md

Контекст: Solo Board покращений, треба додати тести та документацію.

Завдання 1: Unit Tests
Створити тести для нових features:

Файли для тестування:
- `solo_FE/composables/useKeyboardShortcuts.spec.ts`
- `solo_FE/components/toolbar/ColorPicker.spec.ts`
- `solo_FE/composables/usePdfImport.spec.ts`

Використай Vitest + Vue Test Utils.

Tests:
- Keyboard shortcuts працюють
- Color picker зберігає в localStorage
- Circle/Arrow tools рендеряться правильно
- Selection tool виділяє об'єкти
- Autosave debounce працює

Завдання 2: E2E Tests (Playwright)
```typescript
// solo_FE/tests/e2e/new-tools.spec.ts
test('Circle tool creates circle', async ({ page }) => {
  // 1. Open canvas
  // 2. Select circle tool
  // 3. Draw circle
  // 4. Verify circle in canvas
  // 5. Save session
  // 6. Reload
  // 7. Verify circle persisted
})
```

Завдання 3: Оновити документацію
Створити/оновити:
- `solo_FE/README.md` - Features list
- `KEYBOARD_SHORTCUTS.md` - Всі shortcuts
- `API_CONTRACTS_LOCK.md` - Підтвердити що не змінено
- `CHANGELOG.md` - Що додано в цьому update

Завдання 4: Migration Guide
Створити `MIGRATION.md`:
- Як оновити з old version
- Які features додано
- Breaking changes (якщо є)
- Backward compatibility notes

Вимоги:
- Tests мають проходити
- Coverage > 70% для нових файлів
- Documentation в Markdown

ОНОВІТЬ PROGRESS_LOG.md:
```markdown
### ✅ PROMPT 10 - ЗАВЕРШЕНО
**Що зроблено:**
- Unit tests для composables
- E2E tests для нових tools (Playwright)
- Оновлено README.md
- Створено MIGRATION.md
- Оновлено CHANGELOG.md

**Створені файли:**
- solo_FE/composables/*.spec.ts
- solo_FE/tests/e2e/new-tools.spec.ts
- README.md (оновлено)
- MIGRATION.md (створено)
- CHANGELOG.md (оновлено)

**Test coverage:** >70% ✅
**All tests passing:** ✅

## 🎉 ВСІ ПРОМПТИ ЗАВЕРШЕНО!

**Підсумок:**
- API контракти НЕ ЗМІНЕНО ✅
- Backend НЕ ЧІПНУТО ✅
- Всі features backward compatible ✅
- Тести проходять ✅
- Документація актуальна ✅
```
```

---

## 🎯 BONUS PROMPT: Все разом (Якщо хочеш все одним промптом)

```
🔴🔴🔴 КРИТИЧНО ВАЖЛИВО - РОБОЧА ДИРЕКТОРІЯ 🔴🔴🔴

ПРАЦЮЙ ТІЛЬКИ ТУТ: D:\m4sh_v1\frontend\docs\SOLO_v2
НЕ ЧІПАЙ НІЧОГО ЗА МЕЖАМИ ЦІЄЇ ПАПКИ!
НЕ ЗАХОДЬ В D:\m4sh_v1\frontend\ (батьківська папка)!

📝📝📝 СИСТЕМА CHECKPOINT 📝📝📝

ДУЖЕ ВАЖЛИВО:
1. ПЕРЕД ПОЧАТКОМ: Перевір чи є PROGRESS_LOG.md
2. Якщо є → ПРОЧИТАЙ і продовжуй з того місця
3. ПІСЛЯ КОЖНОГО КРОКУ: Оновлюй PROGRESS_LOG.md
4. Якщо токени закінчаться → наступного разу читай лог і продовжуй

Формат PROGRESS_LOG.md:
```markdown
# Solo Board Progress Log
## Останнє оновлення: [DATE TIME]
### Поточний стан: [на якому етапі]
### ✅ Завершено: [список]
### 🔄 В процесі: [що роблю зараз]
### ⏭️ Наступне: [що далі]
### 📁 Змінені файли: [повні шляхи]
```

ДОЗВОЛЕНІ ПАПКИ:
✅ D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\     (працюй тут)
❌ D:\m4sh_v1\frontend\docs\SOLO_v2\solo_BE\     (НЕ ЧІПАТИ)
❌ D:\m4sh_v1\frontend\                          (НЕ ЧІПАТИ)
❌ Будь-що за межами SOLO_v2\                    (НЕ ЧІПАТИ)

Я працюю з Solo Board - whiteboard додаток (Vue 3 + Django backend).

КРИТИЧНО ВАЖЛИВО:
- Backend (`solo_BE/`) - НЕЗМІННИЙ
- API контракти - СВЯТЕ (не чіпати endpoints, request/response)
- Працюю ТІЛЬКИ з frontend (`solo_FE/`)

Завдання: Покращити frontend з новими features, зберігаючи backward compatibility.

ЩО ТРЕБА ЗРОБИТИ:

1. АУДИТ (10 хв):
   - Задокументувати API контракти → API_CONTRACTS_LOCK.md
   - Перевірити існуючі types та structure

2. НОВІ ІНСТРУМЕНТИ (30 хв):
   - Circle tool (draw circles)
   - Arrow tool (з різними головками)
   - Selection tool (lasso + move/resize)
   - Background options (grid, dots, ruled)

3. UI/UX (20 хв):
   - Покращений toolbar з іконками
   - Color picker з палітрами + recent colors
   - Size picker з preview
   - Keyboard shortcuts (Ctrl+Z, P для pen, C для circle, тощо)

4. FEATURES (30 хв):
   - PDF import (frontend only, pdfjs-dist)
   - Better autosave (debounce 2 sec)
   - Performance optimization (lazy rendering)

5. ТЕСТИ + DOCS (20 хв):
   - Unit tests для нових composables
   - E2E test для нових tools
   - README.md оновлення
   - KEYBOARD_SHORTCUTS.md

ПРАВИЛА:
- Використовувати тільки існуючі API endpoints
- State backward compatible (опціональні поля)
- Зберігати через soloApi.updateSession()
- Не створювати нові backend routes

DELIVERABLES:
1. API_CONTRACTS_LOCK.md - proof що контракти незмінні
2. Всі нові features працюють
3. Tests проходять
4. Documentation оновлена
5. Git commits з чіткими messages
6. **PROGRESS_LOG.md - ПОСТІЙНО ОНОВЛЮЄТЬСЯ** (після кожного кроку!)

РОБОЧИЙ ПРОЦЕС:
1. Прочитай PROGRESS_LOG.md (якщо є)
2. Почни з етапу де зупинився (або з початку)
3. Після КОЖНОГО виконаного кроку → оновлюй PROGRESS_LOG.md
4. Зазначай: що зроблено, які файли, що далі
5. Якщо токени закінчаться → наступна сесія продовжить з логу

Почни з аудиту та створення API_CONTRACTS_LOCK.md + PROGRESS_LOG.md, потім покажи plan як будеш робити решту.
```

---

## 📝 Як використовувати ці промпти:

### 📌 ВАЖЛИВО: Система PROGRESS_LOG.md

Після кожного промпта Claude Code створить/оновить файл `PROGRESS_LOG.md`.

**Навіщо це потрібно:**
- Якщо токени закінчаться в середині роботи
- Claude Code зможе продовжити з того місця
- Не буде переробляти те що вже зроблено
- Збереже контекст між сесіями

**Як це працює:**
```
Сесія 1: PROMPT 1 → створює PROGRESS_LOG.md
Сесія 2: PROMPT 2 → читає лог → продовжує → оновлює лог
Сесія 3: Токени закінчились на середині PROMPT 3
Сесія 4: Читає лог → бачить що PROMPT 3 не завершено → продовжує
```

### Варіант 1: По одному (рекомендовано)
```bash
# У терміналі з Claude Code:
claude-code

# Потім копіюєш PROMPT 1, дивишся результат
# Потім PROMPT 2, тощо
```

### Варіант 2: Все разом
```bash
claude-code

# Копіюєш BONUS PROMPT
# Claude Code зробить все за 1-2 години
```

### Варіант 3: Вибірково
```bash
# Хочеш тільки Circle + Arrow?
# Використай PROMPT 2 + PROMPT 3

# Хочеш тільки UI?
# Використай PROMPT 4 + PROMPT 5
```

---

## ✅ Checklist після кожного промпта:

- [ ] ⚠️ **ПЕРЕВІРИТИ PROGRESS_LOG.md** - чи оновлено після завершення промпта
- [ ] ⚠️ **ПЕРЕВІРИТИ РОБОЧУ ДИРЕКТОРІЮ** - чи всі зміни в `D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\`
- [ ] ⚠️ **ПЕРЕВІРИТИ ЩО НЕ ЧІПНУВ** батьківські папки (`D:\m4sh_v1\frontend\`)
- [ ] Перевірити що backend файли не змінені (`solo_BE/`)
- [ ] Перевірити що API calls використовують soloApi.ts
- [ ] Протестувати в браузері
- [ ] Перевірити що старі sessions відкриваються
- [ ] Git commit з описом змін
- [ ] Прочитати PROGRESS_LOG.md - чи там все правильно описано

---

## 🔥 Pro Tips:

1. **🔴 НАЙГОЛОВНІШЕ:** Переконайся що Claude Code працює в `D:\m4sh_v1\frontend\docs\SOLO_v2\`
2. **📝 ЗАВЖДИ ПЕРЕВІРЯЙ PROGRESS_LOG.md** перед наступним промптом
3. **Завжди починай з PROMPT 1** (аудит + контракти) якщо починаєш з нуля
4. **Після кожного промпта** тестуй в браузері
5. **Якщо токени закінчились** - не переживай, наступного разу Claude Code прочитає лог і продовжить
6. **Якщо щось пішло не так** - скажи Claude Code відкотити зміни
7. **Зберігай API_CONTRACTS_LOCK.md** - це твоя страховка
8. **Роби git commits** після кожного успішного промпта
9. **Перевіряй git diff** - чи немає змін за межами solo_FE/
10. **Читай PROGRESS_LOG.md** щоб розуміти що вже зроблено

---

Ці промпти готові до використання! Просто копіюй в Claude Code і він зробить всю роботу! 🚀

---

## 📋 ДОДАТОК: Приклад PROGRESS_LOG.md

Так виглядає файл PROGRESS_LOG.md після кількох промптів:

```markdown
# Solo Board Progress Log

## Останнє оновлення: 2026-02-02 14:30:00

### 📊 Загальний статус
- Робоча директорія: D:\m4sh_v1\frontend\docs\SOLO_v2
- Поточний етап: PROMPT 3 (Arrow Tool) - В ПРОЦЕСІ
- Завершено промптів: 2 з 10
- API контракти: НЕЗМІННІ ✅
- Backend: НЕ ЧІПНУТО ✅

---

### ✅ PROMPT 1 - ЗАВЕРШЕНО
**Дата:** 2026-02-02 12:00
**Що зроблено:**
- Створено API_CONTRACTS_LOCK.md
- Задокументовано всі endpoints
- Задокументовано структуру state

**Змінені файли:**
- D:\m4sh_v1\frontend\docs\SOLO_v2\API_CONTRACTS_LOCK.md (створено)
- D:\m4sh_v1\frontend\docs\SOLO_v2\PROGRESS_LOG.md (створено)

**Перевірено:**
- API endpoints: 7 endpoints задокументовано ✅
- State structure: PageState, Stroke, Shape, TextElement ✅

---

### ✅ PROMPT 2 - ЗАВЕРШЕНО
**Дата:** 2026-02-02 13:15
**Що зроблено:**
- Додано Circle tool
- Оновлено типи (додано 'circle' в Tool)
- Розширено Shape interface (x, y, radius)
- Додано v-circle в canvas rendering
- Додано кнопку Circle в toolbar

**Змінені файли:**
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\types\solo.ts
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\components\canvas\SoloCanvas.vue
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\components\toolbar\SoloToolbar.vue

**Приклад JSON:**
```json
{
  "id": "circle_123",
  "type": "circle",
  "color": "#FF0000",
  "size": 2,
  "x": 100,
  "y": 150,
  "radius": 50
}
```

**Перевірено:**
- API контракти НЕ ЗМІНЕНО ✅
- Backend НЕ ЧІПНУТО ✅
- Backward compatibility ✅
- soloApi.updateSession() використано ✅

---

### 🔄 PROMPT 3 - В ПРОЦЕСІ
**Дата початку:** 2026-02-02 14:20
**Що робиться зараз:**
- Додавання Arrow tool
- Розширення line tool з полями arrowStart, arrowEnd, arrowSize

**Що вже зроблено:**
- Оновлено Shape interface в types/solo.ts
- Почато роботу над SoloCanvas.vue

**Що залишилось:**
- Завершити rendering arrows в canvas
- Додати dropdown в toolbar
- Протестувати backward compatibility
- Оновити цей лог після завершення

**Важливі нотатки:**
- Використовую опціональні поля (arrowStart?, arrowEnd?)
- Старі line без цих полів = звичайні лінії
- Backend не парсить ці поля - просто JSON

---

### ⏭️ НАСТУПНІ КРОКИ

**PROMPT 4:** Toolbar + Color Picker (очікується після PROMPT 3)
**PROMPT 5:** Keyboard Shortcuts
**PROMPT 6:** Selection Tool
**PROMPT 7:** Background Options
**PROMPT 8:** PDF Import
**PROMPT 9:** Performance Optimization
**PROMPT 10:** Testing + Documentation

---

### 📁 Всі змінені файли (накопичувально)

**Створено:**
- D:\m4sh_v1\frontend\docs\SOLO_v2\API_CONTRACTS_LOCK.md
- D:\m4sh_v1\frontend\docs\SOLO_v2\PROGRESS_LOG.md

**Змінено:**
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\types\solo.ts
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\components\canvas\SoloCanvas.vue
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_FE\components\toolbar\SoloToolbar.vue

**НЕ ЧІПНУТО (важливо!):**
- D:\m4sh_v1\frontend\docs\SOLO_v2\solo_BE\ (вся папка) ✅
- D:\m4sh_v1\frontend\ (батьківська папка) ✅

---

### 🛡️ Гарантії збережено

- ✅ API контракти НЕ ЗМІНЕНО
- ✅ Backend код НЕ ЧІПНУТО
- ✅ Робоча директорія НЕ ПОРУШЕНА
- ✅ Backward compatibility ЗБЕРЕЖЕНО
- ✅ Існуючі sessions ПРАЦЮЮТЬ

---

### 💡 Нотатки для продовження

1. Якщо токени закінчаться - почни з читання цього файлу
2. Дивись розділ "В ПРОЦЕСІ" - там поточна задача
3. Перевір що всі файли в правильній директорії
4. Після завершення промпта - оновлюй цей файл
5. Git commit після кожного завершеного промпта

---

**Останній git commit:**
```
feat: Add Circle tool with canvas rendering
- Updated types with circle shape
- Added v-circle to SoloCanvas
- Added Circle button to toolbar
```

---

**Наступний раз:**
Продовжити з PROMPT 3 (Arrow Tool) - завершити rendering та toolbar
```

Цей приклад показує як Claude Code буде вести документацію! 📝