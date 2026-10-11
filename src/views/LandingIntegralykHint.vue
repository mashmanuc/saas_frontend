<!--
  LandingIntegralykHint — Інтегралик на лендінгу /start.
  ТЗ: saas_docs/frontend/design-system/TZ_START_INTEGRALYK_HINTS_2026-10-11.md (§1–§2 після рев'ю Лови:
  «персонаж як ненав'язлива точка входу — так; автоматична карусель команд — ні»).

  Що бачить гість:
    • через ~2 с у правому нижньому куті — той самий персонаж, що в застосунку (спільний SVG), і ОДНА
      фраза, що не змінюється; фраза ховається через ~8 с або після прокрутки, фігурка лишається;
    • торкнувся фігурки чи фрази → панелька з трьома прикладами результату й кнопкою реєстрації.
      Кнопка — та сама дія, що в головної кнопки лендінгу: батько передає свою через `@register`,
      тож куди веде (і з яким `redirect`) вирішує одне місце, а не копія тут;
    • ✕ на панельці закриває панельку; ✕ на фігурці ховає її до кінця сеансу вкладки.

  Чого тут немає НАВМИСНО (§2): живих викликів моделі, діалогу, імітації чату — лише тексти i18n.

  Розташування (§3): батько передає `guard-selector` — що не можна закривати (головна кнопка, нижні
  посилання). Фігурка, що лягла б на такий елемент, відступає (ховається), доки не розійдуться;
  фраза, що лягла б на нього, з'являється лише після прокрутки нижче першого екрана.
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { INTEGRALYK_SVG_STANDALONE } from '@/modules/intent/integralykMascotSvg'
import { trackIntegralykTap } from '@/utils/siteVisit'

const props = withDefaults(defineProps<{
  /** CSS-селектор елементів, які фігурка й фраза не мають закривати. */
  guardSelector?: string
}>(), { guardSelector: '' })

const emit = defineEmits<{ register: [] }>()

const { t } = useI18n()

/** «Через ~2 с з'являється» (§1.1). */
const APPEAR_DELAY_MS = 2000
/** «Через ~8 с бульбашка ховається» (§1.2). */
const BUBBLE_VISIBLE_MS = 8000
/** Прокрутка, після якої фраза ховається: менше — це тремтіння пальця, а не «прогорнув». */
const SCROLL_HIDE_PX = 120
/** Запас довкола охоронюваних елементів, щоб фраза не лягала впритул до кнопки. */
const GUARD_GAP_PX = 8
/** ✕ на фігурці — «до кінця сеансу вкладки» (§1.4). */
const HIDDEN_KEY = 'm4sh:landing-integralyk-hidden'

const MASCOT_SVG = INTEGRALYK_SVG_STANDALONE
const panelId = useId()
const titleId = useId()

// Текст — computed від t(): змінили мову в шапці — фраза й панелька одразу новою мовою (§2).
const phrase = computed(() => t('roleSelection.integralykHint.phrase'))
const examples = computed(() => [
  t('roleSelection.integralykHint.example1'),
  t('roleSelection.integralykHint.example2'),
  t('roleSelection.integralykHint.example3'),
])

function readHidden(): boolean {
  try {
    return window.sessionStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    // Сховище заборонене (приватне вікно, політика браузера) — пам'яті немає, показуємо фігурку;
    // ✕ однаково сховає її, але лише до перезавантаження сторінки.
    return false
  }
}

function writeHidden(): void {
  try {
    window.sessionStorage.setItem(HIDDEN_KEY, '1')
  } catch {
    // Сховище заборонене — фігурку вже сховано на цій сторінці; після перезавантаження з'явиться знову.
  }
}

/** Фігурку сховали ✕ у цьому сеансі вкладки — не малюємо нічого. */
const dismissed = ref(readHidden())
const figureShown = ref(false)
/**
 * Фраза: `idle` — ще не час; `measuring` — намальована невидимо, щоб виміряти, чи не ляже на
 * охоронюваний елемент; `shown`; `deferred` — лягла б, чекає прокрутки нижче першого екрана;
 * `gone` — показали й сховали (більше не з'являється).
 */
type BubbleState = 'idle' | 'measuring' | 'shown' | 'deferred' | 'gone'
const bubble = ref<BubbleState>('idle')
const panelOpen = ref(false)
/** Фігурка відступила: зараз лягла б на охоронюваний елемент. */
const aside = ref(false)
/** prefers-reduced-motion: без анімації появи/дихання, фраза змінюється без переходу (§3). */
const still = ref(false)

const bubbleEl = ref<HTMLElement | null>(null)
const figureWrapEl = ref<HTMLElement | null>(null)
const figureBtnEl = ref<HTMLButtonElement | null>(null)
let bubbleShownAtY = 0

// ── Таймери на паузі, поки вкладку сховано (§3: «таймер підказок на паузі») ──
interface PausableTimer { run(): void; pause(): void; cancel(): void }

function pausableTimeout(fn: () => void, ms: number): PausableTimer {
  let remaining = ms
  let startedAt = 0
  let handle: ReturnType<typeof setTimeout> | null = null
  let done = false
  return {
    run() {
      if (done || handle !== null) return
      startedAt = Date.now()
      handle = setTimeout(() => {
        handle = null
        done = true
        fn()
      }, remaining)
    },
    pause() {
      if (handle === null) return
      clearTimeout(handle)
      handle = null
      remaining = Math.max(0, remaining - (Date.now() - startedAt))
    },
    cancel() {
      done = true
      if (handle !== null) clearTimeout(handle)
      handle = null
    },
  }
}

let appearTimer: PausableTimer | null = null
let bubbleTimer: PausableTimer | null = null

function tabHidden(): boolean {
  return document.visibilityState === 'hidden'
}

function startTimer(timer: PausableTimer): PausableTimer {
  if (!tabHidden()) timer.run()
  return timer
}

function onVisibilityChange(): void {
  if (tabHidden()) {
    appearTimer?.pause()
    bubbleTimer?.pause()
  } else {
    appearTimer?.run()
    bubbleTimer?.run()
  }
}

// ── Охоронювані елементи (§3: не перекривати головну кнопку й нижні посилання) ──
function hitsGuard(el: Element | null): boolean {
  if (!el || !props.guardSelector) return false
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false
  for (const guard of Array.from(document.querySelectorAll(props.guardSelector))) {
    const g = guard.getBoundingClientRect()
    if (g.width <= 0 || g.height <= 0) continue
    if (r.left < g.right + GUARD_GAP_PX && r.right > g.left - GUARD_GAP_PX
      && r.top < g.bottom + GUARD_GAP_PX && r.bottom > g.top - GUARD_GAP_PX) return true
  }
  return false
}

function checkAside(): void {
  // Відкриту панельку людина відкрила сама — фігурку під нею не ховаємо.
  aside.value = figureShown.value && !panelOpen.value && hitsGuard(figureWrapEl.value)
}

// ── Фраза ──
function placeBubble(): void {
  if (bubble.value !== 'measuring') return
  if (aside.value || hitsGuard(bubbleEl.value)) {
    bubble.value = 'deferred'
    return
  }
  bubble.value = 'shown'
  bubbleShownAtY = window.scrollY
  bubbleTimer = startTimer(pausableTimeout(() => {
    if (bubble.value === 'shown') bubble.value = 'gone'
  }, BUBBLE_VISIBLE_MS))
}

function measureBubble(): void {
  bubble.value = 'measuring'
  void nextTick(placeBubble)
}

function hideBubble(): void {
  bubbleTimer?.cancel()
  bubbleTimer = null
  if (bubble.value !== 'idle') bubble.value = 'gone'
}

function appear(): void {
  appearTimer = null
  figureShown.value = true
  void nextTick(() => {
    checkAside()
    measureBubble()
  })
}

function onScroll(): void {
  checkAside()
  const y = window.scrollY
  if (bubble.value === 'shown' && Math.abs(y - bubbleShownAtY) >= SCROLL_HIDE_PX) {
    hideBubble()
  } else if (bubble.value === 'deferred' && y >= window.innerHeight) {
    measureBubble()
  }
}

// ── Панелька ──
function openPanel(): void {
  if (panelOpen.value) return
  panelOpen.value = true
  aside.value = false
  hideBubble()
  trackIntegralykTap()
}

function closePanel(): void {
  if (!panelOpen.value) return
  panelOpen.value = false
  void nextTick(() => {
    checkAside()
    figureBtnEl.value?.focus()
  })
}

function togglePanel(): void {
  if (panelOpen.value) closePanel()
  else openPanel()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && panelOpen.value) closePanel()
}

