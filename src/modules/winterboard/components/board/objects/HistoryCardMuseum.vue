<!--
  HistoryCardMuseum — «Музейна етикетка»: довідка про людину однією карткою
  (власник 2026-10-21, дизайн «Картки Інтегралика», варіант A).

  Ліворуч — портрет у паспарту з підписом автора й ліцензії (показ без них
  заборонений, ТЗ §6.1). Праворуч — галузь, ім'я, підзаголовок, три факти,
  суть, 2–4 дати на лінії часу, джерело й «Детальніше».

  Вміст готує сервер (apps/intent/ai/museum.py) з тексту статті Вікіпедії;
  кожне число на картці стоїть у статті. Тут — лише показ.

  Шрифти дизайну (Literata, Manrope) з чужих серверів НЕ вантажимо: заголовки й
  текст — системна антиква, підписи — шрифт дошки.

  POINTER-EVENTS: уся етикетка прозора для дотику (тягнути можна за будь-яке
  місце — Konva proxy під нею), живі лише посилання.
-->
<template>
  <article class="museum" :class="{ 'museum--no-image': !image }" data-testid="history-card-museum">
    <figure v-if="image" class="museum__img">
      <div class="museum__slot">
        <img
          class="museum__portrait"
          :src="image.url"
          :alt="title"
          @load="emit('image-settled')"
          @error="emit('image-settled')"
        >
      </div>
      <figcaption class="museum__cap" data-testid="history-card-museum-caption">
        <a v-if="isWebUrl(image.file_page)" :href="image.file_page" target="_blank" rel="noopener noreferrer">{{ image.author }}</a>
        <span v-else>{{ image.author }}</span> · {{ image.license }}
      </figcaption>
    </figure>

    <div class="museum__body">
      <div class="museum__kick">
        <span class="museum__cat">{{ museum.category || labels.reference }}</span>
        <span class="museum__ig"><i aria-hidden="true">∫</i>{{ labels.integralyk }}</span>
      </div>
      <h2 class="museum__title">{{ title }}</h2>
      <div v-if="subtitle" class="museum__sub">{{ subtitle }}</div>

      <div class="museum__facts">
        <div v-for="(fact, i) in museum.facts" :key="i" class="museum__fact">
          <b>{{ fact.value }}</b><span>{{ fact.label }}</span>
        </div>
      </div>

      <p class="museum__summary">{{ museum.summary }}</p>

      <ol class="museum__tl">
        <li v-for="(point, i) in museum.timeline" :key="i"><b>{{ point.year }}</b>{{ point.label }}</li>
      </ol>

      <footer class="museum__foot">
        <span class="museum__src">
          <b>{{ labels.source }}:</b>&nbsp;{{ labels.wikipedia }}<template
            v-if="source?.title"> · «{{ source.title }}»</template><template
            v-if="source?.license"> · {{ source.license }}</template>
        </span>
        <a
          v-if="isWebUrl(source?.url)"
          class="museum__more"
          :href="source?.url"
          target="_blank"
          rel="noopener noreferrer"
        >↗ {{ labels.more }}</a>
      </footer>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { HistoryCardImage, HistoryCardMuseumData, WBSourceRef } from '../../../types/winterboard'

const props = defineProps<{
  title: string
  subtitle?: string
  museum: HistoryCardMuseumData
  image: HistoryCardImage | null
  /** Стаття, з якої складено етикетку. */
  source?: WBSourceRef | null
}>()

const emit = defineEmits<{
  /** Портрет довантажився (або не зміг) — картку треба переміряти. */
  'image-settled': []
}>()

/** Підписи мовою МАТЕРІАЛУ, не UI-локалі — як у решті карток історії. */
const LABELS = {
  uk: { reference: 'Довідка', integralyk: 'Інтегралик', source: 'Джерело', wikipedia: 'Вікіпедія', more: 'Детальніше' },
  en: { reference: 'Reference', integralyk: 'Integralyk', source: 'Source', wikipedia: 'Wikipedia', more: 'Read more' },
} as const
const labels = computed(() => LABELS[props.museum.lang === 'en' ? 'en' : 'uk'])

const WEB_URL = /^https?:\/\/.+/i
const isWebUrl = (url: unknown) => typeof url === 'string' && WEB_URL.test(url.trim())
</script>

