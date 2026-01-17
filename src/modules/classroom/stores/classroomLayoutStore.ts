import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type TaskDockState = 'hidden' | 'peek' | 'expanded'
export type LayoutMode = 'board-only' | 'board-with-tasks'

export const useClassroomLayoutStore = defineStore('classroom-layout', () => {
  // v0.92.1: verticalLayoutEnabled більше НЕ впливає на vertical layout у ClassroomWhiteboardHost
  // Vertical layout визначається виключно VITE_VERTICAL_LAYOUT + dev-workspace-* prefix
  // Цей ref залишено для backward compatibility, але він ігнорується для prod workspace
  const verticalLayoutEnabled = ref(false)
  const taskDockState = ref<TaskDockState>('hidden')
  const sidebarCollapsed = ref(false)
  
  // v0.93.1: Layout mode для Winterboard (Board only vs Board + Tasks)
  const layoutMode = ref<LayoutMode>('board-only')

  /**
   * @deprecated v0.92.1: Ця функція більше не вмикає vertical layout для prod workspace.
   * Vertical layout контролюється виключно через VITE_VERTICAL_LAYOUT env + dev-workspace-* prefix.
   * Див. LAW-11, LAW-13 у MANIFEST_Winterboard.md
   */
  function enableVerticalLayout() {
    console.warn(
      '[WINTERBOARD] enableVerticalLayout() is deprecated in v0.92.1. ' +
      'Vertical layout is now controlled exclusively by VITE_VERTICAL_LAYOUT + dev-workspace-* prefix.'
    )
    verticalLayoutEnabled.value = true
    sidebarCollapsed.value = true
  }

  /**
   * @deprecated v0.92.1: Див. enableVerticalLayout()
   */
  function disableVerticalLayout() {
    verticalLayoutEnabled.value = false
    sidebarCollapsed.value = false
  }

  function toggleTaskDock() {
    if (taskDockState.value === 'hidden') {
      taskDockState.value = 'peek'
    } else if (taskDockState.value === 'peek') {
      taskDockState.value = 'expanded'
    } else {
      taskDockState.value = 'hidden'
    }
  }

  function setTaskDockState(state: TaskDockState) {
    taskDockState.value = state
  }

  function collapseSidebar() {
    sidebarCollapsed.value = true
  }

  function expandSidebar() {
    sidebarCollapsed.value = false
  }

  // v0.93.1: Layout mode functions
  function setLayoutMode(mode: LayoutMode) {
    layoutMode.value = mode
    // Автоматично показуємо/ховаємо TaskDock при зміні режиму
    if (mode === 'board-with-tasks') {
      taskDockState.value = 'expanded'
    } else {
      taskDockState.value = 'hidden'
    }
  }

  function toggleLayoutMode() {
    if (layoutMode.value === 'board-only') {
      setLayoutMode('board-with-tasks')
    } else {
      setLayoutMode('board-only')
    }
  }

  function reset() {
    verticalLayoutEnabled.value = false
    taskDockState.value = 'hidden'
    sidebarCollapsed.value = false
    layoutMode.value = 'board-only'
  }

  return {
    verticalLayoutEnabled,
    taskDockState,
    sidebarCollapsed,
    layoutMode,
    enableVerticalLayout,
    disableVerticalLayout,
    toggleTaskDock,
    setTaskDockState,
    setLayoutMode,
    toggleLayoutMode,
    collapseSidebar,
    expandSidebar,
    reset
  }
})
