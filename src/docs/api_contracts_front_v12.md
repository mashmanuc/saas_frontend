# API Contracts Audit — Frontend v0.12.0

## Огляд
Документ фіксує відповідність між очікуваними (frontend) та фактичними (backend) контрактами API.
Оновлено: 2024-12-11

---

## 1. Auth

| Endpoint | Method | Frontend очікує | Примітки |
|----------|--------|-----------------|----------|
| `/auth/login/` | POST | `{ access, refresh, user }` | ✅ OK |
| `/auth/register/` | POST | `{ access, refresh, user }` | ✅ OK |
| `/auth/refresh/` | POST | `{ access }` | ✅ OK |
| `/auth/logout/` | POST | `{}` | ✅ OK |
| `/users/me/` | GET | `UserDTO` | ✅ OK |
| `/auth/invite/validate/` | POST | `{ valid, email?, tutor? }` | ✅ OK |
| `/auth/invite/accept/` | POST | `{ access, refresh, user }` | ✅ OK |

---

## 2. Chat

| Endpoint | Method | Frontend очікує | Примітки |
|----------|--------|-----------------|----------|
| `/chat/history/` | GET | `{ results: Message[], cursor?, has_more }` | ⚠️ Fallback на `messages` якщо `results` відсутній |
| `/chat/messages/` | POST | `Message` | ✅ OK |
| `/chat/messages/:id/` | PATCH | `Message` | ✅ OK |
| `/chat/messages/:id/` | DELETE | `{}` | ✅ OK |

### Message DTO
```ts
{
  id: number | string
  text: string
  created_at: string // ISO
  author_id: number
  author_name?: string
  attachments?: any[]
  clientId?: string // для optimistic updates
}
```

**Виявлені проблеми:**
- Frontend використовує `clientId` для optimistic updates, backend може не повертати це поле — потрібен merge по `id`.

---

## 3. Lessons

| Endpoint | Method | Frontend очікує | Примітки |
|----------|--------|-----------------|----------|
| `/lessons/my/` | GET | `{ results: Lesson[], cursor?, has_more }` або `Lesson[]` | ⚠️ Немає явної обробки пагінації |
| `/lessons/:id/` | GET | `Lesson` | ✅ OK |
| `/lessons/` | POST | `Lesson` | ✅ OK |
| `/lessons/:id/reschedule/` | PATCH | `Lesson` | ✅ OK |
| `/lessons/:id/cancel/` | POST | `Lesson` | ✅ OK |

### Lesson DTO
```ts
{
  id: number
  title?: string
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'completed' | 'cancelled'
  tutor_id: number
  student_id: number
  // ...
}
```

---

## 4. Notifications

| Endpoint | Method | Frontend очікує | Примітки |
|----------|--------|-----------------|----------|
| `/notifications/` | GET | `{ results: Notification[], cursor?, has_more }` | ✅ OK |
| `/notifications/:id/read/` | POST | `Notification` або `{}` | ✅ OK |

### Notification DTO
```ts
{
  id: string
  type: string
  payload: { title?: string, body?: string, ... }
  read_at: string | null
  created_at: string
}
```

---

## 5. Relations

| Endpoint | Method | Frontend очікує | Примітки |
|----------|--------|-----------------|----------|
| `/student/relations/` | GET | `Relation[]` або `{ results }` | ⚠️ Подвійна обробка |
| `/tutor/relations/` | GET | `{ results, cursor, has_more, summary }` | ✅ OK |
| `/tutor/relations/batch/accept/` | POST | `{ processed: id[], failed: id[] }` | ✅ OK |
| `/tutor/relations/batch/archive/` | POST | `{ processed: id[], failed: id[] }` | ✅ OK |
| `/relations/:id/accept/` | POST | `Relation` | ✅ OK |
| `/relations/:id/decline/` | POST | `Relation` | ✅ OK |
| `/relations/:id/resend/` | POST | `Relation` | ✅ OK |

### Relation DTO (Tutor)
```ts
{
  id: number
  status: 'invited' | 'active' | 'archived'
  student: PublicUserDTO
  invited_at: string | null
  accepted_at: string | null
  lesson_count: number
  recent_activity: string | null
  notes?: string
}
```

---

## 6. Profile

| Endpoint | Method | Frontend очікує | Примітки |
|----------|--------|-----------------|----------|
| `/me/profile/` | GET | `Profile` | ✅ OK |
| `/me/profile/` | PATCH | `Profile` | ✅ OK |
| `/me/profile/autosave/` | GET | `Profile` (draft) | ✅ OK |
| `/me/profile/autosave/` | PATCH | `Profile` | ✅ OK |
| `/me/profile/autosave/` | DELETE | `{}` | ✅ OK |
| `/me/avatar/` | POST | `{ avatar_url }` | ✅ OK |
| `/me/avatar/` | DELETE | `{}` | ✅ OK |

---

## 7. Presence

| Endpoint | Method | Frontend очікує | Примітки |
|----------|--------|-----------------|----------|
| `/users/online-status/` | GET | `[{ user_id, online }]` | ✅ OK |

---

## 8. Board (Whiteboard)

| Endpoint | Method | Frontend очікує | Примітки |
|----------|--------|-----------------|----------|
| `/board/lessons/:id/snapshot/` | GET | `{ strokes: Stroke[] }` | ✅ OK, fallback `{ strokes: [] }` |
| `/board/lessons/:id/snapshot/` | POST | `{ strokes }` | ✅ OK |

---

## 9. Activity

| Endpoint | Method | Frontend очікує | Примітки |
|----------|--------|-----------------|----------|
| `/me/activity/` | GET | `{ results: Activity[], cursor?, has_more }` | ✅ OK |

---

## Виявлені невідповідності та рекомендації

### Критичні
1. **Chat history fallback** — використовується `response.messages` як fallback, але це legacy. Рекомендація: видалити fallback після підтвердження backend.

### Середні
2. **Lessons API** — немає явної cursor-пагінації в `lessonsApi.listMyLessons`. Якщо backend підтримує — додати.
3. **Student relations** — подвійна обробка `Array.isArray(data) ? data : data?.results`. Уніфікувати.

### Низькі
4. **Типізація** — відсутні TypeScript типи для більшості DTO. Рекомендація: додати `src/types/*.ts`.
5. **apiClient response unwrap** — `response?.data ?? response` дублюється в кожному API. Централізувати в interceptor.

---

## Статус
- [x] Auth — перевірено
- [x] Chat — перевірено, є fallback
- [x] Lessons — перевірено, немає пагінації
- [x] Notifications — перевірено
- [x] Relations — перевірено
- [x] Profile — перевірено
- [x] Presence — перевірено
- [x] Board — перевірено
- [x] Activity — перевірено
