import { ref } from 'vue'

export interface ToastOptions {
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

interface Toast extends ToastOptions {
  id: number
  visible: boolean
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function useToast() {
  function show(options: ToastOptions) {
    const id = nextId++
    const toast: Toast = {
      id,
      message: options.message,
      type: options.type || 'info',
      duration: options.duration || 5000,
      visible: true,
    }
    
    toasts.value.push(toast)
    
    return id
  }
  
  function success(message: string, duration = 5000) {
    return show({ message, type: 'success', duration })
  }
  
  function error(message: string, duration = 7000) {
    return show({ message, type: 'error', duration })
  }
  
  function info(message: string, duration = 5000) {
    return show({ message, type: 'info', duration })
  }
  
  function warning(message: string, duration = 6000) {
    return show({ message, type: 'warning', duration })
  }
  
  function close(id: number) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }
  
  return {
    toasts,
    show,
    success,
    error,
    info,
    warning,
    close,
  }
}
