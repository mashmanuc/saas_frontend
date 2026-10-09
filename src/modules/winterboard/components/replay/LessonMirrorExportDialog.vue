<template>
  <!-- «Створити відеофрагмент» (ТЗ «Дзеркало уроку», пілот). Каркас: повний діалог — наступним комітом Лони. -->
  <div class="wb-mirror-clip" role="dialog" aria-modal="true" :aria-label="t('winterboard.mirrorClip.title')" data-testid="mirror-clip-dialog">
    <header class="wb-mirror-clip__top">
      <span>{{ t('winterboard.mirrorClip.title') }}</span>
      <button type="button" data-testid="mirror-clip-close" :aria-label="t('common.close')" @click="emit('close')">×</button>
    </header>
    <p>{{ pages.length }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MirrorPhotoPage } from '../../engine/lessonMirror/types'

defineProps<{
  /** Сторінки запису з ≥ 2 фото-фонами (добирає плеєр) */
  pages: MirrorPhotoPage[]
  /** Назва уроку — для імені файла */
  lessonTitle?: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()
</script>

<style scoped>
.wb-mirror-clip { position: fixed; inset: 0; z-index: 80; background: rgba(2, 6, 23, .6); }
</style>
