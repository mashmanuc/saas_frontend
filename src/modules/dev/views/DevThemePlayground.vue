<template>
  <div class="playground-grid">
    <aside class="playground-sidebar">
      <p class="eyebrow">{{ t('devPlayground.sidebar.label') }}</p>
      <nav class="sidebar-nav" aria-label="Playground navigation">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          class="sidebar-pill"
          :class="{ 'sidebar-pill--active': activeSection === item.id }"
          @click="handleNavClick(item.id)"
        >
          <span class="sidebar-pill__icon">{{ item.icon }}</span>
          <div>
            <p class="sidebar-pill__label">{{ item.label }}</p>
            <p class="sidebar-pill__hint">{{ item.hint }}</p>
          </div>
        </button>
      </nav>
    </aside>

    <div class="space-y-8">
      <header class="space-y-3" id="playground-hero">
        <p class="eyebrow">{{ t('devPlayground.eyebrow') }}</p>
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="headline">{{ t('devPlayground.title') }}</h1>
            <p class="text-muted max-w-2xl">
              {{ t('devPlayground.subtitle') }}
            </p>
          </div>
          <Card variant="outline" padding="sm" class="w-full max-w-md">
            <p class="text-xs uppercase tracking-wide text-muted mb-2">
              {{ t('devPlayground.themeSwitcher.label') }}
            </p>
            <div class="flex flex-col gap-3">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in themeOptions"
                  :key="option.value"
                  type="button"
                  class="theme-pill"
                  :class="{ 'theme-pill--active': themeStore.theme === option.value }"
                  @click="setTheme(option.value)"
                >
                  <span class="text-lg">{{ option.icon }}</span>
                  <div class="text-left">
                    <p class="font-semibold leading-tight">{{ option.label }}</p>
                    <p class="text-xs opacity-80">{{ option.description }}</p>
                  </div>
                </button>
              </div>
              <p class="text-xs text-muted">
                {{ t('devPlayground.themeSwitcher.active') }}
                <strong>{{ activeThemeMeta.title }}</strong> · {{ activeThemeMeta.subtitle }}
              </p>
            </div>
          </Card>
        </div>
      </header>

      <section id="playground-controls" class="grid gap-6 lg:grid-cols-2" data-section-id="controls">
        <Card variant="elevated" class="space-y-4">
          <h2 class="section-title">{{ t('devPlayground.sections.buttons') }}</h2>
          <div class="flex flex-wrap gap-3">
            <Button variant="primary">{{ t('devPlayground.buttons.primary') }}</Button>
            <Button variant="secondary">{{ t('devPlayground.buttons.secondary') }}</Button>
            <Button variant="outline">{{ t('devPlayground.buttons.outline') }}</Button>
            <Button variant="ghost">{{ t('devPlayground.buttons.ghost') }}</Button>
            <Button variant="danger">{{ t('devPlayground.buttons.danger') }}</Button>
            <Button variant="primary" :loading="true">{{ t('devPlayground.buttons.loading') }}</Button>
            <Button variant="primary" :disabled="true">{{ t('devPlayground.buttons.disabled') }}</Button>
          </div>
        </Card>

        <Card variant="elevated" class="space-y-4">
          <h2 class="section-title">{{ t('devPlayground.sections.inputs') }}</h2>
          <div class="grid gap-4">
            <Input
              v-model="formState.normal"
              :label="t('devPlayground.inputs.normalLabel')"
              :placeholder="t('devPlayground.inputs.normalPlaceholder')"
            />
            <Input
              v-model="formState.error"
              :label="t('devPlayground.inputs.errorLabel')"
              :error="t('devPlayground.inputs.errorMessage')"
            />
            <Input
              v-model="formState.success"
              :label="t('devPlayground.inputs.successLabel')"
              :help="t('devPlayground.inputs.successHelp', { value: formState.success })"
            />
            <Select
              v-model="formState.select"
              :label="t('devPlayground.inputs.selectLabel')"
              :options="selectOptions"
              :placeholder="t('devPlayground.inputs.selectPlaceholder')"
            />
          </div>
        </Card>
      </section>

      <section id="playground-feedback" class="grid gap-6 lg:grid-cols-2" data-section-id="feedback">
        <Card variant="elevated" class="space-y-4">
          <h2 class="section-title">{{ t('devPlayground.sections.badges') }}</h2>
          <div class="flex flex-wrap gap-2">
            <Badge>{{ t('devPlayground.badges.default') }}</Badge>
            <Badge variant="success">{{ t('devPlayground.badges.success') }}</Badge>
            <Badge variant="warning">{{ t('devPlayground.badges.warning') }}</Badge>
            <Badge variant="muted">{{ t('devPlayground.badges.muted') }}</Badge>
          </div>
          <div class="space-y-3">
            <div class="playground-alert playground-alert--success">
              <strong>{{ t('devPlayground.alerts.success.title') }}</strong>
              {{ t('devPlayground.alerts.success.body') }}
            </div>
            <div class="playground-alert playground-alert--warning">
              <strong>{{ t('devPlayground.alerts.warning.title') }}</strong>
              {{ t('devPlayground.alerts.warning.body') }}
            </div>
            <div class="playground-alert playground-alert--danger">
              <strong>{{ t('devPlayground.alerts.danger.title') }}</strong>
              {{ t('devPlayground.alerts.danger.body') }}
            </div>
          </div>
        </Card>

        <Card variant="elevated" class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="section-title">{{ t('devPlayground.sections.modal') }}</h2>
            <Button variant="primary" size="sm" @click="toggleModal(true)">
              {{ t('devPlayground.actions.openModal') }}
            </Button>
          </div>
          <p class="text-muted text-sm">
            {{ t('devPlayground.sections.modalDescription') }}
          </p>
          <div v-if="showModal" class="modal-backdrop" role="dialog" aria-modal="true">
            <div class="modal-panel">
              <header>
                <h3 class="text-base font-semibold">{{ t('devPlayground.modal.title') }}</h3>
                <Button variant="ghost" size="sm" @click="toggleModal(false)">
                  {{ t('common.close') }}
                </Button>
              </header>
              <div class="space-y-3">
                <Input v-model="modalForm.title" :label="t('devPlayground.modal.fields.title')" required />
                <Input v-model="modalForm.subtitle" :label="t('devPlayground.modal.fields.subtitle')" />
              </div>
              <footer>
                <Button variant="ghost" size="sm" @click="toggleModal(false)">
                  {{ t('common.cancel') }}
                </Button>
                <Button variant="primary" size="sm" @click="confirmModal">
                  {{ t('devPlayground.actions.save') }}
                </Button>
              </footer>
            </div>
          </div>
        </Card>
      </section>

      <section id="playground-tables" class="space-y-4" data-section-id="tables">
        <Card variant="elevated" class="space-y-4">
          <h2 class="section-title">{{ t('devPlayground.sections.table') }}</h2>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{{ t('devPlayground.table.headers.component') }}</th>
                  <th>{{ t('devPlayground.table.headers.state') }}</th>
                  <th>{{ t('devPlayground.table.headers.contrast') }}</th>
                  <th>{{ t('devPlayground.table.headers.notes') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in tableRows" :key="row.component + row.state">
                  <td>{{ row.component }}</td>
                  <td><Badge :variant="row.badge">{{ row.state }}</Badge></td>
                  <td>{{ row.contrast }}</td>
                  <td class="text-muted">{{ row.notes }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section
        id="playground-tokens"
        class="grid gap-6 lg:grid-cols-[2fr,1fr]"
        data-section-id="tokens"
      >
        <Card variant="outline" class="space-y-4">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="section-title">{{ t('devPlayground.liveTokens.title') }}</h2>
              <p class="text-muted text-sm">
                {{ t('devPlayground.liveTokens.subtitle') }}
              </p>
            </div>
            <Button variant="ghost" size="sm" @click="refreshTokens">
              {{ t('devPlayground.actions.refresh') }}
            </Button>
          </div>
          <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div v-for="token in tokenValues" :key="token.variable" class="token-card">
              <p class="text-xs uppercase tracking-wide text-muted">{{ token.label }}</p>
              <p class="font-mono text-sm">{{ token.value }}</p>
              <p class="text-xs text-muted">{{ token.variable }}</p>
            </div>
          </div>
        </Card>

        <Card variant="outline" class="space-y-5">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="section-title">{{ t('devPlayground.designTokens.title') }}</h2>
              <p class="text-muted text-sm">
                {{ t('devPlayground.designTokens.subtitle') }}
              </p>
            </div>
            <Button variant="ghost" size="sm" @click="refreshTokens">
              {{ t('devPlayground.actions.refresh') }}
            </Button>
          </div>
          <div class="token-inspector-grid">
            <div v-for="token in tokenValues" :key="token.variable + '-inspector'" class="token-inspector-card">
              <p class="token-inspector-card__label">{{ token.label }}</p>
              <p class="token-inspector-card__value">{{ token.value }}</p>
              <p class="token-inspector-card__meta">{{ token.variable }}</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import Badge from '../../../ui/Badge.vue'
import Select from '../../../ui/Select.vue'
import { useThemeStore, THEME_OPTIONS } from '../../../stores/themeStore'

const { t } = useI18n()
const themeStore = useThemeStore()
const sectionIds = ['controls', 'feedback', 'tables', 'tokens']
const activeSection = ref(sectionIds[0])
let sectionObserver

const navItems = computed(() => [
  {
    id: 'controls',
    icon: '🎛️',
    label: t('devPlayground.sidebar.controls'),
    hint: t('devPlayground.sidebar.controlsHint'),
  },
  {
    id: 'feedback',
    icon: '⚡',
    label: t('devPlayground.sidebar.feedback'),
    hint: t('devPlayground.sidebar.feedbackHint'),
  },
  {
    id: 'tables',
    icon: '📊',
    label: t('devPlayground.sidebar.tables'),
    hint: t('devPlayground.sidebar.tablesHint'),
  },
  {
    id: 'tokens',
    icon: '🧪',
    label: t('devPlayground.sidebar.tokens'),
    hint: t('devPlayground.sidebar.tokensHint'),
  },
])

const themeOptions = THEME_OPTIONS.map((value) => ({
  value,
  icon: value === 'light' ? '🌿' : value === 'dark' ? '🌙' : '🎓',
  label: value.charAt(0).toUpperCase() + value.slice(1),
  description:
    value === 'light'
      ? 'Emerald accent, airy surfaces'
      : value === 'dark'
        ? 'Deep cyan palette, glassmorphism'
        : 'Classic purple, nostalgic gradients',
}))

const themeMeta = {
  light: { title: 'Light', subtitle: 'Основна production-тема' },
  dark: { title: 'Dark', subtitle: 'Контрастні темні поверхні' },
  classic: { title: 'Classic', subtitle: 'Фіолетовий legacy-комплект' },
}

const activeThemeMeta = computed(() => themeMeta[themeStore.theme] || themeMeta.light)

function setTheme(value) {
  if (themeStore.theme === value) return
  themeStore.setTheme(value)
}

const formState = reactive({
  normal: '',
  error: '',
  success: 'Synced',
  select: '',
})

const selectOptions = [
  { label: 'Emerald', value: 'emerald' },
  { label: 'Cyan', value: 'cyan' },
  { label: 'Violet', value: 'violet' },
]

const showModal = ref(false)
const modalForm = reactive({
  title: 'Oceanic pulse',
  subtitle: 'Glassmorphic CTA card',
})

function toggleModal(state) {
  showModal.value = state
}

function confirmModal() {
  toggleModal(false)
}

const tableRows = [
  {
    component: 'Button / Primary',
    state: 'Hover',
    badge: 'success',
    contrast: 'AA+',
    notes: 'Перевірити glow у dark theme.',
  },
  {
    component: 'Input / Outline',
    state: 'Error',
    badge: 'warning',
    contrast: 'AA',
    notes: 'Потрібно затвердити червоний відтінок.',
  },
  {
    component: 'Badge',
    state: 'Muted',
    badge: 'muted',
    contrast: 'AA-',
    notes: 'Підсилити opacity тексту.',
  },
]

const cssTokenMap = [
  { label: 'Accent', variable: '--accent' },
  { label: 'Accent Hover', variable: '--accent-hover' },
  { label: 'Text Primary', variable: '--text-primary' },
  { label: 'Text Secondary', variable: '--text-secondary' },
  { label: 'Card BG', variable: '--card-bg' },
  { label: 'Border Color', variable: '--border-color' },
  { label: 'Shadow', variable: '--shadow' },
  { label: 'Danger BG', variable: '--danger-bg' },
  { label: 'Success BG', variable: '--success-bg' },
  { label: 'Warning BG', variable: '--warning-bg' },
]

const tokenValues = ref([])

function refreshTokens() {
  if (typeof window === 'undefined') return
  const styles = getComputedStyle(document.documentElement)
  tokenValues.value = cssTokenMap.map((token) => ({
    ...token,
    value: styles.getPropertyValue(token.variable).trim() || 'n/a',
  }))
}

function handleNavClick(id) {
  activeSection.value = id
  const target = document.getElementById(`playground-${id}`)
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function initSectionObserver() {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return

  sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
      if (entry.isIntersecting) {
        activeSection.value = entry.target.dataset.sectionId
      }
    })
    },
    { rootMargin: '-40% 0px -40% 0px', threshold: 0 },
  )

  sectionIds.forEach((id) => {
    const el = document.querySelector(`#playground-${id}`)
    if (el) {
      sectionObserver.observe(el)
    }
  })
}

