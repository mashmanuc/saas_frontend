<!--
  UIA Command Palette (Ctrl+Shift+K) — ГЛОБАЛЬНА точка входу (App.vue). Producer (Закон №6).

  Sprint 4 — COMMAND DIALOG ENGINE: команди декларують `params`; invoke() добирає відсутні
  діалогом. Типи параметрів: text | number | list | SELECT (показує людські label, надсилає value).
  Це «отвір», у який AI-Producer вставиться (усі params → запуск; бракує → спитати) без зміни capabilities.
  Помилки — людською мовою (ERR_MSG). Gated VITE_FEATURE_UIA + tutor/staff. Removable.
-->
<template>
  <Teleport to="body">
    <!-- Плаваючий «Інтегралик» (маскот з DATA/integral): живе поверх УСЬОГО застосунку
         (і дошки, і сторінки з хедером — справа зверху, під дзвіночком). Клік = палітра. -->
    <div v-if="enabled && showAI && !open" class="cmdp-fab-wrap" :style="fabStyle">
      <button
        ref="fabEl"
        class="cmdp-fab"
        :class="fabMood && 'mood-' + fabMood"
        title="Інтегралик — AI-помічник (Ctrl+Shift+K). Перетягніть, куди зручно"
        aria-label="Відкрити Інтегралика — AI-помічника"
        @pointerdown="fabPointerDown"
        @pointermove="fabPointerMove"
        @pointerup="fabPointerUp"
        @pointercancel="fabPointerUp"
        @click="onFabClick"
        v-html="MASCOT_SVG"
      ></button>
      <!-- 0a: тред живе між відкриттями → показуємо, що розмова чекає всередині.
           Без цього persistent-історія невидима: юзер не знає, що є куди вертатись. -->
      <span
        v-if="aiThread.length"
        class="cmdp-fab-badge"
        :title="`Незавершена розмова (${aiThread.length})`"
        aria-hidden="true"
      ></span>
      <!-- Швидке приховування (owner: «не всім потрібен»). Увімкнути — у Налаштуваннях. -->
      <button
        class="cmdp-fab-hide"
        title="Приховати помічника (увімкнути назад — у Налаштуваннях)"
        aria-label="Приховати Інтегралика"
        @pointerdown.stop
        @click.stop="hideIntegralyk"
      >×</button>
    </div>

    <!-- Проактивна бульбашка-підказка Інтегралика (клік → палітра) -->
    <button
      v-if="enabled && showAI && !open && tipVisible"
      class="cmdp-tip"
      :class="'tail-' + tipSide"
      :style="tipStyle"
      @click="tipClick"
    >{{ tipText }}</button>

    <div
      v-if="enabled && open"
      class="cmdp-overlay"
      :class="{ 'cmdp-overlay--pinned': isPinned }"
      :style="overlayStyle"
      @click.self="onOverlayClick"
    >
      <div
        ref="panelEl"
        class="cmdp-panel"
        :style="panelStyle"
        role="dialog"
        aria-label="Командна палітра"
        @pointerdown="panelPointerDown"
        @pointermove="panelPointerMove"
        @pointerup="panelPointerUp"
        @pointercancel="panelPointerUp"
      >

        <!-- MODE: команди -->
        <template v-if="mode === 'commands'">
          <!-- Брендований хедер із ЖИВИМ Інтегралчиком (маскот з очима/настроями,
               не значок). .cmdp-head → панель тягається за нього (drag). -->
          <div class="cmdp-head cmdp-brand">
            <span
              class="cmdp-mascot cmdp-mascot--brand"
              :class="[{ thinking: aiBusy }, fabMood && 'mood-' + fabMood]"
              v-html="MASCOT_SVG"
            ></span>
            <div class="cmdp-brandtitle">
              <span class="cmdp-title">Інтегралик</span>
              <span class="cmdp-subtitle">AI-помічник</span>
            </div>
            <!-- 0b: pin — щоб дошка лишалась клікабельною під час роботи з палітрою -->
            <button
              v-if="canPin" class="cmdp-pin cmdp-pin--brand" :class="{ on: isPinned }"
              @click="togglePin"
              :title="isPinned ? 'Відкріпити (клік повз панель знову закриватиме)' : 'Закріпити — дошка лишиться клікабельною'"
              :aria-pressed="isPinned ? 'true' : 'false'"
              aria-label="Закріпити панель"
            >📌</button>
            <button class="cmdp-close" @click="close" aria-label="Закрити" title="Закрити (Esc)">✕</button>
          </div>
          <div class="cmdp-cmdrow">
            <input
              ref="inputEl" v-model="query" class="cmdp-input"
              :placeholder="voiceListening ? 'Слухаю… говоріть' : 'Що зробити? (напр. «урок», «дошку», «мої уроки»)'"
              @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="runSelected"
            />
            <button
              v-if="VOICE_ENABLED && integralykOn" class="cmdp-mic" :class="{ listening: voiceListening }"
              @click="toggleVoice('cmd')"
              :title="voiceListening ? 'Зупинити' : 'Голосовий ввід'"
              aria-label="Голосовий ввід"
            >🎤</button>
          </div>
          <ul class="cmdp-list">
            <li
              v-for="(c, i) in filtered" :key="c.id"
              :class="['cmdp-item', { active: i === selected }]"
              @mouseenter="selected = i" @click="invoke(c)"
            >{{ c.label }}</li>
            <li v-if="!filtered.length" class="cmdp-empty">Нічого не знайдено</li>
          </ul>
        </template>

        <!-- MODE: діалог параметрів -->
        <template v-else-if="mode === 'dialog' && currentParam">
          <div class="cmdp-head">
            <button class="cmdp-back" @click="toCommands">← Скасувати</button>
            <span class="cmdp-title">{{ dialog.cmd.label }}</span>
            <span class="cmdp-meta">крок {{ dialog.idx + 1 }}/{{ dialog.queue.length }}</span>
          </div>
          <div class="cmdp-dialog">
            <label class="cmdp-dlabel">{{ currentParam.label }}</label>

            <!-- SELECT: список людських назв -->
            <template v-if="currentParam.type === 'select'">
              <input
                ref="dialogSearchEl" v-model="dialogQuery" class="cmdp-input"
                placeholder="Оберіть або почніть вводити…"
                @keydown.down.prevent="moveOpt(1)" @keydown.up.prevent="moveOpt(-1)"
                @keydown.enter.prevent="pickHighlighted"
              />
              <ul class="cmdp-list">
                <li v-if="dialogOptLoading" class="cmdp-empty">Завантаження…</li>
                <li
                  v-for="(o, i) in dialogOptionsFiltered" :key="o.value"
                  :class="['cmdp-item', { active: i === dialogOptIdx }]"
                  @mouseenter="dialogOptIdx = i" @click="pickOption(o)"
                >{{ o.label }}</li>
                <li v-if="!dialogOptLoading && !dialogOptionsFiltered.length" class="cmdp-empty">Немає варіантів</li>
              </ul>
            </template>

            <!-- TEXT / NUMBER / LIST -->
            <template v-else>
              <input
                ref="dialogInputEl" v-model="dialogInput" class="cmdp-input"
                :type="currentParam.type === 'number' ? 'number' : 'text'"
                @keydown.enter.prevent="submitStep"
              />
            </template>

            <div class="cmdp-hint">Enter — далі · Esc — скасувати</div>
          </div>
        </template>

        <!-- MODE: мої дошки -->
        <template v-else-if="mode === 'boards'">
          <div class="cmdp-head">
            <button class="cmdp-back" @click="toCommands">← Команди</button>
            <span class="cmdp-title">Мої дошки</span>
          </div>
          <ul class="cmdp-list">
            <li v-for="b in boards" :key="b.id" class="cmdp-board">
              <span class="cmdp-bname" @click="openBoard(b)" :title="'Відкрити: ' + b.name">{{ b.name || 'Без назви' }}</span>
              <span class="cmdp-actions">
                <button title="Відкрити" :disabled="loading" @click="openBoard(b)">↗</button>
                <button title="Дублювати" :disabled="loading" @click="invoke(actDuplicate, { board_id: b.id })">⧉</button>
                <button title="Перейменувати" :disabled="loading" @click="invoke(actRename, { board_id: b.id })">✎</button>
                <button title="Експорт PDF" :disabled="loading" @click="invoke(actExport, { board_id: b.id })">⬇</button>
                <button title="Видалити" :disabled="loading" @click="confirmDelete(actDeleteBoard, { board_id: b.id }, b.name)">🗑</button>
              </span>
            </li>
            <li v-if="!boards.length && !loading" class="cmdp-empty">Дошок ще немає</li>
          </ul>
        </template>

        <!-- MODE: Інтегралик — ДІАЛОГ (Phase 2). parse ≠ execute: кожна дія — через Policy -->
        <template v-else-if="mode === 'ai'">
          <div class="cmdp-head">
            <button class="cmdp-back" @click="toCommands">← Команди</button>
            <span ref="mascotEl" class="cmdp-mascot" :class="[{ thinking: aiBusy }, fabMood && 'mood-' + fabMood]" v-html="MASCOT_SVG"></span>
            <span class="cmdp-title">Інтегралик</span>
            <!-- 0a: розмова живе між відкриттями → потрібен явний спосіб почати з чистого -->
            <button
              v-if="aiThread.length" class="cmdp-newchat" :disabled="aiBusy"
              @click="newDialog" title="Почати новий діалог" aria-label="Почати новий діалог"
            >↺</button>
            <!-- 0b: той самий pin, що й у режимі команд (авто-вмикається після малювання) -->
            <button
              v-if="canPin" class="cmdp-pin" :class="{ on: isPinned }"
              @click="togglePin"
              :title="isPinned ? 'Відкріпити (клік повз панель знову закриватиме)' : 'Закріпити — дошка лишиться клікабельною'"
              :aria-pressed="isPinned ? 'true' : 'false'"
              aria-label="Закріпити панель"
            >📌</button>
            <!-- Згорнути в маскота. У pin-режимі це ЄДИНИЙ спосіб прибрати панель
                 (клік повз неї свідомо не закриває), а в AI-режимі кнопки закриття
                 не було взагалі — на відміну від режиму команд. Розмова переживає
                 згортання (0a), тому «згорнути», а не «закрити»: FAB одразу покаже
                 бейдж «розмова чекає», а openPalette() поверне саме в тред. -->
            <button
              class="cmdp-min" @click="close"
              title="Згорнути в Інтегралика (розмова збережеться) · Esc"
              aria-label="Згорнути панель"
            >–</button>
          </div>

          <div ref="aiThreadEl" class="cmdp-ai-thread">
            <template v-for="(it, i) in aiThread" :key="i">
              <p v-if="it.kind === 'user'" class="ai-msg ai-msg--user">{{ it.text }}</p>
              <!-- v-html безпечний саме через renderTextWithLatex: він сам
                   екранує HTML (&, <, >) ПЕРЕД вставкою формул. Сирий
                   v-html з відповіддю LLM використовувати не можна. -->
              <p v-else-if="it.kind === 'bot'" class="ai-msg ai-msg--bot" v-html="aiHtml[i]"></p>
              <p v-else-if="it.kind === 'done'" class="ai-msg ai-msg--done">✓&nbsp;<span v-html="aiHtml[i]"></span></p>

              <!-- онбординг: крок провідника -->
              <div v-else-if="it.kind === 'guidecta'" class="cmdp-ai-actions" style="margin:2px 0 4px">
                <button v-if="!it.done" class="cmdp-btn" :disabled="loading"
                        @click="it.done = true; guideNext()">{{ it.label }}</button>
              </div>
              <div v-else-if="it.kind === 'guidecreate'" class="cmdp-ai-actions" style="margin:2px 0 4px">
                <button v-if="!it.done" class="cmdp-btn" :disabled="loading"
                        @click="it.done = true; guideCreate()">{{ it.label }}</button>
              </div>

              <!-- propose medium/high → confirm-картка; high/destructive — ЗАВЖДИ -->
              <div v-else-if="it.kind === 'confirm'" class="ai-msg ai-msg--bot ai-card">
                <p class="cmdp-ai-explain">{{ it.resp.explain }}</p>
                <p v-if="it.resp.risk === 'high'" class="cmdp-ai-danger">⚠️ Незворотна дія — потрібне підтвердження.</p>
                <div v-if="!it.done" class="cmdp-ai-actions">
                  <button :class="['cmdp-btn', { 'cmdp-btn--danger': it.resp.risk === 'high' }]"
                          :disabled="loading" @click="confirmAi(it)">
                    {{ it.resp.risk === 'high' ? 'Так, виконати' : 'Так, зробити' }}
                  </button>
                  <button class="cmdp-back" :disabled="loading" @click="dismissAi(it)">Скасувати</button>
                </div>
              </div>

              <!-- clarify → кандидати (розрізнювані label — Закон B) -->
              <div v-else-if="it.kind === 'candidates'" class="ai-msg ai-msg--bot ai-card">
                <p class="cmdp-ai-explain">{{ it.resp.question }}</p>
                <ul v-if="!it.done" class="cmdp-list cmdp-list--inline">
                  <!-- 2026-08-12 (живий тест власника): у списку кандидатів
                       висіло `NMT-задача: Відомо, що $\displaystyle\int_{0}^{3}
                       f(x)\,dx=6$` — сирим LaTeX. Тьютор мусить упізнати СВОЮ
                       задачу, а читає розмітку. Той самий рендер, що в чаті й
                       на дошці; він же й екранує HTML, тож v-html безпечний. -->
                  <li v-for="c in it.resp.candidates" :key="c.id" class="cmdp-item"
                      @click="pickAiCandidate(it, c)" v-html="renderTextWithLatex(c.label)" />
                </ul>
              </div>
            </template>
            <p v-if="aiBusy" class="ai-msg ai-msg--bot ai-typing"><span></span><span></span><span></span></p>
          </div>

          <div class="cmdp-ai-inputrow">
            <input
              ref="aiInputEl" v-model="aiInput" class="cmdp-input cmdp-input--ai"
              :placeholder="voiceListening ? 'Слухаю… говоріть' : 'Продовжте діалог або спитайте про математику…'"
              :disabled="aiBusy" @keydown.enter.prevent="continueAi"
            />
            <button
              v-if="VOICE_ENABLED && integralykOn" class="cmdp-mic" :class="{ listening: voiceListening }"
              :disabled="aiBusy" @click="toggleVoice('ai')"
              :title="voiceListening ? 'Зупинити' : 'Говоріть — Інтегралик слухає'"
              aria-label="Голосовий ввід"
            >🎤</button>
            <button class="cmdp-btn" :disabled="aiBusy || !aiInput.trim()" @click="continueAi">➤</button>
          </div>
        </template>

        <!-- MODE: мої уроки -->
        <template v-else>
          <div class="cmdp-head">
            <button class="cmdp-back" @click="toCommands">← Команди</button>
            <span class="cmdp-title">Мої уроки</span>
          </div>
          <ul class="cmdp-list">
            <li v-for="l in lessons" :key="l.id" class="cmdp-board">
              <span class="cmdp-bname" @click="invoke(actOpenLesson, { lesson_id: l.id })" :title="'Відкрити: ' + l.title">
                {{ l.title || 'Без назви' }} <small class="cmdp-meta">· {{ l.status }}</small>
              </span>
              <span class="cmdp-actions">
                <button title="Відкрити (редагувати)" :disabled="loading" @click="invoke(actOpenLesson, { lesson_id: l.id })">↗</button>
                <button title="Видалити" :disabled="loading" @click="confirmDelete(actDeleteLesson, { lesson_id: l.id }, l.title)">🗑</button>
              </span>
            </li>
            <li v-if="!lessons.length && !loading" class="cmdp-empty">Уроків ще немає</li>
          </ul>
        </template>

        <div v-if="loading" class="cmdp-status">Виконую…</div>
        <div v-if="notice" class="cmdp-status">✓ {{ notice }}</div>
        <div v-if="error" class="cmdp-error">{{ error }}</div>
        <div class="cmdp-hint">Ctrl+Shift+K (або Ctrl/⌘+K) — відкрити · ↑↓/Enter — команди · Esc — назад/закрити<span v-if="showAI"> · ∫ Інтегралик: просто опишіть дію словами</span></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../auth/store/authStore'
