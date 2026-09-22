<template>
  <div v-if="showRemote" class="wb-remote-entry">
    <WBRemoteView :id="id" />
    <!-- Пульт на комп'ютері відкрито свідомо — лишаємо видимий шлях назад до
         пояснення: меню веде на цю саму адресу, і без цього виходу нема. -->
    <button v-if="!onRemoteDevice" type="button" class="wb-remote-entry__back" @click="showRemote = false">
      {{ t('winterboard.remote.connectPage.backToConnect') }}
    </button>
  </div>
  <WBRemoteConnectPage v-else @open-here="openHere" />
</template>

<script setup lang="ts">
/**
 * Один маршрут — два вигляди (ТЗ Салюта TZ_REMOTE_DESKTOP_CONNECT_2026-09-22 §2.1).
 * Телефон / планшет (лише дотик) → пульт без змін; комп'ютер → «Підключити телефон».
 *
 * Рішення — один раз при вході: вигляд не перемикається посеред роботи, коли
 * вчитель торкнувся тачскріна чи взяв перо.
 *
 * «Все одно відкрити пульт тут» діє ЛИШЕ на цей перегляд і не зберігається
 * (власник 2026-09-22): інакше кожен наступний вхід кидав у пульт повз
 * пояснення, і на ноутбуці лишалось «На ноутбуці не відкрита жодна дошка»
 * без дороги назад.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { trackEvent } from '@/utils/telemetryAgent'
import { useDeviceMode } from '../composables/useDeviceMode'
import { isRemoteDevice } from '../remote/remoteEntry'
import WBRemoteView from './WBRemoteView.vue'
import WBRemoteConnectPage from './WBRemoteConnectPage.vue'

defineProps<{ id?: string }>()

const { t } = useI18n()
const device = useDeviceMode()
const onRemoteDevice = isRemoteDevice({
  isTouchInput: device.isTouchInput.value,
  hasMultipleInputModes: device.hasMultipleInputModes.value,
})
const showRemote = ref(onRemoteDevice)

/** «Все одно відкрити пульт тут» — до виходу зі сторінки, без пам'яті. */
function openHere(): void {
  try { trackEvent('wb.remote.open_here', {}) } catch { /* телеметрія не критична */ }
  showRemote.value = true
}
</script>

<style scoped>
.wb-remote-entry { min-height: 100dvh; background: #0f172a; }
.wb-remote-entry__back {
  display: block; margin: 0 auto; padding: 12px 16px 24px;
  background: none; border: 0; color: #94a3b8; font-size: 13px;
  text-decoration: underline; cursor: pointer;
}
</style>
