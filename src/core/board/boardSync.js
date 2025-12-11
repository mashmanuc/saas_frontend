/**
 * Board Sync v2 — v0.15.0
 * CRDT-like diff application, version mismatch recovery, partial redraw
 */

/**
 * Operation types for board sync
 */
export const OPERATION_TYPE = {
  ADD: 'add',
  UPDATE: 'update',
  DELETE: 'delete',
  MOVE: 'move',
  TRANSFORM: 'transform',
  CLEAR: 'clear',
}

/**
 * Object types on board
 */
export const OBJECT_TYPE = {
  STROKE: 'stroke',
  SHAPE: 'shape',
  TEXT: 'text',
  IMAGE: 'image',
  STICKY: 'sticky',
}

/**
 * Generate unique operation ID
 */
function generateOpId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Vector Clock for causality tracking
 */
export class VectorClock {
  constructor(nodeId, initial = {}) {
    this.nodeId = nodeId
    this.clock = { ...initial }
  }

  increment() {
    this.clock[this.nodeId] = (this.clock[this.nodeId] || 0) + 1
    return this.clone()
  }

  merge(other) {
    const otherClock = other instanceof VectorClock ? other.clock : other
    for (const [node, time] of Object.entries(otherClock)) {
      this.clock[node] = Math.max(this.clock[node] || 0, time)
    }
    return this
  }

  happensBefore(other) {
    const otherClock = other instanceof VectorClock ? other.clock : other
    let atLeastOneLess = false
    
    for (const node of new Set([...Object.keys(this.clock), ...Object.keys(otherClock)])) {
      const thisTime = this.clock[node] || 0
      const otherTime = otherClock[node] || 0
      
      if (thisTime > otherTime) return false
      if (thisTime < otherTime) atLeastOneLess = true
    }
    
    return atLeastOneLess
  }

  concurrent(other) {
    return !this.happensBefore(other) && !other.happensBefore(this)
  }

  clone() {
    return new VectorClock(this.nodeId, { ...this.clock })
  }

  toJSON() {
    return { ...this.clock }
  }
}

/**
 * Operation for board sync
 */
export class BoardOperation {
  constructor(type, objectId, data, options = {}) {
    this.id = options.id || generateOpId()
    this.type = type
    this.objectId = objectId
    this.data = data
    this.timestamp = options.timestamp || Date.now()
    this.userId = options.userId
    this.vectorClock = options.vectorClock
    this.version = options.version || 1
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      objectId: this.objectId,
      data: this.data,
      timestamp: this.timestamp,
      userId: this.userId,
      vectorClock: this.vectorClock?.toJSON?.() || this.vectorClock,
      version: this.version,
    }
  }

  static fromJSON(json) {
    return new BoardOperation(json.type, json.objectId, json.data, {
      id: json.id,
      timestamp: json.timestamp,
      userId: json.userId,
      vectorClock: json.vectorClock,
      version: json.version,
    })
  }
}

/**
 * Board State Manager with CRDT-like sync
 */
export class BoardSyncManager {
  constructor(options = {}) {
    this.nodeId = options.nodeId || generateOpId()
    this.vectorClock = new VectorClock(this.nodeId)
    this.objects = new Map()
    this.tombstones = new Set()
    this.pendingOps = []
    this.appliedOps = new Map()
    this.version = 0
    this.lastSyncVersion = 0
    
    // Callbacks
    this.onObjectAdded = options.onObjectAdded || (() => {})
    this.onObjectUpdated = options.onObjectUpdated || (() => {})
    this.onObjectDeleted = options.onObjectDeleted || (() => {})
    this.onPartialRedraw = options.onPartialRedraw || (() => {})
    this.onFullRedraw = options.onFullRedraw || (() => {})
    this.onVersionMismatch = options.onVersionMismatch || (() => {})
  }

  /**
   * Create local operation
   */
  createOperation(type, objectId, data) {
    this.vectorClock.increment()
    this.version++
    
    const op = new BoardOperation(type, objectId, data, {
      userId: this.nodeId,
      vectorClock: this.vectorClock.clone(),
      version: this.version,
    })
    
    this.pendingOps.push(op)
    this.applyOperation(op, true)
    
    return op
  }

  /**
   * Apply operation (local or remote)
   */
  applyOperation(op, isLocal = false) {
    // Skip if already applied
    if (this.appliedOps.has(op.id)) {
      return false
    }
    
    // Merge vector clock
    if (op.vectorClock) {
      this.vectorClock.merge(op.vectorClock)
    }
    
    let result = false
    const affectedRegion = null
    
    switch (op.type) {
      case OPERATION_TYPE.ADD:
        result = this.applyAdd(op)
        break
      case OPERATION_TYPE.UPDATE:
        result = this.applyUpdate(op)
        break
      case OPERATION_TYPE.DELETE:
        result = this.applyDelete(op)
        break
      case OPERATION_TYPE.MOVE:
        result = this.applyMove(op)
        break
      case OPERATION_TYPE.TRANSFORM:
        result = this.applyTransform(op)
        break
      case OPERATION_TYPE.CLEAR:
        result = this.applyClear(op)
        break
    }
    
    if (result) {
      this.appliedOps.set(op.id, op)
      
      if (!isLocal) {
        // Trigger partial redraw for remote operations
        this.onPartialRedraw(op.objectId, op.type)
      }
    }
    
    return result
  }

  /**
   * Apply ADD operation
   */
  applyAdd(op) {
    if (this.objects.has(op.objectId) || this.tombstones.has(op.objectId)) {
      return false
    }
    
    const object = {
      id: op.objectId,
      ...op.data,
      createdAt: op.timestamp,
      updatedAt: op.timestamp,
      createdBy: op.userId,
    }
    
    this.objects.set(op.objectId, object)
    this.onObjectAdded(object)
    
    return true
  }