import { useProfileStore } from '@/modules/profile/store/profileStore'
import { parseAi, sendIntent } from './sendIntent'
import { notifySuccess } from '@/utils/notify'
import { isLimitError } from '@/utils/apiClient'
import { buildBoardSummary, buildToolCatalog, runBoardAction } from './boardActions'
import { sceneMetricFromAction } from './sceneMetric'
import { trackScene } from '@/modules/winterboard/local/localWorkspaceTelemetry'
import { useVoiceDictation } from '@/composables/useVoiceDictation'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import { explainWithRenderedMath } from './explainMath'
import { createPinPolicy } from './pinPolicy'
import { i18n, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/i18n'
// SSOT «Стилю карток» — той самий список, що показує конструктор (Класичний/Наочний).
// Reuse, щоб палітра й конструктор ніколи не розходились.
import { THEMES } from '@/modules/lesson_constructor/api/lessonConstructorApi'

const SHORTCUTS = [
  { ctrl: true, shift: false, key: 'k' },
  { meta: true, shift: false, key: 'k' },
  { ctrl: true, shift: true, key: 'k' },
]
function matchesShortcut(e) {
  const k = (e.key || '').toLowerCase()
  return SHORTCUTS.some(s => k === s.key && !!s.ctrl === e.ctrlKey && !!s.meta === e.metaKey && !!s.shift === e.shiftKey)
}
const ALLOWED_ROLES = ['tutor', 'admin', 'staff', 'superadmin']

// Людські повідомлення для кодів помилок (замість сирого технічного detail).
const ERR_MSG = {
  TASK_SELECTION_FAILED: 'Для цієї теми й кількості недостатньо задач. Оберіть іншу тему або зменшіть кількість.',
  GENERATION_FAILED: 'Не вдалося згенерувати урок. Спробуйте ще раз.',
  CANNOT_PUBLISH: 'Порожню дошку не можна опублікувати — спершу щось намалюйте на ній.',
  LESSON_CONSTRUCTOR_DISABLED: 'Генерація уроків зараз недоступна.',
  EXPORT_DISABLED: 'Експорт PDF зараз недоступний.',
  FORBIDDEN: 'Немає доступу (потрібна роль тьютора).',
  NOT_FOUND: 'Не знайдено або не належить вам.',
  BAD_REQUEST: 'Бракує даних для команди.',
  INTENT_INVALID: 'Невідома команда.',
}

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const currentBoardId = computed(() =>
  ['winterboard-solo', 'winterboard-prepare'].includes(route.name) ? route.params.id : null,
)
const enabled = computed(() => {
  if (import.meta.env.VITE_FEATURE_UIA !== 'true' || !auth.user) return false
  // 2026-07-27 (зауваження власника): в staff-АДМІНЦІ Інтегралик недоречний —
  // його інструменти (дошка/уроки/навігація тьютора) там не мають сенсу,
  // а FAB висів поверх адмін-таблиць. Staff-РОЛІ на звичайних сторінках — ок.
  if (route.path.startsWith('/staff')) return false
  return ALLOWED_ROLES.includes(auth.user.role) || auth.user.is_staff === true
})

const open = ref(false)
const mode = ref('commands')
const query = ref('')
const selected = ref(0)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const inputEl = ref(null)
const boards = ref([])
const lessons = ref([])

// dialog engine state
const dialog = ref({ cmd: null, queue: [], idx: 0, values: {} })
const dialogInput = ref('')
const dialogInputEl = ref(null)
const dialogSearchEl = ref(null)
const dialogOptions = ref([])
const dialogOptIdx = ref(0)
const dialogQuery = ref('')
const dialogOptLoading = ref(false)

const currentParam = computed(() => dialog.value.queue?.[dialog.value.idx] || null)
const dialogOptionsFiltered = computed(() => {
  const q = dialogQuery.value.trim().toLowerCase()
  return q ? dialogOptions.value.filter(o => o.label.toLowerCase().includes(q)) : dialogOptions.value
})

async function run(fn, onOk) {
  if (loading.value) return
  loading.value = true; error.value = ''; notice.value = ''
  try { const r = await fn(); if (onOk) await onOk(r) }
  catch (e) {
    // Ф3: SaaS-ліміт (403 LIMIT_EXCEEDED) — глобальний LimitPaywallModal уже показано
    // interceptor'ом; не дублюємо власним inline-повідомленням (finally скине loading).
    if (isLimitError(e)) return
    const d = e?.response?.data
    error.value = ERR_MSG[d?.error] || d?.detail || e?.message || 'Помилка'
  } finally { loading.value = false }
}

// ════════════ COMMAND DIALOG ENGINE ════════════
function invoke(cmd, ctx = {}) {
  if (cmd.run) { cmd.run(); return }
  const values = { ...(cmd.context ? cmd.context() : {}), ...ctx }
  const missing = (cmd.params || []).filter((p) => {
    const v = values[p.key]
    return v === undefined || v === null || v === ''
  })
  if (!missing.length) { execute(cmd, values); return }
  dialog.value = { cmd, queue: missing, idx: 0, values }
  mode.value = 'dialog'
  enterStep()
}
async function enterStep() {
  const p = currentParam.value
  error.value = ''
  if (p.type === 'select') {
    dialogQuery.value = ''; dialogOptIdx.value = 0; dialogOptions.value = []
    if (p.options) {
      dialogOptions.value = p.options
    } else if (p.optionsFrom) {
      dialogOptLoading.value = true
      try { dialogOptions.value = await p.optionsFrom() }
      catch { error.value = 'Не вдалося завантажити варіанти' }
      finally { dialogOptLoading.value = false }
    }
    if (p.default != null) {
      const i = dialogOptions.value.findIndex(o => o.value === p.default)
      if (i >= 0) dialogOptIdx.value = i
    }
    nextTick(() => dialogSearchEl.value?.focus())
  } else {
    dialogInput.value = p.default != null ? String(p.default) : ''
    nextTick(() => dialogInputEl.value?.focus())
  }
}
function advance(value) {
  dialog.value.values[currentParam.value.key] = value
  error.value = ''
  if (dialog.value.idx + 1 >= dialog.value.queue.length) {
    const { cmd, values } = dialog.value
    mode.value = 'commands'
    execute(cmd, values)
  } else {
    dialog.value.idx += 1
    enterStep()
  }
}
function submitStep() {
  const p = currentParam.value
  let raw = dialogInput.value
  if (raw === '' && p.default != null) raw = String(p.default)
  let val = raw
  if (p.type === 'number') {
    val = Number(raw)
    if (raw === '' || Number.isNaN(val)) { error.value = 'Потрібне число'; return }
  } else if (p.type === 'list') {
    val = String(raw).split(',').map(s => s.trim()).filter(Boolean)
    if (p.required && !val.length) { error.value = 'Вкажіть хоча б одне значення'; return }
  } else if (p.required && raw === '') {
    error.value = 'Обовʼязкове поле'; return
  }
  advance(val)
}
function pickOption(o) { advance(o.value) }
function pickHighlighted() { const o = dialogOptionsFiltered.value[dialogOptIdx.value]; if (o) advance(o.value) }
function moveOpt(d) { const n = dialogOptionsFiltered.value.length; if (n) dialogOptIdx.value = (dialogOptIdx.value + d + n) % n }
/**
 * Успіх навігаційної команди (2026-08-17, живий тест власника: «дошка
 * створюється на фоні, але юзер нічого не отримує про це»).
 *
 * Було: `close(); router.push(...)`. Палітра зникала ПЕРШОЮ, а перехід із
 * конструктора чекає `onBeforeRouteLeave → flushAll()` — виходило вікно, де
 * не видно нічого: ні панелі, ні нової сторінки. Done-бульбашка не рятує:
 * вона під `if (open.value)`, а ми вже закрились.
 *
 * Стало: спершу тост (глобальний — переживає close і не залежить від того,
 * чи змонтована палітра), потім close, і `await router.push`, щоб `run()`
 * тримав `loading`, поки перехід справді не стався.
 *
 * ⚠️ Тост тут працює лише тому, що ToastContainer переїхав у App.vue: у
 * PageShell він на winterboard-роутах не рендерився ВЗАГАЛІ (той самий урок,
 * що з LimitPaywallModal).
 */
async function announceAndGo(text, route) {
  notifySuccess(text)
  close()
  await router.push(route)
}

function execute(cmd, values) { run(() => cmd.act(values), (r) => cmd.after?.(r, values)) }
function confirmDelete(spec, ctx, name) { if (window.confirm(`Видалити «${name || 'Без назви'}»?`)) invoke(spec, ctx) }

// каталог тем для select
async function fetchTopics() {
  const r = await sendIntent('QUERY', [{ type: 'Topics' }], 'command-palette')
  return r.result.topics || []
}

// IPC-5: продуктовий save/publish дренує ВСІ pending board-ops ПЕРЕД знімком стану
// (WBSoloRoom.openSaveLessonDialog → opsSync.flushAll). Без цього palette зберегла б
// застарілий стан дошки. Try/continue — дзеркало продукту (flush-fail не блокує).
async function flushBoardOps() {
  try {
    const { useOpsSyncStore } = await import('@/modules/winterboard/stores/opsSyncStore')
    await useOpsSyncStore().flushAll()
  } catch (e) {
    console.warn('[palette] flushAll before save/publish failed (continuing):', e)
  }
}

// ════════════ COMMAND SPECS ════════════
const cmdCreateBoard = {
  id: 'create-board', label: 'Створити дошку',
  params: [{ key: 'title', label: 'Назва дошки?', default: 'Нова дошка' }],
  act: (v) => sendIntent('CREATE', [{ type: 'Board', params: { title: v.title } }], 'command-palette'),
  // IPC-5: дзеркало «+ Нова дошка» → winterboard-prepare (не solo).
  after: (r, v) => announceAndGo(
    `Дошку «${r.result?.title || v?.title || 'Нова дошка'}» створено`,
    { name: 'winterboard-prepare', params: { id: r.result.board_id } }),
}
const cmdGenerateLesson = {
  id: 'generate-lesson', label: 'Згенерувати урок',
  params: [
    { key: 'topics', label: 'Тема уроку?', type: 'select', required: true, optionsFrom: fetchTopics },
    { key: 'task_count', label: 'Скільки задач? (1–30)', type: 'number', default: 4 },
    {
      key: 'theme', label: 'Оформлення уроку?', type: 'select', default: THEMES[0].value,
      options: THEMES.map(t => ({ value: t.value, label: `${t.label} — ${t.desc}` })),
    },
  ],
  // ⚠️ Мусимо слати ПРОДУКТОВІ дефолти конструктора, а не покладатись на дефолти
  // серіалайзера (вони інші!). Дзеркало LessonConstructorPage.vue:290-390:
  // include_solution_page=false — інакше бекенд-дефолт True генерує зайву сторінку
  // розбору на кожну задачу (→ подвоєння сторінок). include_theory_page=true, tutorial, balanced.
  act: (v) => sendIntent('CREATE', [{
    type: 'Lesson',
    params: {
      topics: Array.isArray(v.topics) ? v.topics : [v.topics],
      task_count: v.task_count,
      theme: v.theme,
      diff_profile: 'balanced',
      pacing_mode: 'tutorial',
      include_theory_page: true,
      include_solution_page: false,
    },
  }], 'command-palette'),
  after: (r) => announceAndGo(
    `Урок «${r.result?.title || 'без назви'}» згенеровано`,
    { name: 'winterboard-prepare', params: { id: r.result.session_id } }),
}
const cmdPublishCurrent = {
  id: 'publish-current', label: 'Опублікувати поточну дошку',
  context: () => ({ board_id: currentBoardId.value }),
  params: [{ key: 'title', label: 'Назва публічного уроку?' }],
  act: async (v) => {
    await flushBoardOps()
    return sendIntent('PUBLISH', [{ type: 'Lesson', params: { board_id: v.board_id, title: v.title } }], 'command-palette')
  },
  after: (r) => { notice.value = 'Опубліковано: ' + (r.result?.title || '') },
}
const cmdSaveDraft = {
  id: 'save-current-draft', label: 'Зберегти поточну дошку як урок (чернетку)',
  context: () => ({ board_id: currentBoardId.value }),
  params: [{ key: 'title', label: 'Назва уроку-чернетки?', required: true }],
  act: async (v) => {
    await flushBoardOps()
    return sendIntent('CREATE', [{ type: 'LessonDraft', params: { board_id: v.board_id, title: v.title } }], 'command-palette')
  },
  after: (r) => { notice.value = 'Збережено чернетку: ' + (r.result?.title || '') },
}
const cmdMyBoards = { id: 'my-boards', label: 'Мої дошки…', run: myBoards }
const cmdMyLessons = { id: 'my-lessons', label: 'Мої уроки…', run: myLessons }
const cmdOpenLast = { id: 'open-last-lesson', label: 'Відкрити останній урок', run: openLast }

const baseCommands = [cmdCreateBoard, cmdGenerateLesson, cmdMyBoards, cmdMyLessons, cmdOpenLast]
const commands = computed(() => {
  const list = [...baseCommands]
  // Вісь 3: для GLOBAL-профілю ховаємо generate-lesson (дублює Product Policy на FE)
  if (currentProfile.value === 'GLOBAL') {
    const idx = list.findIndex(c => c.id === 'generate-lesson')
    if (idx >= 0) list.splice(idx, 1)
  }
  if (currentBoardId.value) list.push(cmdPublishCurrent, cmdSaveDraft)
  return list
})
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? commands.value.filter(c => c.label.toLowerCase().includes(q)) : [...commands.value]
  // Онбординг: провідник у списку. Тільки для uk локалі (Варіант A: не перекладаємо, ховаємо).
  if (showAI.value && currentLocale.value === 'uk' && (!q || 'провідник з чого почати навчи покажи проведи мене'.includes(q))) {
    const gi = { id: '__guide__', label: `${guided.value ? '🧭 Провідник Інтегралика' : '✨ Новенький? Провідник Інтегралика'}`, run: () => startGuide() }
    guided.value ? list.push(gi) : list.unshift(gi)
  }
  // AI-Producer: будь-яку фразу можна віддати AI — останній пункт списку (і єдиний, якщо збігів нема)
  if (showAI.value && query.value.trim().length >= 3) {
    const phrase = query.value.trim()
    list.push({ id: '__ai__', label: `∫ Спитати Інтегралика: «${phrase}»`, run: () => askAi(phrase) })
  }
  return list
})

