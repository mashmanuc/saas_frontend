import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useClassroomLayoutStore } from '../classroomLayoutStore'

describe('classroomLayoutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('should initialize with correct default values', () => {
      const store = useClassroomLayoutStore()

      expect(store.verticalLayoutEnabled).toBe(false)
      expect(store.taskDockState).toBe('hidden')
      expect(store.sidebarCollapsed).toBe(false)
    })
  })

  describe('enableVerticalLayout', () => {
    it('should enable vertical layout and collapse sidebar', () => {
      const store = useClassroomLayoutStore()

      store.enableVerticalLayout()

      expect(store.verticalLayoutEnabled).toBe(true)
      expect(store.sidebarCollapsed).toBe(true)
    })
  })

  describe('disableVerticalLayout', () => {
    it('should disable vertical layout and expand sidebar', () => {
      const store = useClassroomLayoutStore()
      store.enableVerticalLayout()

      store.disableVerticalLayout()

      expect(store.verticalLayoutEnabled).toBe(false)
      expect(store.sidebarCollapsed).toBe(false)
    })
  })

  describe('toggleTaskDock', () => {
    it('should cycle through hidden -> peek -> expanded -> hidden', () => {
      const store = useClassroomLayoutStore()

      expect(store.taskDockState).toBe('hidden')

      store.toggleTaskDock()
      expect(store.taskDockState).toBe('peek')

      store.toggleTaskDock()
      expect(store.taskDockState).toBe('expanded')

      store.toggleTaskDock()
      expect(store.taskDockState).toBe('hidden')
    })
  })

  describe('setTaskDockState', () => {
    it('should set task dock state directly', () => {
      const store = useClassroomLayoutStore()

      store.setTaskDockState('expanded')
      expect(store.taskDockState).toBe('expanded')

      store.setTaskDockState('peek')
      expect(store.taskDockState).toBe('peek')

      store.setTaskDockState('hidden')
      expect(store.taskDockState).toBe('hidden')
    })
  })

  describe('collapseSidebar / expandSidebar', () => {
    it('should collapse sidebar', () => {
      const store = useClassroomLayoutStore()

      store.collapseSidebar()
      expect(store.sidebarCollapsed).toBe(true)
    })

    it('should expand sidebar', () => {
      const store = useClassroomLayoutStore()
      store.collapseSidebar()

      store.expandSidebar()
      expect(store.sidebarCollapsed).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      const store = useClassroomLayoutStore()

      store.enableVerticalLayout()
      store.setTaskDockState('expanded')

      store.reset()

      expect(store.verticalLayoutEnabled).toBe(false)
      expect(store.taskDockState).toBe('hidden')
      expect(store.sidebarCollapsed).toBe(false)
    })
  })
})
