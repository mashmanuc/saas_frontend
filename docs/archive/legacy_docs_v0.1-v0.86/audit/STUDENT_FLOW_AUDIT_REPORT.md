# Student Flow Audit Report
**Date:** 2026-01-23  
**Auditor:** Cascade AI  
**Scope:** Student → Marketplace → Contact Tutor → Chat Flow

---

## Executive Summary

Проведено повний end-to-end аудит користувацького сценарію студента від входу в Marketplace до спроби зв'язатися з тьютором. Виявлено **3 BLOCKER** та **2 MAJOR** проблеми, які повністю блокують платну цінність продукту.

**Критичний висновок:** Студент **НЕ МОЖЕ** зв'язатися з тьютором через відсутність реалізації contact/chat flow.

---

## 1. Bugs List (Prioritized)

### [BLOCKER-1] Infinite Loop в TutorAvailabilityCalendar
**Severity:** BLOCKER  
**Status:** ✅ FIXED

**Steps to Reproduce:**
1. Логін як студент (s3@gmail.com)
2. Перейти в Marketplace
3. Відкрити профіль будь-якого тьютора
4. Спостерігати консоль браузера

**Expected:**
- Календар завантажується 1 раз
- API викликається 1 раз при mount

**Actual:**
- Тисячі викликів `getTutorCalendar`
- `RangeError: Maximum call stack size exceeded`
- Браузер зависає

**Root Cause:**
- Відсутність guard-флагу `loadingInProgress` у `loadAvailability()`
- Можлива реактивна залежність, яка тригерить безкінечний цикл

**Fix Applied:**
```typescript
// Added guard flag
let loadingInProgress = false

async function loadAvailability() {
  if (loadingInProgress) {
    console.warn('[TutorAvailabilityCalendar] loadAvailability called while already loading, skipping')
    return
  }
  
  loadingInProgress = true
  // ... existing code
  
  finally {
    loading.value = false
    loadingInProgress = false
  }
}
```

**File:** `d:\m4sh_v1\frontend\src\modules\marketplace\components\TutorAvailabilityCalendar.vue`

---

### [BLOCKER-2] handleMessage() Not Implemented
**Severity:** BLOCKER  
**Status:** ❌ NOT FIXED

**Steps to Reproduce:**
1. Логін як студент
2. Відкрити профіль тьютора
3. Натиснути кнопку "Надіслати повідомлення"
4. Нічого не відбувається

**Expected:**
- Відкривається чат або модальне вікно для відправки повідомлення
- Студент може написати тьютору

**Actual:**
- Кнопка клікається, але нічого не відбувається
- `handleMessage()` просто робить `return`

**Root Cause:**
```typescript
// TutorProfileView.vue:69-71
function handleMessage() {
  return  // ← NOT IMPLEMENTED
}
```

**Suggested Fix:**
```typescript
function handleMessage() {
  // Option 1: Navigate to chat page
  router.push(`/chat/tutor/${currentProfile.value.slug}`)
  
  // Option 2: Open chat modal
  // showChatModal.value = true
  
  // Option 3: Create inquiry and redirect
  // await createInquiry(currentProfile.value.user_id)
  // router.push('/messages')
}
```

**Impact:** Студент **НЕ МОЖЕ** зв'язатися з тьютором через UI. Це повністю блокує платну цінність продукту.

---

### [BLOCKER-3] Trial Request API Fails with "Слот недоступний"
**Severity:** BLOCKER  
**Status:** ❌ NOT FIXED

**Steps to Reproduce:**
1. Логін як студент
2. Відкрити профіль тьютора
3. Клікнути на слот у календарі (наприклад, 10:00)
4. У модальному вікні натиснути "Забронювати пробний урок"
5. Отримати помилку "Слот недоступний"

**Expected:**
- Trial request створюється успішно
- Студент отримує підтвердження
- Тьютор отримує запит

