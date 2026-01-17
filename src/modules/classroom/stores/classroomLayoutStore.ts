import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type TaskDockState = 'hidden' | 'peek' | 'expanded'

export const useClassroomLayoutStore = defineStore('classroom-layout', () => {
  const verticalLayoutEnabled = ref(false)
  const taskDockState = ref<TaskDockState>('hidden')
  const sidebarCollapsed = ref(false)

  function enableVerticalLayout() {
    verticalLayoutEnabled.value = true
    sidebarCollapsed.value = true
  }

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

  function reset() {
    verticalLayoutEnabled.value = false
    taskDockState.value = 'hidden'
    sidebarCollapsed.value = false
  }

  return {
    verticalLayoutEnabled,
    taskDockState,
    sidebarCollapsed,
    enableVerticalLayout,
    disableVerticalLayout,
    toggleTaskDock,
    setTaskDockState,
    collapseSidebar,
    expandSidebar,
    reset
  }
})
