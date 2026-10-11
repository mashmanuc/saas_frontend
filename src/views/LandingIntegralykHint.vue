<!--
  LandingIntegralykHint — Інтегралик на лендінгу /start.
  ТЗ: saas_docs/frontend/design-system/TZ_START_INTEGRALYK_HINTS_2026-10-11.md — §1–§6 і §7 (рішення власника
  2026-10-11 після перегляду: «Інтегралик через певну кількість секунд мав би видавати нове повідомлення про свої
  можливості… І так циклічно»; «його не можна рухати — він прив'язаний… треба як в коді»).

  Що бачить гість:
    • через ~2 с у правому нижньому куті — той самий персонаж, що в застосунку (спільний SVG);
    • підказки ПО КОЛУ без кінця: бульбашка ~6 с, пауза ~6 с, наступна (5 текстів). Пауза, коли відкрита
      панелька, коли вкладку сховано, коли фігурку тягнуть. Прокрутка ховає поточну бульбашку раніше —
      коло йде далі;
    • фігурку можна перетягнути пальцем, пером чи мишею — як кнопку Інтегралика на дошці (та сама логіка,
      повторена в `useDraggableFab`); місце запам'ятовується, не виходить за край, після повороту екрана повертається
      в межі. Бульбашка й панелька їдуть з фігуркою і стають з того боку, де є місце;
    • короткий дотик без руху → панелька з трьома прикладами результату й кнопкою реєстрації. Кнопка — та
      сама дія, що в головної кнопки лендінгу: батько передає свою через `@register`;
    • ✕ на панельці закриває панельку; ✕ на фігурці ховає її до кінця сеансу вкладки;
    • на комп'ютері зіниці Інтегралика стежать за курсором — як у палітри на дошці (власник 2026-10-11:
      «на комп'ютері очі Інтегралика бігають за курсором миші»). Палець — ні; reduced-motion — ні.

  Чого тут немає НАВМИСНО (§2): живих викликів моделі, діалогу, імітації чату — лише тексти i18n.

  Розташування (§3): батько передає `guard-selector` — що не можна закривати (кнопки першого екрана, нижні
  посилання). На ТИПОВОМУ місці фігурка, що лягла б на такий елемент, відступає (ховається), а бульбашка,
  що лягла б на кнопку, у першому екрані не показується. Куди людина перетягнула сама — її вибір (§7).
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDraggableFab } from '@/composables/useDraggableFab'
import { INTEGRALYK_SVG_STANDALONE } from '@/modules/intent/integralykMascotSvg'
import { trackIntegralykTap } from '@/utils/siteVisit'

const props = withDefaults(defineProps<{
  /** CSS-селектор елементів, які фігурка й бульбашка на типовому місці не мають закривати. */
  guardSelector?: string
}>(), { guardSelector: '' })

const emit = defineEmits<{ register: [] }>()

const { t } = useI18n()

/** «Через ~2 с з'являється» (§1.1). */
const APPEAR_DELAY_MS = 2000
/** Бульбашка тримається ~6 с (§7). */
const HINT_SHOW_MS = 6000
/** …і ховається на ~6 с перед наступною (§7). */
const HINT_REST_MS = 6000
/** Прокрутка, після якої поточна бульбашка ховається раніше: менше — тремтіння пальця. */
const SCROLL_HIDE_PX = 120
/** Запас довкола охоронюваних елементів, щоб бульбашка не лягала впритул до кнопки. */
const GUARD_GAP_PX = 8
/** Між фігуркою й бульбашкою/панелькою: запас під ✕ фігурки, що виступає над нею на 6 px. */
const POP_GAP_PX = 14
/** Бульбашка й панелька — не ближче до краю екрана. */
const POP_EDGE_PX = 8
/** Фігурка — не ближче до краю екрана: ✕ на ній виступає на 6 px. */
const FIGURE_EDGE_PX = 10
/** ✕ на фігурці — «до кінця сеансу вкладки» (§1.4). */
const HIDDEN_KEY = 'm4sh:landing-integralyk-hidden'
/** Куди людина перетягнула фігурку (§7: «свій ключ для лендінгу»; дошка — `m4sh_integralyk_pos`). */
const POS_KEY = 'm4sh:landing-integralyk-pos'
/** На скільки зіниця відходить від центру ока до курсора — як у палітри на дошці для кнопки 64 px. */
const PUPIL_SHIFT = 2.6

