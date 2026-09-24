<template>
  <div v-if="showRemote" class="wb-remote-entry">
    <WBRemoteView :id="id" />
    <!-- Пульт на комп'ютері відкрито свідомо — лишаємо видимий шлях назад до
         пояснення: меню веде на цю саму адресу, і без цього виходу нема. -->
    <button v-if="!onRemoteDevice" type="button" class="wb-remote-entry__back" @click="toConnectPage">
      {{ t('winterboard.remote.connectPage.backToConnect') }}
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * Вхід у пульт (ТЗ Салюта TZ_REMOTE_DESKTOP_CONNECT_2026-09-22 §2.1).
 *
 * Телефон / планшет (лише дотик) → пульт без змін, на весь екран.
 * Комп'ютер → пояснення «як підключити телефон», але ЗВИЧАЙНОЮ сторінкою
 * застосунку, з бічним меню й шапкою (власник 2026-09-24): голе полотно на
 * весь екран доречне пульту в руці, а не сторінці-довідці на ноутбуці.
 * Тому тут лише рішення й перенаправлення, а сама сторінка живе на маршруті
 * `winterboard-remote-connect` усередині PageShell.
 *
 * Рішення — один раз при вході: вигляд не перемикається посеред роботи, коли
 * вчитель торкнувся тачскріна чи взяв перо.
 *
 * `?here=1` — «Все одно відкрити пульт тут» зі сторінки підключення. Вибір
 * живе рівно один перехід (він в адресі, не в пам'яті): інакше кожен наступний
 * вхід кидав би в пульт повз пояснення, і на ноутбуці лишалось би «На ноутбуці
 * не відкрита жодна дошка» без дороги назад.
 */
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDeviceMode } from '../composables/useDeviceMode'
import { isRemoteDevice } from '../remote/remoteEntry'
import WBRemoteView from './WBRemoteView.vue'

defineProps<{ id?: string }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const device = useDeviceMode()

const onRemoteDevice = isRemoteDevice({
  isTouchInput: device.isTouchInput.value,
  hasMultipleInputModes: device.hasMultipleInputModes.value,
})
const showRemote = ref(onRemoteDevice || route.query.here === '1')

function toConnectPage(): void {
  void router.replace({ name: 'winterboard-remote-connect' })
}

onMounted(() => {
  if (!showRemote.value) toConnectPage()
})
</script>

<style scoped>
.wb-remote-entry { min-height: 100dvh; background: #0f172a; }
.wb-remote-entry__back {
  display: block; margin: 0 auto; padding: 12px 16px 24px;
  background: none; border: 0; color: #94a3b8; font-size: 13px;
  text-decoration: underline; cursor: pointer;
}
</style>
