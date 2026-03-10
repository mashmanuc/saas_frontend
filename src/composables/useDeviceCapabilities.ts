import { ref, computed, onMounted, onUnmounted } from 'vue'

export function useDeviceCapabilities() {
  const hasTouch = ref(false)
  const isLandscape = ref(false)
  const pixelRatio = ref(1)

  function updateOrientation() {
    if (typeof window === 'undefined') return
    isLandscape.value = window.innerWidth > window.innerHeight
  }

  function onOrientationChange() {
    setTimeout(updateOrientation, 100)
  }

  onMounted(() => {
    hasTouch.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    pixelRatio.value = window.devicePixelRatio || 1
    updateOrientation()
    window.addEventListener('resize', updateOrientation, { passive: true })
    window.addEventListener('orientationchange', onOrientationChange)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateOrientation)
    window.removeEventListener('orientationchange', onOrientationChange)
  })

  const isCoarsePointer = computed(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  })

  return {
    hasTouch,
    isLandscape,
    pixelRatio,
    isCoarsePointer,
  }
}
