<template>
  <div
    class="group relative cursor-pointer rounded-xl border border-border-subtle bg-background p-4 transition hover:border-primary/40 hover:shadow-md"
    data-test="marketplace-card"
    @click="$emit('click')"
  >
    <!-- Header: title -->
    <h3 class="text-sm font-semibold text-foreground line-clamp-2">
      {{ template.title }}
    </h3>

    <!-- Description -->
    <p v-if="template.description" class="mt-1 text-xs text-muted line-clamp-2">
      {{ truncatedDescription }}
    </p>

    <!-- Meta row: subject + lesson_type -->
    <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
      <span v-if="template.subject" data-test="mp-subject">
        {{ template.subject }}
      </span>

      <Badge variant="muted" data-test="mp-type">
        {{ t(`lessons.type.${template.lesson_type}`) }}
      </Badge>

      <span data-test="mp-materials">
        {{ template.materials_count }} {{ t('lessons.marketplace.materials') }}
      </span>

      <span v-if="template.has_homework" class="text-primary" data-test="mp-homework">
        {{ t('lessons.marketplace.hasHomework') }}
      </span>
      <span v-else class="text-muted/50" data-test="mp-no-homework">
        {{ t('lessons.marketplace.noHomework') }}
      </span>
    </div>

    <!-- Author + stats -->
    <div class="mt-3 flex items-center justify-between text-xs text-muted">
      <span data-test="mp-author">
        {{ template.owner_display_name }}
      </span>
      <span data-test="mp-used-count">
        {{ t('lessons.marketplace.usedCount', { count: template.used_in_lessons_count }) }}
      </span>
    </div>

    <!-- Footer: price + version + date -->
    <div class="mt-2 flex items-center justify-between">
      <span
        class="rounded-md px-2 py-0.5 text-xs font-semibold"
        :class="priceClass"
        data-test="mp-price"
      >
        {{ priceLabel }}
      </span>
      <span class="text-[10px] text-muted/60" data-test="mp-version-date">
        v{{ template.version }} · {{ formattedDate }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Badge from '@/ui/Badge.vue'
import type { MarketplaceTemplateSummary } from '../types/lessonTypes'

const props = defineProps<{
  template: MarketplaceTemplateSummary
}>()

defineEmits<{
  click: []
}>()

const { t } = useI18n()

const truncatedDescription = computed(() => {
  const desc = props.template.description || ''
  return desc.length > 80 ? desc.slice(0, 80) + '...' : desc
})

const priceLabel = computed(() => {
  const p = props.template.price
  if (p == null || p === 0) return t('lessons.marketplace.free')
  return `${p}\u20B4`
})

const priceClass = computed(() => {
  const p = props.template.price
  if (p == null || p === 0) return 'mp-price-free'
  return 'mp-price-paid'
})

const formattedDate = computed(() => {
  try {
    return new Date(props.template.created_at).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return props.template.created_at
  }
})
</script>

<style scoped>
.mp-price-free {
  background: color-mix(in srgb, var(--success-bg) 12%, var(--card-bg));
  color: var(--success-bg);
}
.mp-price-paid {
  background: color-mix(in srgb, var(--info-bg) 12%, var(--card-bg));
  color: var(--info-bg);
}
</style>
