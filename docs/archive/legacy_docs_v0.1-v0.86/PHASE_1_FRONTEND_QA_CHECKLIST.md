# Phase 1 Frontend - Manual QA Checklist

**Версія:** v0.86.0  
**Дата:** 2026-01-23  
**Статус:** READY FOR QA

---

## Передумови

### Backend
- ✅ Backend Phase 1 реалізовано та протестовано
- ✅ Міграції застосовані
- ✅ API endpoints доступні:
  - `POST /api/v1/inquiries/{id}/accept/`
  - `POST /api/v1/inquiries/{id}/reject/`
  - `POST /api/v1/inquiries/{id}/cancel/`

### Frontend
- ✅ Frontend збирається без помилок
- ✅ Всі залежності встановлені
- ✅ Dev server запущено на `http://127.0.0.1:5173`

### Тестові користувачі
- **Student:** `student@test.com` / `password123`
- **Tutor:** `tutor@test.com` / `password123`

---

## 1. Student Flow - Створення Inquiry

### 1.1 Відкриття форми inquiry
- [ ] Перейти на профіль тьютора `/marketplace/tutors/{id}`
- [ ] Натиснути кнопку "Надіслати запит тьютору"
- [ ] Модальне вікно `InquiryFormModal` відкривається
- [ ] Форма містить всі поля:
  - Рівень студента (select)
  - Бюджет (number input)
  - Коли почати (select)
  - Повідомлення (textarea)

### 1.2 Валідація форми
- [ ] Спробувати відправити порожню форму → кнопка disabled
- [ ] Заповнити тільки частину полів → кнопка disabled
- [ ] Ввести повідомлення < 10 символів → кнопка disabled
- [ ] Заповнити всі поля коректно → кнопка enabled

### 1.3 Відправка inquiry
- [ ] Заповнити форму коректними даними
- [ ] Натиснути "Надіслати запит"
- [ ] Показується стан "Надсилаємо..."
- [ ] Після успіху:
  - Модальне вікно закривається
  - Показується toast "Запит надіслано!"
  - Перенаправлення на `/student/inquiries`

### 1.4 Обробка помилок
- [ ] Спробувати надіслати дублікат inquiry → показати `InquiryAlreadyExistsError`
- [ ] Симулювати 429 (rate limit) → показати rate-limit error з retry_after
- [ ] Симулювати 401 → показати unauthorized error
- [ ] Симулювати network error → показати network error з кнопкою retry

---

## 2. Student Dashboard - Перегляд Inquiries

### 2.1 Empty State
- [ ] Перейти на `/student/inquiries` без inquiries
- [ ] Показується `EmptyInquiriesState`:
  - Іконка
  - Заголовок "У вас ще немає запитів"
  - Опис "Знайдіть тьютора в каталозі..."

### 2.2 Loading State
- [ ] При завантаженні показується `LoadingState` з спінером
- [ ] Текст "Завантаження запитів..."

### 2.3 Список inquiries
- [ ] Inquiries відображаються як `InquiryCard`
- [ ] Кожна картка містить:
  - Аватар тьютора
  - Ім'я тьютора
  - Дату створення
  - Статус badge (OPEN/ACCEPTED/REJECTED/CANCELLED)
  - Повідомлення
  - Предмети (якщо є)
  - Бюджет (якщо є)

### 2.4 Скасування inquiry
- [ ] Для inquiry зі статусом OPEN показується кнопка "Скасувати запит"
- [ ] Натиснути "Скасувати запит"
- [ ] Inquiry зникає або змінює статус на CANCELLED
- [ ] Список оновлюється автоматично

---

## 3. Tutor Flow - Прийняття/Відхилення Inquiries

### 3.1 Tutor Dashboard
- [ ] Перейти на `/tutor/inquiries`
- [ ] Показується список inquiries від студентів
- [ ] Для OPEN inquiries показуються кнопки:
  - "Прийняти" (primary)
  - "Відхилити" (secondary)

### 3.2 Прийняття inquiry
- [ ] Натиснути "Прийняти" на OPEN inquiry
- [ ] Показується loading стан
- [ ] Після успіху:
  - Відкривається модальне вікно з контактами студента
  - Показуються: Email, Телефон, Telegram
  - Кнопка "Закрити"
- [ ] Inquiry змінює статус на ACCEPTED
- [ ] Список оновлюється

### 3.3 Idempotent unlock
- [ ] Прийняти inquiry, де контакти вже були розблоковані раніше
- [ ] Перевірити `was_already_unlocked: true` в response
- [ ] Повідомлення: "Запит прийнято (контакт вже був відкритий раніше)."

### 3.4 Відхилення inquiry
- [ ] Натиснути "Відхилити" на OPEN inquiry
- [ ] Відкривається `RejectInquiryModal`
- [ ] Форма містить:
  - Select з причинами (BUSY, BUDGET_LOW, LEVEL_MISMATCH, SUBJECT_MISMATCH, OTHER)
  - Textarea для коментаря (показується тільки для OTHER)

### 3.5 Валідація reject форми
- [ ] Без вибору причини → кнопка disabled
- [ ] Вибрати "Інше" (OTHER) без коментаря → кнопка disabled
- [ ] Вибрати "Інше" + ввести коментар → кнопка enabled
- [ ] Вибрати будь-яку іншу причину → кнопка enabled

### 3.6 Відправка reject
- [ ] Заповнити форму коректно
- [ ] Натиснути "Відхилити запит"
- [ ] Показується "Відхиляємо..."
- [ ] Після успіху:
  - Модальне вікно закривається
  - Inquiry змінює статус на REJECTED
  - Список оновлюється

