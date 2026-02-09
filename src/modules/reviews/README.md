# Reviews Module (DOMAIN-09)

Модуль відгуків та рейтингів для платформи M4SH.

## Огляд

Модуль надає функціонал для:
- Перегляду відгуків про тьюторів
- Залишення відгуків учнями
- Управління відгуками (редагування, видалення)
- Відповідей тьюторів на відгуки
- Рейтингової системи зірками (1-5)
- Модерації та скарг на відгуки

## Архітектура

### Store (Pinia)

`reviewsStore.ts` - головний store для управління відгуками:
- `tutorReviews` - відгуки про конкретного тьютора
- `tutorStats` - статистика рейтингів (середній, розподіл)
- `myReviews` - відгуки, написані поточним користувачем
- `pendingReviews` - список тьюторів, яких можна відгукнути
- `canReviewData` - дані про можливість залишити відгук

Основні дії:
- `fetchTutorReviews()` - завантаження відгуків тьютора
- `createReview()` - створення нового відгуку
- `updateReview()` - редагування відгуку (24h ліміт)
- `deleteReview()` - видалення відгуку
- `respondToReview()` - відповідь тьютора
- `markHelpful()` - позначити відгук корисним

### API Client

`reviewsApi.ts` - інтеграція з backend API:
- `GET /v1/reviews/tutor/:id/` - відгуки тьютора
- `POST /v1/reviews/` - створити відгук
- `PATCH /v1/reviews/:id/` - оновити відгук
- `DELETE /v1/reviews/:id/` - видалити відгук
- `POST /v1/reviews/:id/respond/` - відповісти на відгук
- `GET /v1/reviews/can-review/:id/` - перевірити можливість відгуку
- `GET /v1/reviews/my/` - мої відгуки
- `GET /v1/reviews/pending/` - очікуючі відгуки

### Компоненти

- `ReviewCard.vue` - картка окремого відгуку з діями
- `ReviewForm.vue` - форма створення/редагування відгуку
- `ReviewsList.vue` - список відгуків з фільтрами та сортуванням
- `TutorRatingWidget.vue` - віджет рейтингу для профілю тьютора

### Views

- `TutorReviewsView.vue` - сторінка відгуків про тьютора (публічна)
- `MyReviewsView.vue` - сторінка "Мої відгуки" для учня

## Використання

### Перегляд відгуків тьютора

```vue
<template>
  <ReviewsList
    :tutor-id="tutorId"
    :reviews="store.tutorReviews"
    :stats="store.tutorStats"
    @write-review="showForm = true"
  />
</template>

<script setup>
import { useReviewsStore } from '@/modules/reviews'

const store = useReviewsStore()
await store.fetchTutorReviews(tutorId)
await store.fetchTutorStats(tutorId)
</script>
```

### Залишити відгук

```vue
<template>
  <ReviewForm
    :tutor-id="tutorId"
    :tutor-name="tutorName"
    @success="onReviewSubmitted"
  />
</template>
```

### Віджет рейтингу на профілі

```vue
<template>
  <TutorRatingWidget
    :rating="stats.average_rating"
    :total-reviews="stats.total_reviews"
    :stats="stats"
    :tutor-id="tutorId"
    show-cta
  />
</template>
```

## Роути

| URL | Доступ | Призначення |
|-----|--------|-------------|
| `/tutor/:id/reviews` | Публічний | Перегляд відгуків про тьютора |
| `/dashboard/reviews/my` | STUDENT | Мої відгуки та очікуючі |

## i18n Ключі

Основні ключі в `uk.json`:

```json
{
  "reviews": {
    "title": "Відгуки",
    "writeReview": "Написати відгук",
    "yourRating": "Ваша оцінка",
    "verified": "Перевірено",
    "helpful": "Корисно",
    "filters": {
      "all": "Всі",
      "verifiedOnly": "Тільки перевірені"
    },
    "sort": {
      "newest": "Спочатку нові",
      "highest": "Спочатку висока оцінка"
    }
  }
}
```

## API Contract

### Review Object

```typescript
interface Review {
  id: number
  tutor_id: number
  student_id: number
  student_name?: string
  rating: 1 | 2 | 3 | 4 | 5
  text: string
  is_anonymous: boolean
  is_verified: boolean
  helpful_count: number
  tutor_response?: {
    text: string
    created_at: string
  }
  created_at: string
  can_edit: boolean
  can_delete: boolean
}
```

### ReviewStats

```typescript
interface ReviewStats {
  average_rating: number
  total_reviews: number
  distribution: {
    5: number
    4: number
    3: number
    2: number
    1: number
  }
  verified_count: number
}
```

## Тестування

```bash
# Unit tests для store
npm test -- reviewsStore

# Всі тести модуля
npm test -- src/modules/reviews
```

## Інтеграція з Backend

Backend реалізовано в `apps/reviews/`:
- `ReviewService` - бізнес-логіка
- `Review` model - зберігання
- `ReviewResponse` model - відповіді тьюторів
- REST API endpoints - `/v1/reviews/*`

## Troubleshooting

### Відгук не створюється
- Перевірте `canReviewData` - чи є `can_review: true`
- Перевірте довжину тексту (мін. 50 символів)
- Перевірте наявність завершених занять

### Не відображається рейтинг
- Перевірте наявність `tutorStats` в store
- Перевірте API endpoint `/v1/reviews/tutor/:id/stats/`

### Помилка редагування
- Відгук можна редагувати тільки протягом 24 годин
- Перевірте поле `can_edit` в об'єкті Review