const MASCOT_SVG = INTEGRALYK_SVG_STANDALONE
const panelId = useId()
const titleId = useId()

// Тексти — computed від t(): змінили мову в шапці — підказки й панелька одразу новою мовою (§2).
// Тексти підказок — від власника (2026-10-11, через Фею: «менше математики»). Підказки 1–2: помітніший
// перший рядок (`lead`) + приклад звичайним. `hintCards` — окремим ключем; відео в ньому немає навмисно:
// Інтегралик його не вставляє (відео — лише з пульта).
interface Hint { lead: string; text: string }
const hints = computed<Hint[]>(() => {
  const lead = t('roleSelection.integralykHint.hintLead')
  return [
    { lead, text: t('roleSelection.integralykHint.hintTriangle') },
    { lead, text: t('roleSelection.integralykHint.hintCircle') },
    { lead: '', text: t('roleSelection.integralykHint.hintCards') },
    { lead: '', text: t('roleSelection.integralykHint.hintPhotoCheck') },
    { lead: '', text: t('roleSelection.integralykHint.hintHelper') },
  ]
})
const hintIndex = ref(0)
const hint = computed(() => hints.value[hintIndex.value % hints.value.length])
const panelTitle = computed(() => t('roleSelection.integralykHint.hintLead'))
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
 * Бульбашка: `idle` — ще не час; `measuring` — намальована невидимо, щоб поставити її з вільного боку й
 * перевірити, чи не ляже на кнопку; `shown`; `resting` — пауза між підказками; `deferred` — на типовому
 * місці лягла б на кнопку, чекає прокрутки нижче першого екрана (або перетягування фігурки).
 */
type BubbleState = 'idle' | 'measuring' | 'shown' | 'resting' | 'deferred'
const bubble = ref<BubbleState>('idle')
const panelOpen = ref(false)
/** Фігурка відступила: на типовому місці лягла б на охоронюваний елемент. */
const aside = ref(false)
/** prefers-reduced-motion: без анімацій, але підказки змінюються (§7). */
const still = ref(false)
/**
 * Читалка вже почула всі підказки — далі коло йде мовчки: інакше вона говорила б кожні 12 с без кінця.
 * Бульбашка лишається в живій області (§3 `aria-live="polite"`), лише область вимикається.
 */
const announcedAll = ref(false)

/** Де стоять бульбашка/панелька відносно фігурки: зверху чи знизу, вирівняні по її правому чи лівому краю. */
const popStyle = ref<Record<string, string>>({})
const popUp = ref(true)
const popAlignRight = ref(true)

const rootEl = ref<HTMLElement | null>(null)
const bubbleEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const figureBtnEl = ref<HTMLButtonElement | null>(null)
let bubbleShownAtY = 0

// ── Перетягування: та сама логіка, що в кнопки Інтегралика на дошці ──
const fab = useDraggableFab({
  storageKey: POS_KEY,
  // Розмір фігурки — з CSS (56 на телефоні, 64 ширше); корінь має рівно її розмір.
  size: () => rootEl.value?.getBoundingClientRect().width || 64,
  margin: FIGURE_EDGE_PX,
  // Типове місце задане right/bottom; переставлена — лише left/top.
  positionedStyle: { bottom: 'auto' },
  // Нове місце потрапляє в DOM лише після оновлення Vue — міряти фігурку раніше означало б ставити
  // бульбашку за позицією на крок позаду (на телефоні вона йшла вгору під шапку).
  onMove: () => { void nextTick(placePop) },
})
const fabStyle = fab.style
const fabDragging = fab.dragging
const onFigurePointerDown = fab.onPointerDown
const onFigurePointerMove = fab.onPointerMove
const onFigurePointerUp = fab.onPointerUp

/** Фігурка на типовому місці (не переставлена) — лише тоді діє охорона кнопок (§7). */
function atDefaultPlace(): boolean {
  return fab.pos.value === null
}

// ── Таймери на паузі (§3, §7): вкладку сховано, відкрита панелька, фігурку тягнуть ──
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
let cycleTimer: PausableTimer | null = null

function tabHidden(): boolean {
  return document.visibilityState === 'hidden'
}

function cyclePaused(): boolean {
  return tabHidden() || panelOpen.value || fabDragging.value
}

