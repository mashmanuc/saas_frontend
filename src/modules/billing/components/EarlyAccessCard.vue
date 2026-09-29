<template>
  <div class="space-y-6" data-testid="early-access">
    <div>
      <h1 class="text-2xl font-semibold">{{ $t('billing.earlyAccess.title') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ $t('billing.earlyAccess.subtitle') }}</p>
    </div>

    <Card class="space-y-2">
      <h2 class="text-base font-semibold">{{ $t('billing.earlyAccess.cardTitle') }}</h2>
      <p class="text-sm text-muted-foreground">{{ $t('billing.earlyAccess.cardText') }}</p>
      <!-- Куди писати, якщо щось не так: той самий пункт, що в меню («Ідеї та відгуки»). -->
      <p class="text-sm text-muted-foreground" data-testid="early-access-feedback">
        {{ $t('billing.earlyAccess.feedbackLead') }}
        <RouterLink to="/feedback" class="font-medium underline underline-offset-2">{{ $t('sidebar.item.feedback') }}</RouterLink>
        {{ $t('billing.earlyAccess.feedbackTail') }}
      </p>
    </Card>
  </div>
</template>

<script setup>
/**
 * «Ранній доступ» — екран тарифу, поки продаж вимкнено (слово власника 2026-09-24).
 *
 * ЧОМУ ВІН Є. Новий учитель бачив на одній сторінці чотири суперечливі речі
 * одночасно: план «FREE», плашку «Без підписки», список лімітів і порожню
 * історію платежів — плюс рядок «Продаж тарифів зараз вимкнено». Людина не
 * розуміла, вона вже щось купила, щось втратила чи має платити.
 *
 * Тут немає ні кнопок оплати, ні слова FREE, ні лімітів: поки платних тарифів
 * не підключено, чесна відповідь одна — користуйся без оплати.
 *
 * 2026-09-29 (власник): «Безкоштовна бета — щонайменше до 1 грудня 2026» (дату можна
 * перенести далі) і знижка 50% на платний тариф для учасників бети. Строку знижки власник
 * не назвав — у тексті його й немає. Записи уроків тут НЕ обіцяємо зберегти: безкоштовний
 * план видаляє їх за `replay_retention_days`.
 *
 * ⚠️ Показує його ЛИШЕ `AccountBillingView` і лише коли сервер справді
 * відповів `sales_enabled: false`, а в людини немає ні підписки, ні
 * очікуваного платежу, ні історії оплат. Правило — там, разом із доказами.
 */
import Card from '@/ui/Card.vue'
</script>
