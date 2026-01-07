# User Profile vs Tutor Profile — Frontend/Backend Audit (v0.59.1)

**Дата:** 7 січня 2026  
**Автор:** Cascade (frontend agent)  

## 1. Мета аудиту

1. З’ясувати, які можливості редагування профілю (ім’я, username, timezone, email, пароль, аватар, біо/предмети) вже реалізовані на бекенді.
2. Перевірити, що саме доступно у нинішньому фронтенді для **user profile** (не плутати з marketplace/tutor profile).
3. Визначити розриви та потенційні ризики (функціонал реалізовано в бекенді, але недоступний або частково реалізований у фронтенді).

---

## 2. Поточний стан фронтенду

| Зона | Файл/Компонент | Джерело даних | Можливості |
|------|----------------|---------------|------------|
| **Account overview** | `UserAccountView.vue` + `useMeStore` | `/v1/me` (via `authApi.updateMe`) | Зміна `first_name`, `last_name`, `username`, `timezone`, аватар (upload/delete). Кнопки переходу до зміни email/password/security. |
| **Profile edit (текстові поля)** | `ProfileEditView.vue` + `useProfileStore` | `/api/me/profile/` (via `patchMeProfile`) | Редагування і autosave для `first_name`, `last_name`, `timezone`, `headline`, `bio`, `subjects`. Є autosave/draft логіка. |
| **Profile settings** | `ProfileSettingsView.vue` | `/api/me/profile/` (section `settings`) | Зміна timezone (через settings), мова UI, notification toggle, privacy toggle. |
| **Change Email** | `ChangeEmailView.vue` | `authApi.changeEmail` → `/v1/me/change-email` | UI існує, але payload відправляє `{ new_email, password }` замість `{ new_email, current_password }` (розрив!). Немає confirm URL input. |
| **Change Password** | `ChangePasswordView.vue` | `authApi.changePassword` → `/v1/me/change-password` | Повний флоу: current/new/confirm, обробка mismatch, нотифікації. |
| **Security sessions / MFA** | (окремі сторінки в router) | `/v1/me/sessions`, `/v1/auth/*` | Поза межами цього аудиту, але в наявності. |

### Ключові спостереження

1. **Дві паралельні сторони даних**:
   - `useMeStore` (легкий `/v1/me` профіль) використовується в `UserAccountView`.
   - `useProfileStore` (повний `/api/me/profile/`) використовується для “Profile Edit/Settings”.
   - Вони не синхронізуються між собою. Напр., зміна імені через `UserAccountView` не тригерить оновлення у `profileStore`.

2. **Change Email UI існує, але payload несумісний** з бекендом (потрібен `current_password`, а фронт відправляє `password`). Через це запит завжди кидає `validation_failed` / `invalid_credentials`.

3. **Username change**: є в `UserAccountView`, але фронт не показує cooldown/validation від сервера (14 днів, reserved names). Користувач дізнається про помилку лише з toast.

4. **Timezone**:
   - У `UserAccountView` користувач вводить timezone “вільним текстом” (простий `<Input>`), без випадаючого списку/валідації.  
   - У `ProfileSettingsView` є select з валідними `TIMEZONES`. Це два різні UX-потоки.

5. **Email/Password зміни винесені в окремі екрани**, але з точки зору “повноцінного профілю” немає єдиного hub’а, де видно усі налаштування на одній сторінці (як очікує користувач).

---

## 3. Бекенд-можливості (вже реалізовано)

| Endpoint | Джерело | Дії |
|----------|---------|-----|
| `PATCH /api/v1/me` (`V1MeView`) | `apps/users/api/views_v1_me.py` | Часткове оновлення `first_name`, `last_name`, `timezone`, `username`. Валідація timezone & username (cooldown, reserved). |
| `PATCH /api/me/profile/` (`MeProfileView`) | `apps/users/api/views.py` | Комплексне оновлення user + tutor/student profile + settings, включно з `bio`, `subjects`, `privacy`, `notifications_enabled` тощо. |
| `POST /api/v1/me/change-email` (`V1MeChangeEmailView`) | `views_v1_me.py` | Вимагає `new_email`, `current_password`, логування, відправлення листа підтвердження, токен зі строком дії. |
| `POST /api/v1/me/confirm-email-change` | `views_v1_me.py` | Завершує зміну email за токеном. |
| `POST /api/v1/me/change-password` | `views_v1_me.py` | Приймає `current_password`, `new_password`, `new_password_confirm`, оновлює token_version. |
| `POST/DELETE /api/v1/me/avatar` (`V1MeAvatarView`) | `views_v1_me.py` | Upload/delete аватару з валідацією розміру та формату (JPEG/PNG/WEBP, 2MB). |
| `GET/PATCH /api/me/profile/autosave` | `ProfileAutosaveView` | Зберігання/читання чернеток з rate-limit. |