function startCycleTimer(fn: () => void, ms: number): void {
  cycleTimer?.cancel()
  cycleTimer = pausableTimeout(fn, ms)
  if (!cyclePaused()) cycleTimer.run()
}

function stopCycleTimer(): void {
  cycleTimer?.cancel()
  cycleTimer = null
}

function syncTimers(): void {
  if (tabHidden()) appearTimer?.pause()
  else appearTimer?.run()
  if (cyclePaused()) cycleTimer?.pause()
  else cycleTimer?.run()
}

// ── Охоронювані елементи (§3: не перекривати кнопки першого екрана й нижні посилання) ──
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
  // Відкриту панельку людина відкрила сама, а переставлену фігурку — сама поставила: тоді не ховаємо.
  aside.value = figureShown.value && !panelOpen.value && atDefaultPlace() && hitsGuard(rootEl.value)
}

// ── Бульбашка/панелька з того боку, де є місце (§7) ──
function placePop(): void {
  const root = rootEl.value
  const pop = panelEl.value ?? bubbleEl.value
  if (!root || !pop) return
  const r = root.getBoundingClientRect()
  const p = pop.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const roomAbove = r.top - POP_GAP_PX - POP_EDGE_PX
  const roomBelow = vh - r.bottom - POP_GAP_PX - POP_EDGE_PX
  // З того боку, де більше місця: фігурка вгорі — бульбашка під нею (а не над, де шапка сторінки).
  const up = roomAbove >= roomBelow
  // Вирівнюємо по краю фігурки, що ближчий до середини екрана, і тримаємо в межах екрана.
  const alignRight = r.left + r.width / 2 >= vw / 2
  const preferred = alignRight ? r.right - p.width : r.left
  const left = Math.min(Math.max(POP_EDGE_PX, preferred), Math.max(POP_EDGE_PX, vw - POP_EDGE_PX - p.width))
  popUp.value = up
  popAlignRight.value = alignRight
  popStyle.value = {
    left: `${Math.round(left - r.left)}px`,
    top: `${Math.round(up ? -(POP_GAP_PX + p.height) : r.height + POP_GAP_PX)}px`,
  }
}

// ── Коло підказок (§7) ──
function showHint(): void {
  stopCycleTimer()
  bubble.value = 'measuring'
  // Спершу бульбашка має з'явитися в DOM (невидимо), потім стати з вільного боку, і лише ПІСЛЯ того, як
  // це місце застосовано, — перевірка, чи не лягла на кнопку (інакше міряли б старе місце).
  void nextTick(() => {
    placePop()
    void nextTick(decideHint)
  })
}

function decideHint(): void {
  if (bubble.value !== 'measuring') return
  if (atDefaultPlace() && (aside.value || hitsGuard(bubbleEl.value))) {
    bubble.value = 'deferred'
    return
  }
  bubble.value = 'shown'
  bubbleShownAtY = window.scrollY
  startCycleTimer(restHint, HINT_SHOW_MS)
}

function restHint(): void {
  if (bubble.value === 'shown' && hintIndex.value === hints.value.length - 1) announcedAll.value = true
  bubble.value = 'resting'
  startCycleTimer(nextHint, HINT_REST_MS)
}

function nextHint(): void {
  hintIndex.value = (hintIndex.value + 1) % hints.value.length
  showHint()
}

function appear(): void {
  appearTimer = null
  figureShown.value = true
  void nextTick(() => {
    checkAside()
    showHint()
  })
}

function onScroll(): void {
  checkAside()
  const y = window.scrollY
  if (bubble.value === 'shown' && Math.abs(y - bubbleShownAtY) >= SCROLL_HIDE_PX) {
    restHint()
  } else if (bubble.value === 'deferred' && y >= window.innerHeight) {
    showHint()
  }
}

function onResize(): void {
  fab.reclamp()
  // Міряємо після того, як нове (повернуте в межі) місце застосовано.
  void nextTick(() => {
    checkAside()
    placePop()
  })
}

// Пауза/продовження кола — коли відкрили/закрили панельку або почали/закінчили тягнути.
watch([panelOpen, fabDragging], syncTimers)
watch(fabDragging, (now) => {
  if (now) return
  void nextTick(() => {
    checkAside()
    placePop()
    // Відклали через кнопку на типовому місці, а людина переставила фігурку — показуємо.
    if (bubble.value === 'deferred') showHint()
  })
})
// Інша мова — інша ширина тексту: переставити бульбашку з вільного боку.
watch(hint, () => { void nextTick(placePop) })

