<template>
  <!-- «Прибрати зайві» (TZ_MIRROR_SNAPSHOTS_GROUPING §1, §2.4): спершу лише підрахунок, далі — одна дія.
       Прибираються тільки знімки, на які ніщо не посилається: ні дошка, ні запис уроку (навіть у кошику), ні шаблон.
       Чесно про місце: якщо урок записано, усі кадри — частина запису, і прибрати нічого. -->
  <Teleport to="body">
  <div class="wb-tidy__scrim" data-testid="mirror-tidy-dialog" @click.self="emit('close')">
    <section class="wb-tidy" role="dialog" aria-modal="true" :aria-label="t('winterboard.library.mirror.tidy')">
      <header class="wb-tidy__top">
        <h2 class="wb-tidy__title">{{ t('winterboard.library.mirror.tidyTitle', { name: folderName }) }}</h2>
        <button type="button" class="wb-tidy__x" :aria-label="t('common.close')" @click="emit('close')">×</button>
      </header>

      <p v-if="phase === 'loading' || phase === 'working'" class="wb-tidy__text" role="status">
        {{ t(phase === 'loading' ? 'winterboard.library.mirror.counting' : 'winterboard.library.mirror.working') }}
      </p>

      <p v-else-if="phase === 'error'" class="wb-tidy__problem" role="status" data-testid="mirror-tidy-error">
        {{ t('winterboard.library.mirror.failed') }}
      </p>

      <template v-else-if="phase === 'ready' && result">
        <p v-if="result.usage_unknown" class="wb-tidy__problem" data-testid="mirror-tidy-unknown">
          {{ t('winterboard.library.mirror.unknown') }}
        </p>
        <template v-else>
          <p class="wb-tidy__text" data-testid="mirror-tidy-summary">
            {{ t('winterboard.library.mirror.total', { n: result.total, size: mb(result.total_bytes) }) }}
          </p>
          <p class="wb-tidy__text wb-tidy__text--strong" data-testid="mirror-tidy-free">
            {{ t('winterboard.library.mirror.free', { n: result.free.length, size: mb(result.free_bytes) }) }}
          </p>
          <p v-if="result.used.length" class="wb-tidy__text" data-testid="mirror-tidy-used">
            {{ t('winterboard.library.mirror.used', { n: result.used.length }) }}
          </p>
          <ul v-if="result.used.length" class="wb-tidy__holders">
            <li v-if="holders.replay.length" data-testid="mirror-tidy-replays">
              {{ t('winterboard.library.mirror.inReplays', { titles: names(holders.replay) }) }}
            </li>
            <li v-if="holders.board.length">{{ t('winterboard.library.mirror.onBoards', { titles: names(holders.board) }) }}</li>
            <li v-if="holders.template">{{ t('winterboard.library.mirror.inTemplate') }}</li>
          </ul>
          <p v-if="!result.free.length && holders.replay.length" class="wb-tidy__hint" data-testid="mirror-tidy-howto">
            {{ t('winterboard.library.mirror.howToFree') }}
          </p>
          <p v-if="result.free.length" class="wb-tidy__hint">{{ t('winterboard.library.mirror.archiveNote') }}</p>
        </template>
      </template>

      <p v-else-if="phase === 'done' && result" class="wb-tidy__text wb-tidy__text--strong" role="status" data-testid="mirror-tidy-done">
        {{ t('winterboard.library.mirror.done', { n: result.archived }) }}
      </p>

      <footer class="wb-tidy__actions">
        <button v-if="phase === 'error'" type="button" class="wb-tidy__btn" @click="count">
          {{ t('winterboard.library.mirror.again') }}
        </button>
        <button
          v-if="canTidy"
          type="button"
          class="wb-tidy__btn is-on"
          data-testid="mirror-tidy-run"
          @click="run"
        >{{ t('winterboard.library.mirror.run', { n: result!.free.length }) }}</button>
        <button type="button" class="wb-tidy__btn" @click="emit('close')">{{ t('common.close') }}</button>
      </footer>
    </section>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { mirrorCleanup } from '../../api/library'
