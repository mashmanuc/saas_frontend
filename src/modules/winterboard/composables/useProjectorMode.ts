// WB: useProjectorMode — «Режим проєктора» для уроку в класі.
// Ref: saas_docs/domains/winterboard/CLASSROOM_REMOTE_VISION_2026-09-02.md, крок 2.
//
// Явний перемикач поверх useDisplayMode: учитель сам вмикає режим кнопкою,
// а не система вгадує його з розміру екрана. Увімкнено → повний екран,
// екран не засинає (wake lock), шапка ховається після 5 с бездіяльності
// й повертається від будь-якого дотику. Вимкнено → усе як було.
//
// Контрактів дошки (ops/presence) не чіпає: це лише вигляд на цьому пристрої.

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import type { DeviceMode } from '../types/responsive'
import { useDisplayMode } from './useDisplayMode'

export interface UseProjectorModeReturn {
  /** Режим увімкнено вчителем */
  enabled: Ref<boolean>
  /** Чи показувати шапку/панелі (false — сховані після бездіяльності) */
  uiVisible: Ref<boolean>
  /** Екран утримується від засинання */
  hasWakeLock: Ref<boolean>
  /** Ефективний device mode: 'display' поки режим увімкнено, інакше — вхідний */
  effectiveDeviceMode: ComputedRef<DeviceMode>
  enter: () => Promise<void>
  exit: () => Promise<void>
  toggle: () => Promise<void>
}

export function useProjectorMode(deviceMode: Ref<DeviceMode>): UseProjectorModeReturn {
  const enabled = ref(false)

  // 'display' лише поки вчитель тримає режим увімкненим. useDisplayMode сам
  // вмикає wake lock і автоховання, коли бачить 'display' (його watch).
  const effectiveDeviceMode = computed<DeviceMode>(() =>
    enabled.value ? 'display' : deviceMode.value,
  )

  const display = useDisplayMode(effectiveDeviceMode)

  async function enter(): Promise<void> {
    if (enabled.value) return
    enabled.value = true
    await display.enterFullscreen()
  }

  async function exit(): Promise<void> {
    if (!enabled.value) return
    enabled.value = false
    if (display.isFullscreen.value) await display.exitFullscreen()
  }

  async function toggle(): Promise<void> {
    if (enabled.value) await exit()
    else await enter()
  }

  // Esc або системний вихід із повного екрана = вихід із режиму: інакше
  // вчитель лишається зі схованою шапкою без очевидного способу повернути її.
  watch(display.isFullscreen, (isFs, wasFs) => {
    if (enabled.value && wasFs && !isFs) enabled.value = false
  })

  return {
    enabled,
    uiVisible: display.uiVisible,
    hasWakeLock: display.hasWakeLock,
    effectiveDeviceMode,
    enter,
    exit,
    toggle,
  }
}
