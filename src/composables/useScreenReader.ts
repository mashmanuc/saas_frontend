import { ref, watch } from 'vue'

export function useScreenReader() {
  const announcements = ref<string[]>([])
  const liveRegionRef = ref<HTMLElement | null>(null)

  function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    announcements.value.push(message)

    if (liveRegionRef.value) {
      liveRegionRef.value.setAttribute('aria-live', priority)
      liveRegionRef.value.textContent = message

      setTimeout(() => {
        if (liveRegionRef.value) {
          liveRegionRef.value.textContent = ''
        }
      }, 1000)
    }
  }

  function createLiveRegion() {
    const region = document.createElement('div')
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    region.className = 'sr-only'
    region.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `
    document.body.appendChild(region)
    liveRegionRef.value = region
  }

  function removeLiveRegion() {
    if (liveRegionRef.value) {
      document.body.removeChild(liveRegionRef.value)
      liveRegionRef.value = null
    }
  }

  return {
    announce,
    createLiveRegion,
    removeLiveRegion,
    announcements,
  }
}
