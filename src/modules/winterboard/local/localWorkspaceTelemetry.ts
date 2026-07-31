// Local Workspace — телеметрія воронки гостя (рішення власника 2026-07-16).
//
// Namespace: `wb.local.*`. Пайплайн — ІСНУЮЧИЙ telemetryAgent (буфер → батч →
// POST /v1/telemetry/events): endpoint приймає анонімів (user_id=null,
// AnonRateThrottle 10/min/IP), FE-агент флашить раз на 10с — вписуємось.
//
// LAW §15: це АНАЛІТИКА продукту, не персистентність даних дошки — дозволений
// виняток (задокументовано у SYSTEM_LAW §15, рішення власника 2026-07-16).
//
// Анонімний ID: UUID у localStorage (`m4sh:anon-id`), БЕЗ PII. Чіпляється до
// кожної події гостя; `handoff_imported` стріляє вже автентифікованим →
// рядок має і user_id, і anon_id → повна атрибуція конверсії гість→юзер.

import { trackEvent } from '@/utils/telemetryAgent'

const ANON_ID_KEY = 'm4sh:anon-id'

/** Воронка гостя — повний перелік подій (дока = код). */
export type LocalTelemetryEvent =
  | 'workspace_opened'      // {first_visit, returning, has_content}
  | 'seed_shown'            // подарунок згенеровано (лише перший візит)
  | 'engaged'               // перша змістовна дія (штрих/об'єкт) — раз за сесію
  | 'tool_used'             // {kind} — раз на kind за сесію
  | 'upsell_shown'          // {variant: share|invite|export|media|generic}
  | 'upsell_cta'            // {variant} — клік «Зареєструватися» у модалі
  | 'connect_cloud_clicked' // хедер [Підключити хмару]
  | 'login_clicked'         // хедер «Увійти»
  | 'language_changed'      // {lang}
  | 'handoff_imported'      // {ok, ops_count} — 🏁 конверсія (стріляє authed)

export function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(ANON_ID_KEY, id)
    }
    return id
  } catch {
    // localStorage недоступний (private mode) — події все одно шлемо, без stitch-ID
    return 'anon-unavailable'
  }
}

/** Відправити подію воронки. Ніколи не кидає (телеметрія не ламає UX). */
export function trackLocal(
  event: LocalTelemetryEvent,
  context: Record<string, unknown> = {},
): void {
  try {
    trackEvent(`wb.local.${event}`, {
      anon_id: getAnonId(),
      ...context,
    })
  } catch {
    // telemetry never throws
  }
}

// ── Session-scoped dedupe (per page load) ────────────────────────────────────
// `engaged` — одна подія за завантаження; `tool_used` — одна на kind.

let _engagedSent = false
const _toolsSent = new Set<string>()

/** Перша змістовна дія + інструмент. Викликати на кожен content-op — сам дедупить. */
export function trackEngagement(kind: string): void {
  if (!_engagedSent) {
    _engagedSent = true
    trackLocal('engaged', { first_kind: kind })
  }
  if (!_toolsSent.has(kind)) {
    _toolsSent.add(kind)
    trackLocal('tool_used', { kind })
  }
}

/** Test-only: скинути session-dedupe. */
export function _resetLocalTelemetryDedupe(): void {
  _engagedSent = false
  _toolsSent.clear()
}

// ── Scene metric (North Ship Phase 1, блок A): `wb.scene.*` ───────────────────
// Сцени — живі об'єкти дошки (графік/планіметрія/стерео/3D/триг-коло);
// міряємо ЛИШЕ AI-шлях (створено/відредаговано командою Інтегралика).
// Транспорт — той самий telemetryAgent (буфер→батч→POST /v1/telemetry/events,
// LAW §15 Rule 2). `via:'integralyk'` захардкоджено в props у v1 — розріз
// ui|integralyk існує з дня 1 (ROADMAP §4.4).
export function trackScene(
  event: 'created' | 'word_edit',
  props: { kind: string; via?: string; op?: string },
): void {
  try {
    trackEvent(`wb.scene.${event}`, { via: 'integralyk', ...props })
  } catch {
    // telemetry never throws
  }
}
