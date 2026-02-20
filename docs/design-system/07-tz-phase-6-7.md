# ТЗ — Фаза 6: Очищення + Фаза 7: Тестування

> Тривалість: 2-4 дні (обидві фази)
> Залежності: Фази 1-5 (всі модулі мігровані)
> Ризик зламу: середній (видаляємо старе)

---

## ФАЗА 6 — Очищення CSS і теми (1-2 дні)

### 6.1. Консолідація тем-систем

**Проблема:** Є 2 store для теми:
- `themeStore.js` (legacy) — працює на проді, light/dark/classic
- `themeStore.ts` (modern) — не використовується або конфліктує

**Рішення:**
- [ ] Залишити `themeStore.js` як основний
- [ ] `themeStore.ts` — видалити або позначити `@deprecated`
- [ ] Перевірити що Winterboard не залежить від modern store

---

### 6.2. Видалення deprecated файлів

**Тільки після того як всі модулі мігровані:**

- [ ] `src/ui/tokens.css` → видалити (замінений на `src/styles/tokens.css`)
  - Перед видаленням: `grep -r "ui/tokens" src/` — переконатись що ніхто не імпортує
- [ ] `src/assets2/ui-contract/tokens/tokens.css` → видалити
  - Перед видаленням: `grep -r "ui-contract/tokens" src/`
- [ ] `src/components/ui/Modal.vue` → видалити (замінений на `src/ui/Modal.vue`)
  - Перед видаленням: `grep -r "components/ui/Modal" src/`
- [ ] `src/components/ui/ConfirmDialog.vue` → видалити (замінений на `src/ui/ConfirmModal.vue`)
  - Перед видаленням: `grep -r "ConfirmDialog" src/`

**Правило:** Перед видаленням КОЖНОГО файлу — grep щоб ніхто не імпортує.

---

### 6.3. Очищення `main.css`

- [ ] Видалити старі `.btn` класи якщо всі `<button class="btn">` замінені на `<Button>`
- [ ] Видалити дублюючі `.form-group` стилі з scoped CSS в модулях
- [ ] Перенести потрібне з `m4sh.css` в `main.css` або `tokens.css`
- [ ] Видалити `m4sh.css` якщо все перенесено

---

### 6.4. Аудит хардкоджених кольорів

**Перевірити що всі замінені:**
```bash
# Знайти залишки хардкоду (крім бренд-кольорів)
grep -rn "#[0-9a-fA-F]\{6\}" src/modules/ --include="*.vue" | grep -v "229ED9\|telegram\|brand"
```

**Допустимі хардкоди (бренд-кольори):**
- `#229ED9` — Telegram brand blue
- `#24292e` — GitHub brand
- `#1DA1F2` — Twitter brand (якщо є)

**Всі інші** → замінити на CSS-змінні.

---

## ФАЗА 7 — Тестування і QA (1-2 дні)

### 7.1. Чеклист по темах

Для **кожної** з 3 тем (Light, Dark, Classic) перевірити **кожну** сторінку:

#### Кнопки
- [ ] Primary — контрастний, читабельний текст
- [ ] Secondary — видима межа
- [ ] Outline — видима межа, прозорий фон
- [ ] Danger — червоний, контрастний
- [ ] Ghost — текст видимий, hover помітний
- [ ] Disabled — напівпрозорий, cursor: not-allowed

#### Модалки
- [ ] Backdrop — затемнений, blur
- [ ] Контент — читабельний на фоні
- [ ] Header — видимий border-bottom
- [ ] Footer — видимий border-top
- [ ] Close button — видимий, hover працює
- [ ] Анімація — плавне відкриття/закриття

#### Форми
- [ ] Input border — видимий
- [ ] Input focus — accent ring
- [ ] Input error — red ring
- [ ] Input disabled — напівпрозорий
- [ ] Select — стрілка видима, dropdown працює
- [ ] Textarea — resize працює
- [ ] Label — читабельний
- [ ] Error text — червоний
- [ ] Hint text — сірий

#### Картки
- [ ] Border — видимий
- [ ] Shadow — помірна
- [ ] Background — відрізняється від page bg

### 7.2. Responsive чеклист

#### Mobile (375px)
- [ ] Модалки — full-width
- [ ] `.form-row` — 1 колонка
- [ ] Кнопки — не обрізаються
- [ ] Sidebar — прихований
- [ ] TopNav — адаптивний

#### Tablet (768px)
- [ ] `.form-row` — 2 колонки
- [ ] Модалки — стандартний розмір
- [ ] Sidebar — hover/toggle

#### Desktop (1280px)
- [ ] Повний layout
- [ ] Sidebar — видимий
- [ ] Модалки — центровані

### 7.3. Accessibility чеклист

- [ ] Tab навігація — послідовна, видимий focus ring
- [ ] Модалка — focus trap (Tab не виходить)
- [ ] Модалка — Escape закриває
- [ ] Модалка — фокус повертається після закриття
- [ ] Button — `role="button"` або `<button>` tag
- [ ] Form fields — `<label for="...">` або `aria-label`
- [ ] Color contrast — >= 4.5:1 для тексту
- [ ] Error messages — `aria-live="polite"` або `role="alert"`

### 7.4. Фінальний аудит

```bash
# Перевірити що сирих кнопок мінімум
grep -rn '<button ' src/modules/ --include="*.vue" | wc -l
# Ціль: < 50 (тільки winterboard canvas)

# Перевірити що сирих textarea немає
grep -rn '<textarea ' src/modules/ --include="*.vue" | grep -v 'Textarea' | wc -l
# Ціль: 0

# Перевірити що хардкоджених кольорів немає
grep -rn '#[0-9a-fA-F]\{6\}' src/modules/ --include="*.vue" | grep -v 'brand\|229ED9' | wc -l
# Ціль: 0

# Перевірити білд
npm run build
# Ціль: 0 errors, 0 warnings
```

---

## Метрики успіху (фінальні)

| Метрика | До | Після | Перевірка |
|---------|-----|-------|-----------|
| Сирих `<button>` в модулях | 856 | < 50 | `grep -c '<button ' modules/` |
| Сирих `<textarea>` | 20+ | 0 | `grep -c '<textarea ' modules/` |
| Кастомних overlay-модалок | 63 | 0 | `grep -c 'fixed inset-0' modules/` |
| Файлів токенів | 5 | 1 | `ls styles/tokens.css` |
| Хардкоджених кольорів | ~30 | 0 (крім brand) | grep hex codes |
| Z-index конфліктів | 4+ різних | 1 шкала | `grep -c 'z-\[' modules/` |
| Теми що працюють | 3 (з багами) | 3 (без багів) | Ручна перевірка |
