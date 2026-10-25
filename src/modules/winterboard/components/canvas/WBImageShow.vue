<template>
  <!-- LAW §9 v1.60: картинка «на весь екран» — як відео (board/mediaShow.ts): поверх усього, темне тло, уся картинка
       по центру. Друга картинка (▶ на пульті, «Далі» в режимі показу) приходить плавно — проступає поверх старої.
       Лише вигляд цього екрана: без ops, Replay і запису. Закривають «Уся сторінка» пульта, × чи Esc. -->
  <Teleport to="body">
    <Transition name="wb-image-show">
      <div v-if="asset" class="wb-image-show" data-testid="image-show" @pointerdown.stop @click.stop>
        <Transition name="wb-image-show-swap">
          <img :key="asset.id" :src="String(asset.src)" class="wb-image-show__img" :data-testid="`image-show-${asset.id}`" alt="" />
        </Transition>
        <button
          type="button"
          class="wb-image-show__close"
          data-testid="image-show-close"
          :aria-label="t('winterboard.player.close')"
          :title="t('winterboard.player.close')"
          @click="emit('close')"
        >&#x2715;</button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ asset: { id: string; src?: unknown } | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
</script>

<style scoped>
.wb-image-show {
  position: fixed;
  inset: 0;
  z-index: 10000; /* як показ відео */
  background: #000;
}
.wb-image-show__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.wb-image-show__close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.35;
  transition: opacity 0.2s;
}
.wb-image-show__close:hover,
.wb-image-show__close:focus-visible { opacity: 1; }

/* Відкрити / закрити — плавно */
.wb-image-show-enter-active,
.wb-image-show-leave-active { transition: opacity 0.35s ease; }
.wb-image-show-enter-from,
.wb-image-show-leave-to { opacity: 0; }

/* Зміна картинки — нова проступає поверх старої; стара лежить під нею цілою, поки та не проступить, — без темного
   провалу посередині (дві напівпрозорі на чорному тлі темнішали б) */
.wb-image-show-swap-enter-active { transition: opacity 0.6s ease; z-index: 2; }
.wb-image-show-swap-leave-active { transition: opacity 0.6s step-end; z-index: 1; }
.wb-image-show-swap-enter-from { opacity: 0; }
.wb-image-show-swap-leave-to { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .wb-image-show-enter-active, .wb-image-show-leave-active,
  .wb-image-show-swap-enter-active, .wb-image-show-swap-leave-active { transition: none; }
}
</style>
