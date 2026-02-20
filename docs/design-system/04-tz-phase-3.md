# ТЗ — Фаза 3: Глобальна модалка

> Тривалість: 2-3 дні
> Залежності: Фаза 1 (токени), Фаза 2 (Button)
> Ризик зламу: мінімальний (новий компонент, нічого не видаляємо)

---

## Мета

Створити єдиний `Modal.vue` і `ConfirmModal.vue` які замінять 63 кастомних overlay-модалки. Модалка повинна: правильно блокувати фон, ловити фокус, закриватись по Escape, працювати у всіх темах, бути accessible.

---

## Задачі

### 3.1. Створити `Modal.vue`

**Файл:** `src/ui/Modal.vue` (новий)

**Пропси:**
| Проп | Тип | Default | Опис |
|------|-----|---------|------|
| `open` | `boolean` | `false` | Видимість модалки |
| `title` | `string` | — | Заголовок (або через `#header` slot) |
| `size` | `'sm' \| 'md' \| 'lg' \| 'full'` | `'md'` | Ширина |
| `closeOnOverlay` | `boolean` | `true` | Закривати при кліку на backdrop |
| `closeOnEsc` | `boolean` | `true` | Закривати по Escape |
| `persistent` | `boolean` | `false` | Ігнорувати overlay/esc (для важливих форм) |

**Події:** `@close`

**Слоти:**
- `default` — тіло модалки
- `#header` — кастомний заголовок (замість `title`)
- `#footer` — кнопки внизу

**Розміри:**
| Size | Max-width | Призначення |
|------|-----------|-------------|
| `sm` | 24rem (384px) | Підтвердження, прості діалоги |
| `md` | 32rem (512px) | Форми (default) |
| `lg` | 48rem (768px) | Складні форми, таблиці |
| `full` | calc(100vw - 2rem) | Повноекранний контент |

**Обов'язкові фічі:**

1. **Teleport:** `<Teleport to="body">` — модалка завжди рендериться в body
2. **Backdrop:** `background: var(--color-overlay)`, `backdrop-filter: blur(4px)`
3. **Z-index:** overlay = `var(--z-overlay)` (200), content = `var(--z-modal)` (210)
4. **Focus trap:** Tab/Shift+Tab циклічно всередині модалки
5. **Focus restore:** При закритті фокус повертається на елемент який відкрив
6. **Escape:** Закриває модалку (якщо `closeOnEsc=true` і `persistent=false`)
7. **Body scroll lock:** `document.body.style.overflow = 'hidden'` при open
8. **Анімація:**
   - Overlay: fadeIn (opacity 0→1, 200ms)
   - Content: slideUp (translateY(16px)→0 + opacity 0→1, 200ms)
9. **Accessibility:**
   - `role="dialog"`
   - `aria-modal="true"`
   - `aria-labelledby` (якщо є title)
10. **Кнопка закриття:** Хрестик у правому верхньому куті header

**Структура HTML:**
```html
<Teleport to="body">
  <Transition name="modal">
    <div v-if="open" class="modal-overlay" @click.self="handleOverlayClick">
      <div class="modal-content modal-content--{size}" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="modal-header">
          <slot name="header">
            <h3 class="modal-title">{{ title }}</h3>
          </slot>
          <button class="modal-close" @click="$emit('close')" aria-label="Закрити">✕</button>
        </div>
        <!-- Body -->
        <div class="modal-body">
          <slot />
        </div>
        <!-- Footer -->
        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Transition>
</Teleport>
```

**CSS:**
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-md);
}
.modal-content {
  position: relative;
  z-index: var(--z-modal);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  width: 100%;
}
.modal-content--sm  { max-width: 24rem; }
.modal-content--md  { max-width: 32rem; }
.modal-content--lg  { max-width: 48rem; }
.modal-content--full { max-width: calc(100vw - 2rem); }

.modal-header {
  padding: var(--space-lg) var(--space-lg) var(--space-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
}
.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}
.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: var(--transition-fast);
}
.modal-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.modal-body {
  padding: var(--space-md) var(--space-lg);
}
.modal-footer {
  padding: var(--space-sm) var(--space-lg) var(--space-lg);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  border-top: 1px solid var(--border-color);
}

/* Animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-base);
}
.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform var(--transition-base), opacity var(--transition-base);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-content {
  transform: translateY(16px);
  opacity: 0;
}
.modal-leave-to .modal-content {
  transform: translateY(8px);
  opacity: 0;
}

/* Mobile */
@media (max-width: 640px) {
  .modal-content {
    max-width: 100% !important;
    max-height: calc(100vh - 1rem);
    margin: 0.5rem;
  }
}
```

**Критерій готовності:**
- Компонент створений і працює
- Фокус ловиться всередині
- Escape закриває
- Backdrop blur
- Анімація плавна
- 3 теми — OK
- Mobile — full-width

---

### 3.2. Створити `ConfirmModal.vue`

**Файл:** `src/ui/ConfirmModal.vue` (новий)

**Призначення:** Простий діалог підтвердження на базі `Modal.vue`. Замінює `ConfirmDialog.vue`.

**Пропси:**
| Проп | Тип | Default | Опис |
|------|-----|---------|------|
| `open` | `boolean` | `false` | Видимість |
| `title` | `string` | `'Підтвердження'` | Заголовок |
| `message` | `string` | — | Текст питання |
| `confirmText` | `string` | `'Підтвердити'` | Текст кнопки підтвердження |
| `cancelText` | `string` | `'Скасувати'` | Текст кнопки скасування |
| `variant` | `'primary' \| 'danger'` | `'primary'` | Колір кнопки підтвердження |
| `loading` | `boolean` | `false` | Стан завантаження |

**Події:** `@confirm`, `@cancel`

**Реалізація:**
```vue
<Modal :open="open" :title="title" size="sm" @close="$emit('cancel')">
  <p class="text-sm text-muted">{{ message }}</p>
  <slot />
  <template #footer>
    <Button variant="outline" @click="$emit('cancel')">{{ cancelText }}</Button>
    <Button :variant="variant" :loading="loading" @click="$emit('confirm')">
      {{ confirmText }}
    </Button>
  </template>
</Modal>
```

**Приклад використання:**
```vue
<ConfirmModal
  :open="showDelete"
  title="Видалення"
  message="Ви впевнені? Цю дію не можна скасувати."
  confirm-text="Видалити"
  variant="danger"
  :loading="deleting"
  @confirm="handleDelete"
  @cancel="showDelete = false"
/>
```

**Критерій готовності:**
- Працює як обгортка Modal
- Danger/primary варіанти
- Loading стан на кнопці підтвердження

---

## Перевірка

- [ ] `npm run build` — OK
- [ ] `Modal.vue` — відкривається, закривається, анімація
- [ ] Focus trap — Tab не виходить за межі модалки
- [ ] Escape — закриває
- [ ] Overlay click — закриває
- [ ] `persistent` — не закривається по overlay/esc
- [ ] `ConfirmModal.vue` — danger/primary
- [ ] Mobile (375px) — full-width
- [ ] 3 теми — коректний вигляд

---

## Що НЕ робимо в цій фазі

- Не замінюємо існуючі модалки на нову (це Фаза 5)
- Не видаляємо `ConfirmDialog.vue`
- Не видаляємо `components/ui/Modal.vue`
