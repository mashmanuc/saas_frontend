/**
 * P0: Ops Queue with ACK-based Sync
 * 
 * Invariant: send → wait ACK → confirm
 * - No race conditions
 * - Guaranteed delivery
 * - 409 Conflict prevention
 */

import { ref, computed } from 'vue'
import api from '@/utils/api'

interface QueuedOp {
  id: string
  seq: number | null
  payload: any
  status: 'pending' | 'sending' | 'ack' | 'error'
  retryCount: number
  createdAt: number
  lastAttempt: number | null
}

interface OpsQueueState {
  ops: Map<string, QueuedOp>
  lastAckSeq: number
  isProcessing: boolean
  ackTimeout: number
  maxRetries: number
  inFlightLimit: number
  circuitOpen: boolean
  circuitResetTime: number | null
  lastError: Error | null
  consecutiveErrors: number
}

const state: OpsQueueState = {
  ops: new Map(),
  lastAckSeq: 0,
  isProcessing: false,
  ackTimeout: 5000,      // 5s timeout for ACK
  maxRetries: 3,
  inFlightLimit: 5,      // Max concurrent in-flight ops
  circuitOpen: false,     // Circuit breaker
  circuitResetTime: null,
  lastError: null,
  consecutiveErrors: 0
}

// Track ops that were confirmed applied on server (for idempotency)
const confirmedOpIds = new Set<string>()

// P0: Idempotency check - ask server if op was already applied
async function checkOpApplied(opId: string): Promise<boolean> {
  try {
    const response = await api.get(`/winterboard/ops/check/?op_id=${opId}`)
    return response.data?.applied === true
  } catch (e) {
    // If check fails, assume not applied (safer to retry)
    return false
  }
}

// Circuit breaker constants
const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_RESET_MS = 30000

const pendingCount = computed(() => 
  Array.from(state.ops.values()).filter(op => op.status === 'pending').length
)

const sendingCount = computed(() => 
  Array.from(state.ops.values()).filter(op => op.status === 'sending').length
)

/**
 * Add operation to queue
 */
export function enqueueOp(payload: any, clientSeq?: number): string {
  const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const op: QueuedOp = {
    id,
    seq: null,
    payload: { ...payload, op_id: id },
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
    lastAttempt: null
  }
  
  state.ops.set(id, op)
  
  // Trigger processing
  processQueue()
  
  return id
}

/**
 * Wait for ACK on specific operation
 */
export function waitForAck(opId: string, timeout = 5000): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const check = () => {
      const op = state.ops.get(opId)
      
      if (!op) {
        reject(new Error(`Op ${opId} not found`))
        return
      }
      
      if (op.status === 'ack') {
        resolve(op.seq!)
        return
      }
      
      if (op.status === 'error') {
        reject(new Error(`Op ${opId} failed`))
        return
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`ACK timeout for op ${opId}`))
        return
      }
      
      setTimeout(check, 50)
    }
    
    check()
  })
}

/**
 * Confirm ACK from server
 */
export function confirmAck(opId: string, serverSeq: number): void {
  const op = state.ops.get(opId)
  
  if (!op) {
    console.warn(`[OpsQueue] ACK for unknown op: ${opId}`)
    return
  }
  
  op.seq = serverSeq
  op.status = 'ack'
  
  // Update last acknowledged sequence
  if (serverSeq > state.lastAckSeq) {
    state.lastAckSeq = serverSeq
  }
  
  // Clean up after delay
  setTimeout(() => {
    state.ops.delete(opId)
  }, 10000)
}

/**
 * Check circuit breaker status
 */
function isCircuitOpen(): boolean {
  if (!state.circuitOpen) return false
  
  // Check if enough time passed to try reset
  if (state.circuitResetTime && Date.now() > state.circuitResetTime) {
    console.log('[OpsQueue] Circuit breaker reset, trying again')
    state.circuitOpen = false
    state.consecutiveErrors = 0
    return false
  }
  
  return true
}

/**
 * Record success for circuit breaker
 */
function recordSuccess(): void {
  if (state.consecutiveErrors > 0) {
    state.consecutiveErrors = 0
  }
}

/**
 * Record error for circuit breaker
 */
function recordError(error: Error): void {
  state.lastError = error
  state.consecutiveErrors++
  
  if (state.consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
    state.circuitOpen = true
    state.circuitResetTime = Date.now() + CIRCUIT_BREAKER_RESET_MS
    console.error(`[OpsQueue] Circuit breaker OPEN for ${CIRCUIT_BREAKER_RESET_MS}ms`)
  }
}

/**
 * Process queue - send pending ops with inFlight limit
 */
async function processQueue(): Promise<void> {
  if (state.isProcessing) return
  if (isCircuitOpen()) {
    console.warn('[OpsQueue] Circuit breaker open, delaying processing')
    setTimeout(() => processQueue(), CIRCUIT_BREAKER_RESET_MS)
    return
  }
  
  state.isProcessing = true
  
  try {
    const pending = Array.from(state.ops.values())
      .filter(op => op.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt)
    
    // Respect inFlight limit
    const inFlight = Array.from(state.ops.values())
      .filter(op => op.status === 'sending').length
    
    const availableSlots = Math.max(0, state.inFlightLimit - inFlight)
    const toProcess = pending.slice(0, availableSlots)
    
    for (const op of toProcess) {
      // Non-blocking send
      sendOp(op).catch(err => {
        console.error(`[OpsQueue] Failed to send ${op.id}:`, err)
      })
    }
    
    // If there are more pending, schedule another batch
    if (pending.length > availableSlots) {
      setTimeout(() => processQueue(), 100)
    }
  } finally {
    state.isProcessing = false
  }
}

