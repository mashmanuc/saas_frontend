# Calendar E2E Suite

Dedicated home for calendar-focused Playwright specs (event modal, navigation, availability, etc.).

## Guidelines

1. **Scope** — only calendar domain tests that may mutate data (edit/delete lessons, slots, etc.).
2. **Environment** — run on staging/local with `CALENDAR_DISABLE_RATE_LIMIT=1` to avoid throttling the runner.
3. **Data/bootstrap** — seed auth + calendar fixtures via scripts before running the suite.
4. **Parallelism** — keep specs serial (one worker) to avoid data contention.
