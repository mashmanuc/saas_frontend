// ReplayV2: SnapshotProvider — abstraction між engine і data source.
// Engine transport-agnostic: не знає про auth/public/token.
//
// INV-V2-4: NullSnapshotProvider = pure noop, zero HTTP.

import type { ReplaySnapshot } from '../../types/replay'

/**
 * Контракт для постачальника snapshots у Replay V2.
 * Реалізації: AuthSnapshotProvider, PublicSnapshotProvider (future), NullSnapshotProvider.
 */
export interface ReplaySnapshotProvider {
  /**
   * Знайти найближчий snapshot at-or-before targetSeq.
   * Повертає null якщо snapshot недоступний — composable fallback на full apply.
   */
  fetchNearest(targetSeq: number): Promise<ReplaySnapshot | null>
}

/**
 * NullSnapshotProvider — pure noop.
 * Завжди повертає null → composable використовує V1-сумісний full apply.
 *
 * INV-V2-4: НЕ робить жодних HTTP запитів.
 * Використання: анонімні public users, тести, явний fallback.
 */
export class NullSnapshotProvider implements ReplaySnapshotProvider {
  fetchNearest(_targetSeq: number): Promise<ReplaySnapshot | null> {
    return Promise.resolve(null)
  }
}
