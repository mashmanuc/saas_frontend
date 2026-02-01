# Аудит профілів користувача та тьютора

**Дата:** 31.01.2026  
**Мета:** Розділити функціонал User Profile та Tutor Profile, усунути дублікати в навігації

---

## 🔍 Поточний стан

### User Profile (`/dashboard/profile`)
**Компоненти:**
- `ProfileOverviewView.vue` - огляд профілю
- `ProfileEditView.vue` - редагування профілю
- `ProfileSettingsView.vue` - налаштування (legacy)
- `UserSettingsView.vue` - нові налаштування (General, Notifications, Privacy)

**Проблеми:**
1. ✅ `ProfileEditView` містить tutor-специфічні поля (subjects, hourly_rate, publish)
2. ✅ `ProfileEditView` використовує `TutorProfileForm` та `StudentProfileForm` всередині
3. ❌ Немає чіткого розділення між user-даними та role-специфічними даними
4. ❌ Кнопка архівування акаунту є тільки в `/settings` → Privacy tab

### Tutor Profile (`/marketplace/my-profile`)
**Компоненти:**
- `MarketplaceMyProfileView` - публічний профіль тьютора для редагування

**Проблеми:**
1. ❌ Дублює функціонал з `ProfileEditView`
2. ❌ Не має прямого доступу до tutor-специфічних налаштувань

### Навігація (menu.js)
**Tutor menu:**
```js
{ label: 'menu.profile', icon: 'user', to: '/dashboard/profile' },
{ label: 'menu.tutorProfile', icon: 'users', to: '/marketplace/my-profile' },
```

**Проблеми:**
1. ✅ Дублікат: два пункти меню ведуть на різні профілі
2. ❌ Незрозуміло користувачу, яка різниця між "Profile" та "Tutor Profile"

---

## 📋 План рефакторингу

### Phase 1: Розділення відповідальності ✅

**User Profile** має містити:
- ✅ Базові дані користувача (first_name, last_name, email, timezone)
- ✅ Аватар
- ✅ Загальні налаштування (General Settings)
- ✅ Налаштування сповіщень (Notifications Settings)
- ✅ Приватність та безпека (Privacy Settings)
- ✅ **Кнопка архівування акаунту** (в Privacy tab)

**Tutor Profile** має містити:
- ✅ Headline, Bio
- ✅ Experience, Hourly Rate, Currency
- ✅ Subjects (список предметів)
- ✅ Certifications
- ✅ Publish/Unpublish toggle
- ✅ Preview публічного профілю

**Student Profile** має містити:
- ✅ Learning goals
- ✅ Preferred subjects
- ✅ Budget range

### Phase 2: Рефакторинг компонентів

#### 2.1. ProfileEditView.vue
**Поточний стан:**
- Містить логіку для TUTOR, STUDENT та загального профілю
- Використовує `TutorProfileForm` та `StudentProfileForm`
- Має autosave, draft restoration

**Рішення:**
- ✅ Залишити тільки базові user-дані (first_name, last_name, timezone, avatar)
- ❌ Видалити tutor/student-специфічні форми
- ✅ Перенести їх у окремі view

#### 2.2. Створити TutorProfileEditView.vue
**Новий компонент:**
- Використовує `TutorProfileForm`
- Має publish/unpublish функціонал
- Autosave для tutor-даних
- Preview публічного профілю

#### 2.3. Створити StudentProfileEditView.vue
**Новий компонент:**
- Використовує `StudentProfileForm`
- Learning goals, preferred subjects, budget

#### 2.4. UserSettingsView.vue
**Поточний стан:**
- ✅ General Settings (language, timezone, dark_mode)
- ✅ Notifications Settings (email, sms)
- ✅ Privacy Settings (export data, **delete account**)

**Рішення:**
- ✅ Залишити як є
- ✅ Переконатись, що кнопка архівування працює

### Phase 3: Навігація та маршрути

#### 3.1. Маршрути (router/index.js)
**Поточні:**
```js
/dashboard/profile          → ProfileOverviewView (всі ролі)
/dashboard/profile/edit     → ProfileEditView (всі ролі)
/dashboard/profile/settings → ProfileSettingsView (legacy)
/settings                   → UserSettingsView (всі ролі)
/marketplace/my-profile     → MarketplaceMyProfileView (тільки TUTOR)
```

