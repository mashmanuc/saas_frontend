<script setup lang="ts">
/**
 * Plans View — РОАДМАП-тарифи під реальні квоти (2026-06-21).
 *
 * Раніше показувало marketplace-ера фічі («розблокування контактів» / «необмежені запити»
 * / «API») — це БРЕХНЯ, бо marketplace вирізано. Замінено на РЕАЛЬНІ квоти Tutor-Tool
 * продукту (сховище / записи уроків / export — саме ті, що enforced у коді:
 * WB_MAX_STORAGE_PER_USER, replay-count, EXPORT_DATA). Платіжки ще нема → кнопки Pro/
 * Business = «Незабаром» (disabled), без LiqPay/Stripe/checkout. Free = поточний план.
 *
 * Текст хардкоджений навмисно — тимчасовий роадмап, Ukrainian-market. Стане динамічним
 * (з BE Plan.quotas) коли підключиться монетизація. Цифри = дорожня карта, не фінал.
 */
import { Sparkles, Check, Minus } from 'lucide-vue-next'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Heading from '@/ui/Heading.vue'
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="text-center mb-12">
      <Sparkles :size="48" class="mx-auto mb-4 text-accent" />
      <Heading :level="1" class="mb-2">Тарифи</Heading>
      <p class="text-muted text-lg">Зараз доступна Free-бета. Платні плани — незабаром.</p>
    </div>

    <!-- Plans -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <!-- Free — поточний план -->
      <Card class="relative p-6 flex flex-col ring-2 ring-accent">
        <h3 class="text-2xl font-bold mb-2">Free</h3>
        <div class="flex items-baseline gap-1 mb-4">
          <span class="text-4xl font-bold">0&nbsp;₴</span>
          <span class="text-muted">/міс</span>
        </div>
        <ul class="space-y-2 mb-6 flex-1">
          <li class="flex items-start gap-2">
            <Check :size="20" class="text-accent shrink-0 mt-0.5" /><span class="text-sm">1 ГБ сховища</span>
          </li>
          <li class="flex items-start gap-2">
            <Check :size="20" class="text-accent shrink-0 mt-0.5" /><span class="text-sm">До 20 записів уроків</span>
          </li>
          <li class="flex items-start gap-2">
            <Minus :size="20" class="text-muted shrink-0 mt-0.5" /><span class="text-sm text-muted">Експорт вимкнено</span>
          </li>
        </ul>
        <Button variant="secondary" class="w-full" disabled>Поточний план</Button>
      </Card>

      <!-- Pro — Незабаром -->
      <Card class="relative p-6 flex flex-col">
        <h3 class="text-2xl font-bold mb-2">Pro</h3>
        <div class="flex items-baseline gap-1 mb-4">
          <span class="text-4xl font-bold">399&nbsp;₴</span>
          <span class="text-muted">/міс</span>
        </div>
        <ul class="space-y-2 mb-6 flex-1">
          <li class="flex items-start gap-2">
            <Check :size="20" class="text-accent shrink-0 mt-0.5" /><span class="text-sm">5 ГБ сховища</span>
          </li>
          <li class="flex items-start gap-2">
            <Check :size="20" class="text-accent shrink-0 mt-0.5" /><span class="text-sm">Необмежені записи уроків</span>
          </li>
          <li class="flex items-start gap-2">
            <Check :size="20" class="text-accent shrink-0 mt-0.5" /><span class="text-sm">Експорт увімкнено</span>
          </li>
        </ul>
        <Button variant="secondary" class="w-full" disabled>Незабаром</Button>
      </Card>

      <!-- Business — Незабаром -->
      <Card class="relative p-6 flex flex-col">
        <h3 class="text-2xl font-bold mb-2">Business</h3>
        <div class="flex items-baseline gap-1 mb-4">
          <span class="text-4xl font-bold">999&nbsp;₴</span>
          <span class="text-muted">/міс</span>
        </div>
        <ul class="space-y-2 mb-6 flex-1">
          <li class="flex items-start gap-2">
            <Check :size="20" class="text-accent shrink-0 mt-0.5" /><span class="text-sm">20 ГБ сховища</span>
          </li>
          <li class="flex items-start gap-2">
            <Check :size="20" class="text-accent shrink-0 mt-0.5" /><span class="text-sm">Необмежені записи уроків</span>
          </li>
          <li class="flex items-start gap-2">
            <Check :size="20" class="text-accent shrink-0 mt-0.5" /><span class="text-sm">Експорт</span>
          </li>
          <li class="flex items-start gap-2">
            <Check :size="20" class="text-accent shrink-0 mt-0.5" /><span class="text-sm">Майбутні функції</span>
          </li>
        </ul>
        <Button variant="secondary" class="w-full" disabled>Незабаром</Button>
      </Card>
    </div>

    <!-- Поточний план -->
    <Card class="p-6">
      <p class="text-sm text-muted mb-1">Ваш поточний план</p>
      <p class="text-xl font-semibold">FREE</p>
    </Card>
  </div>
</template>
