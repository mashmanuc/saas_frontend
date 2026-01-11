# Inquiries & Negotiation Chat Flow v0.69

## Overview

Система People Contacts & Negotiation Chat v0.69 забезпечує контрольований процес встановлення контакту між студентами та тьюторами через inquiry-based workflow з подальшим negotiation chat.

## Architecture Principles

### Single Source of Truth
- Всі мутації викликають `refetch()` для синхронізації з backend
- Немає локального state management для критичних даних
- Backend є єдиним джерелом правди для статусів та даних

### Idempotency
- Всі write операції використовують `clientRequestId` або `clientMessageId`
- Захист від duplicate requests при повторних кліках
- Безпечні retry механізми

### State-Driven UI
- Frontend не вгадує бізнес-логіку
- Всі дозволені дії визначаються backend через DTO
- UI рендериться на основі `inquiry.status` та `thread.readOnly`

## Data Flow

### Student Flow: Create Inquiry

```
1. Student clicks "Contact" on tutor profile
2. CreateInquiryModal opens
3. Student enters message (min 1 char)
4. Click "Send Request"
   → inquiriesStore.createInquiry(tutorId, message)
   → API: POST /api/v1/people/inquiries/ { tutorId, message, clientRequestId }
   → Backend creates inquiry with status='sent'
   → inquiriesStore.refetch() to sync
5. Modal closes, success toast shown
6. Student can view inquiry in /beta/people
```

### Tutor Flow: Accept/Decline Inquiry

```
1. Tutor navigates to /beta/people/inbox
2. inquiriesStore.fetchInquiries({ role: 'tutor', status: 'sent' })
3. Tutor sees pending inquiries
4. Click "Accept"
   → inquiriesStore.acceptInquiry(inquiryId)
   → API: POST /api/v1/people/inquiries/{id}/accept/ { clientRequestId }
   → Backend updates inquiry.status='accepted', creates TutorStudentRelation
   → inquiriesStore.refetch() to sync
5. Inquiry status updates to "Accepted"
6. "Open Chat" button appears
```

### Chat Flow: Negotiation Thread

```
1. User clicks "Open Chat" on accepted inquiry
2. negotiationChatStore.ensureThread(inquiryId)
   → API: POST /api/v1/chat/threads/negotiation/ { inquiryId }
   → Backend returns existing or creates new thread
3. Router navigates to /chat/thread/{threadId}
4. ChatThreadView loads:
   → negotiationChatStore.fetchMessages(threadId)
   → API: GET /api/v1/chat/threads/{threadId}/messages/
5. User types message and clicks Send
   → Optimistic update: message added to local state
   → negotiationChatStore.sendMessage(threadId, body)
   → API: POST /api/v1/chat/threads/{threadId}/messages/ { body, clientMessageId }
   → On success: replace optimistic with server message
   → On error: remove optimistic message
```

## Components

### InquiryStatusPill
**Purpose**: Відображення статусу inquiry з кольоровим badge

**Props**:
- `status: InquiryStatus` - sent | accepted | declined | cancelled | expired

**Usage**:
```vue
<InquiryStatusPill :status="inquiry.status" />
```

### InquiryCard
**Purpose**: Картка inquiry з інформацією про користувача та діями

**Props**:
- `inquiry: InquiryDTO` - дані inquiry
- `viewerRole: 'student' | 'tutor'` - роль поточного користувача

**Slots**:
- `actions` - кастомні дії (Cancel, Accept, Decline, Open Chat)

**Usage**:
```vue
<InquiryCard :inquiry="inquiry" viewer-role="student">
  <template #actions="{ inquiry }">
    <button @click="handleCancel(inquiry.id)">Cancel</button>
  </template>
</InquiryCard>
```

### CreateInquiryModal
**Purpose**: Модальне вікно для створення inquiry

**Props**:
- `isOpen: boolean` - стан відкриття модалу
- `tutorId: string` - ID тьютора
- `tutorName: string` - ім'я тьютора для відображення

**Events**:
- `close` - закриття модалу
- `success` - успішне створення inquiry

**Validation**:
- Message min length: 1 character
- Disabled submit при порожньому повідомленні

**Usage**:
```vue
<CreateInquiryModal
  :is-open="showModal"
  :tutor-id="tutorId"
  :tutor-name="tutorName"
  @close="showModal = false"
  @success="handleSuccess"
/>
```

## Views

### StudentInquiriesView (`/beta/people`)
**Purpose**: Список inquiry студента

**Features**:
- Відображення всіх inquiries студента
- Фільтрація за статусом (опціонально)
- Дії: Cancel (для sent), Open Chat (для accepted)
- Empty state при відсутності inquiries

### TutorInquiriesInbox (`/beta/people/inbox`)
**Purpose**: Inbox тьютора з pending та всіма inquiries

**Features**:
- Tabs: Pending / All
- Pending count badge
- Дії: Accept, Decline (для sent), Open Chat (для accepted)
- Empty state для кожного табу

### ChatThreadView (`/chat/thread/:threadId`)
**Purpose**: Negotiation chat між студентом та тьютором

