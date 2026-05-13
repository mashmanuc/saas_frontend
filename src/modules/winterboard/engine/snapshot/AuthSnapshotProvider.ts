// ReplayV2: AuthSnapshotProvider — snapshots для авторизованих власників сесії.
//
// fetchNearestSnapshot повертає null при будь-якій помилці (401/403/404/network),
// тому додаткова обробка не потрібна — compose-level fallback спрацює.

import { fetchNearestSnapshot } from '../../api/replay'
import type { ReplaySnapshotProvider } from './SnapshotProvider'
import type { ReplaySnapshot } from '../../types/replay'

export class AuthSnapshotProvider implements ReplaySnapshotProvider {
  constructor(private readonly sessionId: string) {}

  fetchNearest(targetSeq: number): Promise<ReplaySnapshot | null> {
    // fetchNearestSnapshot: silent null при 401/403/404/network
    return fetchNearestSnapshot(this.sessionId, targetSeq)
  }
}