import type { MirrorCleanupResult } from '../../types/library'

const props = defineProps<{ folderId: number; folderName: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'done'): void }>()
const { t } = useI18n()

const phase = ref<'loading' | 'ready' | 'working' | 'done' | 'error'>('loading')
const result = ref<MirrorCleanupResult | null>(null)

const canTidy = computed(() =>
  phase.value === 'ready' && !!result.value && !result.value.usage_unknown && result.value.free.length > 0)

/** Хто тримає знімки: назви записів і дощок без повторів; шаблон — так/ні */
const holders = computed(() => {
  const replay = new Set<string>()
  const board = new Set<string>()
  let template = false
  for (const u of result.value?.used ?? []) {
    for (const h of u.holders) {
      if (h.kind === 'replay') replay.add(h.title || t('winterboard.library.mirror.untitled'))
      else if (h.kind === 'board') board.add(h.title || t('winterboard.library.mirror.untitled'))
      else if (h.kind === 'template') template = true
    }
  }
  return { replay: [...replay], board: [...board], template }
})

function names(list: string[]): string {
  const shown = list.slice(0, 3).map((s) => `«${s}»`).join(', ')
  return list.length > 3 ? t('winterboard.library.mirror.andMore', { list: shown, n: list.length - 3 }) : shown
}

function mb(bytes: number): string {
  if (!bytes) return t('winterboard.library.mirror.mb', { n: '0' })
  const v = bytes / (1024 * 1024)
  return t('winterboard.library.mirror.mb', { n: (v < 0.1 ? 0.1 : v).toFixed(1).replace('.', ',') })
}

async function count(): Promise<void> {
  phase.value = 'loading'
  try {
    result.value = await mirrorCleanup(props.folderId, true)
    phase.value = 'ready'
  } catch (err) {
    console.error('[WB:Library] mirror cleanup count failed', err)
    phase.value = 'error'
  }
}

async function run(): Promise<void> {
  phase.value = 'working'
  try {
    // Сервер рахує облік заново й прибирає лише те, що вільне саме зараз
    result.value = await mirrorCleanup(props.folderId, false)
    phase.value = result.value.usage_unknown ? 'ready' : 'done'
    if (!result.value.usage_unknown) emit('done')
  } catch (err) {
    console.error('[WB:Library] mirror cleanup failed', err)
    phase.value = 'error'
  }
}

onMounted(count)
</script>

<style scoped>
.wb-tidy__scrim {
  position: fixed; inset: 0; z-index: var(--z-modal, 210); display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(2, 6, 23, .55);
}
.wb-tidy {
  width: min(480px, 100%); max-height: calc(100dvh - 32px); overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
  padding: 16px 20px; border-radius: 14px; background: #fff; color: #0f172a; box-shadow: 0 20px 50px rgba(2, 6, 23, .35);
}
.wb-tidy__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.wb-tidy__title { margin: 0; font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
.wb-tidy__x { flex: none; width: 36px; height: 36px; border: 0; border-radius: 10px; background: #f1f5f9; font-size: 20px; cursor: pointer; }
.wb-tidy__text { margin: 0; font-size: 15px; }
.wb-tidy__text--strong { font-weight: 600; }
.wb-tidy__holders { margin: 0; padding-left: 20px; font-size: 14px; color: #334155; display: flex; flex-direction: column; gap: 4px; }
.wb-tidy__problem { margin: 0; padding: 10px 12px; border-radius: 10px; background: #fef3c7; color: #78350f; font-size: 14px; }
.wb-tidy__hint { margin: 0; font-size: 13px; color: #475569; }
.wb-tidy__actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
.wb-tidy__btn {
  min-height: 40px; padding: 0 16px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.wb-tidy__btn.is-on { background: #047857; border-color: #047857; color: #fff; }
</style>
