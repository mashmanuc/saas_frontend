# Design System — Промти День 1

---

## 🅰️ Агент A — День 1: MF0 Фундамент (токени + tailwind)

> Копіювати цілком в чат агенту

---

```
Ти — Агент A (Tokens & CSS) в проєкті M4SH Design System.

Прочитай документацію:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md — загальний план
- D:\m4sh_v1\frontend\docs\design-system\02-tz-phase-1.md — детальне ТЗ Фази 1

Твоя зона файлів: src/styles/, src/assets/main.css, tailwind.config.js
НЕ ЧІПАЙ: src/ui/, src/modules/

---

ЗАДАЧА: Виконай MF0 — Фундамент (4 задачі). Це блокер для всіх інших агентів.

### 0.1. Створити src/styles/tokens.css

Створи НОВИЙ файл src/styles/tokens.css з єдиними design-токенами.
Зараз токени розкидані по 5 файлах з конфліктами:
- src/ui/tokens.css (--radius-md: 12px, --space-xs: 0.35rem)
- src/assets2/ui-contract/tokens/tokens.css (--ui-radius-md: 0.5rem, --ui-space-xs: 0.25rem)
- src/styles/m4sh.css
- src/styles/calendar-tokens.css
- src/assets/main.css

Новий tokens.css повинен містити ЄДИНІ значення:

:root {
  /* Radius */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Spacing */
  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;

  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 25px var(--shadow);
  --shadow-xl: 0 12px 35px var(--shadow-strong);

  /* Z-index */
  --z-dropdown: 100;
  --z-sticky: 150;
  --z-overlay: 200;
  --z-modal: 210;
  --z-toast: 300;
  --z-tooltip: 400;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Overlay */
  --color-overlay: rgba(0, 0, 0, 0.5);
}

### 0.2. Підключити в main.js

У файлі src/main.js додай імпорт ПЕРШИМ рядком серед CSS-імпортів (перед import './assets/main.css'):

import './styles/tokens.css'

Поточний порядок імпортів:
import './assets/main.css'
import './assets/fullcalendar.css'
import './styles/m4sh.css'
import './assets2/ui-contract/tokens/tokens.css'

Має стати:
import './styles/tokens.css'          // ← НОВИЙ, першим
import './assets/main.css'
import './assets/fullcalendar.css'
import './styles/m4sh.css'
import './assets2/ui-contract/tokens/tokens.css'

### 0.3. Позначити старі файли @deprecated

Додай коментар на ПЕРШОМУ рядку кожного файлу:

1. src/ui/tokens.css — додати зверху:
/* @deprecated — використовуйте src/styles/tokens.css */

2. src/assets2/ui-contract/tokens/tokens.css — додати зверху:
/* @deprecated — використовуйте src/styles/tokens.css */

НЕ ВИДАЛЯЙ ці файли — вони ще використовуються.

### 0.4. Синхронізувати tailwind.config.js

У файлі tailwind.config.js додай в theme.extend:

borderRadius: {
  xs: 'var(--radius-xs)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  full: 'var(--radius-full)',
},
zIndex: {
  dropdown: 'var(--z-dropdown)',
  sticky: 'var(--z-sticky)',
  overlay: 'var(--z-overlay)',
  modal: 'var(--z-modal)',
  toast: 'var(--z-toast)',
  tooltip: 'var(--z-tooltip)',
},

Поточний tailwind.config.js вже має colors і boxShadow в extend — додай borderRadius і zIndex поруч.

### ПЕРЕВІРКА

Після всіх змін:
1. npm run build — має пройти без помилок
2. npm run dev — сторінка виглядає як раніше (нічого не зламано)
3. DevTools → Computed Styles: --radius-md = 8px на :root
4. Light / Dark / Classic теми не зламані

### КОМІТ

git add -A
git commit -m "design(A-0): create unified tokens.css, sync tailwind, deprecate old token files"
git push

Після завершення оновити progress.md — задачі 0.1-0.4 позначити ✅.
```
