/**
 * useSnapshotRecovery composable (v0.85.0)
 * Single point for snapshot recovery logic
 */

import { ref, computed, onUnmounted } from 'vue'
import type { OpsAckPayload, ResyncResponse } from '@/core/whiteboard/adapters/RealtimeAdapter'

export interface SnapshotRecoveryState {
  isRecovering: boolean
  lastSnapshotVersion: number
  pendingCount: number
}

export function useSnapshotRecovery() {
  const isRecovering = ref(false)
  const lastSnapshotVersion = ref(0)
  const pendingOpsCount = ref(0)
  
  const state = computed<SnapshotRecoveryState>(() => ({
    isRecovering: isRecovering.value,
    lastSnapshotVersion: lastSnapshotVersion.value,
    pendingCount: pendingOpsCount.value
  }))
  
  /**
   * Handle ops acknowledgment
   */
  function handleOpsAck(payload: OpsAckPayload): void {
    pendingOpsCount.value = Math.max(0, pendingOpsCount.value - payload.opIds.length)
    console.log(`[useSnapshotRecovery] Acknowledged ${payload.opIds.length} operations`)
  }
  
  /**
   * Handle resync response
   */
  function handleResync(payload: ResyncResponse): void {
    isRecovering.value = true
    lastSnapshotVersion.value = payload.snapshot.version
    
    console.log(`[useSnapshotRecovery] Resync received: snapshot v${payload.snapshot.version}, ${payload.operations.length} operations`)
    
    // Recovery complete after applying
    setTimeout(() => {
      isRecovering.value = false
    }, 100)
  }
  
  /**
   * Handle version conflict
   */
  function handleVersionConflict(pageId: string, currentVersion: number): void {
    console.warn(`[useSnapshotRecovery] Version conflict on page ${pageId}, server version: ${currentVersion}`)
    isRecovering.value = true
  }
  
  /**
   * Track pending operation
   */
  function trackPendingOp(): void {
    pendingOpsCount.value++
  }
  
  /**
   * Reset state
   */
  function reset(): void {
    isRecovering.value = false
    lastSnapshotVersion.value = 0
    pendingOpsCount.value = 0
  }
  
  onUnmounted(() => {
    reset()
  })
  
  return {
    state,
    isRecovering,
    lastSnapshotVersion,
    pendingOpsCount,
    handleOpsAck,
    handleResync,
    handleVersionConflict,
    trackPendingOp,
    reset
  }
}