function register(): void {
  emit('register')
}

// ── Життєвий цикл ──
function teardown(): void {
  appearTimer?.cancel()
  appearTimer = null
  bubbleTimer?.cancel()
  bubbleTimer = null
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', checkAside)
  document.removeEventListener('keydown', onKeydown)
}

function hideForSession(): void {
  dismissed.value = true
  panelOpen.value = false
  writeHidden()
  teardown()
}

onMounted(() => {
  if (dismissed.value) return
  still.value = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', checkAside)
  document.addEventListener('keydown', onKeydown)
  appearTimer = startTimer(pausableTimeout(appear, APPEAR_DELAY_MS))
})

onBeforeUnmount(teardown)
</script>

<template>
  <div
    v-if="!dismissed"
    class="lih"
    :class="{ 'lih--still': still, 'lih--aside': aside }"
    :data-motion="still ? 'reduce' : 'full'"
    data-test="landing-integralyk"
  >
    <Transition name="lih-panel" :css="!still">
      <section
        v-if="panelOpen"
        :id="panelId"
        class="lih-panel"
        :aria-labelledby="titleId"
        data-test="integralyk-panel"
      >
        <div class="lih-panel-head">
          <p :id="titleId" class="lih-panel-title">{{ phrase }}</p>
          <button
            type="button"
            class="lih-x lih-x--panel"
            :aria-label="t('roleSelection.integralykHint.closeLabel')"
            data-test="integralyk-panel-close"
            @click="closePanel"
          >✕</button>
        </div>
        <ul class="lih-examples">
          <li v-for="(example, i) in examples" :key="i" class="lih-example">{{ example }}</li>
        </ul>
        <!-- Напис — той самий ключ, що в головної кнопки лендінгу: одна дія — один напис. -->
        <button type="button" class="lih-cta" data-test="integralyk-cta" @click="register">
          {{ t('roleSelection.hero.ctaTutor') }}
        </button>
        <p class="lih-note">{{ t('roleSelection.integralykHint.note') }}</p>
      </section>
    </Transition>

    <!-- aria-live живе з першого кадру: читалка оголошує фразу, коли вона з'являється всередині. -->
    <div class="lih-live" aria-live="polite">
      <Transition name="lih-fade" :css="!still">
        <p
          v-if="bubble === 'measuring' || bubble === 'shown'"
          ref="bubbleEl"
          class="lih-bubble"
          :class="{ 'lih-bubble--measuring': bubble === 'measuring' }"
          data-test="integralyk-bubble"
          @click="openPanel"
        >{{ phrase }}</p>
      </Transition>
    </div>

    <Transition name="lih-pop" :css="!still">
      <div v-if="figureShown" ref="figureWrapEl" class="lih-figure-wrap" data-test="integralyk-figure-wrap">
        <button
          ref="figureBtnEl"
          type="button"
          class="lih-figure"
          :aria-label="t('roleSelection.integralykHint.openLabel')"
          :aria-expanded="panelOpen ? 'true' : 'false'"
          :aria-controls="panelOpen ? panelId : undefined"
          data-test="integralyk-figure"
          @click="togglePanel"
        >
          <span class="lih-mascot" aria-hidden="true" v-html="MASCOT_SVG"></span>
        </button>
        <button
          type="button"
          class="lih-x lih-x--figure"
          :aria-label="t('roleSelection.integralykHint.hideLabel')"
          data-test="integralyk-hide"
          @click="hideForSession"
        >✕</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Кольори — лише токени теми (світла, класична, темна): --card-bg, --text-*, --border-color, --accent*. */