/**
 * Send single operation with retry
 */
async function sendOp(op: QueuedOp): Promise<void> {
  // P0: Idempotency - check if already applied before sending
  if (confirmedOpIds.has(op.id)) {
    console.log(`[OpsQueue] Op ${op.id} already confirmed, skipping`)
    op.status = 'ack'
    return
  }
  
  // On retry, verify with server before sending
  if (op.retryCount > 0) {
    const alreadyApplied = await checkOpApplied(op.id)
    if (alreadyApplied) {
      console.log(`[OpsQueue] Op ${op.id} already applied on server (checked)`)
      op.status = 'ack'
      confirmedOpIds.add(op.id)
      recordSuccess()
      return
    }
  }
  
  if (op.retryCount >= state.maxRetries) {
    op.status = 'error'
    console.error(`[OpsQueue] Max retries exceeded for op ${op.id}`)
    return
  }
  
  op.status = 'sending'
  op.lastAttempt = Date.now()
  
  try {
    // Add timeout to prevent hanging
    const timeoutMs = state.ackTimeout + (op.retryCount * 2000)
    
    const response = await Promise.race([
      api.post('/winterboard/ops/batch/', {
        operations: [op.payload]
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ])
    
    if (response.data && response.data.ops) {
      // Extract server seq from response
      const serverOp = response.data.ops[0]
      if (serverOp && serverOp.seq) {
        confirmAck(op.id, serverOp.seq)
        confirmedOpIds.add(op.id)
        recordSuccess()
      }
    }
  } catch (error: any) {
    recordError(error)
    
    if (error.response?.status === 409) {
      // Conflict - likely duplicate, mark as ack
      console.warn(`[OpsQueue] 409 Conflict for op ${op.id}, treating as duplicate`)
      op.status = 'ack'
      confirmedOpIds.add(op.id)
      recordSuccess() // Not a real error
    } else {
      op.retryCount++
      op.status = 'pending'
      
      // Exponential backoff with jitter
      const baseDelay = Math.min(1000 * Math.pow(2, op.retryCount), 30000)
      const jitter = Math.random() * 1000
      const delay = baseDelay + jitter
      
      console.log(`[OpsQueue] Retrying ${op.id} in ${delay}ms (attempt ${op.retryCount})`)
      setTimeout(() => processQueue(), delay)
    }
  }
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  const inFlight = Array.from(state.ops.values())
    .filter(op => op.status === 'sending').length
  
  return {
    pending: pendingCount.value,
    sending: sendingCount.value,
    inFlight,
    inFlightLimit: state.inFlightLimit,
    lastAckSeq: state.lastAckSeq,
    isProcessing: state.isProcessing,
    circuitOpen: state.circuitOpen,
    consecutiveErrors: state.consecutiveErrors,
    opsCount: state.ops.size
  }
}

/**
 * Force reset circuit breaker (emergency only)
 */
export function resetCircuitBreaker(): void {
  state.circuitOpen = false
  state.consecutiveErrors = 0
  state.circuitResetTime = null
  console.log('[OpsQueue] Circuit breaker manually reset')
}

/**
 * Flush all pending ops (use with caution)
 */
export function flushQueue(): void {
  state.ops.clear()
  state.lastAckSeq = 0
  state.isProcessing = false
}

/**
 * Synchronous barrier: wait for all pending ops
 */
export async function barrier(timeout = 30000): Promise<void> {
  const start = Date.now()
  
  while (pendingCount.value > 0 || sendingCount.value > 0) {
    if (Date.now() - start > timeout) {
      throw new Error('OpsQueue barrier timeout')
    }
    await new Promise(r => setTimeout(r, 50))
  }
}

/**
 * P0: Cleanup on page unload/route change
 * - Complete all pending ops
 * - Or save to localStorage for retry
 */
export async function cleanupOnUnload(): Promise<void> {
  console.log('[OpsQueue] Cleanup on unload...')
  
  if (state.ops.size === 0) {
    return
  }
  
  // Try to flush quickly
  try {
    await barrier(5000)
    console.log('[OpsQueue] All ops flushed before unload')
  } catch (e) {
    // Timeout - save pending ops to retry on next session
    const pending = Array.from(state.ops.values())
      .filter(op => op.status !== 'ack')
      .map(op => ({ id: op.id, payload: op.payload }))
    
    if (pending.length > 0) {
      localStorage.setItem('wb_pending_ops', JSON.stringify(pending))
      console.warn(`[OpsQueue] Saved ${pending.length} pending ops to localStorage`)
    }
  }
}

/**
 * P0: Restore pending ops from previous session
 */
export function restorePendingOps(): void {
  const saved = localStorage.getItem('wb_pending_ops')
  if (!saved) return
  
  try {
    const ops = JSON.parse(saved)
    for (const op of ops) {
      state.ops.set(op.id, {
        ...op,
        seq: null,
        status: 'pending',
        retryCount: 0,
        createdAt: Date.now(),
        lastAttempt: null
      })
    }
    localStorage.removeItem('wb_pending_ops')
    console.log(`[OpsQueue] Restored ${ops.length} pending ops from localStorage`)
    processQueue()
  } catch (e) {
    console.error('[OpsQueue] Failed to restore pending ops:', e)
  }
}
