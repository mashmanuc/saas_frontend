# 🔒 API CONTRACTS LOCK - Solo Board

> ⚠️ **КРИТИЧНО: ЦІ КОНТРАКТИ НЕЗМІННІ!**
> Backend не змінюється. Всі нові features мають бути backward compatible.
> Backend просто зберігає JSON в поле `state` - він не знає про структуру даних.

---

## 📋 Зміст

1. [Правила та обмеження](#-правила-та-обмеження)
2. [API Endpoints](#-api-endpoints)
3. [Типи даних](#-типи-даних)
4. [Структура State JSON](#-структура-state-json)
5. [Приклади Request/Response](#-приклади-requestresponse)

---

## 🚫 Правила та обмеження

### ЗАБОРОНЕНО:
- ❌ Змінювати URL endpoints
- ❌ Змінювати HTTP методи (GET/POST/PATCH/DELETE)
- ❌ Змінювати формат response від backend
- ❌ Видаляти існуючі поля з типів
- ❌ Змінювати типи існуючих полів
- ❌ Змінювати backend код (`solo_BE/`)

### ДОЗВОЛЕНО:
- ✅ Додавати нові optional поля до `state` JSON
- ✅ Додавати нові tool types (backend їх не валідує)
- ✅ Розширювати frontend логіку
- ✅ Додавати нові типи елементів в state

### ПРИНЦИП РОБОТИ:
```
Backend зберігає state як JSONB blob.
Він НЕ ЗНАЄ про Stroke, Shape, TextElement.
Він просто зберігає те, що прийшло.
Тому нові features = нові поля в JSON = backward compatible.
```

---

## 📡 API Endpoints

### Sessions CRUD

#### 1. GET `/v1/solo/sessions/`
**Опис:** Отримати список всіх сесій користувача

| Параметр | Значення |
|----------|----------|
| Method   | `GET` |
| Auth     | Required (JWT) |
| Response | `{ count: number, results: SoloSession[] }` |

#### 2. GET `/v1/solo/sessions/{id}/`
**Опис:** Отримати одну сесію за ID

| Параметр | Значення |
|----------|----------|
| Method   | `GET` |
| Auth     | Required (JWT) |
| URL Param | `id: string` (UUID) |
| Response | `SoloSession` |

#### 3. POST `/v1/solo/sessions/`
**Опис:** Створити нову сесію

| Параметр | Значення |
|----------|----------|
| Method   | `POST` |
| Auth     | Required (JWT) |
| Body     | `Partial<SoloSession>` |
| Response | `SoloSession` |

#### 4. PATCH `/v1/solo/sessions/{id}/`
**Опис:** Оновити існуючу сесію (часткове оновлення)

| Параметр | Значення |
|----------|----------|
| Method   | `PATCH` |
| Auth     | Required (JWT) |
| URL Param | `id: string` (UUID) |
| Body     | `Partial<SoloSession>` |
| Response | `SoloSession` |

#### 5. DELETE `/v1/solo/sessions/{id}/`
**Опис:** Видалити сесію

| Параметр | Значення |
|----------|----------|
| Method   | `DELETE` |
| Auth     | Required (JWT) |
| URL Param | `id: string` (UUID) |
| Response | `void` (204 No Content) |

#### 6. POST `/v1/solo/sessions/{id}/duplicate/`
**Опис:** Дублювати сесію

| Параметр | Значення |
|----------|----------|
| Method   | `POST` |
| Auth     | Required (JWT) |
| URL Param | `id: string` (UUID) |
| Response | `SoloSession` (нова копія) |

---

### Sharing

#### 7. POST `/v1/solo/sessions/{id}/share/`
**Опис:** Створити share token для сесії

| Параметр | Значення |
|----------|----------|
| Method   | `POST` |
| Auth     | Required (JWT) |
| URL Param | `id: string` (UUID) |
| Body     | `{ expires_in_days?: number, max_views?: number, allow_download?: boolean }` |
| Response | `ShareToken` |

#### 8. GET `/v1/solo/sessions/{id}/share/`
**Опис:** Отримати share token для сесії

| Параметр | Значення |
|----------|----------|
| Method   | `GET` |
| Auth     | Required (JWT) |
| URL Param | `id: string` (UUID) |
| Response | `ShareToken` |

#### 9. DELETE `/v1/solo/sessions/{id}/share/`
**Опис:** Відкликати share token

| Параметр | Значення |
|----------|----------|
| Method   | `DELETE` |
| Auth     | Required (JWT) |
| URL Param | `id: string` (UUID) |
| Response | `void` (204 No Content) |

#### 10. GET `/v1/solo/public/{token}/`
**Опис:** Отримати публічну сесію за share token (без авторизації)

| Параметр | Значення |
|----------|----------|
| Method   | `GET` |
| Auth     | **NOT Required** |
| URL Param | `token: string` |
| Response | `SoloSession` |

---

### Export

#### 11. POST `/v1/solo/sessions/{id}/export/`
**Опис:** Запит на експорт сесії

| Параметр | Значення |
|----------|----------|
| Method   | `POST` |
| Auth     | Required (JWT) |
| URL Param | `id: string` (UUID) |
| Body     | `{ format: 'png' \| 'pdf' \| 'json' }` |
| Response | `ExportRequest` |

#### 12. GET `/v1/exports/{exportId}/`
**Опис:** Отримати статус експорту

| Параметр | Значення |
|----------|----------|
| Method   | `GET` |
| Auth     | Required (JWT) |
| URL Param | `exportId: string` (UUID) |
| Response | `ExportRequest` |

---

### Thumbnail

#### 13. POST `/v1/solo/sessions/{id}/thumbnail/`
**Опис:** Регенерувати thumbnail для сесії

| Параметр | Значення |
|----------|----------|
| Method   | `POST` |
| Auth     | Required (JWT) |
| URL Param | `id: string` (UUID) |
| Response | `{ thumbnail_url: string, status: string }` |

---

### Uploads (v0.30)

#### 14. POST `/v1/solo/uploads/presign/`
**Опис:** Отримати presigned URL для завантаження зображення

| Параметр | Значення |
|----------|----------|
| Method   | `POST` |
| Auth     | Required (JWT) |
| Body     | `PresignReq` |
| Response | `PresignResp` |

**PresignReq:**
```typescript
{
  session_id: string
  content_type: 'image/png' | 'image/jpeg' | 'image/webp'
  size_bytes: number
  ext?: 'png' | 'jpg' | 'jpeg' | 'webp'
  sha256?: string
}
```

**PresignResp:**
```typescript
{
  upload_url: string      // URL для PUT запиту
  cdn_url: string         // Фінальний URL після завантаження
  method: 'PUT'
  headers: Record<string, string>
  max_bytes: number
  expires_at: string      // ISO datetime
}
```

---

## 📦 Типи даних

### Tool (Union Type)
```typescript
type Tool =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'note'
  | 'select'
```

### Point
```typescript
interface Point {
  x: number
  y: number
}
```

### Stroke
```typescript
interface Stroke {
  id: string                          // UUID
  tool: Tool                          // Тип інструменту
  color: string                       // HEX колір (#RRGGBB)
  size: number                        // Розмір пензля (px)
  opacity: number                     // 0-1
  points: Point[]                     // Масив точок
  composite?: GlobalCompositeOperation // Canvas composite mode
  text?: string                       // Для text/note tools
}
```

### Shape
```typescript
interface Shape {
  id: string                          // UUID
  type: 'line' | 'rectangle' | 'circle'
  color: string                       // HEX колір
  size: number                        // Товщина лінії
  // Для line:
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  // Для rectangle/circle:
  x?: number
  y?: number
  width?: number
  height?: number
  // Alternative points format:
  points?: Point[]
}
```

### TextElement
```typescript
interface TextElement {
  id: string                          // UUID
  type: 'text' | 'note'
  text: string                        // Текстовий контент
  x: number                           // Позиція X
  y: number                           // Позиція Y
  color: string                       // HEX колір
  fontSize: number                    // Розмір шрифту (px)
  width?: number                      // Ширина блоку
  height?: number                     // Висота блоку
}
```

### AssetLayer (v0.30)
```typescript
interface AssetLayer {
  id: string                          // UUID
  type: 'image' | 'svg' | 'pdf'
  src: string                         // URL або data URL
  x: number
  y: number
  width: number
  height: number
  rotation: number                    // Degrees
  locked: boolean
  zIndex: number
}
```

### PageState
```typescript
interface PageState {
  id: string                          // UUID
  name: string                        // Назва сторінки
  strokes: Stroke[]
  shapes: Shape[]
  texts: TextElement[]
}
```

### WorkspaceState (повний state)
```typescript
interface WorkspaceState {
  id: string                          // UUID
  name: string                        // Назва workspace
  pages: PageState[]                  // Масив сторінок
  activePageId: string                // ID активної сторінки
  zoom: number                        // Масштаб (1 = 100%)
  pan: Point                          // Позиція viewport
  fullscreen: boolean
  updatedAt: number                   // Unix timestamp
}
```

### SoloSession (від Backend)
```typescript
interface SoloSession {
  id: string                          // UUID (від backend)
  name: string                        // Назва сесії
  owner_id?: string                   // UUID власника
  state?: Record<string, unknown>     // 🔥 JSONB blob - WorkspaceState
  page_count: number                  // Кількість сторінок
  thumbnail_url?: string              // URL thumbnail
  is_shared: boolean
  created_at: string                  // ISO datetime
  updated_at: string                  // ISO datetime
}
```

### ShareToken
```typescript
interface ShareToken {
  token: string                       // Унікальний токен
  session_id: string                  // UUID сесії
  expires_at: string | null           // ISO datetime або null (безстроковий)
  max_views: number | null            // Ліміт переглядів або null
  view_count: number                  // Поточна кількість переглядів
  allow_download: boolean
  created_at: string                  // ISO datetime
}
```

### ExportRequest
```typescript
interface ExportRequest {
  id: string                          // UUID
  session_id: string                  // UUID сесії
  format: 'png' | 'pdf' | 'json'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  file_url?: string                   // URL файлу (коли completed)
  created_at: string                  // ISO datetime
}
```

### HistoryAction (для undo/redo)
```typescript
interface HistoryAction {
  pageId: string
  type: 'add-stroke' | 'remove-stroke' | 'add-shape' | 'remove-shape' | 'add-text' | 'remove-text' | 'update-state'
  payload: Stroke | Shape | TextElement | PageState
}
```

---

## 📝 Структура State JSON

**ВАЖЛИВО:** Поле `state` в `SoloSession` містить `WorkspaceState` як JSON.

```json
{
  "id": "workspace-uuid-here",
  "name": "My Whiteboard",
  "pages": [
    {
      "id": "page-1-uuid",
      "name": "Page 1",
      "strokes": [
        {
          "id": "stroke-uuid",
          "tool": "pen",
          "color": "#000000",
          "size": 3,
          "opacity": 1,
          "points": [
            { "x": 100, "y": 100 },
            { "x": 150, "y": 120 },
            { "x": 200, "y": 110 }
          ]
        }
      ],
      "shapes": [
        {
          "id": "shape-uuid",
          "type": "rectangle",
          "color": "#FF0000",
          "size": 2,
          "x": 50,
          "y": 50,
          "width": 100,
          "height": 80
        }
      ],
      "texts": [
        {
          "id": "text-uuid",
          "type": "text",
          "text": "Hello World",
          "x": 200,
          "y": 200,
          "color": "#333333",
          "fontSize": 16
        }
      ]
    }
  ],
  "activePageId": "page-1-uuid",
  "zoom": 1,
  "pan": { "x": 0, "y": 0 },
  "fullscreen": false,
  "updatedAt": 1706889600000
}
```

---

## 🔄 Приклади Request/Response

### 1. Створити нову сесію

**Request:**
```http
POST /v1/solo/sessions/
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "name": "New Whiteboard",
  "state": {
    "id": "ws-123",
    "name": "New Whiteboard",
    "pages": [{
      "id": "page-1",
      "name": "Page 1",
      "strokes": [],
      "shapes": [],
      "texts": []
    }],
    "activePageId": "page-1",
    "zoom": 1,
    "pan": { "x": 0, "y": 0 },
    "fullscreen": false,
    "updatedAt": 1706889600000
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "New Whiteboard",
  "owner_id": "user-uuid",
  "state": { ... },
  "page_count": 1,
  "thumbnail_url": null,
  "is_shared": false,
  "created_at": "2024-02-02T12:00:00Z",
  "updated_at": "2024-02-02T12:00:00Z"
}
```

### 2. Оновити state сесії

**Request:**
```http
PATCH /v1/solo/sessions/550e8400-e29b-41d4-a716-446655440000/
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "state": {
    "id": "ws-123",
    "name": "My Whiteboard",
    "pages": [...],
    "activePageId": "page-1",
    "zoom": 1.5,
    "pan": { "x": 100, "y": 50 },
    "fullscreen": false,
    "updatedAt": 1706893200000
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Whiteboard",
  "owner_id": "user-uuid",
  "state": { ... },
  "page_count": 1,
  "thumbnail_url": "https://cdn.example.com/thumb.png",
  "is_shared": false,
  "created_at": "2024-02-02T12:00:00Z",
  "updated_at": "2024-02-02T13:00:00Z"
}
```

### 3. Створити share link

**Request:**
```http
POST /v1/solo/sessions/550e8400-e29b-41d4-a716-446655440000/share/
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "expires_in_days": 7,
  "max_views": 100,
  "allow_download": true
}
```

**Response:**
```json
{
  "token": "abc123xyz",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2024-02-09T12:00:00Z",
  "max_views": 100,
  "view_count": 0,
  "allow_download": true,
  "created_at": "2024-02-02T12:00:00Z"
}
```

### 4. Presign Upload (для зображень)

**Request:**
```http
POST /v1/solo/uploads/presign/
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "image/png",
  "size_bytes": 102400,
  "ext": "png"
}
```

**Response:**
```json
{
  "upload_url": "https://storage.example.com/presigned-url?signature=...",
  "cdn_url": "https://cdn.example.com/solo/images/abc123.png",
  "method": "PUT",
  "headers": {
    "Content-Type": "image/png",
    "x-amz-acl": "public-read"
  },
  "max_bytes": 10485760,
  "expires_at": "2024-02-02T12:15:00Z"
}
```

---

## ⚙️ Backward Compatibility Guidelines

### Додавання нових полів

**✅ БЕЗПЕЧНО:**
```typescript
// Додати optional поле до Stroke
interface Stroke {
  // ... existing fields
  newField?: string  // Optional - backend просто збереже
}

// Додати нове поле до PageState
interface PageState {
  // ... existing fields
  assets?: AssetLayer[]  // Optional - backward compatible
}
```

**❌ НЕБЕЗПЕЧНО:**
```typescript
// Видалити поле
interface Stroke {
  // id: string  // НЕ МОЖНА видаляти!
}

// Змінити тип поля
interface Stroke {
  opacity: string  // БУЛО number - НЕ МОЖНА змінювати!
}
```

### Додавання нових tool types

**✅ БЕЗПЕЧНО:**
```typescript
type Tool =
  | 'pen'
  | 'highlighter'
  // ... existing
  | 'laser'      // Новий tool - OK, backend не валідує
  | 'arrow'      // Новий tool - OK
```

Backend зберігає `tool` як string, тому нові значення працюватимуть.

---

## 📌 Checksums (для валідації)

```
soloApi.ts SHA256: [обчислюється при зміні]
solo.ts SHA256: [обчислюється при зміні]
Endpoints count: 14
Types count: 12
```

---

**Останнє оновлення:** 2024-02-02
**Версія контракту:** v0.30
