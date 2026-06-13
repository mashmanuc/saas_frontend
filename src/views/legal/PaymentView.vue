<template>
  <div class="container mx-auto max-w-4xl px-4 py-12">
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-foreground">{{ $t('legal.payment.title') }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ $t('legal.payment.lastUpdated', { date: lastUpdated }) }}
        </p>
      </div>

      <div class="prose prose-slate max-w-none dark:prose-invert">
        <section v-for="s in sections" :key="s">
          <h2>{{ $t(`legal.payment.${s}.title`) }}</h2>
          <div v-html="$t(`legal.payment.${s}.body`)"></div>
        </section>
      </div>

      <div class="flex justify-center pt-8">
        <Button variant="outline" @click="$router.back()">
          {{ $t('legal.back') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/ui/Button.vue'

const lastUpdated = computed(() => '13.06.2026')
const sections = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']
</script>

<style scoped>
.prose {
  color: var(--color-text-primary);
}

.prose h2 {
  margin-top: 2rem;
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.prose p {
  margin-bottom: 1rem;
  line-height: 1.75;
}

.prose ul {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.prose li {
  margin-bottom: 0.5rem;
}

.prose a {
  color: var(--color-primary);
  text-decoration: underline;
}

.prose a:hover {
  color: var(--color-primary-dark);
}
</style>