---

## 4. Error Handling (Fail-Closed)

### 4.1 Rate Limit (429)
- [ ] Симулювати 429 response
- [ ] Показується `ErrorState` variant="rate-limit"
- [ ] Заголовок: "Забагато запитів"
- [ ] Показується retry_after (якщо є)
- [ ] Кнопка retry НЕ показується

### 4.2 Permission Denied (403)
- [ ] Симулювати 403 response
- [ ] Показується `ErrorState` variant="forbidden"
- [ ] Заголовок: "Доступ заборонено"
- [ ] Повідомлення: "У вас немає прав..."

### 4.3 Unauthorized (401)
- [ ] Симулювати 401 response
- [ ] Показується `ErrorState` variant="unauthorized"
- [ ] Заголовок: "Необхідна авторизація"
- [ ] Повідомлення: "Увійдіть в систему..."

### 4.4 Invalid State (400)
- [ ] Спробувати прийняти вже прийнятий inquiry
- [ ] Показується `ErrorState` variant="error"
- [ ] Повідомлення містить current_status

### 4.5 Network Error
- [ ] Вимкнути інтернет
- [ ] Спробувати виконати дію
- [ ] Показується network error з кнопкою "Спробувати ще раз"

---

## 5. UI States Checklist

### 5.1 LoadingState
- [ ] Показується під час завантаження
- [ ] Анімований спінер
- [ ] Опціональне повідомлення

### 5.2 EmptyInquiriesState
- [ ] Показується коли немає inquiries
- [ ] Іконка + заголовок + опис
- [ ] Slot для action button (опціонально)

### 5.3 ErrorState
- [ ] Підтримує 4 варіанти: error, rate-limit, forbidden, unauthorized
- [ ] Правильні іконки для кожного варіанту
- [ ] Показує retry button коли `showRetry: true`
- [ ] Показує retry_after для rate-limit

---

## 6. Responsive Design

### 6.1 Mobile (< 768px)
- [ ] Модальні вікна займають 100% ширини з padding
- [ ] Форми читабельні та зручні для заповнення
- [ ] Кнопки достатньо великі для touch
- [ ] Inquiry cards стакаються вертикально

### 6.2 Tablet (768px - 1024px)
- [ ] Модальні вікна max-width 600px
- [ ] Списки inquiries центровані

### 6.3 Desktop (> 1024px)
- [ ] Модальні вікна max-width 800px для форми
- [ ] Списки inquiries max-width 800px центровані

---

## 7. Accessibility

### 7.1 Keyboard Navigation
- [ ] Tab через всі інтерактивні елементи
- [ ] Enter для submit форм
- [ ] Escape для закриття модальних вікон

### 7.2 Screen Readers
- [ ] Всі input мають label
- [ ] Кнопки мають описові тексти
- [ ] Error messages асоційовані з полями

### 7.3 Focus States
- [ ] Видимий focus outline на всіх інтерактивних елементах
- [ ] Focus trap в модальних вікнах

---

## 8. Performance

### 8.1 API Calls
- [ ] Refetch після мутацій (accept/reject/cancel)
- [ ] Не більше 1 запиту на дію
- [ ] Loading states під час запитів

### 8.2 Rendering
- [ ] Списки inquiries рендеряться без затримок
- [ ] Модальні вікна відкриваються миттєво
- [ ] Анімації плавні (60fps)

---

## 9. Regression Tests

### 9.1 Існуючий функціонал
- [ ] Login/logout працює
- [ ] Marketplace працює
- [ ] Інші модулі не зламані

---

## Відтворення Типових Сценаріїв

### Сценарій 1: Happy Path (Student → Tutor)
1. Login як student
2. Знайти тьютора в marketplace
3. Надіслати inquiry з коректними даними
4. Перейти на `/student/inquiries`
5. Побачити inquiry зі статусом OPEN
6. Logout
7. Login як tutor
8. Перейти на `/tutor/inquiries`
9. Прийняти inquiry
10. Побачити контакти студента
11. Перевірити що inquiry має статус ACCEPTED

### Сценарій 2: Reject Flow
1. Login як tutor
2. Перейти на `/tutor/inquiries`
3. Відхилити inquiry з причиною "BUSY"
4. Перевірити що inquiry має статус REJECTED
5. Login як student
6. Перейти на `/student/inquiries`
7. Побачити inquiry зі статусом REJECTED

### Сценарій 3: Cancel Flow
1. Login як student
2. Перейти на `/student/inquiries`
3. Скасувати OPEN inquiry
4. Перевірити що inquiry має статус CANCELLED

### Сценарій 4: Error Handling
1. Спробувати надіслати дублікат inquiry → error
2. Спробувати прийняти вже прийнятий inquiry → error
3. Спробувати скасувати прийнятий inquiry → error

---

## Критичні Інваріанти (MUST PASS)

- ✅ **ІНВАРІАНТ 1:** Accept → contacts ОДРАЗУ видимі в response
- ✅ **ІНВАРІАНТ 2:** Idempotent unlock (was_already_unlocked flag)
- ✅ **ІНВАРІАНТ 3:** Fail-closed UI states (не зависають спінери)
- ✅ **ІНВАРІАНТ 4:** Всі тексти через i18n keys
- ✅ **ІНВАРІАНТ 5:** Жодних "тимчасових any" в типах

---

## Підпис QA

**Тестував:** _________________  
**Дата:** _________________  
**Статус:** ☐ PASS / ☐ FAIL  
**Коментарі:** _________________
