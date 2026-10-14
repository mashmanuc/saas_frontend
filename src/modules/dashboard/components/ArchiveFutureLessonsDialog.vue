<template>
  <Modal :open="open" :title="$t('dashboard.tutor.archiveLessons.title')" size="sm" @close="$emit('close')">
    <div class="space-y-3" data-testid="archive-future-lessons">
      <p class="text-sm text-body">{{ $t('dashboard.tutor.archiveLessons.text') }}</p>
      <ul class="space-y-1 text-sm">
        <li v-for="r in rows" :key="r.id" class="flex justify-between gap-3">
          <span class="font-medium text-body">{{ r.name }}</span>
          <span class="text-muted">{{ $t('dashboard.tutor.archiveLessons.count', { n: r.future_lessons }) }}</span>
        </li>
      </ul>
      <p class="text-xs text-muted">{{ $t('dashboard.tutor.archiveLessons.hint') }}</p>
    </div>
    <template #footer>
      <Button variant="ghost" size="sm" type="button" data-testid="archive-lessons-abort" @click="$emit('close')">
        {{ $t('dashboard.tutor.archiveLessons.abort') }}
      </Button>
      <Button variant="outline" size="sm" type="button" data-testid="archive-lessons-keep" @click="$emit('choose', false)">
        {{ $t('dashboard.tutor.archiveLessons.keep') }}
      </Button>
      <Button variant="primary" size="sm" type="button" data-testid="archive-lessons-cancel" @click="$emit('choose', true)">
        {{ $t('dashboard.tutor.archiveLessons.cancel', { n: total }) }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
// «Архівувати» прибирає учня з розкладу до кінця (власник 2026-10-14, пункт 2): якщо в учнів є майбутні
// уроки, учитель сам вирішує — скасувати їх чи лишити. Минулі уроки не чіпаються (вони в обліку оплат).
import Modal from '../../../ui/Modal.vue'
import Button from '../../../ui/Button.vue'

defineProps({
  open: { type: Boolean, default: false },
  /** [{ id, name, future_lessons }] */
  rows: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
})
defineEmits(['close', 'choose'])
</script>