**Нові:**
```js
// User Profile (всі ролі)
/dashboard/profile          → ProfileOverviewView
/dashboard/profile/edit     → ProfileEditView (тільки базові дані)
/settings                   → UserSettingsView

// Tutor Profile (тільки TUTOR)
/tutor/profile              → TutorProfileOverviewView
/tutor/profile/edit         → TutorProfileEditView

// Student Profile (тільки STUDENT)
/student/profile            → StudentProfileOverviewView (опціонально)
/student/profile/edit       → StudentProfileEditView
```

#### 3.2. Меню (config/menu.js)
**Поточне (tutor):**
```js
{ label: 'menu.profile', icon: 'user', to: '/dashboard/profile' },
{ label: 'menu.tutorProfile', icon: 'users', to: '/marketplace/my-profile' },
```

**Нове (tutor):**
```js
{ label: 'menu.account', icon: 'user', to: '/dashboard/profile' },      // Акаунт
{ label: 'menu.tutorProfile', icon: 'briefcase', to: '/tutor/profile' }, // Профіль тьютора
{ label: 'menu.settings', icon: 'settings', to: '/settings' },           // Налаштування
```

**Нове (student):**
```js
{ label: 'menu.account', icon: 'user', to: '/dashboard/profile' },
{ label: 'menu.settings', icon: 'settings', to: '/settings' },
```

### Phase 4: Видалення дублікатів

#### 4.1. ProfileSettingsView.vue (legacy)
- ❌ Видалити (замінено на UserSettingsView)
- ❌ Видалити маршрут `/dashboard/profile/settings`

#### 4.2. MarketplaceMyProfileView
- ❌ Замінити на TutorProfileEditView
- ❌ Оновити маршрут `/marketplace/my-profile` → `/tutor/profile`

---

## 🎯 Критерії успіху

### Функціональні
- ✅ Користувач бачить тільки релевантні для нього дані
- ✅ Тьютор має окремий профіль для публічної інформації
- ✅ Студент має окремий профіль для навчальних цілей
- ✅ Кнопка архівування акаунту доступна в Settings → Privacy
- ✅ Немає дублікатів у навігації

### Технічні
- ✅ Чіткий розділ відповідальності між компонентами
- ✅ Переіспользовуваність форм (TutorProfileForm, StudentProfileForm)
- ✅ Autosave працює для всіх типів профілів
- ✅ Всі маршрути мають правильні guards (roles)

### UX
- ✅ Зрозуміла навігація (Account vs Tutor Profile vs Settings)
- ✅ Користувач знає, де знайти кнопку видалення акаунту
- ✅ Немає плутанини між різними типами профілів

---

## 📊 Матриця відповідальності

| Функціонал | User Profile | Tutor Profile | Student Profile | Settings |
|------------|--------------|---------------|-----------------|----------|
| First/Last Name | ✅ | ❌ | ❌ | ❌ |
| Email | ✅ (read-only) | ❌ | ❌ | ❌ |
| Avatar | ✅ | ❌ | ❌ | ❌ |
| Timezone | ✅ | ❌ | ❌ | ✅ (General) |
| Headline | ❌ | ✅ | ❌ | ❌ |
| Bio | ❌ | ✅ | ❌ | ❌ |
| Experience | ❌ | ✅ | ❌ | ❌ |
| Hourly Rate | ❌ | ✅ | ❌ | ❌ |
| Subjects | ❌ | ✅ | ❌ | ❌ |
| Publish Toggle | ❌ | ✅ | ❌ | ❌ |
| Learning Goals | ❌ | ❌ | ✅ | ❌ |
| Preferred Subjects | ❌ | ❌ | ✅ | ❌ |
| Budget Range | ❌ | ❌ | ✅ | ❌ |
| Language | ❌ | ❌ | ❌ | ✅ (General) |
| Dark Mode | ❌ | ❌ | ❌ | ✅ (General) |
| Notifications | ❌ | ❌ | ❌ | ✅ (Notifications) |
| Archive Account | ❌ | ❌ | ❌ | ✅ (Privacy) |
| Export Data | ❌ | ❌ | ❌ | ✅ (Privacy) |

---

## 🚀 Етапи виконання

1. ✅ **Аудит** - проаналізувати поточну структуру
2. ⏳ **Створити нові компоненти** - TutorProfileEditView, StudentProfileEditView
3. ⏳ **Рефакторинг ProfileEditView** - залишити тільки базові дані
4. ⏳ **Оновити маршрути** - додати нові, видалити legacy
5. ⏳ **Оновити меню** - видалити дублікати, додати Settings
6. ⏳ **Тестування** - перевірити всі flow
7. ⏳ **Документація** - оновити звіти

---

**Статус:** 🟡 В процесі  
**Наступний крок:** Створення TutorProfileEditView та StudentProfileEditView
