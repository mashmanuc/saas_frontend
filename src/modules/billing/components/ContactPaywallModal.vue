<template>
  <!--
    P0 (2026-06-13): Paywall при вичерпаних контактних токенах.
    Показується коли accept inquiry/invite повертає CONTACTS_BALANCE_TOO_LOW.
    Стан — глобальний (useContactPaywallStore), монтується один раз у PageShell.
  -->
  <Modal
    :open="store.visible"
    :title="$t('billing.paywall.title')"
    size="sm"
    @close="store.close()"
  >
    <p class="paywall-text">{{ $t('billing.paywall.body') }}</p>

    <template #footer>
      <Button variant="ghost" @click="store.close()">
        {{ $t('billing.paywall.later') }}
      </Button>
      <Button variant="outline" @click="goPackages">
        {{ $t('billing.paywall.buyPackage') }}
      </Button>
      <Button variant="primary" @click="goPro">
        {{ $t('billing.paywall.goPro') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { useRouter } from 'vue-router'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import { useContactPaywallStore } from '@/stores/contactPaywallStore'

const store = useContactPaywallStore()
const router = useRouter()

function goPro() {
  store.close()
  router.push('/tutor/billing')
}

function goPackages() {
  store.close()
  router.push('/tutor/contacts/purchase')
}
</script>

<style scoped>
.paywall-text {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
  margin: 0;
}
</style>
