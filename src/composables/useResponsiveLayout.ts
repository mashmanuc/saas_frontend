import { ref, computed, onMounted, onUnmounted } from 'vue'

const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  display: 1920,
} as const

type BreakpointKey = keyof typeof BREAKPOINTS

export function useResponsiveLayout() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)

  let rafId: number | null = null

  function onResize() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      width.value = window.innerWidth
      rafId = null
    })
  }

  function onOrientationChange() {
    setTimeout(() => { width.value = window.innerWidth }, 100)
  }

  onMounted(() => {
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('orientationchange', onOrientationChange)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onOrientationChange)
    if (rafId) cancelAnimationFrame(rafId)
  })

  const currentBreakpoint = computed<BreakpointKey>(() => {
    const w = width.value
    if (w < BREAKPOINTS.xs) return 'xs'
    if (w < BREAKPOINTS.sm) return 'sm'
    if (w < BREAKPOINTS.md) return 'md'
    if (w < BREAKPOINTS.lg) return 'lg'
    if (w < BREAKPOINTS.xl) return 'xl'
    if (w < BREAKPOINTS['2xl']) return '2xl'
    return 'display'
  })

  const isMobile = computed(() => width.value < BREAKPOINTS.md)        // < 768
  const isTablet = computed(() => width.value >= BREAKPOINTS.md && width.value < BREAKPOINTS.lg) // 768-1024
  const isDesktop = computed(() => width.value >= BREAKPOINTS.lg)      // >= 1024
  const isWide = computed(() => width.value >= BREAKPOINTS['2xl'])     // >= 1536
  const isDisplay = computed(() => width.value >= BREAKPOINTS.display) // >= 1920

  return {
    width,
    currentBreakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isDisplay,
    BREAKPOINTS,
  }
}