// row-action specs
const actDuplicate = {
  act: (v) => sendIntent('DUPLICATE', [{ type: 'Board', params: { board_id: v.board_id } }], 'command-palette'),
  after: (r) => announceAndGo(
    `Копію дошки створено${r.result?.title ? `: «${r.result.title}»` : ''}`,
    { name: 'winterboard-solo', params: { id: r.result.board_id } }),
}
const actRename = {
  params: [{ key: 'name', label: 'Нова назва дошки?', required: true }],
  act: (v) => sendIntent('MODIFY', [{ type: 'Board', params: { board_id: v.board_id, name: v.name } }], 'command-palette'),
  after: () => { notice.value = 'Перейменовано'; fetchBoards(); notifyBoardsChanged() },
}
// IPC-5 (виправлено після польового прогону): справжній продуктовий експорт — це
// WBExportDialog, який ПЕРЕД BE-експортом робить capture-фазу інтерактивних віджетів
// (GraphMASH 3D, графіки, NMT-картки). Прямий інтент-виклик оминав capture → PDF з
// [nmt_task]-плейсхолдерами. Тому палітра/AI ЗАПУСКАЮТЬ продуктовий діалог:
// дошка відкрита → подія; інша/зі списку → навігація з ?export=1.
function openProductExport(boardId, format = 'pdf') {
  close()
  if (currentBoardId.value && String(currentBoardId.value) === String(boardId)) {
    window.dispatchEvent(new CustomEvent('m4sh:open-export-dialog', { detail: { format } }))
  } else {
    router.push({ name: 'winterboard-solo', params: { id: boardId }, query: { export: '1', format } })
  }
}
const actExport = {
  act: (v) => Promise.resolve(v.board_id),
  after: (boardId) => openProductExport(boardId, 'pdf'),
}
const actDeleteBoard = {
  act: (v) => sendIntent('DELETE', [{ type: 'Board', params: { board_id: v.board_id } }], 'command-palette'),
  after: () => { notice.value = 'Видалено'; fetchBoards(); notifyBoardsChanged() },
}
const actOpenLesson = {
  act: (v) => sendIntent('CREATE', [{ type: 'Session', params: { lesson_id: v.lesson_id } }], 'command-palette'),
  after: (r) => announceAndGo(
    `Урок відкрито${r.result?.title ? `: «${r.result.title}»` : ''}`,
    { name: 'winterboard-solo', params: { id: r.result.session_id } }),
}
const actDeleteLesson = {
  act: (v) => sendIntent('DELETE', [{ type: 'Lesson', params: { lesson_id: v.lesson_id } }], 'command-palette'),
  after: () => { notice.value = 'Видалено'; fetchLessons() },
}

// Сторінка «Студія уроків» живе під палітрою зі своїм станом — після мутації дощок
// повідомляємо її (WBBoardList слухає), інакше список застаріває до ручного F5.
function notifyBoardsChanged() {
  window.dispatchEvent(new CustomEvent('m4sh:boards-changed'))
}

// ── lists ──
async function fetchBoards() {
  const r = await sendIntent('QUERY', [{ type: 'Boards' }], 'command-palette')
  boards.value = r.result.boards || []
}
async function myBoards() { await run(fetchBoards, () => { mode.value = 'boards' }) }
function openBoard(b) { close(); router.push({ name: 'winterboard-solo', params: { id: b.id } }) }

async function fetchLessons() {
  const r = await sendIntent('QUERY', [{ type: 'Lessons' }], 'command-palette')
  lessons.value = r.result.lessons || []
}
async function myLessons() { await run(fetchLessons, () => { mode.value = 'lessons' }) }
async function openLast() {
  await run(async () => {
    const list = await sendIntent('QUERY', [{ type: 'Lessons' }], 'command-palette')
    const last = (list.result.lessons || [])[0]
    if (!last) return { _empty: true }
    return await sendIntent('CREATE', [{ type: 'Session', params: { lesson_id: last.id } }], 'command-palette')
  }, (res) => {
    if (res._empty) { notice.value = 'Уроків ще немає'; return }
    close(); router.push({ name: 'winterboard-solo', params: { id: res.result.session_id } })
  })
}

// ════════════ AI-PRODUCER #1 (Phase 1b) ════════════
// parse ≠ execute: /intents/ai/parse лише ПРОПОНУЄ Intent; тут — Resolution Policy (§3.1):
//   low + 1 кандидат  → авто-виконання
//   medium            → confirm «Зроблю: …?»
//   high/destructive  → ЗАВЖДИ confirm (навіть після explicit-вибору кандидата)
//   2+ кандидатів     → вибір списком (explicit pick = підтвердження для low/medium)
//   none              → чесне пояснення
const AI_ENABLED = import.meta.env.VITE_FEATURE_UIA_AI === 'true'   // build-флаг (усе розгортання)

// ── Per-акаунт вимкнення (owner: «не всім потрібен»). Джерело — profileStore.settings
// (спільне реактивне: і тумблер у Налаштуваннях, і quick-hide пишуть туди → палітра
// реагує миттєво). Дефолт — показувати. showAI гейтить маскот/AI/підказки/провідник/голос.
const profileStore = useProfileStore()
const integralykOn = computed(() => profileStore.settings?.integralyk_enabled !== false)
const showAI = computed(() => AI_ENABLED && integralykOn.value)
async function loadIntegralykPref() {
  if (!AI_ENABLED || profileStore.settings) return
  try {
    const { getUserSettings } = await import('@/api/users')
    profileStore.settings = await getUserSettings()
  } catch { /* нема даних — дефолт (показувати) */ }
}
// Приховати Інтегралика (× на маскоті) — синхронно в акаунт + миттєво в UI
async function hideIntegralyk() {
  // На дотику × завжди видимий (hover немає) → легко зачепити випадково; підтвердимо,
  // бо ввімкнути назад — лише в Налаштуваннях. На desktop (hover) — без зайвого кроку.
  try {
    if (window.matchMedia && window.matchMedia('(hover: none)').matches &&
        !window.confirm('Приховати Інтегралика? Увімкнути назад — у Налаштуваннях.')) return
  } catch { /* matchMedia недоступний — ховаємо без підтвердження */ }
  close()
  if (profileStore.settings) profileStore.settings = { ...profileStore.settings, integralyk_enabled: false }
  try {
    const { updateUserSettings } = await import('@/api/users')
    await updateUserSettings({ integralyk_enabled: false })
  } catch { /* збережеться при наступній спробі */ }
}

// ── Phase V: ГОЛОС — ще один клієнт Runtime (не «голосовий AI»). Мікрофон → Web Speech
// (uk-UA) → текст у поле → той самий parseAi. Тепер через СПІЛЬНИЙ composable
// `useVoiceDictation` (той самий рушій, що в чаті) — one source of truth, без дубля.
// Обгортки нижче зберігають старі імена (voiceListening/VOICE_ENABLED/toggleVoice) для шаблону.
// Поточна UI Locale — РЕАКТИВНО з i18n (SSOT i18n/index.js).
// ⚠️ Читати localStorage один раз при setup НЕ можна: setI18nLocale() міняє мову
// живцем БЕЗ перезавантаження (i18n/index.js:66-73), а перемикач стоїть на самій
// дошці (WBLanguageSwitcher) — там, де живе палітра. Нереактивне значення застигло б,
// і після перемикання Інтегралик слав би у BE стару локаль.
const currentLocale = computed(() => {
  const v = i18n.global.locale.value
  return SUPPORTED_LOCALES.includes(v) ? v : DEFAULT_LOCALE
})

// Профіль (дублює Product Policy на FE — відомий борг, див. §3.3 плану)
// Сьогодні Product Policy залежить лише від ui_locale → безпечно. Коли додадуться
// тариф/feature flag — профіль доведеться віддавати з BE у відповіді parse.
const currentProfile = computed(() => {
  // Дзеркало resolve_runtime_context з BE: en → GLOBAL, інші → UA_EDTECH
  return currentLocale.value === 'en' ? 'GLOBAL' : 'UA_EDTECH'
})

// Голос: lang за поточною UI Locale (en → en-US, ru → ru-RU, uk/pl/de → uk-UA).
// Геттер, а не рядок: composable читає opts.lang усередині ensure() при ПЕРШОМУ
// старті розпізнавання, тож зміна локалі до першого використання голосу підхоплюється.
// Відома межа (НЕ чіпаю спільний composable — його ще використовує чат):
// recognition кешується, тож перемикання локалі ПІСЛЯ першого використання голосу
// не змінить мову розпізнавання до перезавантаження сторінки.
const voice = useVoiceDictation({
  get lang() {
    return currentLocale.value === 'en' ? 'en-US' : currentLocale.value === 'ru' ? 'ru-RU' : 'uk-UA'
  },
})
const voiceListening = voice.listening
const VOICE_ENABLED = AI_ENABLED && import.meta.env.VITE_FEATURE_UIA_VOICE === 'true' && voice.supported
function toggleVoice(target) {
  if (target === 'ai') voice.toggle(aiInput)
  else { selected.value = 0; voice.toggle(query) }   // 'cmd' — диктовка у пошук команд
}

