import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useSelection } from './useSelection'
import type { Stroke, Shape, TextElement } from '../types/solo'

describe('useSelection', () => {
  let strokes: ReturnType<typeof ref<Stroke[]>>
  let shapes: ReturnType<typeof ref<Shape[]>>
  let texts: ReturnType<typeof ref<TextElement[]>>

  beforeEach(() => {
    strokes = ref<Stroke[]>([
      {
        id: 'stroke-1',
        tool: 'pen',
        color: '#000000',
        size: 5,
        opacity: 1,
        points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
      },
      {
        id: 'stroke-2',
        tool: 'pen',
        color: '#ff0000',
        size: 5,
        opacity: 1,
        points: [{ x: 100, y: 100 }, { x: 150, y: 150 }],
      },
    ])

    shapes = ref<Shape[]>([
      {
        id: 'shape-1',
        type: 'rectangle',
        color: '#0000ff',
        size: 2,
        x: 200,
        y: 200,
        width: 100,
        height: 50,
      },
      {
        id: 'shape-2',
        type: 'circle',
        color: '#00ff00',
        size: 2,
        x: 400,
        y: 400,
        radius: 30,
      },
    ])

    texts = ref<TextElement[]>([
      {
        id: 'text-1',
        type: 'text',
        text: 'Hello',
        x: 500,
        y: 500,
        color: '#000000',
        fontSize: 16,
        width: 80,
        height: 24,
      },
    ])
  })

  describe('initialization', () => {
    it('should initialize with empty selection', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      expect(selection.selectedIds.value.size).toBe(0)
      expect(selection.mode.value).toBe('none')
      expect(selection.boundingBox.value).toBeNull()
    })

    it('should compute selectable items from all sources', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      expect(selection.selectableItems.value).toHaveLength(5)
    })
  })

  describe('selectItem', () => {
    it('should select single item', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('stroke-1')

      expect(selection.selectedIds.value.size).toBe(1)
      expect(selection.isSelected('stroke-1')).toBe(true)
    })

    it('should replace selection when addToSelection is false', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('stroke-1')
      selection.selectItem('stroke-2', false)

      expect(selection.selectedIds.value.size).toBe(1)
      expect(selection.isSelected('stroke-1')).toBe(false)
      expect(selection.isSelected('stroke-2')).toBe(true)
    })

    it('should add to selection when addToSelection is true', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('stroke-1')
      selection.selectItem('stroke-2', true)

      expect(selection.selectedIds.value.size).toBe(2)
      expect(selection.isSelected('stroke-1')).toBe(true)
      expect(selection.isSelected('stroke-2')).toBe(true)
    })

    it('should toggle selection when item already selected with addToSelection', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('stroke-1')
      selection.selectItem('stroke-1', true) // Toggle off

      expect(selection.selectedIds.value.size).toBe(0)
    })
  })

  describe('deselectAll', () => {
    it('should clear all selections', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('stroke-1')
      selection.selectItem('shape-1', true)
      selection.deselectAll()

      expect(selection.selectedIds.value.size).toBe(0)
      expect(selection.mode.value).toBe('none')
    })
  })

  describe('selectAll', () => {
    it('should select all items', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectAll()

      expect(selection.selectedIds.value.size).toBe(5)
    })
  })

  describe('boundingBox', () => {
    it('should compute bounding box for selected items', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('shape-1') // Rectangle at 200,200 with 100x50

      const box = selection.boundingBox.value

      expect(box).not.toBeNull()
      expect(box!.x).toBe(200)
      expect(box!.y).toBe(200)
      expect(box!.width).toBe(100)
      expect(box!.height).toBe(50)
    })

    it('should compute combined bounding box for multiple items', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('shape-1') // 200,200 100x50
      selection.selectItem('shape-2', true) // Circle at 400,400 r=30 → bounds 370,370 60x60

      const box = selection.boundingBox.value

      expect(box).not.toBeNull()
      // Should encompass both shapes
      expect(box!.x).toBe(200)
      expect(box!.y).toBe(200)
      expect(box!.width).toBe(230) // 430 - 200
      expect(box!.height).toBe(230) // 430 - 200
    })
  })

  describe('resizeHandles', () => {
    it('should return 8 resize handles when items selected', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('shape-1')

      expect(selection.resizeHandles.value).toHaveLength(8)
    })

    it('should return empty array when nothing selected', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      expect(selection.resizeHandles.value).toHaveLength(0)
    })

    it('should have correct handle ids', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('shape-1')

      const handleIds = selection.resizeHandles.value.map(h => h.id)
      expect(handleIds).toContain('nw')
      expect(handleIds).toContain('n')
      expect(handleIds).toContain('ne')
      expect(handleIds).toContain('e')
      expect(handleIds).toContain('se')
      expect(handleIds).toContain('s')
      expect(handleIds).toContain('sw')
      expect(handleIds).toContain('w')
    })
  })

  describe('rectangle selection', () => {
    it('should start rectangle selection', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.startRectSelection({ x: 0, y: 0 })

      expect(selection.mode.value).toBe('rect')
      expect(selection.selectionRect.value).not.toBeNull()
    })

    it('should update rectangle during selection', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.startRectSelection({ x: 0, y: 0 })
      selection.updateRectSelection({ x: 100, y: 100 }, { x: 0, y: 0 })

      expect(selection.selectionRect.value).toEqual({
        x: 0,
        y: 0,
        w: 100,
        h: 100,
      })
    })

    it('should select items inside rectangle on end', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      // Select area containing stroke-1 (points at 10,10 to 50,50)
      selection.startRectSelection({ x: 0, y: 0 })
      selection.updateRectSelection({ x: 60, y: 60 }, { x: 0, y: 0 })
      selection.endRectSelection()

      expect(selection.selectedIds.value.has('stroke-1')).toBe(true)
      expect(selection.mode.value).toBe('none')
    })
  })

  describe('lasso selection', () => {
    it('should start lasso selection', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.startLassoSelection({ x: 0, y: 0 })

      expect(selection.mode.value).toBe('lasso')
      expect(selection.lassoPoints.value).toHaveLength(1)
    })

    it('should add points during lasso', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.startLassoSelection({ x: 0, y: 0 })
      selection.updateLassoSelection({ x: 50, y: 0 })
      selection.updateLassoSelection({ x: 50, y: 50 })
      selection.updateLassoSelection({ x: 0, y: 50 })

      expect(selection.lassoPoints.value).toHaveLength(4)
    })
  })

  describe('move selection', () => {
    it('should start move operation', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('shape-1')
      selection.startMove({ x: 250, y: 225 })

      expect(selection.mode.value).toBe('move')
    })

    it('should calculate move updates', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('shape-1')
      selection.startMove({ x: 250, y: 225 })

      const updates = selection.calculateMoveUpdates({ x: 260, y: 235 }, true)

      expect(updates).toHaveLength(1)
      expect(updates[0].id).toBe('shape-1')
      expect(updates[0].type).toBe('shape')
    })
  })

  describe('resize selection', () => {
    it('should start resize operation', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('shape-1')
      selection.startResize('se', { x: 300, y: 250 })

      expect(selection.mode.value).toBe('resize')
      expect(selection.resizeHandle.value).toBe('se')
    })
  })

  describe('deleteSelected', () => {
    it('should return IDs of selected items', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('stroke-1')
      selection.selectItem('shape-1', true)
      selection.selectItem('text-1', true)

      const result = selection.deleteSelected()

      expect(result.strokes).toContain('stroke-1')
      expect(result.shapes).toContain('shape-1')
      expect(result.texts).toContain('text-1')
    })

    it('should clear selection after delete', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('stroke-1')
      selection.deleteSelected()

      expect(selection.selectedIds.value.size).toBe(0)
    })
  })

  describe('hit testing', () => {
    it('should detect point in bounding box', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      selection.selectItem('shape-1') // 200,200 100x50

      expect(selection.isPointInBoundingBox({ x: 250, y: 225 })).toBe(true)
      expect(selection.isPointInBoundingBox({ x: 0, y: 0 })).toBe(false)
    })

    it('should get item at point', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      const item = selection.getItemAtPoint({ x: 250, y: 225 })

      expect(item).not.toBeNull()
      expect(item!.id).toBe('shape-1')
    })

    it('should return null when no item at point', () => {
      const selection = useSelection(
        computed(() => strokes.value),
        computed(() => shapes.value),
        computed(() => texts.value)
      )

      const item = selection.getItemAtPoint({ x: 1000, y: 1000 })

      expect(item).toBeNull()
    })
  })
})