.lih {
  position: fixed;
  right: 24px;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  /* Нижче шапки лендінгу (z-index 100) і її меню мов. */
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  /* Запас під ✕ фігурки, що виступає над нею на 6 px. */
  gap: 14px;
  /* Порожній кут не ловить кліків — лише самі елементи. */
  pointer-events: none;
}
.lih-panel,
.lih-bubble,
.lih-figure-wrap {
  pointer-events: auto;
}

/* ── Фігурка ── */
.lih-figure-wrap {
  position: relative;
  width: 64px;
  height: 64px;
}
.lih-figure {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  filter: drop-shadow(0 6px 14px var(--shadow-strong));
}
.lih-figure:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}
.lih-mascot {
  display: block;
  width: 100%;
  height: 100%;
}
.lih-mascot :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
/* Дихання й кліпання — як у палітрі на дошці (svg іде через v-html, тому :deep). */
.lih-mascot :deep(.itg-body) { transform-origin: 50px 62px; animation: lih-breath 4.2s ease-in-out infinite; }
.lih-mascot :deep(.itg-eye) { animation: lih-blink 4.6s linear infinite; }
.lih-mascot :deep(.itg-e2) { animation-delay: 0.05s; }
@keyframes lih-breath { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-1.4px) scale(1.012); } }
@keyframes lih-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.12); } }

