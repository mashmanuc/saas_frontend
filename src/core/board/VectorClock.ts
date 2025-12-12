// TASK FX1: Vector Clock BigInt Migration

/**
 * Vector Clock with BigInt support for long-running sessions.
 * Prevents overflow issues in collaborative editing scenarios.
 */
export class VectorClock {
  private nodeId: string
  private clock: Map<string, bigint>

  constructor(nodeId: string, initial: Record<string, number | bigint | string> = {}) {
    this.nodeId = nodeId
    this.clock = new Map()

    // Convert initial values to BigInt
    for (const [node, time] of Object.entries(initial)) {
      this.clock.set(node, BigInt(time))
    }
  }

  /**
   * Increment local clock and return a clone.
   */
  increment(): VectorClock {
    const current = this.clock.get(this.nodeId) || 0n
    this.clock.set(this.nodeId, current + 1n)
    return this.clone()
  }

  /**
   * Merge with another vector clock, taking max values.
   */
  merge(other: VectorClock | Record<string, number | bigint | string>): this {
    const otherClock =
      other instanceof VectorClock
        ? other.clock
        : new Map(Object.entries(other).map(([k, v]) => [k, BigInt(v)]))

    for (const [node, time] of otherClock) {
      const current = this.clock.get(node) || 0n
      this.clock.set(node, time > current ? time : current)
    }
    return this
  }

  /**
   * Check if this clock happens before another.
   */
  happensBefore(other: VectorClock): boolean {
    let atLeastOneLess = false
    const allNodes = new Set([...this.clock.keys(), ...other.clock.keys()])

    for (const node of allNodes) {
      const thisTime = this.clock.get(node) || 0n
      const otherTime = other.clock.get(node) || 0n

      if (thisTime > otherTime) return false
      if (thisTime < otherTime) atLeastOneLess = true
    }

    return atLeastOneLess
  }

  /**
   * Check if this clock is concurrent with another.
   */
  isConcurrent(other: VectorClock): boolean {
    return !this.happensBefore(other) && !other.happensBefore(this)
  }

  /**
   * Check if this clock equals another.
   */
  equals(other: VectorClock): boolean {
    if (this.clock.size !== other.clock.size) return false

    for (const [node, time] of this.clock) {
      if (other.clock.get(node) !== time) return false
    }
    return true
  }

  /**
   * Get time for a specific node.
   */
  getTime(nodeId: string): bigint {
    return this.clock.get(nodeId) || 0n
  }

  /**
   * Get local node time.
   */
  getLocalTime(): bigint {
    return this.clock.get(this.nodeId) || 0n
  }

  /**
   * Get node ID.
   */
  getNodeId(): string {
    return this.nodeId
  }

  /**
   * Clone this vector clock.
   */
  clone(): VectorClock {
    const cloned = new VectorClock(this.nodeId)
    for (const [node, time] of this.clock) {
      cloned.clock.set(node, time)
    }
    return cloned
  }

  /**
   * Serialize to JSON (string format for BigInt).
   */
  toJSON(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [node, time] of this.clock) {
      result[node] = time.toString()
    }
    return result
  }

  /**
   * Create from JSON.
   */
  static fromJSON(nodeId: string, json: Record<string, string>): VectorClock {
    const initial: Record<string, bigint> = {}
    for (const [node, time] of Object.entries(json)) {
      initial[node] = BigInt(time)
    }
    return new VectorClock(nodeId, initial)
  }

  /**
   * Create a new vector clock with initial time.
   */
  static create(nodeId: string): VectorClock {
    const clock = new VectorClock(nodeId)
    clock.clock.set(nodeId, 1n)
    return clock
  }
}

export default VectorClock
