<template>
  <div class="wb-remote-qrblock">
    <div class="wb-remote-qrblock__code-wrap">
      <img v-if="qrDataUrl" :src="qrDataUrl" class="wb-remote-qrblock__img" alt="QR" :width="size" :height="size" />
      <div v-else class="wb-remote-qrblock__img wb-remote-qrblock__img--pending" :style="{ width: `${size}px`, height: `${size}px` }">…</div>
    </div>
    <p class="wb-remote-qrblock__or">{{ t('winterboard.remote.openOnPhone') }}</p>
    <p class="wb-remote-qrblock__url">{{ displayUrl }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * «QR + адреса» пульта — один компонент для модалки в дошці і для сторінки
 * «Підключити телефон» (ТЗ TZ_REMOTE_DESKTOP_CONNECT §2.3: не дублювати).
 * Адреса — `remoteEntryUrl()`, тож обидва місця кодують те саме.
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { remoteEntryUrl } from '../../remote/remoteEntry'

// `url` — лише для модалки, що вже тримає `useBoardRemote.remoteUrl` (той теж
// бере `remoteEntryUrl()`); без нього — те саме джерело напряму.
const props = withDefaults(defineProps<{ size?: number; url?: string }>(), { size: 240, url: '' })

const { t } = useI18n()
const url = computed(() => props.url || remoteEntryUrl())
const qrDataUrl = ref('')
const displayUrl = computed(() => url.value.replace(/^https?:\/\//, ''))

// qrcode — лінива залежність: тягнеться лише коли блок показали
watch(
  () => [url.value, props.size] as const,
  async ([value, size]) => {
    if (!value) return
    try {
      const QRCode = (await import('qrcode')).default
      qrDataUrl.value = await QRCode.toDataURL(value, { width: size, margin: 1 })
    } catch (err) {
      console.warn('[WB:remote] QR render failed', err)
      qrDataUrl.value = ''
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.wb-remote-qrblock { text-align: center; }
.wb-remote-qrblock__code-wrap { display: flex; justify-content: center; }
.wb-remote-qrblock__img { border-radius: 8px; }
.wb-remote-qrblock__img--pending { display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #94a3b8; font-size: 32px; }
.wb-remote-qrblock__or { margin: 12px 0 2px; font-size: 13px; color: #64748b; }
.wb-remote-qrblock__url { margin: 0 0 12px; font-size: 20px; font-weight: 700; letter-spacing: .5px; word-break: break-all; color: #0f172a; }
</style>
