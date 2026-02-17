<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="trust-strip">
    <div class="tstrip-item">
      <span class="tstrip-icon">✅</span>
      {{ t('marketplace.trust.verified') }}
    </div>
    <div class="tstrip-item">
      <span class="tstrip-icon">📞</span>
      {{ t('marketplace.trust.contactsChecked') }}
    </div>
    <div class="tstrip-item">
      <span class="tstrip-icon">🆓</span>
      {{ t('marketplace.trust.freeInquiry') }}
    </div>
    <div class="tstrip-item">
      <span class="tstrip-icon">↩️</span>
      {{ t('marketplace.trust.noObligation') }}
    </div>
  </div>
</template>

<style scoped>
.trust-strip {
  background: var(--white, #ffffff);
  border: 1px solid var(--border, #e0ece5);
  border-radius: 14px;
  padding: 14px 24px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
  animation: fadeUp 0.3s ease 0.05s both;
}

.tstrip-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted, #7a9186);
}

.tstrip-icon {
  font-size: 15px;
  color: var(--green-dark, #158f3e);
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
  .trust-strip {
    gap: 16px;
    padding: 12px 16px;
  }
  .tstrip-item {
    font-size: 11.5px;
  }
}
</style>
