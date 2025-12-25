import { ref, computed } from 'vue'

export interface Command<T = any> {
  execute(): Promise<T>
  undo(): Promise<T>
  redo?(): Promise<T>
  description: string
}

export interface CommandHistory {
  past: Command[]
  future: Command[]
}

export function useUndoRedo() {
  const history = ref<CommandHistory>({
    past: [],
    future: []
  })

  const canUndo = computed(() => history.value.past.length > 0)
  const canRedo = computed(() => history.value.future.length > 0)

  const lastCommand = computed(() => {
    const past = history.value.past
    return past.length > 0 ? past[past.length - 1] : null
  })

  async function executeCommand<T>(command: Command<T>): Promise<T> {
    const result = await command.execute()
    
    // Add to history
    history.value.past.push(command)
    
    // Clear future (redo stack) when new command is executed
    history.value.future = []
    
    return result
  }

  async function undo(): Promise<void> {
    if (!canUndo.value) {
      throw new Error('Nothing to undo')
    }

    const command = history.value.past.pop()!
    await command.undo()
    
    // Add to future (redo stack)
    history.value.future.push(command)
  }

  async function redo(): Promise<void> {
    if (!canRedo.value) {
      throw new Error('Nothing to redo')
    }

    const command = history.value.future.pop()!
    
    // Use redo method if available, otherwise use execute
    if (command.redo) {
      await command.redo()
    } else {
      await command.execute()
    }
    
    // Add back to past
    history.value.past.push(command)
  }

  function clear() {
    history.value.past = []
    history.value.future = []
  }

  function getHistory() {
    return {
      past: [...history.value.past],
      future: [...history.value.future]
    }
  }

  return {
    canUndo,
    canRedo,
    lastCommand,
    executeCommand,
    undo,
    redo,
    clear,
    getHistory
  }
}