/* ✕ — і на фігурці, і на панельці. */
.lih-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.lih-x:hover { color: var(--text-primary); }
.lih-x:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.lih-x--figure {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 22px;
  height: 22px;
}
/* Ціль для пальця більша за кружечок. */
.lih-x--figure::before {
  content: '';
  position: absolute;
  inset: -8px;
}
.lih-x--panel {
  flex: none;
  width: 28px;
  height: 28px;
}

/* ── Фраза ── */
.lih-bubble {
  margin: 0;
  max-width: min(70vw, 260px);
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 14px 14px 4px 14px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.35;
  box-shadow: 0 6px 20px var(--shadow-strong);
  cursor: pointer;
}
/* Вимір перед показом: місце займає, але не видно. */
.lih-bubble--measuring { visibility: hidden; }

/* ── Панелька ── */
.lih-panel {
  box-sizing: border-box;
  width: min(320px, calc(100vw - 32px));
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--card-bg);
  color: var(--text-primary);
  box-shadow: 0 10px 32px var(--shadow-strong);
}
.lih-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.lih-panel-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
}
.lih-examples {
  margin: 12px 0 14px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lih-example {
  position: relative;
  padding-left: 16px;
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--text-primary);
}
.lih-example::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 0.5em;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
.lih-cta {
  display: block;
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}
.lih-cta:hover { background: var(--accent-hover); }
.lih-cta:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.lih-note {
  margin: 8px 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-align: center;
}

/* ── Відступ: фігурка лягла б на охоронюваний елемент ── */
.lih-figure-wrap,
.lih-live {
  transition: opacity 0.2s ease, visibility 0.2s;
}
.lih--aside .lih-figure-wrap,
.lih--aside .lih-live {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

/* ── Переходи ── */
.lih-pop-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.lih-pop-enter-from { opacity: 0; transform: translateY(8px) scale(0.9); }
.lih-fade-enter-active,
.lih-fade-leave-active { transition: opacity 0.2s ease; }
.lih-fade-enter-from,
.lih-fade-leave-to { opacity: 0; }
.lih-panel-enter-active,
.lih-panel-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.lih-panel-enter-from,
.lih-panel-leave-to { opacity: 0; transform: translateY(6px); }

/* ── Менше руху: без появи, дихання й переходів ── */
.lih--still .lih-mascot :deep(.itg-body),
.lih--still .lih-mascot :deep(.itg-eye) { animation: none; }
.lih--still .lih-figure-wrap,
.lih--still .lih-live,
.lih--still .lih-cta { transition: none; }
@media (prefers-reduced-motion: reduce) {
  .lih-mascot :deep(.itg-body),
  .lih-mascot :deep(.itg-eye) { animation: none; }
  .lih-figure-wrap,
  .lih-live,
  .lih-cta { transition: none; }
}

/* ── Телефон: фігурка ≤ 56 px (§3) ── */
@media (max-width: 767px) {
  .lih {
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  }
  .lih-figure-wrap {
    width: 56px;
    height: 56px;
  }
}
</style>
