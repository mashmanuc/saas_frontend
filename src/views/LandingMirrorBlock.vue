<script setup lang="ts">
/**
 * Лендінг /start — блок «Дзеркало»: коротке відео звичайної крейдяної дошки.
 *
 * 2026-10-11, власник: «роби відео Дзеркала, але так, щоб я міг змінити потім, як кращі
 * зніму». Тому відео змінне зі staff (`LandingConfig.mirror_video_url` / `_poster_url`,
 * поле в «Налаштуваннях платформи»), а без нього — вбудоване типове відео з дробами
 * (`public/landing/mirror-drobi.mp4`, урок 9 жовтня 2026).
 *
 * Дані — той самий публічний `GET /landing-config/`, що читає сторінка для демо-запису.
 * Сторінка й блок просять його в одному такті монтування, і apiClient склеює однакові
 * GET у польоті (транспортний дедуп, `src/utils/apiClient.js`) — у мережу йде один запит.
 *
 * Відео: без звуку, по колу, без перемоток. Вантажиться лише коли блок біля екрана
 * (IntersectionObserver, `preload="none"`), поза екраном — на паузі. Хто просив менше руху
 * (`prefers-reduced-motion`) — лише постер і кнопка ▶, нічого не вантажиться без натискання.
 * Відео з адмінки не відкрилось (404, не той формат, CSP) — тихо повертаємось до типового.
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'

const DEFAULT_VIDEO = '/landing/mirror-drobi.mp4'
const DEFAULT_POSTER = '/landing/mirror-drobi.jpg'

interface MirrorVideo { url: string; poster: string }

const { t } = useI18n()

const frameRef = ref<HTMLElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)

/** landing-config прочитано (або не вдалось — тоді типове відео). До того src не ставимо. */
const resolved = ref(false)
const adminVideo = ref<MirrorVideo | null>(null)
const adminFailed = ref(false)
/** Типове теж не відкрилось — лишається постер, без кнопок. */
const broken = ref(false)

const reduceMotion = ref(false)
const inView = ref(false)
/** Відео вже можна вантажити: блок біля екрана (або людина натиснула ▶). Назад не скидається. */
const activated = ref(false)
const playing = ref(false)
const userPaused = ref(false)
/** Браузер не дав грати саме (режим економії, політика автозапуску) — показуємо ▶. */
const autoplayBlocked = ref(false)

let observer: IntersectionObserver | null = null

const usingDefault = computed(() => !adminVideo.value || adminFailed.value)
const videoUrl = computed(() => (usingDefault.value ? DEFAULT_VIDEO : adminVideo.value!.url))
const posterUrl = computed(() => {
  if (!resolved.value) return ''
  return usingDefault.value ? DEFAULT_POSTER : adminVideo.value!.poster
})
const src = computed(() => (resolved.value && activated.value ? videoUrl.value : ''))
const showPlay = computed(() => resolved.value && !broken.value && !playing.value
  && (reduceMotion.value || userPaused.value || autoplayBlocked.value))

const isHttps = (v: unknown): v is string => typeof v === 'string' && /^https:\/\/\S+$/i.test(v.trim())

/** `mirror_video` з landing-config → `{url, poster}`; будь-що інше — null (типове відео). */
function toMirrorVideo(raw: unknown): MirrorVideo | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isHttps(r.url)) return null
  return { url: r.url.trim(), poster: isHttps(r.poster) ? r.poster.trim() : '' }
}

function tryPlay() {
  const el = videoRef.value
  if (!el || !src.value) return
  el.muted = true // і властивість: деякі браузери дивляться лише на неї перед автозапуском
  let result: Promise<void> | undefined
  try {
    result = el.play()
  } catch (err) {
    console.warn('[LandingMirrorBlock] відео не запустилось', err)
    autoplayBlocked.value = true
    return
  }
  result?.catch?.((err: unknown) => {
    const name = (err as { name?: string })?.name
    // AbortError — пауза прийшла раніше за старт (блок прогорнули); NotSupportedError — файл
    // не відкрився, це обробляє `@error` (відкат на типове). Ні те, ні те не «заборона грати».
    if (name === 'AbortError' || name === 'NotSupportedError') return
    console.warn('[LandingMirrorBlock] браузер не дав грати саме — показуємо ▶', err)
    autoplayBlocked.value = true
  })
}

function maybeActivate() {
  if (!resolved.value || reduceMotion.value || !inView.value) return
  if (!activated.value) {
    activated.value = true
    nextTick(tryPlay) // src з'явиться в DOM після перемальовування
  } else if (!userPaused.value && !autoplayBlocked.value) {
    tryPlay()
  }
}

function onIntersect(entries: IntersectionObserverEntry[]) {
  // Останній запис: у пачці перший буває застарілим (блок уже прогорнули назад)
  inView.value = !!entries[entries.length - 1]?.isIntersecting
  if (inView.value) maybeActivate()
  else if (playing.value) videoRef.value?.pause()
}

function onPlayClick() {
  userPaused.value = false
  autoplayBlocked.value = false
  if (!activated.value) {
    activated.value = true
    nextTick(tryPlay)
  } else {
    tryPlay()
  }
}

function onPauseClick() {
  userPaused.value = true
  videoRef.value?.pause()
}