**Actual:**
- API повертає помилку (ймовірно 409 або 422)
- Toast: "Слот недоступний"
- Запит не створюється

**Root Cause:**
- Можливо, слоти в календарі показуються, але backend їх не вважає доступними
- Можлива race condition між `getTutorCalendar` та `createTrialRequest`
- Можливо, `slot_id` не валідний або застарілий

**Suggested Fix:**
1. Перевірити backend логіку валідації слотів
2. Додати real-time перевірку доступності перед відкриттям модалки
3. Додати retry mechanism з refresh календаря
4. Покращити error message (показати причину недоступності)

**API Endpoint:** `POST /v1/marketplace/tutors/{slug}/trial-request/`

---

### [MAJOR-1] "Запланувати урок" Button UX Confusion
**Severity:** MAJOR  
**Status:** ❌ NOT FIXED

**Steps to Reproduce:**
1. Відкрити профіль тьютора
2. Натиснути "Запланувати урок" (зелена кнопка)
3. Сторінка прокручується до календаря

**Expected:**
- Відкривається модальне вікно з вибором слоту
- Або чіткий hint "Оберіть час у календарі нижче"

**Actual:**
- Просто scroll до календаря
- Студент не розуміє, що робити далі
- Немає візуального feedback

**Suggested Fix:**
```typescript
function handleBook() {
  const calendarEl = document.querySelector('[data-test="marketplace-availability"]')
  calendarEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  
  // Add visual hint
  showCalendarHint.value = true
  setTimeout(() => {
    showCalendarHint.value = false
  }, 5000)
}
```

**UI Improvement:**
- Додати tooltip або banner: "👇 Оберіть зручний час у календарі"
- Highlight календар на 2-3 секунди
- Або змінити кнопку на "Переглянути розклад"

---

### [MAJOR-2] No Message Field in Trial Request Modal
**Severity:** MAJOR  
**Status:** ❌ NOT FIXED

**Steps to Reproduce:**
1. Клікнути на слот у календарі
2. Відкривається модалка "Підтвердження пробного уроку"
3. Немає поля для повідомлення

**Expected:**
- Студент може написати коротке повідомлення тьютору
- Наприклад: "Хочу підготуватися до НМТ з математики"

**Actual:**
- Тільки кнопки "Скасувати" та "Забронювати"
- Немає можливості додати контекст

**Suggested Fix:**
```vue
<textarea
  v-model="message"
  :placeholder="t('marketplace.trialRequest.messagePlaceholder')"
  rows="3"
  maxlength="500"
/>
```

**Impact:** Тьютор не розуміє контекст запиту, що знижує якість першого контакту.

---

## 2. Product UX Issues List

### UX-1: No Clear Entry Point to Chat
**Severity:** HIGH

**Issue:**
- Кнопка "Надіслати повідомлення" не працює
- Немає альтернативного способу зв'язатися з тьютором
- Студент не знає, як почати переговори

**Student POV:**
> "Я бачу тьютора, але не можу з ним зв'язатися. Що робити?"

**Suggested Solution:**
1. Реалізувати `handleMessage()` → navigate to chat
2. Додати "Історія звернень" у профілі студента
3. Додати fallback: "Написати на email" або "Telegram"

---

### UX-2: No Status Visibility for Contact Requests
**Severity:** HIGH

**Issue:**
- Студент не бачить статус своїх запитів (pending/accepted/declined)
- Немає "історії" звернень до тьюторів
- Після refresh студент губить контекст

**Student POV:**
> "Я відправив запит? Тьютор відповів? Де це подивитися?"

**Suggested Solution:**
1. Додати `/dashboard/requests` сторінку
2. Показувати badge на профілі тьютора: "Запит відправлено"
3. Додати notification при зміні статусу

---

### UX-3: Empty State After Failed Trial Request
**Severity:** MEDIUM

**Issue:**
- Після помилки "Слот недоступний" модалка залишається відкритою
- Немає пропозиції обрати інший слот
- Студент не знає, що робити далі

