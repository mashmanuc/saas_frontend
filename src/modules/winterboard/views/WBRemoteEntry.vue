<template>
  <WBRemoteView v-if="showRemote" :id="id" />
  <WBRemoteConnectPage v-else @open-here="openHere" />
</template>

<script setup lang="ts">
/**
 * Один маршрут — два вигляди (ТЗ Салюта TZ_REMOTE_DESKTOP_CONNECT_2026-09-22 §2.1).
 * Телефон / планшет (лише дотик) → пульт без змін; комп'ютер → «Підключити телефон».
 *
 * Рішення — один раз при вході: вигляд не перемикається посеред роботи, коли
 * вчитель торкнувся тачскріна чи взяв перо.
 */
import { ref } from 'vue'
import { trackEvent } from '@/utils/telemetryAgent'
import { useDeviceMode } from '../composables/useDeviceMode'
import { isRemoteDevice, remoteForcedHere, forceRemoteHere } from '../remote/remoteEntry'
import WBRemoteView from './WBRemoteView.vue'
import WBRemoteConnectPage from './WBRemoteConnectPage.vue'

defineProps<{ id?: string }>()

const device = useDeviceMode()
const showRemote = ref(
  remoteForcedHere() ||
  isRemoteDevice({
    isTouchInput: device.isTouchInput.value,
    hasMultipleInputModes: device.hasMultipleInputModes.value,
  }),
)

/** «Все одно відкрити пульт тут» — до кінця вкладки. */
function openHere(): void {
  forceRemoteHere()
  try { trackEvent('wb.remote.open_here', {}) } catch { /* телеметрія не критична */ }
  showRemote.value = true
}
</script>