<style scoped>
/* Палітра й міри — з дизайну (варіант A), кеглі × --wb-card-text-scale, як у решти карток. */
.museum {
  --m-g: #0e7a5f;
  --m-gt: #e3f3ec;
  --m-ac: #e07a3c;
  --m-ink: #0f2620;
  --m-ink2: #3d554e;
  --m-ink3: #6e8a82;
  --m-line: #dbe6e1;
  --m-cream: #fbf8f1;
  --m-serif: 'Literata', Georgia, 'Times New Roman', serif;
  display: grid;
  grid-template-columns: clamp(220px, 34.7%, 340px) minmax(0, 1fr);
  min-height: 560px;
  background: var(--m-cream);
  color: var(--m-ink);
}
.museum--no-image { grid-template-columns: minmax(0, 1fr); }
.museum a { color: var(--m-g); pointer-events: auto; }

.museum__img {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 26px 26px 18px;
  background: #ece4d2;
}
/* Портрет не задає висоти рядка: інакше 1164 px оригіналу розтягли б картку. */
.museum__slot {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  background: #fff;
  box-shadow: 0 2px 0 #d8ceb7, 0 10px 24px -12px rgba(0, 0, 0, 0.3);
}
.museum__portrait {
  position: absolute;
  inset: 10px;
  width: calc(100% - 20px);
  height: calc(100% - 20px);
  object-fit: cover;
  object-position: center top;
  background: #f4efe4;
}
.museum__cap {
  font: italic 400 calc(13px * var(--wb-card-text-scale, 1)) / 1.35 var(--m-serif);
  color: #6b5d44;
  text-align: center;
  overflow-wrap: anywhere;
}
.museum__cap a { color: inherit; text-decoration: underline dotted; }

.museum__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 34px 40px 26px;
}
.museum__kick { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.museum__cat {
  font-size: calc(11px * var(--wb-card-text-scale, 1));
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--m-ac);
}
.museum__ig {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 4px 9px 4px 5px;
  border-radius: 999px;
  background: var(--m-gt);
  color: var(--m-g);
  font-size: calc(11px * var(--wb-card-text-scale, 1));
  font-weight: 700;
}
.museum__ig i {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--m-g);
  color: #fff;
  font: italic 700 11px/16px var(--m-serif);
  text-align: center;
}
.museum__title {
  margin: 0;
  font: 700 calc(40px * var(--wb-card-text-scale, 1)) / 1.05 var(--m-serif);
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.museum__sub {
  margin-top: -8px;
  font: italic 400 calc(17px * var(--wb-card-text-scale, 1)) / 1.35 var(--m-serif);
  color: var(--m-ink2);
}

.museum__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: var(--m-line);
  border: 1px solid var(--m-line);
  border-radius: 12px;
  overflow: hidden;
}
.museum__fact { background: #fff; padding: 10px 14px; }
.museum__fact b {
  display: block;
  font: 700 calc(20px * var(--wb-card-text-scale, 1)) / 1.25 var(--m-serif);
  color: var(--m-g);
  overflow-wrap: anywhere;
}
.museum__fact span {
  display: block;
  font-size: calc(11.5px * var(--wb-card-text-scale, 1));
  line-height: 1.3;
  font-weight: 600;
  color: var(--m-ink3);
}

.museum__summary {
  margin: 0;
  font: 400 calc(15px * var(--wb-card-text-scale, 1)) / 1.6 var(--m-serif);
  color: var(--m-ink2);
  text-wrap: pretty;
}

/* Лінія часу — внизу колонки, хоч би скільки тексту було вище. */
.museum__tl {
  position: relative;
  display: flex;
  gap: 8px;
  margin: auto 0 0;
  padding: 12px 0 0;
  list-style: none;
}
.museum__tl::before {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  top: 17px;
  height: 2px;
  background: var(--m-line);
}
.museum__tl li {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  padding-top: 18px;
  font-size: calc(11.5px * var(--wb-card-text-scale, 1));
  line-height: 1.3;
  color: var(--m-ink2);
}
.museum__tl li::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--m-ac);
  border: 2px solid var(--m-cream);
}
.museum__tl b {
  display: block;
  font: 700 calc(15px * var(--wb-card-text-scale, 1)) / 1.3 var(--m-serif);
  color: var(--m-ink);
}

.museum__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--m-line);
}
.museum__src {
  min-width: 0;
  font-size: calc(11px * var(--wb-card-text-scale, 1));
  color: var(--m-ink3);
}
.museum__src b { font-weight: 700; color: var(--m-ink2); }
.museum__more {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  /* Ціль торкання пера й пульта (ТЗ §7). */
  min-height: 32px;
  font-size: calc(12px * var(--wb-card-text-scale, 1));
  font-weight: 700;
  text-decoration: none;
}
</style>
