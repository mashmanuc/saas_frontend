// ReplayV2 Phase B: PublicSnapshotProvider — snapshots для анонімних public viewers.
//
// INV-V2-PUB-1: знає тільки (token, seq). НЕ знає sessionId, owner, userId.
//   token IS the ownership proof — не потрібен додатковий lookup.
//
// INV-V2-PUB-6: будь-яка помилка (404/429/timeout/malformed) → null →
//   composable fallback на full rAF apply. Replay НІКОЛИ не ламається.

import { fetchPublicNearestSnapshot } from '../../api/replay'
import type { ReplaySnapshotProvider } from './SnapshotProvider'
import type { ReplaySnapshot } from '../../types/replay'

/**
 * PublicSnapshotProvider — snapshot transport для anonymous public viewers.
 *
 * Використовується: коли `?replay=v2-public` і `publicToken` присутній.
 * Rollout: поступово, після BE endpoint stress-test.
 */
export class PublicSnapshotProvider implements ReplaySnapshotProvider {
  constructor(private readonly publicToken: string) {}

  fetchNearest(targetSeq: number): Promise<ReplaySnapshot | null> {
    // INV-V2-PUB-6: fetchPublicNearestSnapshot silent null при будь-якій помилці
    return fetchPublicNearestSnapshot(this.publicToken, targetSeq)
  }
}
