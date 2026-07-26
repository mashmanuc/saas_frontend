<!--
  AppErrorBoundary — глобальний fallback навколо кореня застосунку (App.vue).

  2026-07-21: до цього краш верхнього рівня / збій lazy-чанка поза навігацією
  давав ПОРОЖНІЙ екран (репорт власника після churn-у чанків). Тепер юзер бачить
  спокійну брендовану сторінку з Інтегралчиком і кнопкою «Онови», а не білу пустку.

  САМОДОСТАТНІЙ: inline маскот-SVG + scoped-стилі, БЕЗ імпортів дизайн-системи /
  сторів — щоб рендеритись навіть якщо крашнулось саме воно. Reload — ручний
  (кнопка), тож без auto-loop. Chunk-nav помилки окремо auto-reload-яться у
  router.onError (router/index.js).
-->
<template>
  <div v-if="hasError" class="aeb">
    <div class="aeb__card">
      <span class="aeb__mascot" aria-hidden="true" v-html="MASCOT_SVG"></span>
      <h1 class="aeb__title">{{ isStaleVersion ? 'Вийшла нова версія' : 'Щось пішло не так' }}</h1>
      <p class="aeb__text">
        {{ isStaleVersion
          ? 'Ця вкладка була відкрита до оновлення. Онови сторінку — усе зроблене збережено.'
          : 'Нічого не втрачено — просто онови сторінку, і ми повернемось туди, де ти був.' }}
      </p>
      <div class="aeb__actions">
        <button type="button" class="aeb__btn aeb__btn--primary" @click="reload">
          <svg class="aeb__btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          Онови сторінку
        </button>
        <button type="button" class="aeb__btn aeb__btn--ghost" @click="goHome">На головну</button>
      </div>
      <p class="aeb__note">Якщо повторюється — напиши нам, розберемось.</p>
    </div>
  </div>
  <slot v-else />
</template>

<script setup>
import { computed, ref, onErrorCaptured } from 'vue'
// Єдина залежність (умисно): крихітний ref-прапорець без власних залежностей —
// див. коментар про самодостатність вище. Через нього router.onError повідомляє
// про stale-chunk, який `onErrorCaptured` не бачить (chunk падає ДО монтування).
import { appFatalError } from '../core/errors/appFatalError'

// Той самий Інтегралик, що в CommandPalette — дихає/кліпає (класи в стилях).
// Легка сльозинка (#7fc8ff) — трохи винуватий, що підвів. Рота немає (за дизайном).
const MASCOT_SVG =
  '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#d6f1ed" stroke="#0d9488" stroke-width="3"></circle>'
  + '<g class="itg-body">'
  + '<path d="M60 22 C55 12, 42 14, 42 27 C42 42, 58 52, 58 70 C58 85, 45 92, 40 82" fill="none" stroke="#0f5f57" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"></path>'
  + '<path d="M37 25 Q43 27 48 25" fill="none" stroke="#0f5f57" stroke-width="2" stroke-linecap="round"></path>'
  + '<path d="M51 30 Q56 32 61 30" fill="none" stroke="#0f5f57" stroke-width="2" stroke-linecap="round"></path>'
  + '<g class="itg-eye" style="transform-origin:43px 34px;"><circle cx="43" cy="34" r="7" fill="#fff" stroke="#0f5f57" stroke-width="2"></circle><circle cx="43" cy="35.5" r="3.5" fill="#0f5f57"></circle></g>'
  + '<g class="itg-eye itg-e2" style="transform-origin:55px 40px;"><circle cx="55" cy="40" r="7" fill="#fff" stroke="#0f5f57" stroke-width="2"></circle><circle cx="55" cy="41.5" r="3.5" fill="#0f5f57"></circle></g>'
  + '<path d="M40 44 Q37 51 40 55 Q43 51 40 44 Z" fill="#7fc8ff" stroke="#3b9fe0" stroke-width="1"></path>'
  + '</g></svg>'

// Локальний краш (компонент упав під час рендеру).
const localError = ref(false)

// Показуємо сторінку і на локальний краш, і на сигнал знадвору (router.onError).
const hasError = computed(() => localError.value || appFatalError.value !== null)
const isStaleVersion = computed(() => !localError.value && appFatalError.value === 'stale-version')

onErrorCaptured((err) => {
  localError.value = true
  // Best-effort лог; НЕ кидаємо далі (return false зупиняє propagation).
  try { console.error('[AppErrorBoundary]', err) } catch { /* noop */ }
  return false
})

function reload() {
  try { window.location.reload() } catch { /* noop */ }
}

function goHome() {
  // Жорстка навігація (не router — він міг бути в стані краху).
  try { window.location.assign('/') } catch { /* noop */ }
}
</script>

<style scoped>
.aeb {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #eef7f3;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
.aeb__card { text-align: center; max-width: 420px; }

.aeb__mascot {
  display: inline-block;
  width: 110px;
  height: 110px;
  margin-bottom: 20px;
  animation: aeb-float 5s ease-in-out infinite;
}
.aeb__mascot :deep(svg) {
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 6px 14px rgba(4, 40, 30, 0.18));
}
.aeb__mascot :deep(.itg-body) { transform-origin: 50px 62px; animation: aeb-breath 4s ease-in-out infinite; }
.aeb__mascot :deep(.itg-eye) { animation: aeb-blink 4.4s linear infinite; }
.aeb__mascot :deep(.itg-e2) { animation-delay: 0.06s; }

@keyframes aeb-breath { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2px) scale(1.015); } }
@keyframes aeb-blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
@keyframes aeb-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

.aeb__title { font-size: 22px; font-weight: 500; color: #0f172a; margin: 0 0 10px; }
.aeb__text { font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px; }

.aeb__actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.aeb__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  padding: 11px 22px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.aeb__btn-ic { width: 18px; height: 18px; }
.aeb__btn--primary { background: #047857; color: #fff; }
.aeb__btn--primary:hover { background: #065f46; }
.aeb__btn--ghost { background: #fff; border-color: #cbd5e1; color: #334155; padding: 11px 20px; }
.aeb__btn--ghost:hover { background: #f8fafc; }

.aeb__note { font-size: 12px; color: #94a3b8; margin: 22px 0 0; }

@media (prefers-reduced-motion: reduce) {
  .aeb__mascot, .aeb__mascot :deep(.itg-body), .aeb__mascot :deep(.itg-eye) { animation: none; }
}
</style>