// ── Панелька ──
function openPanel(): void {
  if (panelOpen.value) return
  panelOpen.value = true
  aside.value = false
  // Бульбашку замінює панелька; коло продовжиться паузою після її закриття.
  if (bubble.value !== 'idle') {
    bubble.value = 'resting'
    startCycleTimer(nextHint, HINT_REST_MS)
  }
  trackIntegralykTap()
  void nextTick(placePop)
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

function onFigureClick(): void {
  // Після перетягування браузер усе одно шле click — це не дотик, панельку не відкриваємо.
  if (fab.consumeDragClick()) return
  togglePanel()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && panelOpen.value) closePanel()
}

function register(): void {
  emit('register')
}

// ── Зіниці стежать за курсором (як у палітри на дошці: `CommandPalette.vue`, `onEyesMove`) ──
// Лише курсор на комп'ютері — миша або перо графічного планшета. Палець — ні: після торкання браузер шле ще
// й «мишачий» mousemove у точку дотику, і на телефоні зіниці смикались би за кожним тапом. Тому слухаємо
// `pointermove` і пропускаємо `touch`. Скільки б не було рухів — один кадр (rAF); поки фігурку тягнуть,
// зіниці стоять; reduced-motion — слухача немає взагалі (onMounted).
let pupilFrame = 0
let cursorX = 0
let cursorY = 0

function onEyesMove(e: PointerEvent): void {
  if (e.pointerType === 'touch') return
  cursorX = e.clientX
  cursorY = e.clientY
  if (pupilFrame) return
  pupilFrame = window.requestAnimationFrame(lookAtCursor)
}

function lookAtCursor(): void {
  pupilFrame = 0
  const host = figureBtnEl.value
  if (!host || fabDragging.value) return
  const r = host.getBoundingClientRect()
  const angle = Math.atan2(cursorY - (r.top + r.height / 2), cursorX - (r.left + r.width / 2))
  const dx = (Math.cos(angle) * PUPIL_SHIFT).toFixed(2)
  const dy = (Math.sin(angle) * PUPIL_SHIFT).toFixed(2)
  host.querySelectorAll<SVGElement>('.itg-pupil').forEach((p) => { p.style.transform = `translate(${dx}px, ${dy}px)` })
}

// ── Життєвий цикл ──
function teardown(): void {
  appearTimer?.cancel()
  appearTimer = null
  stopCycleTimer()
  document.removeEventListener('visibilitychange', syncTimers)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('orientationchange', onResize)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', onEyesMove)
  if (pupilFrame) window.cancelAnimationFrame(pupilFrame)
  pupilFrame = 0
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
  fab.restore()
  document.addEventListener('visibilitychange', syncTimers)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
  document.addEventListener('keydown', onKeydown)
  // Менше руху — зіниці дивляться прямо: слухача курсора не ставимо.
  if (!still.value) window.addEventListener('pointermove', onEyesMove, { passive: true })
  appearTimer = pausableTimeout(appear, APPEAR_DELAY_MS)
  if (!tabHidden()) appearTimer.run()
})

onBeforeUnmount(teardown)
</script>