// 2026-07-30 (баг, знайдений власником): composable тримає РЕФ того поля, яке було
// видиме на момент start(). Палітра має ДВА поля — `query` (пошук команд) і `aiInput`
// (чат). Перемикання режиму міняє видиме поле, але не реф у composable, тож мікрофон
// лишався червоним, плейсхолдер обіцяв «Слухаю… говоріть», а текст тихо писався у
// СХОВАНЕ поле. Симетрично в обидва боки: commands→ai (вибір дії зі списку, Провідник)
// і ai→commands (кнопка «← Команди»).
// Ре-таргет через start(): він перезаписує model і сіє committed з нового поля;
// повторний r.start() кидає InvalidStateError, який глушиться всередині composable,
// тож виклик під час активного слухання безпечний.
function retargetVoice() {
  if (!voice.listening.value) return
  voice.start(mode.value === 'ai' ? aiInput : query)
}

// «Інтегралик» — маскот AI-помічника (вигляд оновлено з DATA/integral/integral4).
// БЕЗ РОТА (дизайнерське рішення): вираз через очі/кліпання, руку (.itg-arm), слоти
// настрою (.itg-mood: сльоза/сон) й аксесуара (.itg-accessory) — скіни за часом доби.
// КЛАСИ (не id), бо маскот рендериться двічі (fab + шапка). Дихання/кліпання — у стилях.
const MASCOT_SVG =
  '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#d6f1ed" stroke="#0d9488" stroke-width="3"></circle>'
  + '<g class="itg-mood"></g>'
  + '<g class="itg-body">'
  + '<path d="M60 22 C55 12, 42 14, 42 27 C42 42, 58 52, 58 70 C58 85, 45 92, 40 82" fill="none" stroke="#0f5f57" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"></path>'
  + '<path d="M37 24 Q43 23 48 26" fill="none" stroke="#0f5f57" stroke-width="2" stroke-linecap="round"></path>'
  + '<path d="M51 29 Q56 28 61 31" fill="none" stroke="#0f5f57" stroke-width="2" stroke-linecap="round"></path>'
  + '<g class="itg-eye" style="transform-origin:43px 34px;"><circle cx="43" cy="34" r="7" fill="#fff" stroke="#0f5f57" stroke-width="2"></circle><circle class="itg-pupil" cx="43" cy="34" r="3.5" fill="#0f5f57"></circle></g>'
  + '<g class="itg-eye itg-e2" style="transform-origin:55px 40px;"><circle cx="55" cy="40" r="7" fill="#fff" stroke="#0f5f57" stroke-width="2"></circle><circle class="itg-pupil" cx="55" cy="40" r="3.5" fill="#0f5f57"></circle></g>'
  + '<path class="itg-arm" d="M68 58 Q76 52 74 42" fill="none" stroke="#0f5f57" stroke-width="6" stroke-linecap="round"></path>'
  + '<g class="itg-accessory"></g>'
  + '</g></svg>'

// Настрої / аксесуари (з integral4 assistant-icon.js). Рота НЕМАЄ.
const ITG_MOODS = {
  tear: '<path d="M40 44 Q37 51 40 55 Q43 51 40 44 Z" fill="#60a5fa" stroke="#2563eb" stroke-width="1.2"></path>',
  zzz: '<text x="64" y="20" font-size="11" fill="#0f5f57" opacity=".75">z</text><text x="72" y="13" font-size="8" fill="#0f5f57" opacity=".6">z</text><text x="78" y="8" font-size="6" fill="#0f5f57" opacity=".5">z</text>',
}
const ITG_ACC = {
  coffee: '<g transform="translate(66,58)"><rect x="-2" y="2" width="18" height="15" rx="3" fill="#fff" stroke="#0f5f57" stroke-width="2.5"></rect><rect x="-2" y="2" width="18" height="4" fill="#7a4a1f"></rect><path d="M16 6 Q26 6 22 15 Q18 18 15 15" fill="none" stroke="#0f5f57" stroke-width="2.5"></path><path d="M1 -2 Q3 -8 0 -12" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round"></path></g>',
  nightcap: '<g transform="translate(0,-6)"><path d="M28 22 Q30 -6 62 8 Q68 14 66 22 Q47 12 28 22 Z" fill="#5b6cff" stroke="#0f5f57" stroke-width="2.5"></path><circle cx="63" cy="9" r="5.5" fill="#fff" stroke="#0f5f57" stroke-width="2"></circle></g>',
  stars: '<g fill="#f59e0b"><text x="10" y="24" font-size="16">✦</text><text x="70" y="30" font-size="13">✦</text><text x="16" y="66" font-size="11">✧</text></g>',
  hat: '<g transform="translate(0,-4)"><ellipse cx="50" cy="24" rx="30" ry="6.5" fill="#f2c14e" stroke="#0f5f57" stroke-width="2.5"></ellipse><path d="M32 22 Q50 2 68 22 Q66 26 50 27 Q34 26 32 22 Z" fill="#f7d774" stroke="#0f5f57" stroke-width="2.5"></path></g>',
  party: '<g transform="translate(0,-8)"><path d="M42 2 L60 24 L28 24 Z" fill="#f43f5e" stroke="#0f5f57" stroke-width="2"></path><rect x="30" y="16" width="26" height="3" fill="#fff" opacity=".85"></rect></g>',
}

// Оновлюємо ВСІ інстанси маскота (fab + шапка) через класи
function itgSetMood(key) {
  document.querySelectorAll('.itg-mood').forEach((el) => { el.innerHTML = key ? (ITG_MOODS[key] || '') : '' })
}
function itgSetAccessory(html) {
  document.querySelectorAll('.itg-accessory').forEach((el) => { el.innerHTML = html || '' })
}