**Features**:
- Message history з пагінацією
- Send message з optimistic updates
- Read-only enforcement для закритих threads
- Back navigation
- Enter to send (Shift+Enter для нового рядка)

## Stores

### inquiriesStore
**State**:
- `items: InquiryDTO[]` - список inquiries
- `statusFilter: InquiryStatus | null` - активний фільтр
- `isLoading: boolean` - стан завантаження
- `error: string | null` - помилка

**Actions**:
- `createInquiry(tutorId, message)` - створити inquiry
- `fetchInquiries(filters)` - завантажити inquiries
- `cancelInquiry(inquiryId)` - скасувати inquiry (student)
- `acceptInquiry(inquiryId)` - прийняти inquiry (tutor)
- `declineInquiry(inquiryId)` - відхилити inquiry (tutor)
- `refetch()` - перезавантажити з поточними фільтрами

**Computed**:
- `pendingCount` - кількість sent inquiries

### negotiationChatStore
**State**:
- `threads: NegotiationThreadDTO[]` - список threads
- `messagesByThread: Record<string, ChatMessageDTO[]>` - повідомлення по threads
- `activeThreadId: string | null` - активний thread
- `isLoading: boolean` - стан завантаження
- `isSending: boolean` - стан відправки повідомлення

**Actions**:
- `ensureThread(inquiryId)` - створити або отримати thread
- `fetchThreads()` - завантажити всі threads
- `fetchMessages(threadId, cursor?)` - завантажити повідомлення
- `sendMessage(threadId, body)` - відправити повідомлення
- `setActiveThread(threadId)` - встановити активний thread

**Computed**:
- `activeThread` - об'єкт активного thread

## Error Handling

### limit_exceeded
**Scenario**: Student перевищив ліміт inquiries

**Response**:
```json
{
  "code": "limit_exceeded",
  "resetAt": "2024-01-02T10:00:00Z",
  "limitType": "daily_inquiries"
}
```

**UI Behavior**:
- Показати error message з resetAt
- **НЕ показувати upgrade CTA** (per v0.69 spec)
- Disable "Contact" button до resetAt

### inquiry_already_exists
**Scenario**: Student намагається створити duplicate inquiry

**UI Behavior**:
- Показати error: "You already have a pending request with this tutor"
- Redirect до /beta/people

### invalid_transition
**Scenario**: Неможлива зміна статусу (e.g., cancel accepted inquiry)

**UI Behavior**:
- Показати error message
- Refetch для синхронізації актуального стану

### forbidden
**Scenario**: Користувач не має прав на дію

**UI Behavior**:
- Показати error: "You don't have permission to perform this action"
- Redirect до home page

## Routing

### Student Routes
- `/beta/people` - StudentInquiriesView (role: STUDENT)

### Tutor Routes
- `/beta/people/inbox` - TutorInquiriesInbox (role: TUTOR)

### Shared Routes
- `/chat/thread/:threadId` - ChatThreadView (role: STUDENT | TUTOR)

## Testing

### Unit Tests
- `inquiriesStore.spec.ts` - всі actions, computed, idempotency
- `negotiationChatStore.spec.ts` - thread management, optimistic updates

### E2E Tests
- `student-inquiry-flow.spec.ts` - create, view, cancel, open chat
- `tutor-inquiry-flow.spec.ts` - inbox, accept, decline, tabs
- `negotiation-chat-flow.spec.ts` - send, history, read-only, optimistic

## Migration from v0.62

### Breaking Changes
1. **API namespace**: `/api/v1/inquiries/` → `/api/v1/people/inquiries/`
2. **DTO structure**: `relation_id` removed, `student` and `tutor` objects added
3. **Status values**: `OPEN/ACCEPTED/REJECTED` → `sent/accepted/declined`
4. **New actions**: `cancel` (student), `decline` (tutor)
5. **Idempotency**: всі write операції вимагають `clientRequestId`

### Removed Features (v0.62 → v0.69)
- `contactVisibility` field (moved to v0.70)
- `unreadCount` field (moved to v0.70)
- WebSocket integration (replaced with polling/refetch)
- Upgrade CTA in limit_exceeded errors

### New Features (v0.69)
- Negotiation chat threads
- Optimistic message updates
- Read-only thread enforcement
- Pending count badge
- Tab-based inbox filtering

## Performance Considerations

### Polling Strategy
- **NOT implemented in v0.69** (per SAFE spec)
- Use manual refetch on user actions
- Consider WebSocket in v0.70

### Optimistic Updates
- Only for chat messages
- Rollback on error
- Clear visual feedback

### Pagination
- Messages: cursor-based pagination
- Inquiries: simple list (no pagination in v0.69)

## Security

### CSRF Protection
- All POST/PUT/DELETE requests include CSRF token
- Token obtained from `/api/v1/auth/csrf`

### Authorization
- Backend enforces role-based access
- Frontend respects `thread.readOnly` flag
- No client-side permission logic

## Future Enhancements (v0.70+)

- WebSocket real-time updates
- Unread message counts
- Contact visibility controls
- Typing indicators
- Message reactions
- File attachments
- Rich text formatting

---

**Version**: v0.69  
**Last Updated**: 2024-01-11  
**Status**: Production Ready
