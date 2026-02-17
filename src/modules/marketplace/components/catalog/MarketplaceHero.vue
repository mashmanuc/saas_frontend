<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="marketplace-hero">
    <h1 class="hero-title">{{ t('marketplace.hero.title') }}</h1>
    <p class="hero-sub">{{ t('marketplace.hero.subtitle') }}</p>
  </section>
</template>

<style scoped>
.marketplace-hero {
  background: linear-gradient(135deg, var(--green, #1DB954) 0%, var(--green-dark, #158f3e) 100%);
  border-radius: 18px;
  padding: 40px 44px;
  margin-bottom: 24px;
  color: white;
  box-shadow: 0 4px 24px rgba(29, 185, 84, 0.25);
  animation: fadeUp 0.3s ease 0s both;
}

.hero-title {
  font-family: var(--font-display, 'Unbounded', sans-serif);
  font-size: 28px;
  font-weight: 900;
  line-height: 1.2;
  margin: 0 0 8px;
  letter-spacing: -0.8px;
}

.hero-sub {
  font-size: 15px;
  font-weight: 600;
  opacity: 0.92;
  margin: 0;
  line-height: 1.5;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
  .marketplace-hero {
    padding: 28px 20px;
    border-radius: 14px;
  }
  .hero-title {
    font-size: 22px;
  }
}
</style>
