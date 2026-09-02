<template>
  <Teleport to="body">
    <div v-if="visible" class="wb-remote-qr__overlay" @click.self="$emit('close')">
      <div class="wb-remote-qr" role="dialog" aria-modal="true" :aria-label="t('winterboard.remote.qrTitle')">
        <h2 class="wb-remote-qr__title">{{ t('winterboard.remote.qrTitle') }}</h2>
        <p class="wb-remote-qr__hint">{{ t('winterboard.remote.qrHint') }}</p>

        <div class="wb-remote-qr__code-wrap">
          <img v-if="qrDataUrl" :src="qrDataUrl" class="wb-remote-qr__img" alt="QR" width="240" height="240" />
          <div v-else class="wb-remote-qr__img wb-remote-qr__img--pending">…</div>
        </div>

        <p class="wb-remote-qr__or">{{ t('winterboard.remote.openOnPhone') }}</p>
        <p class="wb-remote-qr__url">{{ displayUrl }}</p>

        <p class="wb-remote-qr__status" :class="{ 'wb-remote-qr__status--on': remoteConnected }">
          {{ remoteConnected ? t('winterboard.remote.phoneConnected') : t('winterboard.remote.phoneWaiting') }}
        </p>
        <p class="wb-remote-qr__account">{{ t('winterboard.remote.sameAccountNote') }}</p>

        <button type="button" class="wb-remote-qr__close" @click="$emit('close')">
          {{ t('common.close', 'Закрити') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * «Пульт на телефон» (CLASSROOM_REMOTE_VISION крок 5; v1.1 2026-09-02).
 * Показує QR з УНІВЕРСАЛЬНОЮ адресою /remote (без id, без коду) — пульт сам
 * знаходить активну дошку. Ту саму адресу можна просто набрати або додати на
 * головний екран телефона. Статус — чи пульт уже вітався (hello).
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  visible: boolean
  url: string
  remoteConnected: boolean
}>()
defineEmits<{ (e: 'close'): void }>()

const { t } = useI18n()
const qrDataUrl = ref('')
const displayUrl = computed(() => props.url.replace(/^https?:\/\//, ''))

// qrcode — лінива залежність: тягнеться лише коли модалку відкрили
watch(
  () => [props.visible, props.url] as const,
  async ([visible, url]) => {
    if (!visible || !url) return
    try {
      const QRCode = (await import('qrcode')).default
      qrDataUrl.value = await QRCode.toDataURL(url, { width: 240, margin: 1 })
    } catch (err) {
      console.warn('[WB:remote] QR render failed', err)
      qrDataUrl.value = ''
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.wb-remote-qr__overlay {
  position: fixed; inset: 0; z-index: 1200;
  background: rgba(15, 23, 42, 0.6);
  display: flex; align-items: center; justify-content: center;
}
.wb-remote-qr {
  background: #fff; color: #0f172a; border-radius: 16px;
  padding: 24px 28px; width: min(92vw, 380px);
  box-shadow: 0 20px 60px rgba(0,0,0,.3);
  text-align: center;
}
.wb-remote-qr__title { margin: 0 0 6px; font-size: 20px; font-weight: 700; }
.wb-remote-qr__hint { margin: 0 0 16px; font-size: 14px; color: #475569; }
.wb-remote-qr__code-wrap { display: flex; justify-content: center; }
.wb-remote-qr__img { width: 240px; height: 240px; border-radius: 8px; }
.wb-remote-qr__img--pending { display:flex; align-items:center; justify-content:center; background:#f1f5f9; color:#94a3b8; font-size: 32px; }
.wb-remote-qr__or { margin: 12px 0 2px; font-size: 13px; color: #64748b; }
.wb-remote-qr__url { margin: 0 0 12px; font-size: 20px; font-weight: 700; letter-spacing: .5px; word-break: break-all; }
.wb-remote-qr__status { margin: 0 0 6px; font-size: 14px; color: #64748b; }
.wb-remote-qr__status--on { color: #16a34a; font-weight: 600; }
.wb-remote-qr__account { margin: 0 0 16px; font-size: 12px; color: #94a3b8; }
.wb-remote-qr__close {
  border: 0; border-radius: 10px; padding: 10px 22px; font-size: 15px; cursor: pointer;
  background: #0f172a; color: #fff;
}
</style>
