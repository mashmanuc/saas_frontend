<!--
  CelebrationModal — момент здобуття артефакту (порт дизайну → Vue).
  Дизайн: design_handoff/from_designer/collection.html (.cele*). Тригер: submit.unlocked.
  Показується, коли є pendingUnlocks; @close → store.dismissUnlock() (наступний у черзі).
-->
<template>
  <div
    class="cele"
    :class="{ show }"
    :style="hueStyle"
    role="dialog"
    aria-modal="true"
    :aria-label="t('practice.celebration.eyebrow')"
    @click.self="emit('close')"
  >
    <div class="cele__card">
      <p class="cele__eyebrow">{{ t('practice.celebration.eyebrow') }}</p>
      <div class="cele__rays"><i v-for="n in 12" :key="n" :style="rayStyle(n)" /></div>
      <div class="cele__frame"><img :src="img" :alt="artifact.title" /></div>
      <h2 class="cele__title">{{ artifact.title }}</h2>
      <p class="cele__src">{{ sourceLabel }}</p>
      <button class="cele__close" type="button" @click="emit('close')">{{ t('practice.celebration.add') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { UnlockedArtifact } from '../api/practiceApi'
import { ARTIFACT_HUE } from '../constants'

const props = defineProps<{ artifact: UnlockedArtifact }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

const show = ref(false)
const hue = computed(() => ARTIFACT_HUE[props.artifact.id] ?? 200)
const hueStyle = computed(() => ({
  '--bc': `hsl(${hue.value} 80% 58%)`,
  '--bc-soft': `hsl(${hue.value} 85% 58% / 0.30)`,
}))
const img = computed(() => (props.artifact.preview ? `/practice/artifacts/${props.artifact.preview}` : ''))

const sourceLabel = computed(() => {
  const a = props.artifact
  const s = a.source || ''
  if (s.startsWith('xp:')) return t('practice.celebration.fromXp', { n: s.slice(3) })
  if (s.startsWith('streak:')) return t('practice.celebration.fromStreak', { n: s.slice(7) })
  if (a.world_title) return t('practice.celebration.fromWorldNamed', { name: a.world_title })  // #11
  return t('practice.celebration.fromWorld')
})

function rayStyle(n: number) {
  return { '--r': `${(n - 1) * 30}deg`, animationDelay: `${(n - 1) * 18}ms` }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  requestAnimationFrame(() => { show.value = true })
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.cele {
  position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px;
  --overlay: rgba(6, 30, 24, 0.55);
  --art-bg: #05070d;
  --font-display: 'Space Grotesk', var(--font-sans, system-ui, sans-serif);
  background: var(--overlay); backdrop-filter: blur(6px); opacity: 0; transition: opacity 0.2s;
}
[data-theme="dark"] .cele { --overlay: rgba(2, 8, 20, 0.7); --art-bg: #03050a; }
.cele.show { opacity: 1; }

.cele__card {
  position: relative; width: min(340px, 90vw); background: var(--card-bg); border: 1px solid var(--border-color);
  border-radius: var(--radius-xl, 16px); padding: 26px 22px 22px; text-align: center;
  box-shadow: var(--shadow-lg, 0 16px 40px rgba(0, 0, 0, 0.4));
  transform: scale(0.9) translateY(8px); transition: transform 0.3s; overflow: hidden;
}
.cele.show .cele__card { transform: scale(1) translateY(0); }
.cele__card::before {
  content: ""; position: absolute; left: 50%; top: -30%; width: 280px; height: 280px; transform: translateX(-50%);
  background: radial-gradient(circle, var(--bc-soft), transparent 65%); pointer-events: none;
}
.cele__eyebrow { position: relative; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--bc); margin: 0; }
.cele__frame {
  position: relative; width: 148px; height: 148px; margin: 16px auto 4px; border-radius: var(--radius-lg, 12px); overflow: hidden;
  background: var(--art-bg); box-shadow: 0 0 36px var(--bc-soft), inset 0 0 0 1px var(--border-color);
}
.cele__frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cele__title { position: relative; font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; margin: 12px 0 2px; color: var(--text-primary); }
.cele__src { position: relative; font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 18px; }
.cele__close {
  position: relative; display: inline-flex; align-items: center; gap: 7px; background: var(--accent); color: #fff;
  border: none; border-radius: 9999px; padding: 10px 18px; font: 600 0.85rem var(--font-sans, sans-serif); cursor: pointer;
}
.cele__rays { position: absolute; left: 50%; top: 96px; width: 1px; height: 1px; pointer-events: none; }
.cele__rays i { position: absolute; left: 0; top: 0; width: 3px; height: 62px; border-radius: 2px; background: var(--bc); transform-origin: 50% 0; opacity: 0; }
.cele.show .cele__rays i { animation: ray 0.7s cubic-bezier(0.2, 0.7, 0.3, 1) forwards; }
@keyframes ray {
  0% { opacity: 0; transform: rotate(var(--r)) scaleY(0.2); }
  40% { opacity: 0.85; }
  100% { opacity: 0; transform: rotate(var(--r)) scaleY(1.5) translateY(-6px); }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>