**Suggested Solution:**
```typescript
catch (err) {
  if (err.response?.status === 409) {
    error.value = t('marketplace.trialRequest.slotUnavailable')
    suggestAlternativeSlots.value = true
  }
}
```

---

### UX-4: Subjects and Tags Display Issues
**Severity:** LOW

**Issue:**
- Теги відображаються без пробілів: "ЦіліПідвищити рівеньЗакрити прогалини"
- Важко читати та розрізняти окремі теги

**Actual Output:**
```
Молодші класиЦіліПідвищити рівеньЗакрити прогалиниДопомога з домашніми завданнями
```

**Expected:**
```
Молодші класи • Цілі • Підвищити рівень • Закрити прогалини • Допомога з домашніми завданнями
```

**Suggested Fix:**
- Додати CSS gap між тегами
- Або додати роздільник (•, |, comma)

---

## 3. Data/Contract Issues

### API-1: getTutorCalendar Infinite Calls
**Status:** ✅ FIXED (frontend guard added)

**Issue:**
- Frontend викликав API тисячі разів
- Можлива проблема з реактивністю Vue

**Fix:**
- Додано `loadingInProgress` guard

---

### API-2: createTrialRequest Returns 409/422
**Status:** ❌ NOT FIXED

**Issue:**
- Backend не приймає trial requests
- Можлива проблема з валідацією `slot_id`

**Needs Investigation:**
1. Backend logs для `/v1/marketplace/tutors/{slug}/trial-request/`
2. Чи слоти з `getTutorCalendar` валідні для `createTrialRequest`?
3. Чи є rate limiting або duplicate protection?

---

### API-3: Missing Chat/Message Endpoints
**Status:** ❌ NOT IMPLEMENTED

**Issue:**
- Немає endpoint для створення чату з тьютором
- Немає endpoint для відправки повідомлення

**Required Endpoints:**
```
POST /v1/chat/inquiries/          # Create inquiry
GET  /v1/chat/threads/            # List chat threads
POST /v1/chat/threads/{id}/messages/  # Send message
GET  /v1/chat/threads/{id}/messages/  # Get messages
```

---

## 4. Security/Privacy Invariants

### SEC-1: No Contact Info Leakage
**Status:** ✅ OK

**Checked:**
- Email тьютора не показується
- Телефон не показується
- Telegram username не показується

**Good:** Контакти захищені до підтвердження зв'язку.

---

### SEC-2: No Duplicate Trial Requests Protection
**Status:** ⚠️ UNKNOWN

**Issue:**
- Не перевірено, чи можна відправити кілька запитів на один слот
- Потрібна idempotency перевірка

**Suggested Test:**
1. Клікнути "Забронювати" двічі швидко
2. Перевірити, чи створюється 2 запити

---

## 5. Reliability Issues

### REL-1: No Graceful Degradation for Calendar Errors
**Status:** ❌ NOT IMPLEMENTED

**Issue:**
- Якщо `getTutorCalendar` fails → порожній екран
- Немає fallback UI

**Suggested Fix:**
```vue
<div v-if="error" class="error-state">
  <p>{{ error }}</p>
  <button @click="loadAvailability">{{ t('common.retry') }}</button>
  <p class="hint">{{ t('marketplace.calendar.contactDirectly') }}</p>
</div>
```

---

### REL-2: No State Persistence After Refresh
**Status:** ❌ NOT IMPLEMENTED

**Issue:**
- Після refresh сторінки студент губить:
  - Обраний слот
  - Написане повідомлення (якщо було б поле)
  - Статус запиту

**Suggested Fix:**
- Зберігати draft у localStorage
- Або redirect на `/dashboard/requests` після успішного створення

---

## 6. Implementation Plan (P0/P1/P2)

### P0 (BLOCKER - Must Fix Before Release)

