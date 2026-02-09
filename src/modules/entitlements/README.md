# Entitlements Module (Feature Gates)

## Overview

Модуль прав доступу відповідає за управління функціональними можливостями користувачів на основі їхнього тарифного плану в M4SH Platform.

**Source of Truth:** Backend API (`/v1/entitlements/*`)

---

## Architecture

### Store

**Location:** `src/modules/entitlements/stores/entitlementsStore.ts`

**Store ID:** `entitlements`

**Invariants:**
1. Store НЕ обчислює features локально — тільки читає з backend
2. Кешування з TTL 5 хвилин для зменшення API calls
3. Grace period tracking з можливістю acknowledge
4. Trial period detection та відображення

### API Client

**Location:** `src/modules/entitlements/api/entitlements.ts`

**Endpoints:**
- `GET /v1/entitlements/me/` — поточні права користувача
- `GET /v1/entitlements/features/{feature}/check/` — перевірка конкретної функції
- `POST /v1/entitlements/grace/acknowledge/` — підтвердження grace period

**Contract:** DOMAIN-06 Entitlements

### Components

**Views:**
- `PlanFeaturesView.vue` — сторінка функцій плану (`/dashboard/plan-features`)

**Components:**
- `GraceBanner.vue` — банер grace period з відліком
- `FeatureGate.vue` — умовний рендеринг на основі прав
- `PlanCard.vue` — картка тарифного плану

### Composables

**Location:** `src/modules/entitlements/composables/useFeatureGate.ts`

- `useFeatureGate(feature)` — перевірка доступу до однієї функції
- `useFeatureGateMultiple(features[])` — перевірка доступу до множини функцій
- `useFeatureGateAny(features[])` — перевірка доступу хоча б до однієї

---

## Usage

### Import Store

```typescript
import { useEntitlementsStore } from '@/modules/entitlements/stores/entitlementsStore'

const entitlementsStore = useEntitlementsStore()
```

### Check Feature Access

```typescript
// Перевірити доступ до функції
const hasAnalytics = await entitlementsStore.checkFeature('analytics_advanced')

// Або через computed (з кешу)
const canUseAdvancedAnalytics = entitlementsStore.canUseFeature('analytics_advanced')
```

### Fetch Entitlements

```typescript
// Завантажити всі права (з кешуванням)
await entitlementsStore.fetchEntitlements()

// Примусове оновлення
await entitlementsStore.fetchEntitlements(true)
```

### Access Plan Info

```typescript
// Computed properties
entitlementsStore.currentPlan        // 'free' | 'basic' | 'pro' | 'business'
entitlementsStore.isInGracePeriod    // boolean
entitlementsStore.isTrialing         // boolean
entitlementsStore.daysRemaining      // number

// Ліміти
entitlementsStore.maxContactsPerMonth  // number
entitlementsStore.maxStudents          // number
entitlementsStore.maxStorageGb         // number
entitlementsStore.analyticsLevel       // 'basic' | 'advanced' | 'full'
```

### Grace Period Handling

```typescript
// Перевірка grace period
if (entitlementsStore.isInGracePeriod && entitlementsStore.shouldShowGraceBanner) {
  // Показати банер grace period
}

// Підтвердження grace period (закриття банера)
await entitlementsStore.acknowledgeGrace()
```

### Feature Gate Component

```vue
<template>
  <FeatureGate feature="analytics_advanced">
    <template #default>
      <AdvancedAnalyticsDashboard />
    </template>
    <template #locked>
      <UpgradePrompt feature="analytics_advanced" />
    </template>
  </FeatureGate>
</template>

<script setup>
import { FeatureGate } from '@/modules/entitlements'
</script>
```

### Composable Usage

```typescript
import { useFeatureGate } from '@/modules/entitlements'

const { granted, loading, error } = useFeatureGate('unlimited_contacts')

// Декларативний доступ
watch(granted, (isGranted) => {
  if (isGranted) {
    enableUnlimitedContacts()
  }
})
```

---

## Testing

### Unit Tests

**Location:** `src/modules/entitlements/stores/__tests__/entitlementsStore.spec.ts`

**Coverage:**
- fetchEntitlements() — успішне завантаження, кешування, force refresh
- checkFeature() — перевірка з кешу, API call при необхідності
- canUseFeature() — доступ на основі entitlements
- isInGracePeriod / isTrialing — визначення статусу
- daysRemaining — розрахунок днів
- acknowledgeGrace() — підтвердження grace period
- getters — maxContactsPerMonth, maxStudents, etc.

**Run tests:**
```bash
npm test -- entitlementsStore
```

---

## Integration with Backend

### API Contract

**UserEntitlements:**
```typescript
{
  plan: string
  status: 'active' | 'trialing' | 'grace_period' | 'expired' | 'none'
  features: {
    [featureName: string]: {
      feature: string
      granted: boolean
      reason: 'active_subscription' | 'trial' | 'grace_period' | 'none' | 'expired'
    }
  }
  limits: {
    max_contacts_per_month: number
    max_students: number
    max_storage_gb: number
    analytics_level: 'basic' | 'advanced' | 'full'
  }
  grace_period?: {
    started_at: string
    ends_at: string
    days_remaining: number
  }
  trial?: {
    started_at: string
    ends_at: string
    days_remaining: number
  }
}
```

**EntitlementCheck:**
```typescript
{
  feature: string
  granted: boolean
  reason: 'active_subscription' | 'trial' | 'grace_period' | 'none' | 'expired'
}
```

---

## Routes

| Route | Component | Meta | Description |
|-------|-----------|------|-------------|
| `/dashboard/plan-features` | PlanFeaturesView.vue | requiresAuth | Функції поточного плану |

---

## Feature List

| Feature | Free | Basic | Pro | Business |
|-----------|:--:|:--:|:--:|:--:|
| `basic_analytics` | ✅ | ✅ | ✅ | ✅ |
| `analytics_advanced` | ❌ | ❌ | ✅ | ✅ |
| `unlimited_contacts` | ❌ | ❌ | ✅ | ✅ |
| `priority_support` | ❌ | ❌ | ❌ | ✅ |
| `custom_branding` | ❌ | ❌ | ❌ | ✅ |
| `api_access` | ❌ | ❌ | ❌ | ✅ |

---

## Troubleshooting

### Feature Not Available

```typescript
// Перевірка чи точно функція не доступна
const check = await entitlementsStore.checkFeature('some_feature')
console.log(check.reason) // 'none', 'expired', 'active_subscription', etc.
```

### Grace Period Not Showing

```typescript
// Перевірка чи був grace period визнаний
console.log(entitlementsStore.graceAcknowledged)

// Скидання acknowledge (для тестування)
entitlementsStore.graceAcknowledged = false
```

---

## i18n Keys

**Namespace:** `entitlements`

```yaml
entitlements:
  features:
    title: "Можливості тарифу"
    included: "Включено"
    upgradeRequired: "Потрібне оновлення"
    graceAlert: "Grace period закінчується через {days} днів"
  grace:
    title: "Grace Period"
    message: "Ваша підписка закінчилась..."
  locked:
    title: "Функція недоступна"
```

---

## Version

**Version:** v1.0.0  
**Domain:** DOMAIN-06 Entitlements  
**Last Updated:** 2026-02-08
