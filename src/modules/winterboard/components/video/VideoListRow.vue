<template>
  <!-- Рядок відео: прев'ю з тривалістю, назва, канал, позначка мови — той самий
       вигляд, що в переліку пульта (WBRemoteView). Пульт на цей компонент НЕ
       переведено (don't touch working): це спільний рядок для дошки й «Матеріалів». -->
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    class="wb-video-row"
    :class="{ 'wb-video-row--interactive': interactive, 'wb-video-row--preview': !interactive }"
    @click="interactive && emit('select')"
  >
    <span class="wb-video-row__thumb">
      <img v-if="thumbnail" :src="thumbnail" alt="" loading="lazy">
      <span v-else class="wb-video-row__thumb-empty" aria-hidden="true">▶</span>
      <span v-if="durationText" class="wb-video-row__dur">{{ durationText }}</span>
    </span>
    <span class="wb-video-row__meta">
      <span class="wb-video-row__title">{{ title || t('winterboard.youtube.picker.untitled') }}</span>
      <span v-if="channel" class="wb-video-row__channel">{{ channel }}</span>
      <span v-if="langText" class="wb-video-row__lang">{{ langText }}</span>
    </span>
    <span v-if="$slots.actions" class="wb-video-row__actions" @click.stop>
      <slot name="actions" />
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  title: string
  thumbnail?: string
  channel?: string
  /** Тривалість у секундах (null — невідома) */
  durationS?: number | null
  /** Мова звуку з нашого контракту пошуку: 'uk' | 'unknown' | інший код */
  audioLanguage?: string
  /** Рядок — кнопка вибору (перелік) чи лише показ (підтвердження, «Матеріали») */
  interactive?: boolean
}>(), {
  thumbnail: '',
  channel: '',
  durationS: null,
  audioLanguage: '',
  interactive: false,
})

const emit = defineEmits<{ select: [] }>()
const { t } = useI18n({ useScope: 'global' })

/** Та сама подача, що в пульті: 4:05 або 1:02:03 */
const durationText = computed(() => {
  const s = props.durationS
  if (s == null || !Number.isFinite(s) || s < 0) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
})

/** Як у пульті: українську не підписуємо; невідому НЕ називаємо українською. */
const langText = computed(() => {
  const l = props.audioLanguage
  if (!l || l === 'uk') return ''
  if (l === 'unknown') return t('winterboard.youtube.picker.langUnknown')
  return l.toUpperCase()
})
</script>

<style scoped>
.wb-video-row {
  width: 100%;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 6px;
  border: 0;
  border-radius: 10px;
  background: #f1f5f9;
  color: #0f172a;
  text-align: left;
  font: inherit;
}
.wb-video-row--interactive { cursor: pointer; transition: background 0.12s ease; }
.wb-video-row--interactive:hover,
.wb-video-row--interactive:focus-visible { background: #e2e8f0; outline: none; }
.wb-video-row--preview { background: #e2e8f0; }
.wb-video-row__thumb { position: relative; flex: 0 0 112px; }
.wb-video-row__thumb img,
.wb-video-row__thumb-empty {
  width: 112px;
  height: 63px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  background: #1e293b;
}
.wb-video-row__thumb-empty { display: flex; align-items: center; justify-content: center; color: #94a3b8; }
.wb-video-row__dur {
  position: absolute;
  right: 4px;
  bottom: 4px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 4px;
}
.wb-video-row__meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.wb-video-row__title { font-size: 0.875rem; line-height: 1.25; max-height: 3.75em; overflow: hidden; }
.wb-video-row__channel { font-size: 0.75rem; color: #64748b; }
.wb-video-row__lang {
  align-self: flex-start;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 6px;
  background: #475569;
  color: #fff;
}
.wb-video-row__actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; align-self: center; }

/* Темна тема — ті самі токени, що у вікні YouTube (Б-156) */
[data-theme="dark"] .wb-video-row { background: var(--color-surface-sunken); color: var(--color-text); }
[data-theme="dark"] .wb-video-row--interactive:hover,
[data-theme="dark"] .wb-video-row--interactive:focus-visible { background: var(--color-hover); }
[data-theme="dark"] .wb-video-row--preview { background: var(--color-hover); }
[data-theme="dark"] .wb-video-row__channel { color: var(--color-text-muted); }
</style>
