# Avatar Dropdown Theme Background Fix

**Дата:** 2026-03-14  
**Проблема:** Dropdown-меню користувача зливається з фоном сторінки в різних темах

## Проблема

На скріншоті видно, що в світлій темі (Classic/Світла) dropdown-меню має м'ятний фон `#e0f7f4`, який ідентичний фону сторінки (`--bg-primary`). Це призводить до того, що меню візуально зливається з фоном і погано виділяється.

## Аналіз

### Поточна реалізація

**`src/assets/main.css`** — CSS змінні для тем:
- **Light тема:** `--bg-primary: #e0f7f4` (м'ятний)
- **Dark тема:** `--bg-primary: #0a1929` (темно-синій)
- **Classic тема:** `--bg-primary: #f8f7fd` (світло-фіолетовий)

**`src/ui/AvatarDropdown.vue`** — компонент dropdown-меню:
```css
.dropdown-panel {
  background: var(--bg-primary); /* ❌ Зливається з фоном сторінки */
}

.avatar-sheet {
  background: var(--bg-primary); /* ❌ Mobile версія теж зливається */
}
```

### Причина проблеми

Dropdown-меню використовувало `--bg-primary`, яка призначена для фону **сторінки**, а не для **elevated surfaces** (піднятих поверхонь типу dropdown, modal, card).

## Рішення

### 1. Створено нову CSS змінну `--dropdown-bg`

Додано окрему змінну для кожної теми, яка **контрастує** з фоном сторінки, але **відповідає** стилю теми:

**Light тема** (`src/assets/main.css:30-31`):
```css
--dropdown-bg: #ffffff;
--bg-hover: rgba(5, 150, 105, 0.08);
```
- Білий фон контрастує з м'ятним `#e0f7f4`
- Hover з зеленим відтінком відповідає темі

**Dark тема** (`src/assets/main.css:84-85`):
```css
--dropdown-bg: #1e293b;
--bg-hover: rgba(56, 189, 248, 0.1);
```
- Темно-сірий `#1e293b` контрастує з чорним `#0a1929`
- Hover з бірюзовим відтінком відповідає темі

**Classic тема** (`src/assets/main.css:125-126`):
```css
--dropdown-bg: #ffffff;
--bg-hover: rgba(124, 58, 237, 0.08);
```
- Білий фон контрастує зі світло-фіолетовим `#f8f7fd`
- Hover з фіолетовим відтінком відповідає темі

### 2. Оновлено AvatarDropdown.vue

**Desktop dropdown** (`src/ui/AvatarDropdown.vue:294`):
```css
.dropdown-panel {
  background: var(--dropdown-bg); /* ✅ Тепер контрастує */
}
```

**Mobile bottom sheet** (`src/ui/AvatarDropdown.vue:422`):
```css
.avatar-sheet {
  background: var(--dropdown-bg); /* ✅ Тепер контрастує */
}
```

## Результат

### Візуальні зміни

**Light тема:**
- Було: м'ятний dropdown на м'ятному фоні ❌
- Стало: білий dropdown на м'ятному фоні ✅

**Dark тема:**
- Було: чорний dropdown на чорному фоні ❌
- Стало: темно-сірий dropdown на чорному фоні ✅

**Classic тема:**
- Було: світло-фіолетовий dropdown на світло-фіолетовому фоні ❌
- Стало: білий dropdown на світло-фіолетовому фоні ✅

### Переваги рішення

1. **Платформне мислення:** створено окрему змінну `--dropdown-bg`, яку можуть використовувати інші dropdown/modal компоненти
2. **Тематична узгодженість:** кожна тема має свій колір dropdown, який відповідає загальній палітрі
3. **Доступність:** чіткий контраст між dropdown та фоном покращує читабельність
4. **Масштабованість:** нова змінна може бути використана в інших компонентах (modals, popovers, tooltips)

## Інші компоненти

Перевірено інші компоненти, які використовують `var(--bg-primary)`:
- `StaffLayout.vue` — фон сторінки ✅
- `NegotiationChatWindow.vue` — фон чату ✅
- `DoubtCard.vue` — фон картки ✅
- `ProfileHero.vue` — бейджі ✅
- `CohortTable.vue`, `AlertsPanel.vue`, `StaffAnalyticsView.vue` — UI елементи ✅

Всі вони правильно використовують `--bg-primary` для фонових елементів сторінки, а не для elevated surfaces.

## Тестування

Рекомендовано перевірити:
1. Desktop dropdown в усіх 3 темах (light, dark, classic)
2. Mobile bottom sheet в усіх 3 темах
3. Перемикання між темами (плавність transition)
4. Hover стани на dropdown-item
5. Accessibility (контраст тексту на новому фоні)

## Lint попередження

CSS валідатор показує попередження про `@tailwind` та `@apply` директиви — це нормально для Tailwind CSS проєктів і не впливає на роботу коду.