  /**
   * Apply UPDATE operation with LWW (Last Writer Wins)
   */
  applyUpdate(op) {
    const existing = this.objects.get(op.objectId)
    if (!existing) return false
    
    // LWW: only apply if newer
    if (op.timestamp < existing.updatedAt) {
      return false
    }
    
    const updated = {
      ...existing,
      ...op.data,
      updatedAt: op.timestamp,
      updatedBy: op.userId,
    }
    
    this.objects.set(op.objectId, updated)
    this.onObjectUpdated(updated, existing)
    
    return true
  }

  /**
   * Apply DELETE operation
   */
  applyDelete(op) {
    if (!this.objects.has(op.objectId)) {
      // Still add to tombstones to prevent resurrection
      this.tombstones.add(op.objectId)
      return false
    }
    
    const deleted = this.objects.get(op.objectId)
    this.objects.delete(op.objectId)
    this.tombstones.add(op.objectId)
    this.onObjectDeleted(deleted)
    
    return true
  }

  /**
   * Apply MOVE operation
   */
  applyMove(op) {
    const existing = this.objects.get(op.objectId)
    if (!existing) return false
    
    if (op.timestamp < existing.updatedAt) {
      return false
    }
    
    const updated = {
      ...existing,
      x: op.data.x ?? existing.x,
      y: op.data.y ?? existing.y,
      updatedAt: op.timestamp,
      updatedBy: op.userId,
    }
    
    this.objects.set(op.objectId, updated)
    this.onObjectUpdated(updated, existing)
    
    return true
  }

  /**
   * Apply TRANSFORM operation
   */
  applyTransform(op) {
    const existing = this.objects.get(op.objectId)
    if (!existing) return false
    
    if (op.timestamp < existing.updatedAt) {
      return false
    }
    
    const updated = {
      ...existing,
      ...op.data,
      updatedAt: op.timestamp,
      updatedBy: op.userId,
    }
    
    this.objects.set(op.objectId, updated)
    this.onObjectUpdated(updated, existing)
    
    return true
  }

  /**
   * Apply CLEAR operation
   */
  applyClear(op) {
    const allIds = Array.from(this.objects.keys())
    
    for (const id of allIds) {
      this.tombstones.add(id)
    }
    
    this.objects.clear()
    this.onFullRedraw()
    
    return true
  }

  /**
   * Handle version mismatch
   */
  handleVersionMismatch(serverVersion, serverState) {
    console.warn(`[boardSync] version mismatch: local=${this.version}, server=${serverVersion}`)
    
    this.onVersionMismatch(this.version, serverVersion)
    
    // Full state sync
    this.objects.clear()
    this.tombstones.clear()
    this.appliedOps.clear()
    this.pendingOps = []
    
    // Apply server state
    if (serverState && Array.isArray(serverState.objects)) {
      for (const obj of serverState.objects) {
        this.objects.set(obj.id, obj)
      }
    }
    
    this.version = serverVersion
    this.lastSyncVersion = serverVersion
    
    this.onFullRedraw()
  }

  /**
   * Get pending operations for sync
   */
  getPendingOps() {
    return this.pendingOps.map(op => op.toJSON())
  }

  /**
   * Acknowledge synced operations
   */
  acknowledgeSynced(opIds) {
    this.pendingOps = this.pendingOps.filter(op => !opIds.includes(op.id))
    this.lastSyncVersion = this.version
  }

  /**
   * Get diff since version
   */
  getDiffSince(sinceVersion) {
    const ops = []
    
    for (const op of this.appliedOps.values()) {
      if (op.version > sinceVersion) {
        ops.push(op.toJSON())
      }
    }
    
    return ops.sort((a, b) => a.version - b.version)
  }

  /**
   * Get current state snapshot
   */
  getSnapshot() {
    return {
      version: this.version,
      objects: Array.from(this.objects.values()),
      tombstones: Array.from(this.tombstones),
    }
  }

  /**
   * Load state from snapshot
   */
  loadSnapshot(snapshot) {
    this.objects.clear()
    this.tombstones.clear()
    
    if (snapshot.objects) {
      for (const obj of snapshot.objects) {
        this.objects.set(obj.id, obj)
      }
    }
    
    if (snapshot.tombstones) {
      for (const id of snapshot.tombstones) {
        this.tombstones.add(id)
      }
    }
    
    this.version = snapshot.version || 0
    this.lastSyncVersion = this.version
    
    this.onFullRedraw()
  }

  /**
   * Get objects in region (for partial redraw)
   */
  getObjectsInRegion(x, y, width, height) {
    const result = []
    
    for (const obj of this.objects.values()) {
      if (this.objectIntersectsRegion(obj, x, y, width, height)) {
        result.push(obj)
      }
    }
    
    return result
  }

  /**
   * Check if object intersects region
   */
  objectIntersectsRegion(obj, rx, ry, rw, rh) {
    const ox = obj.x || 0
    const oy = obj.y || 0
    const ow = obj.width || 0
    const oh = obj.height || 0
    
    return !(ox + ow < rx || ox > rx + rw || oy + oh < ry || oy > ry + rh)
  }

  /**
   * Destroy manager
   */
  destroy() {
    this.objects.clear()
    this.tombstones.clear()
    this.appliedOps.clear()
    this.pendingOps = []
  }
}

/**
 * Create board sync manager
 */
export function createBoardSyncManager(options = {}) {
  return new BoardSyncManager(options)
}

export default {
  BoardSyncManager,
  BoardOperation,
  VectorClock,
  createBoardSyncManager,
  OPERATION_TYPE,
  OBJECT_TYPE,
}
