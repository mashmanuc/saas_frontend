<template>
  <span
    class="itg-thinking"
    :class="{ 'itg-thinking--on': thinking }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    data-testid="integralyk-thinking"
    aria-hidden="true"
    v-html="svg"
  />
</template>

<script setup lang="ts">
/**
 * Інтегралик, що «думає» (власник 2026-10-18: «спеціальний стан інтегралика… коли він думає… а не просто
 * колесо крутиться»). Той самий персонаж і той самий рух, що в палітрі (`CommandPalette.vue`, клас `thinking`:
 * тіло-інтеграл похитується) — тут окремим значком: на ✍, коли розв'язує Інтегралик, і замість колеса,
 * поки генерується урок. Вигляд — вибраний користувачем (Інтегралик / Інтегралка).
 * Коментар тут, а не в шаблоні: коментар у корені шаблону робить із компонента фрагмент — клас ззовні не чіпляється.
 */
import { computed } from 'vue'
import { useAssistantLook } from './assistantLook'
import { previewMascotSvg } from './integralykMascotSvg'

withDefaults(defineProps<{
  /** Розмір значка в пікселях. */
  size?: number
  /** Думає (похитується) чи просто стоїть. */
  thinking?: boolean
}>(), { size: 20, thinking: true })

const { look } = useAssistantLook()
// Без слотів настрою: скіни палітри (капелюх, кава) значок не чіпають.
const svg = computed(() => previewMascotSvg(look.value))
</script>

<style scoped>
.itg-thinking {
  display: inline-block;
  flex: none;
  line-height: 0;
  vertical-align: middle;
}
.itg-thinking :deep(svg) { width: 100%; height: 100%; display: block; overflow: visible; }

/* Той самий рух, що в палітрі (`CommandPalette.vue`: `itg-think`). */
@keyframes itg-thinking-sway {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  25% { transform: rotate(-7deg) translateY(-2px); }
  75% { transform: rotate(7deg) translateY(-1px); }
}
.itg-thinking :deep(.itg-body) { transform-origin: 50px 62px; }
.itg-thinking--on :deep(.itg-body) { animation: itg-thinking-sway .55s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .itg-thinking--on :deep(.itg-body) { animation: none; }
}
</style>