function onVideoError() {
  if (!src.value) return // помилка без адреси (ще не призначена) — не наша
  if (!usingDefault.value) {
    console.warn('[LandingMirrorBlock] відео з налаштувань не відкрилось — показуємо типове', adminVideo.value?.url)
    adminFailed.value = true
    playing.value = false
    autoplayBlocked.value = false // відмова була про файл, а не про автозапуск
    // Грати типове — лише якщо й так мало б грати: блок на екрані (або людина сама натиснула ▶)
    nextTick(() => {
      if (reduceMotion.value || (inView.value && !userPaused.value)) tryPlay()
    })
    return
  }
  console.warn('[LandingMirrorBlock] типове відео не відкрилось — лишається постер', DEFAULT_VIDEO)
  broken.value = true
  playing.value = false
}

onMounted(() => {
  reduceMotion.value = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  // Vue ставить `muted` лише властивістю; Safari для автозапуску дивиться й на атрибут
  if (videoRef.value) {
    videoRef.value.defaultMuted = true
    videoRef.value.muted = true
  }

  api.get('/landing-config/')
    .then((res: any) => { adminVideo.value = toMirrorVideo(res?.mirror_video) })
    .catch((err: unknown) => {
      console.warn('[LandingMirrorBlock] landing-config не прочитано — типове відео', err)
    })
    .finally(() => {
      resolved.value = true
      maybeActivate()
    })

  if (reduceMotion.value) return // без автопрогравання спостерігати нема за чим
  if (typeof IntersectionObserver === 'undefined' || !frameRef.value) {
    inView.value = true // старий браузер: без лінивого завантаження, але відео є
    return
  }
  observer = new IntersectionObserver(onIntersect, { rootMargin: '200px 0px' })
  observer.observe(frameRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <section class="landing-mirror" data-test="landing-mirror">
    <div class="landing-mirror-grid">
      <div class="landing-mirror-text">
        <h2 class="landing-mirror-title">{{ t('roleSelection.mirror.title') }}</h2>
        <p class="landing-mirror-body">{{ t('roleSelection.mirror.body') }}</p>
      </div>
      <figure class="landing-mirror-media">
        <div ref="frameRef" class="landing-mirror-frame">
          <video
            ref="videoRef"
            class="landing-mirror-video"
            :src="src || undefined"
            :poster="posterUrl || undefined"
            :autoplay="!reduceMotion"
            muted
            loop
            playsinline
            preload="none"
            disablepictureinpicture
            disableremoteplayback
            tabindex="-1"
            :aria-label="t('roleSelection.mirror.videoLabel')"
            data-test="landing-mirror-video"
            @playing="playing = true"
            @pause="playing = false"
            @error="onVideoError"
          />
          <button
            v-if="showPlay"
            type="button"
            class="landing-mirror-play"
            :aria-label="t('roleSelection.mirror.play')"
            data-test="landing-mirror-play"
            @click="onPlayClick"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4" /></svg>
          </button>
          <!-- Пауза для тих, кому рух заважає (WCAG 2.2.2); перемоток немає навмисно -->
          <button
            v-else-if="playing"
            type="button"
            class="landing-mirror-pause"
            :aria-label="t('roleSelection.mirror.pause')"
            data-test="landing-mirror-pause"
            @click="onPauseClick"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
          </button>
        </div>
        <!-- Дата — лише для типового відео: про відео з адмінки ми її не знаємо -->
        <figcaption v-if="usingDefault" class="landing-mirror-caption" data-test="landing-mirror-caption">
          {{ t('roleSelection.mirror.caption') }}
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.landing-mirror {
  /* Знизу теж: наступна на сторінці картка «Я хочу вчити» власного верхнього відступу не має */
  margin: 4rem 0 3rem;
  text-align: left;
}

.landing-mirror-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 3rem;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
}

.landing-mirror-text {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.landing-mirror-title {
  font-family: 'Space Grotesk', var(--font-sans);
  font-size: clamp(1.6rem, 2.8vw, 2.25rem);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
  text-wrap: balance; /* без «M4SH» самотою в останньому рядку на телефоні */
}

.landing-mirror-body {
  font-size: 1.1rem;
  color: var(--text-secondary);
  line-height: 1.65;
  margin: 0;
}

.landing-mirror-media {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.landing-mirror-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 1rem;
  overflow: hidden;
  /* Тло крейдяної дошки — поки немає постера чи кадру, рамка не біла */
  background: #1f3b34;
  box-shadow: 0 12px 24px var(--shadow-strong, rgba(0, 0, 0, 0.18));
  border: 1px solid var(--border-color);
}

.landing-mirror-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.landing-mirror-play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 4px; /* оптичний центр трикутника */
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.landing-mirror-play:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.05);
}

.landing-mirror-pause {
  position: absolute;
  right: 0.6rem;
  bottom: 0.6rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.2s ease;
}

.landing-mirror-pause:hover,
.landing-mirror-pause:focus-visible {
  opacity: 1;
}

.landing-mirror-play:focus-visible,
.landing-mirror-pause:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.landing-mirror-caption {
  font-size: 0.82rem;
  color: var(--text-secondary);
  opacity: 0.75;
  text-align: center;
  margin: 0;
}

@media (max-width: 900px) {
  .landing-mirror {
    margin: 3rem 0 2.5rem;
    text-align: center;
  }

  .landing-mirror-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .landing-mirror-text {
    align-items: center;
  }

  .landing-mirror-body {
    max-width: 520px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-mirror-play,
  .landing-mirror-pause {
    transition: none;
  }

  .landing-mirror-play:hover {
    transform: none;
  }
}
</style>