// Скін за часом доби (кава вранці · ковпак увечері · зірки+сон вночі · party п'ятниця · капелюх вихідні)
let itgSkinMood = ''
function applyItgSkin() {
  const now = new Date()
  const h = now.getHours()
  const day = now.getDay()   // 0 нд .. 6 сб
  let acc = ''
  let mood = ''
  const night = h >= 23 || h < 6
  if (night) { acc = ITG_ACC.stars; mood = 'zzz' }
  else if (h >= 18) { acc = ITG_ACC.nightcap }
  else if (h >= 6 && h < 11) { acc = ITG_ACC.coffee }
  if (day === 5) { acc = ITG_ACC.party + acc }
  else if (day === 0 || day === 6) { acc = ITG_ACC.hat + acc }
  itgSkinMood = mood
  nextTick(() => { itgSetAccessory(acc); itgSetMood(mood) })
}
function itgRestoreFace() { itgSetMood(itgSkinMood) }
// Phase 2 — ДІАЛОГ: тред бульбашок (user/bot/done/confirm/candidates) + історія ≤6 реплік
// у кожен parse-запит (follow-up'и: «ні, ту що вчора», «а тепер експортуй її»).
// Ключ РОЗМОВИ для серверної пам'яті (Фаза 2 «пам'ять чату»). Живе рівно
// стільки, скільки тред: сервер тримає за ним згорнутий стан старших реплік,
// тож новий ключ = чиста пам'ять. Тому скидається ТАМ ЖЕ, де тред, і ніде більше.
function newConversationId() {
  // randomUUID є лише в безпечному контексті (https/localhost). Фолбек мусить
  // давати ВАЛІДНИЙ uuid: сервер розбирає ключ і на кривий рядок працює без
  // пам'яті — тобто мовчки віддає нам ту саму ваду, яку ми лагодимо.
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
const conversationId = ref(newConversationId())
const aiThread = ref([])
const aiBusy = ref(false)
const aiInput = ref('')
const aiThreadEl = ref(null)
const aiInputEl = ref(null)

function aiScroll() {
  nextTick(() => { const el = aiThreadEl.value; if (el) el.scrollTop = el.scrollHeight })
}
function aiPush(item) { aiThread.value.push(item); aiScroll() }

/**
 * HTML відповідей Інтегралика: $LaTeX$ → KaTeX, **жирний** → <strong>.
 *
 * Раніше рядок виводився через {{ }} — учень читав `\Rightarrow`,
 * `\sqrt{...}` і `**стор.5:**` сирим текстом (знахідка власника
 * 2026-08-10). Рендеримо ТИМ САМИМ `renderTextWithLatex`, що малює
 * картки дошки й слайди, — одна поведінка формул усюди.
 *
 * Ключ — індекс у треді; мапа перераховується лише коли тред змінився,
 * а не на кожен ререндер панелі (KaTeX недешевий, а тред росте).
 * Повідомлення КОРИСТУВАЧА свідомо НЕ рендеримо: формул там немає, а
 * будь-який v-html — зайва поверхня.
 */
const aiHtml = computed(() => {
  const out = {}
  aiThread.value.forEach((it, i) => {
    if (it && (it.kind === 'bot' || it.kind === 'done')) {
      out[i] = renderTextWithLatex(String(it.text ?? ''))
    }
  })
  return out
})

function aiHistory() {
  const msgs = []
  for (const it of aiThread.value) {
    if (it.kind === 'user') msgs.push({ role: 'user', content: it.text })
    else if (it.kind === 'bot') msgs.push({ role: 'assistant', content: it.text })
    else if (it.kind === 'done') msgs.push({ role: 'assistant', content: 'Виконано: ' + it.text })
    else if (it.kind === 'confirm') msgs.push({ role: 'assistant', content: it.resp.explain })
    else if (it.kind === 'candidates') msgs.push({ role: 'assistant', content: it.resp.question })
  }
  return msgs.slice(-6)   // ліміт ратифіковано; сервер теж обрізає
}

async function askAi(phrase) {
  mode.value = 'ai'
  retargetVoice()   // видиме поле змінилось → голос мусить писати в нього
  error.value = ''; notice.value = ''
  const history = aiHistory()          // історія ДО поточної репліки
  aiPush({ kind: 'user', text: phrase })
  aiBusy.value = true
  // Phase 2.6 «зір» + 2.7 каталог: на відкритій дошці — стан канви + доступні інструменти
  let boardSummary = null
  let toolCatalog = null
  if (currentBoardId.value) {
    try { boardSummary = await buildBoardSummary() } catch { /* без зору — не блокуємо parse */ }
    try { toolCatalog = await buildToolCatalog() } catch { /* без каталогу — не блокуємо */ }
  }
  try {
    const r = await parseAi(phrase, currentBoardId.value, history, boardSummary, toolCatalog, currentLocale.value, conversationId.value)
    if (r.status === 'propose') {
      if (r.risk === 'low') executeAi(r)
      else aiPush({ kind: 'confirm', resp: r, done: false })
    } else if (r.status === 'clarify') {
      aiPush({ kind: 'candidates', resp: r, done: false })
    } else if (r.status === 'board_action') {
      // 2026-07-31 (скарга власника «він тупо вийшов з дошки»): раніше close_board
      // спрацьовував ТУТ, ДО перевірки ризику — тобто миттєво викидав з дошки без
      // жодного підтвердження. Досить було моделі неточно зрозуміти фразу
      // («відкрий останню дошку» з одруківкою), і людина втрачала робочий контекст
      // одним кліком, без шансу скасувати. Тепер порядок зворотний: спершу ризик.
      // Вихід із дошки — medium (BE), тож завжди питаємо.
      if (r.risk === 'medium' || r.risk === 'high') {
        aiPush({ kind: 'confirm', resp: r, done: false })
      } else if (r.action?.kind === 'close_board') {
        leaveBoard()
      } else {
        await execBoardAction(r)
      }
    } else if (r.status === 'board_action_plan') {
      await runPlan(r)   // Phase 2.10: сценарій з кількох дій
    } else {
      aiPush({ kind: 'bot', text: r.explain })   // відповідь-пояснення або чесний фолбек
    }
  } catch (e) {
    // Ф3: SaaS-ліміт (403 LIMIT_EXCEEDED) — глобальний LimitPaywallModal («Оформи PRO»)
    // уже показано interceptor'ом; не пхаємо в тред ще й «Помилка AI» (finally скине aiBusy).
    if (isLimitError(e)) return
    const d = e?.response?.data
    aiPush({
      kind: 'bot',
      text: d?.error === 'AI_UNAVAILABLE'
        ? 'AI зараз недоступний — спробуйте пізніше.'
        : (ERR_MSG[d?.error] || d?.detail || 'Помилка AI'),
    })
    react('sad')
  } finally {
    aiBusy.value = false
    nextTick(() => aiInputEl.value?.focus())
  }
}

function continueAi() {
  syncQueryFromDom()   // голосовий ввід: підхопити текст, який v-model ще не бачив
  const t = aiInput.value.trim()
  if (!t || aiBusy.value) return
  aiInput.value = ''
  voice.reset()   // після відправки голос диктує з чистого, не дописує надіслане
  askAi(t)
}

// Виконати board_action (санкц. store-action) + done/reaction-бульбашки
// Phase 1 (North Ship, блок A): `sceneMetricFromAction` імпортовано з './sceneMetric'
function emitSceneMetric(action) {
  const m = sceneMetricFromAction(action)
  if (!m) return
  trackScene(m.event, m.op ? { kind: m.kind, op: m.op } : { kind: m.kind })
}

async function execBoardAction(r) {
  try {
    await runBoardAction(r.action)
    emitSceneMetric(r.action)   // Phase 1, блок A: wb.scene.created / word_edit
    // 0b: щойно щось з'явилось на дошці — юзеру треба туди клікати (тягнути
    // повзунок, рухати об'єкт), а пояснення в чаті лишається потрібним. Тому
    // самі закріплюємо панель — але РІВНО ОДИН раз за сеанс і лише якщо людина
    // не відкріпила її сама (2026-08-17).
    autoPinOnce()
    // Вирази з payload → `$latex$`, щоб у чаті стояла формула, а не
    // `sqrt(9-(x-1)^2)` (скарга власника 2026-08-16). Див. explainMath.ts.
    aiPush({ kind: 'done', text: explainWithRenderedMath(r.explain, r.action) })
    react('happy')
  } catch (be) {
    aiPush({ kind: 'bot', text: be?.message || 'Не вдалося виконати дію на дошці.' })
    react('sad')
  }
}

// Phase 2.10: сценарій — виконуємо кроки ПОСЛІДОВНО; будь-який falls → стоп + чесний звіт.
async function runPlan(r) {
  const actions = r.actions || []
  aiPush({ kind: 'bot', text: r.explain })
  for (let i = 0; i < actions.length; i++) {
    try {
      await runBoardAction(actions[i])
      emitSceneMetric(actions[i])   // Phase 1, блок A: кожен успішний крок плану
      aiPush({ kind: 'done', text: `Крок ${i + 1}/${actions.length}` })
      await new Promise((res) => setTimeout(res, 130))   // дати вставці «осісти» (add_tool — через подію)
    } catch (be) {
      aiPush({ kind: 'bot', text: `Крок ${i + 1} не вдався: ${be?.message || ''}. Зупиняюсь.` })
      react('sad')
      return
    }
  }
  react('happy')
}

// Вихід із дошки = дзеркало кнопки «Вийти»: route-leave guard WBSoloRoom сам
// збереже зміни. Винесено з askAi, бо тепер викликається і після підтвердження.
function leaveBoard() {
  close()
  router.push('/winterboard/boards')
}

function confirmAi(item) {
  item.done = true
  // close_board — навігація, а не мутація дошки: execBoardAction її не вміє
  // (у HANDLERS такого kind немає, буде «дія не підтримується»).
  if (item.resp?.action?.kind === 'close_board') leaveBoard()
  else if (item.resp?.action) execBoardAction(item.resp)   // Phase 2.9: підтверджений board_action (delete)
  else executeAi(item.resp)
}
function dismissAi(item) { item.done = true; aiPush({ kind: 'bot', text: 'Скасовано. Що далі?' }) }

// ── Онбординг: Інтегралик-ПРОВІДНИК — ще один КЛІЄНТ Runtime. Гід не має власної
// бізнес-логіки: кожен крок викликає ТІ САМІ операції (create_board / add_graph /
// add_card), що палітра, голос і AI-режим. Скрипт розмови + виклики Runtime.
const GUIDE_KEY = 'm4sh_integralyk_guided'
const guided = ref((() => { try { return localStorage.getItem(GUIDE_KEY) === '1' } catch { return false } })())
const GUIDE_STEPS = [
  { say: 'Привіт! Я Інтегралик 👋 За кілька кроків покажу, що вмію — прямо на цій дошці. Поїхали?', cta: 'Почнемо' },
  { run: () => runBoardAction({ kind: 'add_graph', payload: { expression: 'sin(x)' } }),
    say: 'Крок 1 — я будую графіки функцій. Ось y = sin(x) вже на дошці 📈', cta: 'Далі' },
  { run: () => runBoardAction({ kind: 'add_card', payload: { title: 'Приклад картки', body: 'Пояснення з формулами: похідна $(\\sin x)\' = \\cos x$.' } }),
    say: 'Крок 2 — пишу теорію й розв\'язки гарними картками з формулами.', cta: 'Далі' },
  { say: 'Крок 3 — я БАЧУ дошку й розв\'язую задачі. Спробуй: «розв\'яжи задачу», «намалюй трикутник», «опиши навколо нього коло». А ще розумію голос — тисни 🎤 і говори.', cta: 'Далі' },
  { say: 'Готово 🎉 Коли урок готовий — скажи «збережи як урок», і він з\'явиться в «Мої уроки». Тепер просто описуй дії словами — я поруч!', cta: 'Дякую!' },
]
let _gidx = -1
function startGuide() {
  mode.value = 'ai'; aiThread.value = []; aiInput.value = ''
  conversationId.value = newConversationId()   // знайомство — теж нова розмова
  retargetVoice()   // той самий перехід commands→ai, той самий ре-таргет
  if (!currentBoardId.value) {
    aiPush({ kind: 'bot', text: 'Привіт! Я Інтегралик 👋 Найкраще показати все прямо на дошці. Створю нову — і проведу тебе?' })
    aiPush({ kind: 'guidecreate', label: 'Створити дошку і почати' })
    react('wave')
    return
  }
  _gidx = -1
  guideNext()
}
async function guideNext() {
  _gidx++
  const step = GUIDE_STEPS[_gidx]
  if (!step) { finishGuide(); return }
  if (step.run) {
    try { await step.run() } catch (e) { aiPush({ kind: 'bot', text: 'Ой, крок не вдався: ' + (e?.message || '') }) }
  }
  aiPush({ kind: 'bot', text: step.say })
  aiPush({ kind: 'guidecta', label: step.cta })
  react(_gidx >= GUIDE_STEPS.length - 1 ? 'happy' : 'wave')
}
function finishGuide() {
  guided.value = true
  try { localStorage.setItem(GUIDE_KEY, '1') } catch { /* private */ }
  aiPush({ kind: 'bot', text: 'Провідник завершено. Клич будь-коли — «провідник» у палітрі.' })
}
function guideCreate() {
  run(() => sendIntent('CREATE', [{ type: 'Board', params: { title: 'Моя перша дошка' } }], 'guide'),
    (r) => {
      try { localStorage.setItem(GUIDE_KEY, '1') } catch { /* private */ }
      close()
      router.push({ name: 'winterboard-prepare', params: { id: r.result.board_id } })
    })
}

function pickAiCandidate(item, c) {
  item.done = true
  const t = item.resp.pick_template
  // Phase 2.8/2.9: clarify для дії НА дошці — пік будує board_action (не звичайний intent)
  if (t.board_action) {
    const extra = { ...(t.extra || {}) }
    const confirm = extra.confirm
    delete extra.confirm
    const action = { kind: t.board_action, payload: { [t.param]: c.id, ...extra } }
    const resp = { action, explain: `Готово · ${c.label}`, risk: confirm ? 'medium' : 'low' }
    if (confirm) { resp.explain = `Видалю «${c.label}». Скасувати — Ctrl+Z.`; aiPush({ kind: 'confirm', resp, done: false }) }
    else execBoardAction(resp)
    return
  }
  const proposal = {
    capability: t.capability, risk: t.risk, verb: t.verb,
    objects: [{ type: t.type, params: { [t.param]: c.id } }],
    explain: `${item.resp.question} → «${c.label}»`,
  }
  if (t.risk === 'high') aiPush({ kind: 'confirm', resp: proposal, done: false })  // destructive — ще один confirm
  else executeAi(proposal)                                                          // explicit вибір = підтвердження
}

// Після успіху: навігація закриває палітру; списки перемикають режим;
// решта — «✓ done»-бульбашка в треді, діалог продовжується.
// Навігаційні capability йдуть через `announceAndGo` — тиша була системною
// (усі 4 навігаційні команди), не в одній кнопці.
const AI_AFTER = {
  'workspace.create_board': (r) => announceAndGo(
    `Дошку «${r.result?.title || 'Нова дошка'}» створено`,
    { name: 'winterboard-prepare', params: { id: r.result.board_id } }),
  'lesson.generate': (r) => announceAndGo(
    `Урок «${r.result?.title || 'без назви'}» згенеровано`,
    { name: 'winterboard-prepare', params: { id: r.result.session_id } }),
  'knowledge.open_lesson': (r) => announceAndGo(
    `Урок відкрито${r.result?.title ? `: «${r.result.title}»` : ''}`,
    { name: 'winterboard-solo', params: { id: r.result.session_id } }),
  'knowledge.list_lessons': (r) => { lessons.value = r.result.lessons || []; mode.value = 'lessons' },
  'workspace.list_boards': (r) => { boards.value = r.result.boards || []; mode.value = 'boards' },
  'workspace.rename_board': () => notifyBoardsChanged(),
  'workspace.delete_board': () => notifyBoardsChanged(),
  'knowledge.save_draft': () => {},
}

function executeAi(p) {
  if (p.capability === 'workspace.export_board') {
    // launcher-патерн: продуктовий діалог експорту (capture-фаза всередині) з autostart
    // формату, який користувач назвав у фразі — без повторного вибору.
    openProductExport(p.objects[0].params.board_id, p.objects[0].params.format || 'pdf')
    return
  }
  run(async () => {
    // IPC-5: перед збереженням/публікацією стану дошки — дренувати pending ops (як продукт)
    if (p.capability === 'knowledge.save_draft' || p.capability === 'knowledge.publish_board') {
      await flushBoardOps()
    }
    return sendIntent(p.verb, p.objects, 'ai')
  }, (r) => {
    const after = AI_AFTER[p.capability]
    if (after) after(r)
    // якщо лишились у діалозі — done-бульбашка (для історії follow-up'ів теж) + радість
    if (open.value && mode.value === 'ai') {
      aiPush({ kind: 'done', text: p.explain || 'Готово' })
      react('happy')
    }
  })
}

// ── Інтегралик живий (порт з DATA/integral/integral2): підказки + реакції + конфеті ──
const fabEl = ref(null)
const mascotEl = ref(null)
const fabMood = ref('')            // '' | 'happy' | 'sad'
let moodTimer = null

function react(kind) {
  fabMood.value = kind
  clearTimeout(moodTimer)
  moodTimer = setTimeout(() => { fabMood.value = ''; itgRestoreFace() }, 1700)
  if (kind === 'happy') { itgSetMood(''); confettiBurst() }        // радість — конфеті + погойдування
  else if (kind === 'sad') { itgSetMood('tear') }                  // сум — сльоза
  // wave — лише погойдування тіла/руки (без зміни настрою)
}

// Конфеті через Web Animations API (елементи поза scoped-CSS)
function confettiBurst() {
  const anchor = (open.value ? mascotEl.value : fabEl.value)
  const r = anchor?.getBoundingClientRect?.()
  if (!r) return
  const colors = ['#0d9488', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7']
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('div')
    p.style.cssText = `position:fixed;width:6px;height:6px;border-radius:1px;z-index:70;pointer-events:none;`
      + `left:${r.left + r.width / 2 + (Math.random() * 40 - 20)}px;top:${r.top + Math.random() * 10}px;`
      + `background:${colors[i % colors.length]}`
    document.body.appendChild(p)
    p.animate(
      [{ transform: 'translateY(0) rotate(0deg)', opacity: 1 },
       { transform: `translateY(-70px) rotate(${160 + Math.random() * 80}deg)`, opacity: 0 }],
      { duration: 900, easing: 'ease-out' },
    )
    setTimeout(() => p.remove(), 950)
  }
}

// Зіниці стежать за курсором (порт pupil-tracking з оригінального assistant.js):
// rAF-тротлінг, максимум ~2px зсуву; ціль — видимий маскот (fab або шапка діалогу).
let pupilRaf = 0
let pupilX = 0
let pupilY = 0
function onEyesMove(e) {
  pupilX = e.clientX
  pupilY = e.clientY
  if (pupilRaf) return
  pupilRaf = requestAnimationFrame(() => {
    pupilRaf = 0
    const host = open.value ? mascotEl.value : fabEl.value
    if (!host) return
    const r = host.getBoundingClientRect()
    const ang = Math.atan2(pupilY - (r.top + r.height / 2), pupilX - (r.left + r.width / 2))
    const m = r.width > 40 ? 2 : 1.3   // fab 46px / маскот у шапці 28px
    const t = `translate(${(Math.cos(ang) * m).toFixed(2)}px, ${(Math.sin(ang) * m).toFixed(2)}px)`
    host.querySelectorAll('.itg-pupil').forEach((p) => { p.style.transform = t })
  })
}

// Проактивні бульбашки-підказки. КОНТЕКСТНІ: набір залежить від того, де користувач
// (у дошці / у студії дощок / деінде). Показуємо лише коли палітра закрита.
// Кожна фраза натякає на РЕАЛЬНУ команду, доступну в цьому контексті.
const TIPS = {
  // всередині відкритої дошки — малювання, графіки, формули, розв'язки, збереження, експорт
  board: [
    'Скажи «побудуй графік sin(x)» — намалюю прямо тут.',
    '«Побудуй графік x² − 3» — і парабола на дошці.',
    'Хочеш косинусоїду? Скажи «побудуй графік cos(x)».',
    '«Встав формулу x²+2x+1» — покладу гарну картку.',
    'Скажи «напиши на дошці: Тема уроку».',
    '«Розв’яжи задачу з дошки» — розпишу покроково.',
    'Спитай «що зараз є на дошці?» — я все бачу.',
    '«Збережи цю дошку як урок» — і вона в «Мої уроки».',
    'Скажи «експортуй дошку в PDF» — зберу файл.',
    'Потрібен малюнок? «Експортуй дошку в PNG».',
    '«Додай картку з поясненням» — формули відрендерю гарно.',
    'Застряг? «Розв’яжи задачу і запиши на дошку».',
    '«Побудуй графік ln(x)» — логарифм готовий.',
    'Хочеш ще дошку? Скажи «створи дошку».',
    '«Згенеруй урок з похідних на 5 задач».',
    'Скажи «закрий дошку» — вийду й збережу зміни.',
    '«Перейменуй дошку на Контрольна».',
    '«Побудуй графік tg(x)» — обережно, там розриви!',
    'Хочеш перевірити відповідь? Спитай мене про задачу.',
    '«Побудуй графік e^x» — експонента летить угору.',
    'Скажи «додай текст: Домашнє завдання».',
    '«Розв’яжи задачу на цій сторінці» — прочитаю умову.',
    '«Побудуй параболу y = x² − 4».',
    '«Експортуй усі сторінки в PDF» — зберу весь урок.',
    '«Збережи як урок» — відкриєш будь-коли.',
    'Спитай «що на першій сторінці?» — перевірю.',
    '«Побудуй графік 1/x» — гіпербола готова.',
    '«Побудуй графік √x» — корінь плавно росте.',
    'Розписати теорію? «Додай картку теорії».',
    '«Побудуй графік |x|» — модуль кутиком.',
    '«Побудуй графік sin(x)·cos(x)» — цікава хвиля.',
    '«Побудуй графік x³» — кубічна парабола.',
    '«Додай картку з розв’язком» — усе по кроках.',
    '«Згенеруй урок з інтегралів на 6 задач».',
    '«Побудуй графік cos(2x)» — частіші коливання.',
    '«Встав формулу теореми Піфагора».',
    '«Напиши на дошці: Розв’язання».',
    '«Побудуй графік x² + 1» — вершина вгорі.',
    'Хочеш дві функції? Проси обидва графіки поспіль.',
    '«Розв’яжи задачу» — і перевіримо відповідь разом.',
  ],
  // студія дощок / список — створення, генерація, відкриття уроків
  studio: [
    'Скажи «створи дошку» — почнемо нову.',
    '«Згенеруй урок з логарифмів на 6 задач».',
    'Скажи «покажи мої уроки» — відкрию список.',
    '«Покажи мої дошки» — зберу все докупи.',
    '«Відкрий останній урок» — продовжимо роботу.',
    '«Створи дошку Тригонометрія» — одразу з назвою.',
    '«Згенеруй урок з квадратних рівнянь».',
    '«Відкрий мої уроки» — усі збережені там.',
    'Скажи «видали дошку …» — спитаю підтвердження.',
    '«Створи урок з інтегралів на 8 задач».',
    'Скажи «перейменуй дошку» — оновлю назву.',
    '«Згенеруй урок з геометрії» — підберу задачі.',
    '«Відкрий урок про похідну» — знайду серед твоїх.',
    'Хочеш продовжити? «Відкрий останній урок».',
    '«Згенеруй урок з прогресій на 5 задач».',
    '«Покажи мої уроки» — виберемо, що провести.',
    '«Створи дошку Контрольна 9 клас».',
    'Готуєшся до НМТ? «Згенеруй урок з тригонометрії».',
    '«Відкрий вкладку мої уроки» — усе там.',
    '«Згенеруй урок з дробів на 4 задачі».',
    '«Створи нову дошку для сьогоднішнього уроку».',
    '«Згенеруй урок зі стереометрії» — 3D-задачі теж є.',
    'Не знаєш з чого почати? Скажи «створи дошку».',
    '«Згенеруй урок з функцій на 6 задач».',
    '«Створи дошку Алгебра 8 клас».',
    '«Покажи мої дошки» — і оберемо потрібну.',
    '«Створи дошку для домашнього завдання».',
    '«Згенеруй урок з рівнянь на 7 задач».',
    '«Покажи мої уроки» — і одразу проведемо.',
    '«Створи урок з відсотків на 5 задач».',
    '«Згенеруй урок з векторів» — підберу задачі.',
    '«Відкрий останній урок» — від того ж місця.',
  ],
  // деінде (дашборд, інші сторінки) — універсальні дії
  other: [
    'Скажи «створи дошку» — і почнемо працювати.',
    '«Згенеруй урок з логарифмів на 6 задач».',
    'Скажи «покажи мої уроки» — відкрию список.',
    '«Відкрий останній урок» — продовжимо, де спинились.',
    'Скажи «згенеруй урок» — і назви тему.',
    'Я поруч — тисни на мене й опиши дію словами.',
    '«Покажи мої дошки» — усе в один список.',
    '«Створи урок з квадратних рівнянь».',
    'Готуєшся до заняття? «Згенеруй урок за темою».',
    'Тисни на мене — перекладу твої слова в дію.',
    'Скажи «створи дошку» і малюй прямо пером.',
    '«Згенеруй урок з геометрії на 5 задач».',
    'Спитай мене про математику — поясню коротко.',
    '«Відкрий мої уроки» — виберемо, що провести.',
    'Хочеш почати? Скажи «створи дошку».',
    '«Згенеруй урок з тригонометрії» — підберу задачі.',
    'Я розумію звичайні слова — опиши, що треба.',
    '«Покажи мої уроки» — усе під рукою.',
    'Спитай «що ти вмієш?» — розкажу коротко.',
    'Потрібна дошка? Скажи «створи дошку».',
    'Хочеш урок за 10 секунд? «Згенеруй урок з теми».',
    'Просто опиши дію — я зроблю решту.',
    '«Відкрий останній урок» — повернемось до роботи.',
    '«Покажи мої уроки» — оберемо і відкриємо.',
  ],
}

// Контекст = де користувач зараз (визначає набір підказок)
function tipContext() {
  if (currentBoardId.value) return 'board'
  if (route.name === 'winterboard-boards') return 'studio'
  return 'other'
}

// Антиповтор: не показуємо жодну з останніх ~6 фраз (щоб не «бісило»)
const recentTips = []
function pickTip() {
  const pool = TIPS[tipContext()] || TIPS.other
  const avoid = recentTips.slice(-Math.min(6, pool.length - 1))
  let t = pool[Math.floor(Math.random() * pool.length)]
  for (let i = 0; i < 12 && avoid.includes(t); i++) {
    t = pool[Math.floor(Math.random() * pool.length)]
  }
  recentTips.push(t)
  if (recentTips.length > 8) recentTips.shift()
  return t
}
const tipVisible = ref(false)
const tipText = ref('')
const tipStyle = ref({})
const tipSide = ref('right')     // сторона ХВОСТИКА: 'right' = маскот справа від бульбашки
let tipShowTimer = null
let tipHideTimer = null

// Ставимо бульбашку ПОРУЧ з Інтеграликом, хвостиком до нього (не «з кута»).
// Вертикально центруємо на маскоті (top + translateY(-50%)) → хвостик завжди
// дивиться йому в «обличчя». Горизонтально: ліворуч від нього, а біля лівого
// краю екрана — праворуч (щоб бульбашка не вилазила).
function placeTip() {
  const host = fabEl.value
  if (!host) return
  const r = host.getBoundingClientRect()
  const GAP = 13
  const vw = window.innerWidth
  const vh = window.innerHeight
  const centerY = Math.max(48, Math.min(r.top + r.height / 2, vh - 48))
  if (r.left >= 250) {
    tipSide.value = 'right'                                  // маскот праворуч → хвостик справа
    tipStyle.value = { right: (vw - r.left + GAP) + 'px', top: centerY + 'px' }
  } else {
    tipSide.value = 'left'                                   // маскот ліворуч → хвостик зліва
    tipStyle.value = { left: (r.right + GAP) + 'px', top: centerY + 'px' }
  }
}

function tipClick() { tipVisible.value = false; openPalette() }

function scheduleTip() {
  clearTimeout(tipShowTimer)
  tipShowTimer = setTimeout(() => {
    // Варіант A: TIPS — хардкоджений укр. словник (TIPS вище), i18n нема.
    // Не перекладаємо, а ховаємо для не-uk локалі, щоб en/ru-юзер не бачив
    // українських бульбашок. Таймер продовжує тікати — при поверненні на uk
    // підказки з'являться без перемонтування (locale реактивна).
    if (!open.value && currentLocale.value === 'uk' && Math.random() < 0.7) {
      tipText.value = pickTip()
      placeTip()
      tipVisible.value = true
      react('wave')   // помах уваги при появі підказки (без конфеті)
      clearTimeout(tipHideTimer)
      tipHideTimer = setTimeout(() => { tipVisible.value = false }, 7000)
    }
    scheduleTip()
  }, 40000 + Math.random() * 40000)   // кожні ~40–80с, з шансом 70%
}

// ── Інтегралик: перетягування (юзер сам обирає місце; позиція живе в localStorage) ──
// Pointer-події: працює мишею, ПЕРОМ планшета і пальцем. Клік vs drag розрізняємо
// порогом 5px; після перетягування click-подію гасимо, щоб палітра не відкривалась.
const FAB_POS_KEY = 'm4sh_integralyk_pos'
const FAB_SIZE = 46
const fabPos = ref(null)               // {x,y} | null → дефолтна позиція з CSS (top-right)
let fabDrag = null                     // {startX,startY,origX,origY,moved}
let fabDragJustMoved = false

const fabStyle = computed(() =>
  fabPos.value ? { left: fabPos.value.x + 'px', top: fabPos.value.y + 'px', right: 'auto' } : {},
)

function clampFab(x, y) {
  const maxX = window.innerWidth - FAB_SIZE - 4
  const maxY = window.innerHeight - FAB_SIZE - 4
  return { x: Math.min(Math.max(4, x), maxX), y: Math.min(Math.max(4, y), maxY) }
}

function fabPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const rect = e.currentTarget.getBoundingClientRect()
  fabDrag = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, moved: false }
  try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* older browsers */ }
}
function fabPointerMove(e) {
  if (!fabDrag) return
  const dx = e.clientX - fabDrag.startX
  const dy = e.clientY - fabDrag.startY
  if (!fabDrag.moved && Math.hypot(dx, dy) < 5) return
  fabDrag.moved = true
  fabPos.value = clampFab(fabDrag.origX + dx, fabDrag.origY + dy)
}
function fabPointerUp() {
  if (!fabDrag) return
  fabDragJustMoved = fabDrag.moved
  if (fabDrag.moved && fabPos.value) {
    try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(fabPos.value)) } catch { /* private mode */ }
  }
  fabDrag = null
}
function onFabClick() {
  if (fabDragJustMoved) { fabDragJustMoved = false; return }  // це був drag, не клік
  openPalette()
}
function restoreFabPos() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAB_POS_KEY) || 'null')
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      fabPos.value = clampFab(saved.x, saved.y)   // clamp — раптом екран став меншим
    }
  } catch { /* зіпсований запис — лишаємо дефолт */ }
}