onMounted(() => {
  refreshTokens()
  initSectionObserver()
})

onBeforeUnmount(() => {
  if (sectionObserver) {
    sectionObserver.disconnect()
    sectionObserver = null
  }
})

watch(
  () => themeStore.theme,
  () => {
    requestAnimationFrame(() => refreshTokens())
  },
)
</script>

<style scoped>
.playground-grid {
  display: grid;
  gap: 2rem;
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 1024px) {
  .playground-grid {
    grid-template-columns: 260px minmax(0, 1fr);
  }
}

.playground-sidebar {
  position: sticky;
  top: 6rem;
  height: fit-content;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-2xl, 20px);
  background: color-mix(in srgb, var(--card-bg) 92%, transparent);
  box-shadow: 0 20px 60px color-mix(in srgb, var(--shadow, rgba(15, 23, 42, 0.1)) 15%, transparent);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-top: 1rem;
}

.sidebar-pill {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl, 18px);
  padding: 0.8rem 1rem;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
  transition: 200ms ease;
}

.sidebar-pill--active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  box-shadow: 0 14px 30px color-mix(in srgb, var(--accent) 18%, transparent);
}

.sidebar-pill__icon {
  font-size: 1.25rem;
}

.sidebar-pill__label {
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-pill__hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.eyebrow {
  font: var(--font-eyebrow, 600 0.72rem/1 var(--font-sans, 'Inter', sans-serif));
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.headline {
  font: var(--font-display, 600 clamp(2rem, 4vw, 3rem)/1.2 'Space Grotesk', sans-serif);
  color: var(--text-primary);
}

.section-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
}

.theme-pill {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg, 14px);
  padding: 0.5rem 0.85rem;
  background: var(--bg-secondary);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 11rem;
  transition: var(--transition-base, 200ms ease);
}

