# UI/UX Hardening Report — v0.12.0

## Огляд
Аудит ключових UI компонентів у 3 темах: light, dark, high-contrast.
Перевірка контрасту, hover/focus/disabled станів.

---

## 1. Button

### Перевірені варіанти
- Primary, Secondary, Danger, Ghost, Link

### Знайдені проблеми
| Проблема | Тема | Статус |
|----------|------|--------|
| Disabled opacity занадто низька (0.3) | Dark | ✅ Виправлено → 0.5 |
| Focus ring не видно на dark bg | Dark | ✅ Додано ring-offset |
| Hover contrast недостатній | Light | ✅ Збільшено насиченість |

### CSS змінні
```css
:root {
  --btn-disabled-opacity: 0.5;
  --btn-focus-ring-offset: 2px;
  --btn-hover-brightness: 0.95;
}

[data-theme="dark"] {
  --btn-hover-brightness: 1.1;
}
```

---

## 2. Modal

### Перевірені аспекти
- Backdrop opacity
- Close button visibility
- Focus trap

### Знайдені проблеми
| Проблема | Тема | Статус |
|----------|------|--------|
| Backdrop занадто прозорий | Light | ✅ 0.3 → 0.5 |
| Close (X) зливається з header | Dark | ✅ Додано border |
| Немає focus trap | All | ✅ Додано @vueuse/integrations |

---

## 3. Card

### Перевірені аспекти
- Border visibility
- Shadow depth
- Hover state

### Знайдені проблеми
| Проблема | Тема | Статус |
|----------|------|--------|
| Border не видно | Dark | ✅ Додано subtle border |
| Shadow занадто агресивний | Light | ✅ Зменшено blur |

---

## 4. Input

### Перевірені аспекти
- Placeholder contrast
- Error state visibility
- Disabled state

### Знайдені проблеми
| Проблема | Тема | Статус |
|----------|------|--------|
| Placeholder занадто світлий | Light | ✅ Збільшено opacity |
| Error border не помітний | Dark | ✅ Яскравіший red |
| Disabled bg зливається | Dark | ✅ Окремий колір |

### CSS змінні
```css
:root {
  --input-placeholder-opacity: 0.6;
  --input-error-border: #dc2626;
  --input-disabled-bg: #f3f4f6;
}

[data-theme="dark"] {
  --input-placeholder-opacity: 0.5;
  --input-error-border: #f87171;
  --input-disabled-bg: #374151;
}
```

---

## 5. Table

### Перевірені аспекти
- Row hover
- Header contrast
- Zebra striping

### Знайдені проблеми
| Проблема | Тема | Статус |
|----------|------|--------|
| Hover row не видно | Dark | ✅ Яскравіший bg |
| Header недостатньо виділений | Light | ✅ Bold + border |

---

## 6. Chat Bubbles

### Перевірені аспекти
- Own vs other message distinction
- Status indicators
- Timestamp readability

### Знайдені проблеми
| Проблема | Тема | Статус |
|----------|------|--------|
| Own message занадто схожий | Dark | ✅ Інший відтінок |
| Status pill не читається | Light | ✅ Збільшено контраст |
| Timestamp занадто дрібний | All | ✅ 10px → 11px |

### CSS змінні
```css
:root {
  --chat-own-bg: #dbeafe;
  --chat-other-bg: #f3f4f6;
  --chat-status-sending: #fbbf24;
  --chat-status-delivered: #22c55e;
  --chat-status-error: #ef4444;
}

[data-theme="dark"] {
  --chat-own-bg: #1e3a5f;
  --chat-other-bg: #374151;
}
```

---

## 7. Board Toolbar

### Перевірені аспекти
- Tool selection visibility
- Color picker contrast
- Thickness slider

### Знайдені проблеми
| Проблема | Тема | Статус |
|----------|------|--------|
| Active tool не виділений | Dark | ✅ Додано ring |
| Color picker border | Light | ✅ Додано subtle border |
| Slider thumb не видно | Dark | ✅ Контрастніший колір |

---

## Загальні рекомендації

### WCAG 2.1 AA Compliance
- [x] Контраст тексту ≥ 4.5:1
- [x] Контраст великого тексту ≥ 3:1
- [x] Focus indicators видимі
- [x] Disabled states розрізняються

### Accessibility
- [x] Всі інтерактивні елементи мають focus state
- [x] Кольори не єдиний спосіб передачі інформації
- [x] Touch targets ≥ 44x44px

---

## Підсумок

| Компонент | Light | Dark | High-Contrast |
|-----------|-------|------|---------------|
| Button | ✅ | ✅ | ✅ |
| Modal | ✅ | ✅ | ✅ |
| Card | ✅ | ✅ | ✅ |
| Input | ✅ | ✅ | ✅ |
| Table | ✅ | ✅ | ✅ |
| Chat Bubbles | ✅ | ✅ | ✅ |
| Board Toolbar | ✅ | ✅ | ✅ |

---

## Файли з CSS змінами
- `src/assets/styles/themes/light.css`
- `src/assets/styles/themes/dark.css`
- `src/assets/styles/components/button.css`
- `src/assets/styles/components/input.css`
- `src/assets/styles/components/modal.css`
- `src/modules/chat/styles/chat.css`
- `src/modules/board/styles/toolbar.css`
