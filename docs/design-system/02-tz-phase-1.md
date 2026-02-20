# ТЗ — Фаза 1: Токени та фундамент

> Тривалість: 1-2 дні
> Залежності: немає
> Ризик зламу: мінімальний (додаємо нове, не змінюємо існуюче)

---

## Мета

Створити єдине джерело design-токенів для всього проекту. Зараз значення розкидані по 5 файлах з конфліктами — після фази 1 буде один `tokens.css`.

---

## Задачі

### 1.1. Створити `src/styles/tokens.css`

**Файл:** `src/styles/tokens.css` (новий)

**Вміст:**
```css
:root {
  /* ─── Radius ─── */
  --radius-xs:   4px;
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;

  /* ─── Spacing ─── */
  --space-2xs: 0.25rem;
  --space-xs:  0.5rem;
  --space-sm:  0.75rem;
  --space-md:  1rem;
  --space-lg:  1.5rem;
  --space-xl:  2rem;
  --space-2xl: 3rem;

  /* ─── Typography ─── */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;

  /* ─── Shadows ─── */
  --shadow-xs:  0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm:  0 2px 4px rgba(0,0,0,0.06);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg:  0 8px 25px var(--shadow);
  --shadow-xl:  0 12px 35px var(--shadow-strong);

  /* ─── Z-index scale ─── */
  --z-dropdown:  100;
  --z-sticky:    150;
  --z-overlay:   200;
  --z-modal:     210;
  --z-toast:     300;
  --z-tooltip:   400;

  /* ─── Transitions ─── */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);

  /* ─── Overlay ─── */
  --color-overlay: rgba(0, 0, 0, 0.5);
}
```

**Критерій готовності:** Файл створений, імпортується першим в `main.js`.

---

### 1.2. Підключити в `main.js`

**Файл:** `src/main.js`

**Зміна:** Додати **перед** існуючими імпортами CSS:
```js
import './styles/tokens.css'  // Design tokens — єдине джерело
```

**Критерій готовності:** Після `npm run dev` токени доступні глобально, існуючі стилі не зламані.

---

### 1.3. Позначити старі файли як `@deprecated`

**Файли:**
- `src/ui/tokens.css` — додати коментар на початок:
  ```css
  /* @deprecated — використовуйте src/styles/tokens.css */
  ```
- `src/assets2/ui-contract/tokens/tokens.css` — додати коментар:
  ```css
  /* @deprecated — використовуйте src/styles/tokens.css */
  ```

**НЕ ВИДАЛЯТИ** ці файли — вони ще використовуються. Тільки позначити.

**Критерій готовності:** Кожен старий файл має коментар `@deprecated` зверху.

---

### 1.4. Синхронізувати `tailwind.config.js`

**Файл:** `tailwind.config.js`

**Зміна:** Додати в `theme.extend`:
```js
borderRadius: {
  xs:   'var(--radius-xs)',
  sm:   'var(--radius-sm)',
  md:   'var(--radius-md)',
  lg:   'var(--radius-lg)',
  xl:   'var(--radius-xl)',
  full: 'var(--radius-full)',
},
zIndex: {
  dropdown: 'var(--z-dropdown)',
  sticky:   'var(--z-sticky)',
  overlay:  'var(--z-overlay)',
  modal:    'var(--z-modal)',
  toast:    'var(--z-toast)',
  tooltip:  'var(--z-tooltip)',
},
```

**Критерій готовності:** `npm run build` проходить без помилок, `rounded-lg` використовує `var(--radius-lg)`.

---

## Перевірка

- [ ] `npm run build` — OK
- [ ] `npm run dev` — сторінка виглядає як раніше
- [ ] DevTools → Computed Styles: `--radius-md` = 8px на `:root`
- [ ] Light / Dark / Classic теми не зламані
- [ ] Старі файли позначені `@deprecated`

---

## Що НЕ робимо в цій фазі

- Не змінюємо існуючі компоненти
- Не видаляємо старі файли токенів
- Не рефакторимо CSS-класи
- Не чіпаємо модулі