Бекенд покриває всі потреби: базові дані, профільні дані (тутор/студент), налаштування, email/password, аватар, security sessions.

---

## 4. Розриви та ризики

| ID | Опис | Статус на фронті | Як має бути |
|----|------|------------------|-------------|
| G1 | **Change Email payload** | `ChangeEmailView` шле `{ new_email, password }` | Повинно бути `{ new_email, current_password }`, і, опціонально, `confirm_url`. Зараз бекенд відхиляє запит. |
| G2 | **Дублювання профільних сторінок** | `UserAccountView` vs `ProfileEditView` користують різні стори/ендпойнти, без синхронізації. | Потрібно консолідувати (або хоча б після save вручну оновлювати інший store), інакше користувач бачить застарілі дані. |
| G3 | **Timezone input без валідації** | В `UserAccountView` звичайне текстове поле → можна ввести будь-що й отримати бекенд-ерор `invalid_timezone`. | Використати спільний селект як у `ProfileSettingsView` або додати підказку/валідацію. |
| G4 | **Відсутність флоу підтвердження email** | UI не показує, що після `change-email` треба підтвердити токен з листа; нема статуса pending. | Додати state “verification sent”, інструкцію, кнопку “Ввести токен” або автопереадресацію. |
| G5 | **Немає єдиного екрану “повноцінного профілю”** | Користувач розкиданий між `UserAccount`, `ProfileEdit`, `ProfileSettings`, `ChangeEmail`, `ChangePassword`. | Запропонувати об’єднаний UX (наприклад, таби: Account / Profile / Settings / Security) або принаймні cross-links. |
| G6 | **Username cooldown/errors** | В UI немає messaging про 14-денний cooldown, reserved names. | Перед сабмітом викликати бекенд валідацію або показувати підказки (наприклад, “Оновити можна раз на 14 днів”). |
| G7 | **Tutor vs student profile відмінності** | Зараз `ProfileEditView` має умовну логіку для tutors (subjects) vs students, але UI не пояснює різницю. | Додати пояснення/labels, чи рознести на окремі секції. |

---

## 5. Рекомендації

1. **Терміново виправити `ChangeEmailView`**:
   - Змінити назву поля на `current_password`.
   - Додати обробку `confirm_url` (хоча б прихований input із базовим URL).
   - Показати користувачу, що лист відправлено і треба підтвердити.

2. **Синхронізувати `useMeStore` та `useProfileStore`**:
   - Після успішного `authApi.updateMe` викликати `profileStore.setProfileState({ ...profileStore.raw, user: updatedUser })` або зробити єдине джерело правди.

3. **Timezone UX**:
   - Використати `TIMEZONES` у `UserAccountView`.
   - Або прибрати timezone з `UserAccountView`, залишити в `ProfileSettingsView`, щоб не дублювати.

4. **Єдиний профільний хаб**:
   - Зробити сторінку `ProfileHome` з табами: “Account”, “Profile”, “Settings”, “Security”.
   - Тримати всі CTA там, щоб користувач не шукав у різних місцях.

5. **Username UX**:
   - Показати підказку, якщо сервер повернув `cooldown`, `reserved`, `already_exists`.
   - Можна попередньо викликати `/v1/me` валідацію перед сабмітом через debounce.

6. **Документація**:
   - Додати секцію в `FRONTEND_REPORT_v0.59.1.md` або новий ADR про потребу консолідувати профільні сторінки та виправити change-email payload.

---

## 6. Висновок

Бекенд вже давно підтримує повний цикл редагування профілю (дані користувача, тьютор/студент профілі, налаштування, email, пароль, безпека). На фронтенді цей функціонал розбитий на кілька неузгоджених сторінок з різними Pinia сторами, що створює враження “неповноцінного” профілю:

- Користувач бачить лише частину налаштувань за один раз.
- Зміни можуть не відображатися одразу через відсутність синхронізації між `useMeStore` та `useProfileStore`.
- Change Email фактично не працює через невідповідність payload’а.

Для виконання вимоги “повноцінного редагування” потрібна консолідація UX (single entry point), виправлення change-email флоу та вирівнювання стора + валідації. Після цього фронтенд повністю відповідатиме можливостям бекенду.
