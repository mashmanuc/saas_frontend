import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  BoardSyncManager,
  BoardOperation,
  VectorClock,
  createBoardSyncManager,
  OPERATION_TYPE,
  OBJECT_TYPE,
} from '../../src/core/board/boardSync'

describe('Board Sync v2', () => {
  describe('VectorClock', () => {
    it('creates clock with node ID', () => {
      const clock = new VectorClock('node1')
      expect(clock.nodeId).toBe('node1')
      expect(clock.clock).toEqual({})
    })

    it('increments correctly', () => {
      const clock = new VectorClock('node1')
      clock.increment()
      expect(clock.clock.node1).toBe(1)
      clock.increment()
      expect(clock.clock.node1).toBe(2)
    })

    it('merges clocks correctly', () => {
      const clock1 = new VectorClock('node1', { node1: 2, node2: 1 })
      const clock2 = new VectorClock('node2', { node1: 1, node2: 3 })

      clock1.merge(clock2)

      expect(clock1.clock.node1).toBe(2)
      expect(clock1.clock.node2).toBe(3)
    })

    it('detects happens-before relationship', () => {
      const clock1 = new VectorClock('node1', { node1: 1 })
      const clock2 = new VectorClock('node2', { node1: 2 })

      expect(clock1.happensBefore(clock2)).toBe(true)
      expect(clock2.happensBefore(clock1)).toBe(false)
    })

    it('detects concurrent events', () => {
      const clock1 = new VectorClock('node1', { node1: 2, node2: 1 })
      const clock2 = new VectorClock('node2', { node1: 1, node2: 2 })

      expect(clock1.concurrent(clock2)).toBe(true)
    })
  })

  describe('BoardOperation', () => {
    it('creates operation with required fields', () => {
      const op = new BoardOperation(OPERATION_TYPE.ADD, 'obj1', { x: 10, y: 20 })

      expect(op.type).toBe(OPERATION_TYPE.ADD)
      expect(op.objectId).toBe('obj1')
      expect(op.data).toEqual({ x: 10, y: 20 })
      expect(op.id).toBeDefined()
      expect(op.timestamp).toBeDefined()
    })

    it('serializes to JSON', () => {
      const op = new BoardOperation(OPERATION_TYPE.ADD, 'obj1', { x: 10 }, {
        id: 'op1',
        userId: 'user1',
        version: 5,
      })

      const json = op.toJSON()

      expect(json.id).toBe('op1')
      expect(json.type).toBe(OPERATION_TYPE.ADD)
      expect(json.objectId).toBe('obj1')
      expect(json.userId).toBe('user1')
      expect(json.version).toBe(5)
    })

    it('deserializes from JSON', () => {
      const json = {
        id: 'op1',
        type: OPERATION_TYPE.UPDATE,
        objectId: 'obj1',
        data: { color: 'red' },
        timestamp: 12345,
        userId: 'user1',
        version: 3,
      }

      const op = BoardOperation.fromJSON(json)

      expect(op.id).toBe('op1')
      expect(op.type).toBe(OPERATION_TYPE.UPDATE)
      expect(op.data.color).toBe('red')
    })
  })

  describe('BoardSyncManager', () => {
    let manager

    beforeEach(() => {
      manager = createBoardSyncManager({
        nodeId: 'test-node',
      })
    })

    describe('createOperation', () => {
      it('creates and applies local operation', () => {
        const op = manager.createOperation(OPERATION_TYPE.ADD, 'obj1', {
          type: OBJECT_TYPE.STROKE,
          x: 10,
          y: 20,
        })

        expect(op.type).toBe(OPERATION_TYPE.ADD)
        expect(manager.objects.has('obj1')).toBe(true)
        expect(manager.version).toBe(1)
      })

      it('increments vector clock', () => {
        manager.createOperation(OPERATION_TYPE.ADD, 'obj1', {})
        manager.createOperation(OPERATION_TYPE.ADD, 'obj2', {})

        expect(manager.vectorClock.clock['test-node']).toBe(2)
      })
    })

    describe('applyOperation', () => {
      it('applies ADD operation', () => {
        const op = new BoardOperation(OPERATION_TYPE.ADD, 'obj1', {
          type: OBJECT_TYPE.SHAPE,
          x: 100,
        })

        const result = manager.applyOperation(op)

        expect(result).toBe(true)
        expect(manager.objects.get('obj1').x).toBe(100)
      })

      it('applies UPDATE operation with LWW', () => {
        // Add object first
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.ADD, 'obj1', {
          color: 'blue',
        }, { timestamp: 1000 }))

        // Update with newer timestamp
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.UPDATE, 'obj1', {
          color: 'red',
        }, { timestamp: 2000 }))

        expect(manager.objects.get('obj1').color).toBe('red')
      })

      it('rejects UPDATE with older timestamp', () => {
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.ADD, 'obj1', {
          color: 'blue',
        }, { timestamp: 2000 }))

        manager.applyOperation(new BoardOperation(OPERATION_TYPE.UPDATE, 'obj1', {
          color: 'red',
        }, { timestamp: 1000 }))

        expect(manager.objects.get('obj1').color).toBe('blue')
      })

      it('applies DELETE operation', () => {
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.ADD, 'obj1', {}))
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.DELETE, 'obj1', {}))

        expect(manager.objects.has('obj1')).toBe(false)
        expect(manager.tombstones.has('obj1')).toBe(true)
      })

      it('prevents resurrection of deleted objects', () => {
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.DELETE, 'obj1', {}))
        const result = manager.applyOperation(new BoardOperation(OPERATION_TYPE.ADD, 'obj1', {}))

        expect(result).toBe(false)
        expect(manager.objects.has('obj1')).toBe(false)
      })

      it('applies MOVE operation', () => {
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.ADD, 'obj1', {
          x: 0, y: 0,
        }, { timestamp: 1000 }))

        manager.applyOperation(new BoardOperation(OPERATION_TYPE.MOVE, 'obj1', {
          x: 100, y: 200,
        }, { timestamp: 2000 }))

        const obj = manager.objects.get('obj1')
        expect(obj.x).toBe(100)
        expect(obj.y).toBe(200)
      })

      it('applies CLEAR operation', () => {
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.ADD, 'obj1', {}))
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.ADD, 'obj2', {}))
        manager.applyOperation(new BoardOperation(OPERATION_TYPE.CLEAR, null, {}))

        expect(manager.objects.size).toBe(0)
      })

      it('skips already applied operations', () => {
        const op = new BoardOperation(OPERATION_TYPE.ADD, 'obj1', {}, { id: 'op1' })

        manager.applyOperation(op)
        const result = manager.applyOperation(op)

        expect(result).toBe(false)
      })
    })

    describe('getSnapshot', () => {
      it('returns current state', () => {
        manager.createOperation(OPERATION_TYPE.ADD, 'obj1', { x: 10 })
        manager.createOperation(OPERATION_TYPE.ADD, 'obj2', { x: 20 })

        const snapshot = manager.getSnapshot()

        expect(snapshot.version).toBe(2)
        expect(snapshot.objects).toHaveLength(2)
      })
    })

    describe('loadSnapshot', () => {
      it('restores state from snapshot', () => {
        const snapshot = {
          version: 5,
          objects: [
            { id: 'obj1', x: 10 },
            { id: 'obj2', x: 20 },
          ],
          tombstones: ['obj3'],
        }

        manager.loadSnapshot(snapshot)

        expect(manager.version).toBe(5)
        expect(manager.objects.size).toBe(2)
        expect(manager.tombstones.has('obj3')).toBe(true)
      })
    })

    describe('handleVersionMismatch', () => {
      it('resets state and applies server state', () => {
        manager.createOperation(OPERATION_TYPE.ADD, 'local1', {})

        manager.handleVersionMismatch(10, {
          objects: [{ id: 'server1', x: 100 }],
        })

        expect(manager.version).toBe(10)
        expect(manager.objects.has('local1')).toBe(false)
        expect(manager.objects.has('server1')).toBe(true)
      })
    })

    describe('getPendingOps', () => {
      it('returns pending operations', () => {
        manager.createOperation(OPERATION_TYPE.ADD, 'obj1', {})
        manager.createOperation(OPERATION_TYPE.ADD, 'obj2', {})

        const pending = manager.getPendingOps()

        expect(pending).toHaveLength(2)
      })
    })

    describe('acknowledgeSynced', () => {
      it('removes acknowledged operations', () => {
        const op1 = manager.createOperation(OPERATION_TYPE.ADD, 'obj1', {})
        manager.createOperation(OPERATION_TYPE.ADD, 'obj2', {})

        manager.acknowledgeSynced([op1.id])

        expect(manager.getPendingOps()).toHaveLength(1)
      })
    })
  })

  describe('OPERATION_TYPE', () => {
    it('has all expected types', () => {
      expect(OPERATION_TYPE.ADD).toBe('add')
      expect(OPERATION_TYPE.UPDATE).toBe('update')
      expect(OPERATION_TYPE.DELETE).toBe('delete')
      expect(OPERATION_TYPE.MOVE).toBe('move')
      expect(OPERATION_TYPE.TRANSFORM).toBe('transform')
      expect(OPERATION_TYPE.CLEAR).toBe('clear')
    })
  })

  describe('OBJECT_TYPE', () => {
    it('has all expected types', () => {
      expect(OBJECT_TYPE.STROKE).toBe('stroke')
      expect(OBJECT_TYPE.SHAPE).toBe('shape')
      expect(OBJECT_TYPE.TEXT).toBe('text')
      expect(OBJECT_TYPE.IMAGE).toBe('image')
      expect(OBJECT_TYPE.STICKY).toBe('sticky')
    })
  })
})