// ── Мобільний layout (телефон): палітра стає нижнім «листом», не плаваючим вікном.
// isNarrow (≤640px) → CSS-лист + вимкнений drag панелі + ігнор desktop-позиції.
// kbInset (VisualViewport) піднімає лист над екранною клавіатурою на iOS (де layout-
// viewport не стискається) і обмежує висоту, щоб верх листа / поле вводу не обрізались.
// Стратегія: на телефоні палітра — голос-перша й текст-знизу, поле завжди над клавіатурою.
const isNarrow = ref(false)
const kbInset = ref(0)
let narrowMq = null
function updateNarrow() { isNarrow.value = !!(narrowMq && narrowMq.matches) }
const overlayStyle = computed(() =>
  isNarrow.value && kbInset.value ? { paddingBottom: kbInset.value + 'px' } : {},
)

// ── 0b (2026-07-31): PIN-режим — дошку можна чіпати, чат лишається ──────────
// Проблема: підкладка ловила ВСІ кліки (`@click.self="close"`), тож клік по дошці
// закривав панель. Тягнути повзунок графіка й читати пояснення було неможливо.
// У pin: підкладка стає прозорою і `pointer-events:none` → кліки йдуть на дошку,
// панель лишається (вона вже перетягувана й пам'ятає позицію — restorePanelPos).
// Закриття у pin — ЛИШЕ явне: ✕ або Esc.
// pin = desktop/широкий планшет І відкрита дошка. Ширина: на вузькому екрані
// панель фактично повноекранна, «відсунути» чат нема куди. Дошка: pin існує
// заради того, щоб дошка лишалась клікабельною — у списках, матеріалах,
// кабінеті під панеллю немає чого чіпати, і єдиним ефектом лишалося «клік повз
// панель не закриває». Кнопка ні про що (скарга власника 2026-08-17).
const canPin = computed(() => !isNarrow.value && !!currentBoardId.value)

// Хто вирішує, коли панель закріплена — політика у ./pinPolicy.ts (там же
// тести). Коротко: рішення людини старше за автоматику, авто-pin один раз за
// діалог. `pinnedPref` лишає стару назву — на неї дивиться решта файлу.
const {
  pinned: pinnedPref,
  isPinned,
  togglePin,
  autoPinOnce,
  resetHabit: resetPinHabit,
} = createPinPolicy(() => canPin.value)

