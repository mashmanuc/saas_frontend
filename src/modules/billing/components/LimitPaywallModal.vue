<template>
  <!--
    Ф3 (2026-07-19): Paywall при досягненні SaaS-ліміту тарифу.
    Тригериться глобально з apiClient на 403 LIMIT_EXCEEDED (key).
    Монтується один раз у PageShell. SSOT: backend/apps/payments/LIMITS_OPS_RUNBOOK.md §5.
  -->
  <Modal
    :open="store.visible"
    :title="title"
    size="sm"
    @close="store.close()"
  >
    <p class="limit-paywall-text">{{ body }}</p>

    <template #footer>
      <Button variant="ghost" @click="store.close()">
        {{ $t('billing.limitPaywall.later') }}
      </Button>
      <Button variant="primary" @click="goPro">
        {{ $t('billing.limitPaywall.goPro') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import { useLimitPaywallStore } from '@/stores/limitPaywallStore'

const store = useLimitPaywallStore()
const router = useRouter()
const { t, te } = useI18n()

// Меседж per-key з fallback на дефолт (щоб новий ключ ніколи не «ламав» модалку).
const title = computed(() => {
  const key = store.limitKey ? `billing.limitPaywall.titleByKey.${store.limitKey}` : ''
  return (store.limitKey && te(key)) ? t(key) : t('billing.limitPaywall.title')
})
const body = computed(() => {
  const key = store.limitKey ? `billing.limitPaywall.bodyByKey.${store.limitKey}` : ''
  return (store.limitKey && te(key)) ? t(key) : t('billing.limitPaywall.bodyDefault')
})

function goPro() {
  store.close()
  router.push({ name: 'tutor-billing' })
}
</script>

<style scoped>
.limit-paywall-text {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
  margin: 0;
}
</style>