<template>
  <div
    v-if="!dismissed"
    ref="rootEl"
    class="lih"
    :class="{
      'lih--still': still,
      'lih--aside': aside,
      'lih--dragging': fabDragging,
      'lih--up': popUp,
      'lih--down': !popUp,
      'lih--right': popAlignRight,
      'lih--left': !popAlignRight,
    }"
    :style="fabStyle"
    :data-motion="still ? 'reduce' : 'full'"
    data-test="landing-integralyk"
  >
    <Transition name="lih-panel" :css="!still">
      <section
        v-if="panelOpen"
        :id="panelId"
        ref="panelEl"
        class="lih-panel"
        :style="popStyle"
        :aria-labelledby="titleId"
        data-test="integralyk-panel"
      >
        <div class="lih-panel-head">
          <p :id="titleId" class="lih-panel-title">{{ panelTitle }}</p>
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

    <!-- aria-live живе з першого кадру: читалка оголошує підказку, коли вона з'являється всередині. -->
    <div class="lih-live" :aria-live="announcedAll ? 'off' : 'polite'" data-test="integralyk-live">
      <Transition name="lih-fade" :css="!still">
        <p
          v-if="bubble === 'measuring' || bubble === 'shown'"
          ref="bubbleEl"
          class="lih-bubble"
          :class="{ 'lih-bubble--measuring': bubble === 'measuring' }"
          :style="popStyle"
          data-test="integralyk-bubble"
          @click="openPanel"
        >
          <strong v-if="hint.lead" class="lih-bubble-lead">{{ hint.lead }}</strong>
          <span class="lih-bubble-text">{{ hint.text }}</span>
        </p>
      </Transition>
    </div>

    <Transition name="lih-pop" :css="!still">
      <div v-if="figureShown" class="lih-figure-wrap" data-test="integralyk-figure-wrap">
        <button
          ref="figureBtnEl"
          type="button"
          class="lih-figure"
          :aria-label="t('roleSelection.integralykHint.openLabel')"
          :aria-expanded="panelOpen ? 'true' : 'false'"
          :aria-controls="panelOpen ? panelId : undefined"
          data-test="integralyk-figure"
          @pointerdown="onFigurePointerDown"
          @pointermove="onFigurePointerMove"
          @pointerup="onFigurePointerUp"
          @pointercancel="onFigurePointerUp"
          @click="onFigureClick"
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

/* Корінь — рівно розміром із фігурку: його переставляє перетягування (left/top), а бульбашка й панелька
   стоять відносно нього з того боку, де є місце (placePop). */
.lih {
  position: fixed;
  right: 24px;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  /* Над шапкою лендінгу (z-index 100): фігурку можна перетягнути будь-куди, і під шапкою вона б
     зникла назавжди — місце запам'ятовується, а схопити її крізь шапку не можна. */
  z-index: 101;
  width: 64px;
  height: 64px;
  /* Сам корінь кліків не ловить — лише фігурка, бульбашка й панелька. */
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
  width: 100%;
  height: 100%;
}
.lih-figure {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: grab;
  /* Тягнуть пальцем/пером — не прокручувати сторінку (як на дошці). */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  filter: drop-shadow(0 6px 14px var(--shadow-strong));
}
.lih--dragging .lih-figure { cursor: grabbing; }
.lih-figure:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}
.lih-mascot {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
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
/* Зіниці плавно тягнуться за курсором (transform ставить lookAtCursor) — як у палітри. */
.lih-mascot :deep(.itg-pupil) { transition: transform 0.18s ease; }

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

/* ── Бульбашка ── */
/* Точка відліку бульбашки — верхній лівий кут фігурки (як і в панельки). */
.lih-live {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
}
.lih-bubble {
  position: absolute;
  box-sizing: border-box;
  margin: 0;
  width: max-content;
  /* На телефоні ≤ 70 % екрана (§3); ширше — до 300 px, щоб жирний перший рядок не ламався. */
  max-width: min(70vw, 300px);
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.35;
  box-shadow: 0 6px 20px var(--shadow-strong);
  cursor: pointer;
}
/* Підказки 1–2: перший рядок помітніший, другий — приклад звичайним (власник 2026-10-11). */
.lih-bubble-lead {
  display: block;
  font-weight: 600;
}
.lih-bubble-lead + .lih-bubble-text {
  display: block;
  margin-top: 2px;
}
/* «Хвостик» — гострий кут бульбашки дивиться на фігурку. */
.lih--up.lih--right .lih-bubble { border-bottom-right-radius: 4px; }
.lih--up.lih--left .lih-bubble { border-bottom-left-radius: 4px; }
.lih--down.lih--right .lih-bubble { border-top-right-radius: 4px; }
.lih--down.lih--left .lih-bubble { border-top-left-radius: 4px; }
/* Вимір перед показом: місце займає, але не видно. */
.lih-bubble--measuring { visibility: hidden; }

/* ── Панелька ── */
.lih-panel {
  position: absolute;
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

/* ── Відступ: на типовому місці фігурка лягла б на охоронюваний елемент ── */
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
.lih-panel-leave-active { transition: opacity 0.18s ease; }
.lih-panel-enter-from,
.lih-panel-leave-to { opacity: 0; }

/* ── Менше руху: без появи, дихання й переходів (підказки однаково змінюються) ── */
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
    width: 56px;
    height: 56px;
  }
}
</style>
