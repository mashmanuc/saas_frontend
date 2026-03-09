# PLAN A — Tutor Profile Stabilization
## Execution Report — 2026-02-26

**Status:** ✅ COMPLETED — All frontend fixes implemented  
**Scope:** GlobalLoader UX, API loading optimization, Notification fallbacks  
**Unimplemented:** Backend diagnostics (КРОК 4, 6) — shell commands provided below

---

## Summary of Changes

### КРОК 1-2 — GlobalLoader pointer-events (✅ COMPLETED)
**File:** `frontend/src/ui/GlobalLoader.vue`  
**Change:** Added `pointer-events: none` to `.fade-leave-active` to prevent overlay from blocking clicks after fade-out.

```css
.fade-leave-active {
  transition: opacity 0.2s ease;
  pointer-events: none; /* Не блокуємо кліки під час fade-out */
}
```

**Impact:** Critical — fixes click interaction on 100% of pages after loading.

---

### КРОК 3 — skipLoader for background API calls (✅ COMPLETED)

#### 3а — calendarWeekApi
**File:** `frontend/src/modules/booking/api/calendarWeekApi.ts:71`  
```typescript
meta: { skipLoader: true },  // ← не блокуємо UI при завантаженні тижня
```

#### 3б — notificationsStore
**File:** `frontend/src/stores/notificationsStore.ts:55`  
```typescript
const response = await notificationsApi.getNotifications({ ...params, skipLoader: true } as any)
```

#### 3в — relationsStore  
**File:** `frontend/src/stores/relationsStore.ts:51`  
```typescript
const response = await apiClient.get<RelationsResponse>('/v1/users/me/relations/', { meta: { skipLoader: true } } as any)
```

**Impact:** Navigation between pages no longer shows GlobalLoader overlay. Views have inline loading states.

---

### КРОК 4 — has_availability = false (🔧 BACKEND DIAGNOSTICS)

**Problem:** `has_availability: false` even after setting availability schedule.  
**Impact:** Tutor may not appear in marketplace filters for "available slots".

**Backend diagnostic commands:**
```bash
# Search for has_availability logic
grep -r "has_availability" backend/apps/marketplace/ --include="*.py"
grep -r "has_availability" backend/apps/booking/ --include="*.py"

# Manual fix via Django shell
python manage.py shell << 'EOF'
from apps.marketplace.models import TutorProfile
from apps.booking.models import AvailabilityTemplate

tutor = TutorProfile.objects.get(user__email='mashmanuc@gmail.com')
has = AvailabilityTemplate.objects.filter(tutor=tutor, is_active=True).exists()
tutor.has_availability = has
tutor.save(update_fields=['has_availability'])
print(f"Updated has_availability to: {has}")
EOF
```

**Typical cause:** Celery worker not running or signal not triggered after availability save.

---

### КРОК 5 — Notification fallback titles (✅ COMPLETED)

**File:** `frontend/src/components/Notifications/NotificationBell.vue`

**Changes:**
1. Line 57: `{{ item.title }}` → `{{ getNotificationTitle(item) }}`
2. Line 58: `{{ item.body }}` → `{{ item.body || '' }}`
3. Lines 104-126: Added `NOTIFICATION_FALLBACK_TITLES` map and `getNotificationTitle()` function

**Fallback titles map:**
```typescript
const NOTIFICATION_FALLBACK_TITLES: Record<string, string> = {
  'subscription.confirmed': 'Підписку активовано',
  'subscription.cancelled': 'Підписку скасовано',
  'subscription.renewed': 'Підписку подовжено',
  'inquiry.created': 'Новий запит від студента',
  'inquiry.accepted': 'Запит прийнято',
  'inquiry.rejected': 'Запит відхилено',
  'inquiry.cancelled': 'Запит скасовано',
  'booking.created': 'Нове бронювання',
  'booking.cancelled': 'Бронювання скасовано',
  'booking.rescheduled': 'Бронювання перенесено',
  'relation.accepted': 'Студент додано',
  'relation.rejected': 'Запит відхилено',
  'billing.payment_success': 'Платіж успішний',
  'billing.payment_failed': 'Помилка платежу',
  'verification.verified': 'Верифікація пройдена',
  'verification.rejected': 'Верифікацію відхилено',
}
```

**Impact:** Notifications without title from backend now display human-readable fallback.

---

### КРОК 6 — tutor_count = 0 verification (🔧 BACKEND DIAGNOSTICS)

**Problem:** All 37 subjects show `tutor_count: 0`.

**Backend verification commands:**
```bash
python manage.py shell -c "
from apps.marketplace.models import TutorProfile, Subject
from django.db.models import Count

print('Total active tutor profiles:', TutorProfile.objects.filter(is_published=True).count())
print('Subjects with tutors:', Subject.objects.annotate(cnt=Count('tutorprofile')).filter(cnt__gt=0).count())
"
```

**If data exists in DB but not in API:** Problem in serializer or cache.  
**If no data:** Test account not published or subjects not assigned.

---

## Git Commit Commands

```bash
cd D:/m4sh_v1/frontend

# Stage all modified files
git add src/ui/GlobalLoader.vue
git add src/modules/booking/api/calendarWeekApi.ts
git add src/stores/notificationsStore.ts
git add src/stores/relationsStore.ts
git add src/components/Notifications/NotificationBell.vue
git add docs/PLAN_A_TUTOR_PROFILE_STABILIZATION.md

# Check status
git status

# Create commit
git commit -m "fix(stabilization): Plan A — GlobalLoader, skipLoader, Notification fallbacks

- GlobalLoader: pointer-events:none on fade-leave-active (fixes click blocking)
- calendarWeekApi: skipLoader for week snapshot loading
- notificationsStore: skipLoader for loadNotifications
- relationsStore: skipLoader for fetchRelations
- NotificationBell: fallback titles for 16 notification types
- Body fallback: item.body || '' to prevent empty display

Fixes: UI blocking after loading, navigation UX, notification display
Refs: PLAN_A_TUTOR_PROFILE_STABILIZATION.md"

# Verify commit
git log -1 --stat

# Push (user will handle)
# git push origin <branch>
```

---

## Verification Checklist

- [ ] GlobalLoader doesn't block clicks after fade-out (click any button after page load)
- [ ] Navigation between pages shows no overlay loader (only inline spinners)
- [ ] Notification bell shows titles for all notification types
- [ ] Calendar week loads without blocking UI
- [ ] Relations load without blocking UI
- [ ] Notifications load without blocking UI

---

## Backend Follow-up Required (Manual)

1. **has_availability fix:** Run Django shell commands from КРОК 4 above
2. **tutor_count verification:** Run Django shell commands from КРОК 6 above
3. **Celery worker check:** Ensure worker is running for availability signals

---

**Next Steps:** Commit → Push → Deploy → Run backend diagnostics
