<template>
  <div v-if="hasPlatform || hasPay" class="week-legend" data-testid="calendar-legend">
    <span class="week-legend__item">
      <i class="week-legend__swatch" aria-hidden="true" />{{ t('calendar.weekLegend.own') }}
    </span>
    <span v-if="hasPlatform" class="week-legend__item" data-testid="calendar-legend-platform">
      <i class="week-legend__swatch week-legend__swatch--platform" aria-hidden="true" />{{ t('calendar.weekLegend.platform') }}
    </span>
    <span v-if="hasPay" class="week-legend__item" data-testid="calendar-legend-pay">
      <b class="week-legend__chip">₴3</b>{{ t('calendar.weekLegend.left') }}
    </span>
    <span v-if="hasPay" class="week-legend__item">
      <b class="week-legend__chip week-legend__chip--unpaid">₴0</b>{{ t('calendar.weekLegend.unpaid') }}
    </span>
  </div>
</template>

<script setup lang="ts">
// Що означають кольори й значки в розкладі вчителя (власник 2026-10-17, К1/О3). Показуємо лише коли на тижні
// є що пояснювати: урок учня «З платформи» або значок оплати; інакше підпису немає — розклад як був.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  events: Array<{ student?: { platform?: string | null } }>
  paymentLeft?: Record<string, number>
}>()

const { t } = useI18n()
const hasPlatform = computed(() => props.events.some((e) => Boolean(e.student?.platform && String(e.student.platform).trim())))
const hasPay = computed(() => Object.keys(props.paymentLeft || {}).length > 0)
</script>

<style scoped>
.week-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding: 8px 4px 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.week-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.week-legend__swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: #2e7d32;
}

.week-legend__swatch--platform {
  background: #1d4ed8;
}

.week-legend__chip {
  padding: 0 4px;
  border-radius: 4px;
  font-size: 11px;
  background: #e8f5e9;
  color: #14532d;
}

.week-legend__chip--unpaid {
  background: #fee2e2;
  color: #991b1b;
}

/* ── Темна тема (Б-156): ті самі селектори, кольори токенами теми ── */
[data-theme="dark"] .week-legend__swatch {
  background: var(--color-success);
}
[data-theme="dark"] .week-legend__swatch--platform {
  background: var(--color-info);
}
[data-theme="dark"] .week-legend__chip {
  background: var(--color-surface-sunken);
  color: var(--color-text);
}
[data-theme="dark"] .week-legend__chip--unpaid {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
</style>