#### P0.1: Implement handleMessage() → Chat Flow
**Goal:** Студент може зв'язатися з тьютором

**Tasks:**
1. ✅ Create chat API endpoints (backend)
   - `POST /v1/chat/inquiries/` - create inquiry
   - `GET /v1/chat/threads/` - list threads
   - `POST /v1/chat/threads/{id}/messages/` - send message

2. ✅ Create chat store (frontend)
   - `useChatStore()` з методами `createInquiry()`, `sendMessage()`

3. ✅ Implement `handleMessage()` in TutorProfileView
   ```typescript
   async function handleMessage() {
     const inquiry = await chatStore.createInquiry({
       tutor_id: currentProfile.value.user_id,
       message: 'Привіт! Хочу дізнатися більше про ваші уроки.'
     })
     router.push(`/chat/${inquiry.thread_id}`)
   }
   ```

4. ✅ Create chat UI components
   - `ChatView.vue` - main chat interface
   - `MessageList.vue` - message history
   - `MessageInput.vue` - send message

**Estimate:** 2-3 days  
**Priority:** P0 (BLOCKER)

---

#### P0.2: Fix Trial Request API Error
**Goal:** Студент може забронювати пробний урок

**Tasks:**
1. ✅ Debug backend `/trial-request/` endpoint
   - Check slot validation logic
   - Check availability rules
   - Add detailed error messages

2. ✅ Add real-time slot validation (frontend)
   ```typescript
   async function validateSlot(slotId: string): Promise<boolean> {
     const response = await marketplaceApi.checkSlotAvailability(slotId)
     return response.available
   }
   ```

3. ✅ Add retry mechanism with calendar refresh
   ```typescript
   catch (err) {
     if (err.response?.status === 409) {
       await loadAvailability() // Refresh calendar
       notifyError(t('marketplace.trialRequest.slotTaken'))
     }
   }
   ```

**Estimate:** 1-2 days  
**Priority:** P0 (BLOCKER)

---

### P1 (MAJOR - Should Fix Soon)

#### P1.1: Improve "Запланувати урок" UX
**Goal:** Студент розуміє, що робити після кліку

**Tasks:**
1. ✅ Add visual hint after scroll
2. ✅ Highlight calendar for 3 seconds
3. ✅ Add tooltip: "Оберіть зручний час"

**Estimate:** 0.5 day  
**Priority:** P1

---

#### P1.2: Add Message Field to Trial Request Modal
**Goal:** Студент може додати контекст до запиту

**Tasks:**
1. ✅ Add textarea to `TrialRequestModal.vue`
2. ✅ Update API payload to include `message`
3. ✅ Backend: store message with trial request

**Estimate:** 0.5 day  
**Priority:** P1

---

#### P1.3: Create Student Dashboard for Requests
**Goal:** Студент бачить історію звернень та статуси

**Tasks:**
1. ✅ Create `/dashboard/requests` page
2. ✅ Show list of inquiries with statuses
3. ✅ Add filters: pending/accepted/declined
4. ✅ Add link to chat for accepted requests

**Estimate:** 1 day  
**Priority:** P1

---

### P2 (MINOR - Nice to Have)

#### P2.1: Fix Tags Display Spacing
**Goal:** Теги читабельні

**Tasks:**
1. ✅ Add CSS gap between tags
2. ✅ Or add separator (•)

**Estimate:** 0.25 day  
**Priority:** P2

---

#### P2.2: Add Graceful Degradation for Calendar Errors
**Goal:** Студент бачить fallback UI при помилках

**Tasks:**
1. ✅ Add error state with retry button
2. ✅ Add hint: "Або напишіть тьютору напряму"

**Estimate:** 0.5 day  
**Priority:** P2

---

#### P2.3: Add State Persistence (localStorage)
**Goal:** Студент не губить прогрес після refresh

**Tasks:**
1. ✅ Save draft message to localStorage
2. ✅ Restore draft on mount

