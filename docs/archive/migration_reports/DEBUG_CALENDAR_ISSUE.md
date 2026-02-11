# Calendar Slots Not Showing - Debug Investigation

**Issue:** Tutor has slots in their calendar (Image 1), but student sees "Немає доступних слотів" (empty state) on marketplace (Image 2).

## Debug Steps Added

### 1. API Client Logging
Added console logs in `src/modules/marketplace/api/marketplace.ts`:
- Request parameters (tutorId, weekStart, timezone, URL)
- Response data structure

### 2. Component Logging
Added console logs in `src/modules/marketplace/components/TutorAvailabilityCalendar.vue`:
- API response structure (cells count, total slots)
- dayCells assignment verification
- hasAnySlots computed property result

## Expected Data Flow

```
Backend API Response:
{
  tutor_id: number,
  week_start: "2026-01-05",
  week_end: "2026-01-11",
  timezone: "Europe/Kyiv",
  horizon_weeks: 4,
  generated_at: "...",
  cells: [
    {
      date: "2026-01-06",
      day_status: "working",
      slots: [
        {
          slot_id: "...",
          start_at: "2026-01-06T10:00:00Z",
          duration_min: 60,
          status: "available"
        }
      ]
    }
  ]
}
```

## Possible Root Causes

1. **API returns empty cells array** - Backend not generating slots for marketplace endpoint
2. **Date mismatch** - weekStart calculation differs between tutor calendar and marketplace
3. **Timezone issues** - Slots filtered out due to timezone conversion
4. **Status filtering** - Only 'available' slots should show, others filtered
5. **Data transformation** - Response structure doesn't match expected interface

## Next Steps

**User needs to:**
1. Open browser DevTools (F12)
2. Navigate to tutor profile as student: `/marketplace/tutors/{slug}`
3. Check Console tab for debug logs:
   - `[marketplaceApi.getTutorCalendar] Request:`
   - `[marketplaceApi.getTutorCalendar] Response:`
   - `[TutorAvailabilityCalendar] API response:`
   - `[TutorAvailabilityCalendar] dayCells after assignment:`
4. Check Network tab:
   - Find request to `/api/v1/marketplace/tutors/{id}/calendar/`
   - Verify query params (start, week_start, tz, timezone)
   - Check response body - does it contain cells with slots?

## Expected Console Output

If working correctly:
```
[marketplaceApi.getTutorCalendar] Request: {tutorId: 79, weekStart: "2026-01-05", ...}
[marketplaceApi.getTutorCalendar] Response: {status: "success", data: {...}}
[TutorAvailabilityCalendar] API response: {cells_count: 7, total_slots: 15, ...}
[TutorAvailabilityCalendar] dayCells after assignment: {length: 7, hasAnySlots: true, ...}
```

If broken:
```
[TutorAvailabilityCalendar] API response: {cells_count: 7, total_slots: 0, ...}
[TutorAvailabilityCalendar] dayCells after assignment: {length: 7, hasAnySlots: false, ...}
```

## Files Modified for Debug

1. `src/modules/marketplace/api/marketplace.ts` - Added request/response logging
2. `src/modules/marketplace/components/TutorAvailabilityCalendar.vue` - Added data flow logging

## Hypothesis

Most likely: **Backend returns empty slots array** for marketplace endpoint while tutor's own calendar shows slots. This could be:
- Permission/visibility issue (marketplace endpoint filters differently)
- Different API endpoint used (tutor uses `/v1/calendar/week/`, marketplace uses `/v1/marketplace/tutors/{id}/calendar/`)
- Status filtering (only 'available' slots visible on marketplace, tutor sees all)

**Action Required:** User must provide console logs and network response to confirm root cause.
