import { ref, onMounted, onUnmounted } from 'vue'

export function usePageVisibility() {
  const isVisible = ref(document.visibilityState === 'visible')

  const onChange = () => {
    isVisible.value = document.visibilityState === 'visible'
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onChange)
  })

  return {
    isVisible,
  }
}
