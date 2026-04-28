# PR — Winterboard Ops Reconstruction (or other backend work)

> **Якщо PR НЕ стосується winterboard ops / auth refresh / WS consumers** — скип checklist'и нижче і опиши зміни звичайним format'ом.
> **Якщо PR стосується** → ОБОВ'ЯЗКОВО заповнити секції нижче.

## Phase

Який Phase з [`saas_docs/domains/winterboard/ops_sync/RECONSTRUCTION_PLAN.md`](https://github.com/.../saas_docs/domains/winterboard/ops_sync/RECONSTRUCTION_PLAN.md)?

- [ ] Phase 0 — verification (curl checks)
- [ ] Phase 0.5 — documentation hardening
- [ ] Phase 0.6 — workflow hardening (PR template, sequential rule, reading scope)
- [ ] Phase 1.0 — OpsApplyService + WS handler removal
- [ ] Phase 1 — Backend (op_id NOT NULL + AUTH exp + protocol-version + 503)
- [ ] Phase 2 — Frontend (state machine + opsSyncStore + modals)
- [ ] Phase 3 — Cleanup PR3 hacks
- [ ] Phase 4 — Husky + CI gates per DEV_QUALITY_GATES
- [ ] Phase 5 — Invariant tests
- [ ] HARD CUT deploy
- [ ] Інше (не реконструкція): __________

## Pre-merge checklist (ALL required для winterboard ops PR)

### A. Documentation read
- [ ] Я прочитав `SYSTEM_LAW.md` секції relevantні моїм змінам (per "Required reading scope" у Plan)
- [ ] Я прочитав `OPS_SYNC_SSOT.md` invariants relevantні моїм змінам
- [ ] Я НЕ читав docs irrelevantні моїй phase (контекст-дисципліна)

### B. PROGRESS tracking (LAW §13 mandatory)
- [ ] `PROGRESS.md` Summary table оновлений (status цієї phase = `IN PROGRESS` або `DONE`)
- [ ] `PROGRESS.md` Event log містить event `started`/`completed` з timestamp + agent ID
- [ ] Якщо blocked — додано у "Active Blockers" + event `blocked` з reason

### C. Phase-specific invariants (відмітити ТІЛЬКИ ті що relevantні моїй phase)

**Phase 1.0 — OpsApplyService:**
- [ ] INV-7 SERVICE-ENTRYPOINT: усі writes у `WBSession.state` / `WBBoardOperation` через service. Грep gate passes.
- [ ] INV-8 NO-BYPASS: `WBSession.save()` guard з `_PROTECTED_FIELDS` token implemented
- [ ] INV-11 BROADCAST: `transaction.on_commit` для broadcast — НЕ inline у view
- [ ] INV-11: broadcast тільки якщо `applied_count > 0`
- [ ] INV-17 WS-STRICT: 4 WS write handlers видалені (`_handle_operation`, `_handle_session_lock`, `_handle_session_page`, `_handle_state_update`)

**Phase 1 — Backend:**
- [ ] AUTH: `RefreshView` повертає `{access, exp}` (Unix seconds, extracted з JWT payload)
- [ ] PROTOCOL VERSION: `require_protocol_version` decorator на 4 winterboard write endpoints
- [ ] 503: `nowait=True` + `DatabaseError` → 503 з `Retry-After` header (НЕ 409)
- [ ] INV-13 ATOMIC-APPLY: validation помилка → response `{error, invalid_op_index, reason}`, 0 ops applied
- [ ] INV-14 IDEMPOTENCY: all-duplicates batch → 201 з `last_seq` unchanged + NO broadcast
- [ ] INV-18 SEQ-INITIAL: new session GET /state → `last_seq=0`
- [ ] Migration `op_id NOT NULL` tested на staging БД з backup

**Phase 2 — Frontend:**
- [ ] State machine `SYNCED` ⇄ `DESYNC` ⇄ `BOOTSTRAP` implemented
- [ ] INV-12 503: max 2 attempts з jitter 100-500ms (або Retry-After header); drop on 2nd
- [ ] INV-15 CLIENT-SEQ-FILTER: client apply тільки `op.seq > localSeq`
- [ ] INV-16 STATE-MACHINE-HARD: `flush()` THROW у DESYNC; `record()` NO-OP у DESYNC; `sendBeacon()` THROW
- [ ] INV-19 MULTI-TAB: independent `localSeq` per tab; 409 → DESYNC immediately per tab
- [ ] INV-20 PROTOCOL VERSION: `X-Protocol-Version: v3` header у winterboard write requests; 400 PROTOCOL_VERSION_MISMATCH → blocking modal (undismissable, no auto-reload)
- [ ] DESYNC overlay text MUST be точно: "Reconnecting… changes temporarily paused"
- [ ] AUTH precise mode: `accessExp` parse з refresh response; precise guard `if (now > exp - 60s) → refresh`
- [ ] AUTH heuristic deprecation: detect `response.exp` → switch precise forever; precise mode → no fallback to heuristic

**Phase 3 — Cleanup:**
- [ ] PR3 hacks видалено: `MAX_LOCK_RETRIES`, `consecutive409`, `MAX_409_PER_SESSION`, `PAUSE_AFTER_CONSECUTIVE`
- [ ] PR4 FE recoverFromOverflow видалено
- [ ] Husky pre-push: `LEGACY=warn` → `LEGACY=block` (`sed -i 's/LEGACY_MODE=warn/LEGACY_MODE=block/'`)

**Phase 5 — Invariants:**
- [ ] Stub tests з Phase 0.5 заповнені реальними assertions (НЕ `assert True` placeholder)
- [ ] Кожен test перевіряє ОДИН invariant — не змішує
- [ ] FE tests з real mocks для apiClient (не trivially-passing)
- [ ] BE tests з Postgres service у CI (per DEV_QUALITY_GATES.md ssot-gates.yml)

### D. Tests + Regression (CRITICAL — added 2026-04-27)

- [ ] Усі нові tests passing локально (`pnpm vitest run` / `pytest -q`)
- [ ] Husky pre-push gate passes (0 NEW violations; legacy WARN OK)
- [ ] Якщо writing invariant test — assertions реально перевіряють behavior (не tautology)
- [ ] **FULL REGRESSION** — `pytest backend/apps/winterboard/` (BE) і/або `pnpm vitest run` (FE) — 0 unexpected failures.
  - **Якщо є EXPECTED failures** (legacy tests що тестують видалений код) → list їх у PR description "Expected breakage" section з explicit decision: **delete** the test file/case, OR **`@pytest.mark.skip(reason="...")`**, OR **migrate** до new endpoint test. НЕ можна "ignore — пройде".
  - **Якщо є ERRORS** (collection-time, ImportError, fixture failure) → MUST investigate root cause. ERRORS можуть блокувати **entire test files** silently. НЕ acceptable у PR.
- [ ] **API contract changes** explicitly документовані у PR description "Breaking changes" section.
  - Response shape change (e.g., field renamed/removed) → consumer audit (FE callsites, інші services).
  - Якщо breaking → atomic merge з consumer migration PR (per LAW §13 #6 Coordinator).
  - НЕ acceptable: silent shape change без mention у description.

### E. Coordination (LAW §13)
- [ ] Якщо PR залежить від іншого PR → `depends-on: #PR_NUM, blocks-on-merge` у description
- [ ] Якщо PR частина atomic group (Phase 1.0 + Phase 2 разом) — посилання на parent PR / умова merge order
- [ ] **MANDATORY MY-REVIEW:** PR призначений @agent-A (або іншому lead reviewer) — self-merge ЗАБОРОНЕНО до Phase 4 done

## Description

(Що змінено, чому, які edge cases враховані)

## Test plan

(Як перевірив локально / на staging)

## Rollback plan

(Як revert якщо щось зламається у production)

---

> **Reviewer (NOT author) MUST verify:** усі checked boxes відповідають реальному коду. Якщо хоч один box checked але код не відповідає → request changes.
