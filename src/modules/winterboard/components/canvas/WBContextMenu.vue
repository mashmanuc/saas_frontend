<!-- WB: Context menu — right-click on selected items
     Ref: TASK_BOARD_V5.md B6
     Sections: Group/Ungroup → Align (2+) → Distribute (3+) → Actions
     a11y: role="menu", role="menuitem", ArrowDown/Up nav, Escape close
     Teleport to body to avoid z-index issues -->
<template>
  <Teleport to="body">
    <Transition name="wb-context-fade">
      <div
        v-if="visible"
        ref="menuRef"
        class="wb-context-menu"
        :style="menuStyle"
        role="menu"
        :aria-label="t('winterboard.context.menu_label')"
        @keydown.escape="close"
        @click.stop
      >
        <!-- GROUP SECTION -->
        <div v-if="canGroup || canUngroup" class="wb-context-menu__section">
          <button
            v-if="canGroup"
            class="wb-context-menu__item"
            role="menuitem"
            @click="emit('group')"
          >
            <WBIconGroup class="wb-context-menu__icon" />
            <span>{{ t('winterboard.context.group') }}</span>
            <kbd class="wb-context-menu__kbd">Ctrl+G</kbd>
          </button>
          <button
            v-if="canUngroup"
            class="wb-context-menu__item"
            role="menuitem"
            @click="emit('ungroup')"
          >
            <WBIconUngroup class="wb-context-menu__icon" />
            <span>{{ t('winterboard.context.ungroup') }}</span>
            <kbd class="wb-context-menu__kbd">Ctrl+Shift+G</kbd>
          </button>
        </div>

        <!-- ALIGN SECTION (only for multi-select 2+) -->
        <div v-if="canAlign" class="wb-context-menu__section">
          <div class="wb-context-menu__sublabel">
            {{ t('winterboard.context.align') }}
          </div>
          <div class="wb-context-menu__align-grid">
            <button
              class="wb-context-menu__align-btn"
              :title="t('winterboard.context.align_left')"
              role="menuitem"
              @click="emit('align-left')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="2" height="12" rx="0.5" />
                <rect x="5" y="4" width="8" height="3" rx="0.5" />
                <rect x="5" y="9" width="5" height="3" rx="0.5" />
              </svg>
            </button>
            <button
              class="wb-context-menu__align-btn"
              :title="t('winterboard.context.align_center')"
              role="menuitem"
              @click="emit('align-center')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="7" y="1" width="2" height="14" rx="0.5" opacity="0.3" />
                <rect x="3" y="4" width="10" height="3" rx="0.5" />
                <rect x="4.5" y="9" width="7" height="3" rx="0.5" />
              </svg>
            </button>
            <button
              class="wb-context-menu__align-btn"
              :title="t('winterboard.context.align_right')"
              role="menuitem"
              @click="emit('align-right')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="13" y="2" width="2" height="12" rx="0.5" />
                <rect x="3" y="4" width="8" height="3" rx="0.5" />
                <rect x="6" y="9" width="5" height="3" rx="0.5" />
              </svg>
            </button>
            <button
              class="wb-context-menu__align-btn"
              :title="t('winterboard.context.align_top')"
              role="menuitem"
              @click="emit('align-top')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="2" y="1" width="12" height="2" rx="0.5" />
                <rect x="3" y="5" width="3" height="8" rx="0.5" />
                <rect x="8" y="5" width="3" height="5" rx="0.5" />
              </svg>
            </button>
            <button
              class="wb-context-menu__align-btn"
              :title="t('winterboard.context.align_middle')"
              role="menuitem"
              @click="emit('align-middle')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="7" width="14" height="2" rx="0.5" opacity="0.3" />
                <rect x="3" y="3" width="3" height="10" rx="0.5" />
                <rect x="8" y="4.5" width="3" height="7" rx="0.5" />
              </svg>
            </button>
            <button
              class="wb-context-menu__align-btn"
              :title="t('winterboard.context.align_bottom')"
              role="menuitem"
              @click="emit('align-bottom')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="2" y="13" width="12" height="2" rx="0.5" />
                <rect x="3" y="3" width="3" height="8" rx="0.5" />
                <rect x="8" y="6" width="3" height="5" rx="0.5" />
              </svg>
            </button>
          </div>
        </div>

        <!-- DISTRIBUTE SECTION (only for 3+ items) -->
        <div v-if="canDistribute" class="wb-context-menu__section">
          <div class="wb-context-menu__sublabel">
            {{ t('winterboard.context.distribute') }}
          </div>
          <div class="wb-context-menu__align-grid wb-context-menu__align-grid--2col">
            <button
              class="wb-context-menu__align-btn"
              :title="t('winterboard.context.distribute_h')"
              role="menuitem"
              @click="emit('distribute-horizontal')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="5" width="3" height="6" rx="0.5" />
                <rect x="6.5" y="5" width="3" height="6" rx="0.5" />
                <rect x="12" y="5" width="3" height="6" rx="0.5" />
              </svg>
            </button>
            <button
              class="wb-context-menu__align-btn"
              :title="t('winterboard.context.distribute_v')"
              role="menuitem"
              @click="emit('distribute-vertical')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="5" y="1" width="6" height="3" rx="0.5" />
                <rect x="5" y="6.5" width="6" height="3" rx="0.5" />
                <rect x="5" y="12" width="6" height="3" rx="0.5" />
              </svg>
            </button>
          </div>
        </div>

        <!-- STICKY COLOR SECTION (only when all selected are stickies) -->
        <div v-if="allSticky" class="wb-context-menu__section">
          <button
            class="wb-context-menu__item"
            role="menuitem"
            @click="emit('change-color')"
          >
            <svg class="wb-context-menu__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="8" cy="8" r="5" />
              <circle cx="8" cy="8" r="2" fill="currentColor" />
            </svg>
            <span>{{ t('winterboard.sticky.change_color') }}</span>
          </button>
        </div>

        <!-- ACTIONS SECTION -->
        <div class="wb-context-menu__section wb-context-menu__section--actions">
          <button
            v-if="canDuplicate"
            class="wb-context-menu__item"
            role="menuitem"
            @click="emit('duplicate')"
          >
            <svg class="wb-context-menu__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="5" y="5" width="9" height="9" rx="1" />
              <path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
            </svg>
            <span>{{ t('winterboard.context.duplicate') }}</span>
            <kbd class="wb-context-menu__kbd">Ctrl+D</kbd>
          </button>

          <button
            v-if="canLock"
            class="wb-context-menu__item"
            role="menuitem"
            @click="emit('lock')"
          >
            <WBIconLock class="wb-context-menu__icon" />
            <span>{{ t('winterboard.context.lock') }}</span>
            <kbd class="wb-context-menu__kbd">Ctrl+Shift+L</kbd>
          </button>

          <button
            v-if="canUnlock"
            class="wb-context-menu__item"
            role="menuitem"
            @click="emit('unlock')"
          >
            <WBIconUnlock class="wb-context-menu__icon" />
            <span>{{ t('winterboard.context.unlock') }}</span>
            <kbd class="wb-context-menu__kbd">Ctrl+Shift+U</kbd>
          </button>

          <button
            class="wb-context-menu__item wb-context-menu__item--danger"
            role="menuitem"
            @click="emit('delete')"
          >
            <svg class="wb-context-menu__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 0 1 1.34-1.34h2.66a1.33 1.33 0 0 1 1.34 1.34V4M12.67 4v9.33a1.33 1.33 0 0 1-1.34 1.34H4.67a1.33 1.33 0 0 1-1.34-1.34V4" />
            </svg>
            <span>{{ t('winterboard.context.delete') }}</span>
            <kbd class="wb-context-menu__kbd">Del</kbd>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Backdrop (invisible, catches clicks to close) -->
  <Teleport to="body">
    <div
      v-if="visible"
      class="wb-context-backdrop"
      @click="close"
      @contextmenu.prevent="close"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import WBIconGroup from '../toolbar/icons/WBIconGroup.vue'