.theme-pill--active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 25%, transparent);
}

.playground-alert {
  border-radius: var(--radius-md, 12px);
  padding: 0.85rem 1rem;
  font-size: 0.9rem;
}

.playground-alert--success {
  background: color-mix(in srgb, var(--success-bg, #0ba360) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--success-bg, #0ba360) 35%, transparent);
}

.playground-alert--warning {
  background: color-mix(in srgb, var(--warning-bg, #f59e0b) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning-bg, #f59e0b) 32%, transparent);
}

.playground-alert--danger {
  background: color-mix(in srgb, var(--danger-bg, #ef4444) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger-bg, #ef4444) 32%, transparent);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(9, 12, 20, 0.55);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 50;
}

.modal-panel {
  background: var(--card-bg);
  border-radius: var(--radius-xl, 24px);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card, 0 8px 25px rgba(15, 23, 42, 0.12));
  width: 100%;
  max-width: 28rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-panel header,
.modal-panel footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.table-wrapper {
  border-radius: var(--radius-lg, 16px);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

th,
td {
  padding: 0.85rem 1rem;
  text-align: left;
}

thead th {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
}

tbody tr {
  transition: background 180ms ease;
}

tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--bg-secondary) 30%, transparent);
}

tbody tr:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.token-card {
  border-radius: var(--radius-md, 12px);
  border: 1px solid var(--border-color);
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--card-bg) 85%, transparent);
}

.token-inspector-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.token-inspector-card {
  border: 1px dashed color-mix(in srgb, var(--border-color) 80%, transparent);
  border-radius: var(--radius-lg, 16px);
  padding: 1rem;
  background: color-mix(in srgb, var(--bg-secondary) 40%, transparent);
}

.token-inspector-card__label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.token-inspector-card__value {
  font-family: 'Space Mono', monospace;
  font-size: 1rem;
  margin-top: 0.4rem;
}

.token-inspector-card__meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
}

code {
  background: color-mix(in srgb, var(--bg-secondary) 60%, transparent);
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  font-size: 0.85em;
}
</style>