function onOverlayClick() { if (!isPinned.value) close() }
function onViewportResize() {
  const vv = window.visualViewport
  if (!vv || !isNarrow.value || !open.value) { kbInset.value = 0; return }
  const inset = Math.round(window.innerHeight - vv.height - vv.offsetTop)
  kbInset.value = inset > 90 ? inset : 0   // >90px ≈ клавіатура (не URL-бар)
}

// ── Панель перетягувана за ШАПКУ (щоб не закривала дошку під час дій Інтегралика) ──
// Позиція живе в localStorage; перетягнув убік раз — лишається там. Pointer-події →
// миша/перо/палець. Клік по кнопках/полях НЕ починає drag. На телефоні (isNarrow) drag
// вимкнено й desktop-позиція ігнорується — лист завжди знизу.
const CMDP_POS_KEY = 'm4sh_cmdp_pos'
const panelEl = ref(null)
const panelPos = ref(null)             // {x,y} | null → центр (флекс оверлея)
let panelDrag = null

const panelStyle = computed(() => {
  if (isNarrow.value) {
    // лист над клавіатурою: обмежуємо висоту видимою областю (innerHeight − клавіатура)
    return kbInset.value ? { maxHeight: (window.innerHeight - kbInset.value - 8) + 'px' } : {}
  }
  return panelPos.value
    ? { position: 'fixed', left: panelPos.value.x + 'px', top: panelPos.value.y + 'px', margin: '0' }
    : {}
})

function clampPanel(x, y) {
  const el = panelEl.value
  const w = el?.offsetWidth || 600
  const h = el?.offsetHeight || 200
  return {
    x: Math.min(Math.max(4, x), window.innerWidth - Math.min(w, 120)),   // лишаємо видимим край
    y: Math.min(Math.max(4, y), window.innerHeight - 48),
  }
}

function panelPointerDown(e) {
  if (isNarrow.value) return                     // телефон: лист фіксований знизу, не тягається
  // drag лише за шапку; не за кнопки/поля/списки
  if (!e.target.closest('.cmdp-head')) return
  if (e.target.closest('button, input, a')) return
  const r = panelEl.value.getBoundingClientRect()
  panelDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top }
  try { panelEl.value.setPointerCapture(e.pointerId) } catch { /* older */ }
}
function panelPointerMove(e) {
  if (!panelDrag) return
  panelPos.value = clampPanel(e.clientX - panelDrag.dx, e.clientY - panelDrag.dy)
}
function panelPointerUp() {
  if (!panelDrag) return
  panelDrag = null
  if (panelPos.value) {
    try { localStorage.setItem(CMDP_POS_KEY, JSON.stringify(panelPos.value)) } catch { /* private */ }
  }
}
function restorePanelPos() {
  try {
    const s = JSON.parse(localStorage.getItem(CMDP_POS_KEY) || 'null')
    if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) {
      panelPos.value = s
      nextTick(() => { if (panelPos.value) panelPos.value = clampPanel(panelPos.value.x, panelPos.value.y) })
    }
  } catch { /* зіпсований запис — центр */ }
}

// ── palette lifecycle ──
// Compat-шим для ГОЛОСОВОГО вводу (Voice In та ін. розширення): вони пишуть текст
// прямо в DOM-поле БЕЗ події `input`, тож v-model не оновлюється (поле заповнене,
// а query порожній → AI-пункт не з'являється). Поки палітра відкрита — синкаємо
// значення з DOM; при зміні скидаємо підсвітку на перший пункт.
let domSyncTimer = null
function syncQueryFromDom() {
  const dom = inputEl.value?.value
  if (typeof dom === 'string' && dom !== query.value) {
    query.value = dom
    selected.value = 0
  }
  // Те саме для поля діалогу Інтегралика (інакше голосовий текст не активує «➤»)
  const aiDom = aiInputEl.value?.value
  if (typeof aiDom === 'string' && aiDom !== aiInput.value) {
    aiInput.value = aiDom
  }
}

function openPalette() {
  open.value = true
  // 0a (2026-07-31): тред БІЛЬШЕ НЕ стирається на відкриття. Раніше тут стояло
  // `aiThread.value = []  // новий діалог на кожне відкриття` — і розмова гинула
  // від будь-якого закриття панелі (а закривав її навіть клік по дошці). Тепер
  // розмова живе, поки жива вкладка; явне скидання — кнопка «↺» (newDialog).
  // Якщо є незавершений тред — відкриваємось ОДРАЗУ в ньому, інакше в командах:
  // інакше «продовжити розмову» коштувало б зайвого кліку.
  const hasThread = aiThread.value.length > 0
  mode.value = hasThread ? 'ai' : 'commands'
  query.value = ''; selected.value = 0
  error.value = ''; notice.value = ''
  tipVisible.value = false
  aiInput.value = ''; aiBusy.value = false   // чернетка й busy — так, тред — ні
  // 0b+ (2026-07-31, скарга «модалка просто закрилась»): якщо ВІДКРИТА ДОШКА —
  // закріплюємо одразу, не чекаючи поки AI щось намалює. На дошці людина неминуче
  // клікає по канві (подивитись, вибрати об'єкт), а клік повз панель її закривав —
  // разом із розмовою на екрані. Поза дошкою (списки, кабінет) лишаємо звичайну
  // модалку: там клік-повз-закрити очікуваний і нічого не руйнує.
  // 2026-08-17: через autoPinOnce — щоб відкриття панелі не скасовувало ручне
  // відкріплення (саме це робило кнопку 📌 на вигляд мертвою).
  autoPinOnce()
  restorePanelPos()   // відновити місце, куди юзер відсунув панель
  applyItgSkin()      // маскот у шапці теж отримує скін часу доби
  nextTick(() => (hasThread ? aiInputEl.value : inputEl.value)?.focus())
  clearInterval(domSyncTimer)
  domSyncTimer = setInterval(syncQueryFromDom, 300)
}

// 0a: ЄДИНИЙ спосіб втратити розмову — явна дія юзера (Product Invariant #1).
function newDialog() {
  aiThread.value = []
  // Новий діалог — чистий аркуш і для pin-звички: авто-закріплення знову
  // дозволене, ручне відкріплення попереднього діалогу не тягнемо далі.
  resetPinHabit()
  conversationId.value = newConversationId()   // і серверна пам'ять теж з чистого
  aiInput.value = ''
  aiBusy.value = false
  voice.reset()   // голос диктує з чистого, не дописує до попередньої розмови
  nextTick(() => aiInputEl.value?.focus())
}
function close() { open.value = false; loading.value = false; clearInterval(domSyncTimer); voice.stop(); kbInset.value = 0 }
function toCommands() { mode.value = 'commands'; retargetVoice(); error.value = ''; nextTick(() => inputEl.value?.focus()) }
function move(d) { syncQueryFromDom(); const n = filtered.value.length; if (n) selected.value = (selected.value + d + n) % n }
function runSelected() {
  syncQueryFromDom()
  if (selected.value >= filtered.value.length) selected.value = 0
  const c = filtered.value[selected.value]
  if (c) invoke(c)
}

/**
 * 2026-08-16 — вхід «спитати Інтегралика ЦИМ текстом» для інших модулів.
 * Живий випадок власника: у поле ✨ «Збагатити урок» ввели «що ти вмієш?» —
 * enrich не має що на це відповісти, а Інтегралик — має. Модалка enrich
 * шле CustomEvent (конвенція `m4sh:open-export-dialog`), палітра відкривається
 * ОДРАЗУ в діалозі й ставить репліку. Якщо Інтегралик вимкнено (build-флаг
 * або per-акаунт) — відкриваємось у командах із поясненням, а не мовчимо:
 * кнопка в іншому модулі не має «нічого не робити».
 */
function onIntegralykAsk(e) {
  const text = String(e?.detail?.text ?? '').trim()
  if (!enabled.value || !text) return
  if (!open.value) openPalette()
  if (!showAI.value) {
    mode.value = 'commands'
    notice.value = 'Інтегралик вимкнено в налаштуваннях профілю — увімкніть, щоб ставити питання словами.'
    return
  }
  askAi(text)
}

function onKeydown(e) {
  if (matchesShortcut(e)) {
    e.preventDefault(); open.value ? close() : openPalette()
  } else if (open.value && e.key === 'Escape') {
    mode.value !== 'commands' ? toCommands() : close()
  }
}

onMounted(() => {
  if (enabled.value) window.addEventListener('keydown', onKeydown)
  window.addEventListener('m4sh:integralyk-ask', onIntegralykAsk)
  restoreFabPos()
  // Мобільний layout: стежимо за шириною екрана + екранною клавіатурою (VisualViewport)
  try {
    narrowMq = window.matchMedia('(max-width: 640px)')
    updateNarrow()
    narrowMq.addEventListener ? narrowMq.addEventListener('change', updateNarrow) : narrowMq.addListener(updateNarrow)
  } catch { /* matchMedia недоступний */ }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize)
    window.visualViewport.addEventListener('scroll', onViewportResize)
  }
  if (enabled.value && AI_ENABLED) {
    loadIntegralykPref()   // per-акаунт вимкнення (може сховати маскот)
    scheduleTip()
    applyItgSkin()   // скін маскота за часом доби (кава/ковпак/зірки/party/капелюх)
    window.addEventListener('mousemove', onEyesMove, { passive: true })
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('m4sh:integralyk-ask', onIntegralykAsk)
  window.removeEventListener('mousemove', onEyesMove)
  try { narrowMq && (narrowMq.removeEventListener ? narrowMq.removeEventListener('change', updateNarrow) : narrowMq.removeListener(updateNarrow)) } catch { /* noop */ }
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', onViewportResize)
    window.visualViewport.removeEventListener('scroll', onViewportResize)
  }
  if (pupilRaf) cancelAnimationFrame(pupilRaf)
  clearInterval(domSyncTimer)
  clearTimeout(tipShowTimer); clearTimeout(tipHideTimer); clearTimeout(moodTimer)
  voice.stop()
})
</script>

<style scoped>
/* Плаваючий «Інтегралик»: напівпрозорий, під зоною дзвіночка; z нижче за оверлей (60). */
.cmdp-fab-wrap { position: fixed; top: 74px; right: 18px; z-index: 55; width: 46px; height: 46px; }
.cmdp-fab { position: absolute; inset: 0; width: 46px; height: 46px; border: 0; border-radius: 50%;
  cursor: grab; background: transparent; padding: 0;
  touch-action: none; /* drag пером/пальцем, а не скрол сторінки */
  opacity: .6; transition: opacity .15s ease;
  filter: drop-shadow(0 3px 8px rgba(13, 148, 136, .35)); }
.cmdp-fab-wrap:hover .cmdp-fab { opacity: 1; }
.cmdp-fab:active { cursor: grabbing; }
.cmdp-fab :deep(svg) { width: 100%; height: 100%; display: block; overflow: visible; }
/* «×» — приховати помічника; видно лише на hover обгортки */
.cmdp-fab-hide { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; z-index: 1;
  border: 1px solid #e5e7eb; border-radius: 50%; background: #fff; color: #6b7280; cursor: pointer;
  font-size: 13px; line-height: 1; padding: 0; display: grid; place-items: center;
  opacity: 0; transform: scale(.7); transition: opacity .12s ease, transform .12s ease; }
.cmdp-fab-wrap:hover .cmdp-fab-hide { opacity: 1; transform: scale(1); }
.cmdp-fab-hide:hover { color: #ef4444; border-color: #ef4444; }
/* 0a: бейдж «є незавершена розмова». Ліворуч-угору, щоб не збігтися з ×-кнопкою
   приховування (вона top-right і з'являється на hover). */
.cmdp-fab-badge { position: absolute; top: -2px; left: -2px; width: 11px; height: 11px; z-index: 1;
  border-radius: 50%; background: #0d9488; border: 2px solid #fff; pointer-events: none; }

/* Бульбашка-підказка Інтегралика — спіч-бабл із ХВОСТИКОМ до маскота (JS ставить
   left/right+top, translateY(-50%) центрує по вертикалі → хвостик дивиться йому в обличчя). */
.cmdp-tip { position: fixed; z-index: 54; max-width: 230px;
  background: #f0fbf9; border: 1px solid #bfe5df; border-radius: 12px;
  padding: 9px 12px; font-size: 12.5px; line-height: 1.4; color: #114b45; text-align: left;
  box-shadow: 0 10px 26px rgba(20, 30, 30, .18); cursor: pointer;
  transform: translateY(-50%); }
/* Хвостик — повернутий квадрат із 2 бордерами; половина стирчить у бік Інтегралика */
.cmdp-tip::after { content: ''; position: absolute; top: 50%; width: 12px; height: 12px;
  background: #f0fbf9; transform: translateY(-50%) rotate(45deg); }
.cmdp-tip.tail-right { border-bottom-right-radius: 4px; animation: tip-in-right .22s ease; }
.cmdp-tip.tail-right::after { right: -6px; border-top: 1px solid #bfe5df; border-right: 1px solid #bfe5df; }
.cmdp-tip.tail-left { border-bottom-left-radius: 4px; animation: tip-in-left .22s ease; }
.cmdp-tip.tail-left::after { left: -6px; border-bottom: 1px solid #bfe5df; border-left: 1px solid #bfe5df; }
.cmdp-tip:hover { border-color: #0d9488; }
/* Поява — «виїжджає» з боку маскота (translateY(-50%) зберігаємо, бо ним центруємось) */
@keyframes tip-in-right { from { opacity: 0; transform: translateY(-50%) translateX(10px) scale(.96); }
  to { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); } }
@keyframes tip-in-left { from { opacity: 0; transform: translateY(-50%) translateX(-10px) scale(.96); }
  to { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); } }

/* Настрої Інтегралика (реакції на успіх/помилку) */
@keyframes itg-happy { 0%, 100% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-6px) scale(1.12); } 60% { transform: translateY(0) scale(1); }
  80% { transform: translateY(-3px) scale(1.06); } }
.mood-happy :deep(.itg-body) { animation: itg-happy .8s ease-in-out 2 !important; }
@keyframes itg-sad { 0%, 100% { transform: rotate(0) translateY(0); }
  40% { transform: rotate(7deg) translateY(2.5px); } 70% { transform: rotate(5deg) translateY(2px); } }
.mood-sad :deep(.itg-body) { animation: itg-sad 1.5s ease-in-out !important; }
@keyframes itg-wave { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-6deg) translateY(-1.5px); }
  55% { transform: rotate(6deg) translateY(-1px); } 80% { transform: rotate(-3deg); } }