import WBIconUngroup from '../toolbar/icons/WBIconUngroup.vue'
import WBIconLock from '../toolbar/icons/WBIconLock.vue'
import WBIconUnlock from '../toolbar/icons/WBIconUnlock.vue'

const { t } = useI18n()

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  x: number
  y: number
  selectedCount: number
  canGroup: boolean
  canUngroup: boolean
  canLock: boolean
  canUnlock: boolean
  canDuplicate: boolean
  allSticky?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  x: 0,
  y: 0,
  selectedCount: 0,
  canGroup: false,
  canUngroup: false,
  canLock: false,
  canUnlock: false,
  canDuplicate: false,
  allSticky: false,
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  close: []
  group: []
  ungroup: []
  'align-left': []
  'align-center': []
  'align-right': []
  'align-top': []
  'align-middle': []
  'align-bottom': []
  'distribute-horizontal': []
  'distribute-vertical': []
  duplicate: []
  lock: []
  unlock: []
  delete: []
  'change-color': []
}>()

// ─── Refs ───────────────────────────────────────────────────────────────────

const menuRef = ref<HTMLElement | null>(null)

// ─── Computed ───────────────────────────────────────────────────────────────

const canAlign = computed(() => props.selectedCount >= 2)
const canDistribute = computed(() => props.selectedCount >= 3)

const menuStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}))

// ─── Lifecycle: focus + viewport adjust ─────────────────────────────────────

watch(() => props.visible, async (visible) => {
  if (visible) {
    await nextTick()
    adjustPosition()
    const firstBtn = menuRef.value?.querySelector('button')
    firstBtn?.focus()
  }
})

function adjustPosition(): void {
  const menu = menuRef.value
  if (!menu) return
  const rect = menu.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (rect.right > vw) {
    menu.style.left = `${props.x - rect.width}px`
  }
  if (rect.bottom > vh) {
    menu.style.top = `${props.y - rect.height}px`
  }
}

function close(): void {
  emit('close')
}

// ─── Keyboard navigation ────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent): void {
  if (!props.visible) return

  const items = menuRef.value?.querySelectorAll<HTMLButtonElement>('button') || []
  const current = document.activeElement as HTMLElement
  const idx = Array.from(items).indexOf(current as HTMLButtonElement)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const next = idx < items.length - 1 ? idx + 1 : 0
    items[next]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = idx > 0 ? idx - 1 : items.length - 1
    items[prev]?.focus()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* Backdrop — invisible click catcher */
.wb-context-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

/* Menu container */
.wb-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  max-width: 280px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px 0;
  font-size: 13px;
  color: #1e293b;
}

/* Sections */
.wb-context-menu__section {
  padding: 4px 0;
}

.wb-context-menu__section + .wb-context-menu__section {
  border-top: 1px solid #e2e8f0;
}

/* Sub-label (Align, Distribute) */
.wb-context-menu__sublabel {
  padding: 4px 12px 2px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Menu item (full-width row) */
.wb-context-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font-size: inherit;
  border-radius: 0;
  transition: background 0.1s;
}

.wb-context-menu__item:hover,
.wb-context-menu__item:focus-visible {
  background: #f1f5f9;
  outline: none;
}

.wb-context-menu__item--danger {
  color: #dc2626;
}

.wb-context-menu__item--danger:hover,
.wb-context-menu__item--danger:focus-visible {
  background: #fef2f2;
}

/* Icon */
.wb-context-menu__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Keyboard shortcut badge */
.wb-context-menu__kbd {
  margin-left: auto;
  font-size: 11px;
  color: #94a3b8;
  font-family: inherit;
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid #e2e8f0;
}

/* Align grid: 3x2 */
.wb-context-menu__align-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 4px 8px;
}

.wb-context-menu__align-grid--2col {
  grid-template-columns: repeat(2, 1fr);
}

.wb-context-menu__align-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: 1px solid transparent;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  color: #475569;
  transition: all 0.1s;
}

.wb-context-menu__align-btn:hover,
.wb-context-menu__align-btn:focus-visible {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #1e293b;
  outline: none;
}

/* Fade transition */
.wb-context-fade-enter-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.wb-context-fade-leave-active {
  transition: opacity 0.08s ease;
}
.wb-context-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.wb-context-fade-leave-to {
  opacity: 0;
}

/* Reduced motion (LAW-22) */
@media (prefers-reduced-motion: reduce) {
  .wb-context-menu__item,
  .wb-context-menu__align-btn,
  .wb-context-fade-enter-active,
  .wb-context-fade-leave-active {
    transition: none;
  }
}
</style>