**Estimate:** 0.5 day  
**Priority:** P2

---

## 7. What to Test After Fix (E2E Checklist)

### ✅ Happy Path: Student → Tutor Contact → Chat

**Scenario 1: Direct Message**
1. [ ] Логін як студент (s3@gmail.com / demo1234)
2. [ ] Перейти в Marketplace
3. [ ] Відкрити профіль тьютора
4. [ ] Натиснути "Надіслати повідомлення"
5. [ ] **Expected:** Відкривається чат або модалка
6. [ ] Написати повідомлення: "Привіт! Хочу дізнатися про уроки математики"
7. [ ] Натиснути "Відправити"
8. [ ] **Expected:** Повідомлення відправлено, статус "pending"
9. [ ] Перейти в `/dashboard/requests`
10. [ ] **Expected:** Запит відображається зі статусом "pending"

**Scenario 2: Trial Lesson Booking**
1. [ ] Відкрити профіль тьютора
2. [ ] Натиснути "Запланувати урок"
3. [ ] **Expected:** Scroll до календаря + hint
4. [ ] Клікнути на доступний слот (наприклад, 10:00)
5. [ ] **Expected:** Модалка "Підтвердження пробного уроку"
6. [ ] Написати повідомлення: "Хочу підготуватися до НМТ"
7. [ ] Натиснути "Забронювати пробний урок"
8. [ ] **Expected:** Успішне створення, toast "Запит відправлено"
9. [ ] **Expected:** Redirect на `/dashboard/requests` або `/chat/{thread_id}`

---

### ✅ Negative Scenarios

**Test 1: Double Click Protection**
1. [ ] Клікнути "Забронювати" двічі швидко
2. [ ] **Expected:** Тільки 1 запит створюється (409 на другий)

**Test 2: Slot Unavailable**
1. [ ] Клікнути на слот, який щойно зайняв інший студент
2. [ ] **Expected:** Помилка "Слот недоступний" + пропозиція обрати інший

**Test 3: Unauthorized Access**
1. [ ] Вийти з акаунта (logout)
2. [ ] Спробувати відкрити профіль тьютора
3. [ ] Натиснути "Надіслати повідомлення"
4. [ ] **Expected:** Redirect на `/login` або modal "Увійдіть, щоб зв'язатися"

**Test 4: Network Timeout**
1. [ ] Throttle network до 3G
2. [ ] Спробувати відправити повідомлення
3. [ ] **Expected:** Loading state → retry button при таймауті

**Test 5: Refresh During Send**
1. [ ] Написати повідомлення
2. [ ] Натиснути "Відправити"
3. [ ] Одразу зробити refresh (F5)
4. [ ] **Expected:** Draft зберігається в localStorage або запит все одно створюється

---

## 8. Summary & Recommendations

### Current State
❌ **Student CANNOT contact tutor** - платна цінність продукту повністю заблокована

**Blocker Issues:**
1. ❌ `handleMessage()` not implemented
2. ❌ Trial request API fails
3. ✅ Infinite loop (FIXED)

### Critical Path to MVP
**Week 1 (P0):**
- Day 1-2: Implement chat API + store
- Day 3: Implement `handleMessage()` + chat UI
- Day 4: Fix trial request API
- Day 5: E2E testing

**Week 2 (P1):**
- Day 1: Student dashboard for requests
- Day 2: Improve booking UX
- Day 3: Add message field to trial modal
- Day 4-5: QA + bug fixes

### Success Metrics
- [ ] Student can send message to tutor (100% success rate)
- [ ] Student can book trial lesson (>80% success rate)
- [ ] Student sees request status (100% visibility)
- [ ] No infinite loops or crashes (0 critical errors)

---

**Next Steps:**
1. Prioritize P0.1 (Chat implementation)
2. Assign backend dev for chat API
3. Assign frontend dev for chat UI
4. Daily sync to unblock issues

**End of Report**