.mood-wave :deep(.itg-body) { animation: itg-wave .9s ease-in-out !important; }
/* Рука махає при wave (transform-origin — плече) */
@keyframes itg-armwave { 0%, 100% { transform: rotate(0); } 30% { transform: rotate(-18deg); } 70% { transform: rotate(14deg); } }
:deep(.itg-arm) { transform-origin: 70px 56px; transform-box: fill-box; }
.mood-wave :deep(.itg-arm), .mood-happy :deep(.itg-arm) { animation: itg-armwave .55s ease-in-out 2; }

/* Зіниці: плавно тягнуться за курсором (transform ставить onEyesMove) */
:deep(.itg-pupil) { transition: transform .18s ease; }

/* Маскот у шапці AI-режиму */
.cmdp-mascot { width: 28px; height: 28px; display: inline-block; flex: none; }
.cmdp-mascot :deep(svg) { width: 100%; height: 100%; display: block; overflow: visible; }

/* Анімації Інтегралика (перенесено з DATA/integral/assistant.css; :deep — svg іде через v-html) */
@keyframes itg-breath { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-1.4px) scale(1.012); } }
:deep(.itg-body) { transform-origin: 50px 62px; animation: itg-breath 4.2s ease-in-out infinite; }
@keyframes itg-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.12); } }
:deep(.itg-eye) { animation: itg-blink 4.6s linear infinite; }
:deep(.itg-e2) { animation-delay: .05s; }
@keyframes itg-think { 0%, 100% { transform: rotate(0deg) translateY(0); } 25% { transform: rotate(-7deg) translateY(-2px); } 75% { transform: rotate(7deg) translateY(-1px); } }
.cmdp-mascot.thinking :deep(.itg-body) { animation: itg-think .55s ease-in-out infinite; }

.cmdp-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.35);
  display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; }
/* 0b PIN: підкладка перестає перехоплювати кліки → вони йдуть на дошку (повзунок
   графіка тягається, об'єкти рухаються), а панель лишається видимою й активною.
   Затемнення прибираємо: дошка клікабельна, тож затемнена вона виглядала б
   заблокованою — це збивало б з пантелику. */
/* Селектор навмисно з ДВОХ класів: із одним (`.cmdp-overlay--pinned`) специфічність
   дорівнює базовому `.cmdp-overlay`, і затемнення фону не перекривалось — живий
   тест 2026-07-31 показав pointer-events:none (працює, бо в базі його нема), але
   background лишався rgba(0,0,0,.35). Два класи знімають залежність від порядку правил. */
.cmdp-overlay.cmdp-overlay--pinned { background: transparent; pointer-events: none; }
.cmdp-overlay.cmdp-overlay--pinned .cmdp-panel { pointer-events: auto;
  box-shadow: 0 10px 34px rgba(0,0,0,.28), 0 0 0 2px rgba(13,148,136,.35); }
.cmdp-panel { width: min(600px, 94vw); background: #fff; color: #111;
  border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.25); overflow: hidden; }
.cmdp-input { width: 100%; box-sizing: border-box; padding: 14px 16px; border: 0;
  border-bottom: 1px solid #eee; font-size: 16px; outline: none; }
.cmdp-head { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #eee;
  cursor: move; touch-action: none; user-select: none; }
.cmdp-head button, .cmdp-head input { cursor: pointer; }
.cmdp-back { border: 0; background: #f3f3f3; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
.cmdp-title { font-weight: 600; flex: 1; }

/* Брендований зелений хедер (режим команд) — маскот живий, як на відео */
.cmdp-brand { background: #047857; border-bottom: 0; padding: 12px 16px; }
.cmdp-brand .cmdp-title { color: #fff; font-size: 15px; line-height: 1.1; flex: none; }
.cmdp-brandtitle { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cmdp-subtitle { color: #a7f3d0; font-size: 12px; }
.cmdp-mascot--brand { width: 36px; height: 36px; flex: none; }
.cmdp-close { border: 0; background: rgba(255,255,255,.14); color: #d1fae5; width: 28px; height: 28px;
  border-radius: 8px; font-size: 15px; line-height: 1; display: flex; align-items: center;
  justify-content: center; cursor: pointer; transition: background .15s, color .15s; }
.cmdp-close:hover { background: rgba(255,255,255,.28); color: #fff; }
/* 0a: «↺ новий діалог» — світлий хедер ai-режиму (не зелений brand), тож нейтральні кольори */
.cmdp-newchat { border: 0; background: #f3f3f3; color: #555; width: 28px; height: 28px;
  border-radius: 8px; font-size: 15px; line-height: 1; display: flex; align-items: center;
  justify-content: center; cursor: pointer; transition: background .15s, color .15s; }
.cmdp-newchat:hover:not(:disabled) { background: #e3e3e3; color: #0d9488; }
.cmdp-newchat:disabled { opacity: .45; cursor: default; }
/* 0b: 📌 у світлій (ai) і зеленій (brand) шапках. `.on` — закріплено. */
.cmdp-pin { border: 0; background: #f3f3f3; width: 28px; height: 28px; border-radius: 8px;
  font-size: 13px; line-height: 1; display: flex; align-items: center; justify-content: center;
  cursor: pointer; filter: grayscale(1); opacity: .55; transition: opacity .15s, filter .15s, background .15s; }
.cmdp-pin:hover { opacity: .85; }
.cmdp-pin.on { filter: none; opacity: 1; background: #ccfbf1; }
/* Згорнути — сусід pin/newchat у шапці AI-режиму, той самий розмір і ритм. */
.cmdp-min { border: 0; background: #f3f3f3; color: #555; width: 28px; height: 28px;
  border-radius: 8px; font-size: 18px; line-height: 1; display: flex; align-items: center;
  justify-content: center; cursor: pointer; opacity: .7; transition: opacity .15s, background .15s, color .15s; }
.cmdp-min:hover { opacity: 1; background: #e3e3e3; color: #0d9488; }
.cmdp-pin--brand { background: rgba(255,255,255,.14); }
.cmdp-pin--brand:hover { background: rgba(255,255,255,.28); }
.cmdp-pin--brand.on { background: rgba(255,255,255,.9); }
.cmdp-dialog { padding: 14px 16px; }
.cmdp-dlabel { display: block; margin-bottom: 6px; font-size: 14px; color: #333; }
.cmdp-dialog .cmdp-input { border: 1px solid #ddd; border-radius: 8px; }
.cmdp-list { list-style: none; margin: 0; padding: 6px; max-height: 46vh; overflow: auto; }
.cmdp-item { padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: background .12s; }
.cmdp-item.active { background: #ecfdf5; color: #065f46; }
.cmdp-item:hover { background: #f0fdf4; }
.cmdp-board { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; }
.cmdp-board:hover { background: #f7f7f8; }
.cmdp-bname { cursor: pointer; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmdp-meta { color: #999; font-size: 12px; }
.cmdp-actions button { border: 0; background: transparent; cursor: pointer; font-size: 16px; padding: 2px 5px; }
.cmdp-actions button:hover { background: #e9e9ef; border-radius: 6px; }
.cmdp-actions button:disabled { opacity: .4; cursor: default; }
.cmdp-empty { padding: 12px; color: #888; }
.cmdp-ai-explain { font-size: 14px; color: #111; margin: 0 0 8px; }
.cmdp-ai-danger { color: #b91c1c; font-size: 13px; margin: 0 0 8px; }
.cmdp-ai-actions { display: flex; gap: 8px; align-items: center; }

/* Phase 2 — діалоговий тред */
.cmdp-ai-thread { padding: 12px 14px; max-height: 46vh; min-height: 110px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px; }
.ai-msg { max-width: 88%; font-size: 14px; line-height: 1.45; padding: 8px 11px;
  border-radius: 10px; white-space: pre-wrap; margin: 0; }
.ai-msg--user { background: #16a34a; color: #fff; align-self: flex-end; border-bottom-right-radius: 3px; }
.ai-msg--bot { background: #f3f4f6; color: #111; align-self: flex-start; border-bottom-left-radius: 3px; }
.ai-msg--done { background: #dcfce7; color: #166534; align-self: flex-start; }
.ai-card { max-width: 95%; }
/* KaTeX у відповідях: формула не має рвати бульбашку й розтягувати панель.
   :deep — вміст іде через v-html, тож scoped-класи на нього не діють. */
.ai-msg--bot :deep(.katex), .ai-msg--done :deep(.katex) { font-size: 1.02em; }
.ai-msg--bot :deep(.katex-display), .ai-msg--done :deep(.katex-display) {
  margin: 6px 0; overflow-x: auto; overflow-y: hidden; }
/* Довга формула в inline-рядку — скрол усередині бульбашки, а не розпирання. */
.ai-msg--bot :deep(.lc-display-math) { overflow-x: auto; }
.ai-msg--bot :deep(table) { border-collapse: collapse; margin: 6px 0; font-size: .95em; }
.ai-msg--bot :deep(th), .ai-msg--bot :deep(td) {
  border: 1px solid #d1d5db; padding: 3px 6px; }
.cmdp-list--inline { max-height: 190px; padding: 4px 0 0; }
.ai-typing { display: flex; gap: 4px; align-items: center; padding: 11px 13px; }
.ai-typing span { width: 5px; height: 5px; border-radius: 50%; background: #9ca3af;
  animation: ai-dot 1s infinite ease-in-out; }
.ai-typing span:nth-child(2) { animation-delay: .15s; }
.ai-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes ai-dot { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } }
/* Phase V — кнопка мікрофона (голос = ще один клієнт) */
.cmdp-cmdrow { display: flex; gap: 7px; align-items: center; }
.cmdp-cmdrow .cmdp-input { flex: 1; }
.cmdp-mic { flex: none; width: 38px; height: 38px; border: 1px solid #ddd; border-radius: 8px;
  background: #fff; cursor: pointer; font-size: 16px; line-height: 1; display: grid; place-items: center;
  transition: background .15s ease, border-color .15s ease; }
.cmdp-mic:hover { border-color: #0d9488; }
.cmdp-mic:disabled { opacity: .5; cursor: default; }
.cmdp-mic.listening { background: #fee2e2; border-color: #ef4444; animation: mic-pulse 1.1s ease-in-out infinite; }
@keyframes mic-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, .5); } 50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); } }

.cmdp-ai-inputrow { display: flex; gap: 7px; padding: 10px; border-top: 1px solid #eee; }
.cmdp-input--ai { flex: 1; border: 1px solid #ddd; border-radius: 8px; }
.cmdp-ai-inputrow .cmdp-btn { padding: 10px 14px; }
.cmdp-btn { background: #16a34a; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer; }
.cmdp-btn:disabled { opacity: .5; cursor: default; }
.cmdp-btn--danger { background: #dc2626; }
.cmdp-status { padding: 8px 16px; color: #555; }
.cmdp-error { padding: 8px 16px; color: #c00; }
.cmdp-hint { padding: 8px 16px; border-top: 1px solid #eee; color: #999; font-size: 12px; }

/* ═══════════ ДОТИК (планшет + телефон) ═══════════ */
/* На дотику hover не існує → × «сховати» завжди видимий (інакше приховати неможливо),
   а сам маскот тримаємо помітнішим (без hover-підсвітки). */
@media (hover: none) {
  .cmdp-fab { opacity: .82; }
  .cmdp-fab-hide { opacity: 1; transform: scale(1); width: 20px; height: 20px; font-size: 14px; }
}

/* ═══════════ ТЕЛЕФОН (≤640px) ═══════════ */
/* Палітра = нижній «лист» на всю ширину, а не плаваюче центроване вікно: поле вводу
   лишається над клавіатурою (JS overlayStyle/panelStyle піднімає й обмежує лист по
   VisualViewport). Маскот дефолтно — у зоні великого пальця (знизу-праворуч). */
@media (max-width: 640px) {
  .cmdp-overlay { align-items: flex-end; justify-content: center; padding: 0; }
  .cmdp-panel { width: 100%; max-width: 100%; border-radius: 16px 16px 0 0; max-height: 92vh; }
  .cmdp-list, .cmdp-ai-thread { max-height: 38vh; }
  .cmdp-tip { max-width: min(230px, 74vw); }
  .cmdp-fab-wrap { top: auto; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); right: 14px; }
}
</style>
