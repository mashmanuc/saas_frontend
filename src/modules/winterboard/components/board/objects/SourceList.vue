<!--
  SourceList — підвал доказових джерел, спільний для шкали й карти (H2–H3).

  Той самий контракт, що в картці теорії (H0): компактний рядок «Джерела: N»,
  клік розгортає назву, автора, ліцензію, версію й дату отримання. Клікабельне
  лише справжнє веб-посилання — інакше `javascript:` з чужих метаданих став би
  активним у картці вчителя.

  Окремий компонент, а не копія коду: два майже-однакові підвали розійшлися б
  за місяць, і в одному з них перевірка посилання тихо зникла б.
-->
<template>
  <div v-if="list.length" class="source-list">
    <button
      type="button"
      class="source-list__toggle"
      :aria-expanded="open"
      @click.stop="open = !open"
      @mousedown.stop
      @pointerdown.stop
    >{{ labels.sources }}: {{ list.length }}</button>

    <ol v-if="open" class="source-list__items">
      <li v-for="(ref, i) in list" :key="i" class="source-list__item">
        <a
          v-if="isWebUrl(ref.url)"
          class="source-list__title"
          :href="ref.url"
          target="_blank"
          rel="noopener noreferrer nofollow"
          @click.stop @mousedown.stop @pointerdown.stop
        >{{ ref.title }}</a>
        <span v-else class="source-list__title source-list__title--plain">{{ ref.title }}</span>

        <span v-if="ref.author" class="source-list__meta">{{ labels.author }}: {{ ref.author }}</span>
        <span v-if="ref.license" class="source-list__meta">
          {{ labels.license }}:
          <a
            v-if="isWebUrl(ref.license_url)"
            class="source-list__license-link"
            :href="ref.license_url"
            target="_blank"
            rel="noopener noreferrer nofollow"
            @click.stop @mousedown.stop @pointerdown.stop
          >{{ ref.license }}</a>
          <template v-else>{{ ref.license }}</template>
        </span>
        <span v-if="ref.revision_id" class="source-list__meta">{{ labels.revision }}: {{ ref.revision_id }}</span>
        <span v-if="retrievedDay(ref.retrieved_at)" class="source-list__meta">
          {{ labels.retrieved }}: {{ retrievedDay(ref.retrieved_at) }}
        </span>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WBSourceRef } from '../../../types/winterboard'
import {
  SOURCE_LIST_LABELS, isWebUrl, retrievedDay, type MaterialLanguage,
} from '../../../board/timelinePresentation'

const props = withDefaults(
  defineProps<{ sources?: WBSourceRef[] | null; language?: MaterialLanguage }>(),
  { sources: null, language: 'uk' },
)

const open = ref(false)
const list = computed<WBSourceRef[]>(() => Array.isArray(props.sources) ? props.sources : [])
const labels = computed(() => SOURCE_LIST_LABELS[props.language === 'en' ? 'en' : 'uk'])
</script>

<style scoped>
.source-list { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; pointer-events: auto; }
.source-list__toggle {
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: calc(12px * var(--wb-card-text-scale, 1)); color: #64748b;
  text-decoration: underline dotted;
}
.source-list__items { margin: 6px 0 0; padding-left: 18px; }
.source-list__item { margin-bottom: 4px; font-size: calc(11px * var(--wb-card-text-scale, 1)); color: #64748b; }
.source-list__title { color: #2563eb; }
.source-list__title--plain { color: #64748b; }
.source-list__license-link { color: #2563eb; }
.source-list__meta { display: block; }
</style>
