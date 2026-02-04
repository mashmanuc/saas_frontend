<template>
  <aside class="solo-toolbar" :class="{ 'solo-toolbar--horizontal': isMobile }">
    <!-- Drawing tools group -->
    <div class="solo-toolbar__group">
      <span class="solo-toolbar__group-label">{{ $t('soloWorkspace.toolbar.sections.draw') }}</span>
      <div class="solo-toolbar__section">
        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.tools.pen')"
          :shortcut="$t('soloWorkspace.toolbar.shortcuts.pen')"
          :active="currentTool === 'pen'"
          @click="$emit('tool-change', 'pen')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/>
              <circle cx="11" cy="11" r="2"/>
            </svg>
          </template>
        </ToolButton>

        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.tools.highlighter')"
          :shortcut="$t('soloWorkspace.toolbar.shortcuts.highlighter')"
          :active="currentTool === 'highlighter'"
          @click="$emit('tool-change', 'highlighter')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l-6 6v3h9l3-3"/>
              <path d="M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4"/>
            </svg>
          </template>
        </ToolButton>

        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.tools.eraser')"
          :shortcut="$t('soloWorkspace.toolbar.shortcuts.eraser')"
          :active="currentTool === 'eraser'"
          @click="$emit('tool-change', 'eraser')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 20H7L3 16c-.6-.6-.6-1.5 0-2.1l10-10c.6-.6 1.5-.6 2.1 0l6 6c.6.6.6 1.5 0 2.1L13 20"/>
              <path d="M6 11l8 8"/>
            </svg>
          </template>
        </ToolButton>
      </div>
    </div>

    <div class="solo-toolbar__divider" />

    <!-- Shapes group -->
    <div class="solo-toolbar__group">
      <span class="solo-toolbar__group-label">{{ $t('soloWorkspace.toolbar.sections.shapes') }}</span>
      <div class="solo-toolbar__section">
        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.tools.line')"
          :shortcut="$t('soloWorkspace.toolbar.shortcuts.line')"
          :active="currentTool === 'line'"
          @click="$emit('tool-change', 'line')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="19" x2="19" y2="5"/>
            </svg>
          </template>
        </ToolButton>

        <!-- Arrow with dropdown -->
        <div class="arrow-tool-wrapper">
          <ToolButton
            :tooltip="$t('soloWorkspace.toolbar.tools.arrow')"
            :shortcut="$t('soloWorkspace.toolbar.shortcuts.arrow')"
            :active="currentTool === 'arrow'"
            @click="$emit('tool-change', 'arrow')"
          >
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </template>
          </ToolButton>
          <button
            class="arrow-dropdown-btn"
            :class="{ active: showArrowMenu }"
            @click.stop="showArrowMenu = !showArrowMenu"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
            </svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showArrowMenu" class="arrow-dropdown-menu">
              <button
                :class="{ selected: currentArrowStyle === 'arrow-end' }"
                @click="selectArrowStyle('arrow-end')"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
                <span>{{ $t('soloWorkspace.toolbar.arrow.styles.end') }}</span>
              </button>
              <button
                :class="{ selected: currentArrowStyle === 'arrow-start' }"
                @click="selectArrowStyle('arrow-start')"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 5 12 12 19"/>
                </svg>
                <span>{{ $t('soloWorkspace.toolbar.arrow.styles.start') }}</span>
              </button>
              <button
                :class="{ selected: currentArrowStyle === 'arrow-both' }"
                @click="selectArrowStyle('arrow-both')"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="8 5 5 12 8 19"/>
                  <polyline points="16 5 19 12 16 19"/>
                </svg>
                <span>{{ $t('soloWorkspace.toolbar.arrow.styles.both') }}</span>
              </button>
              <div class="arrow-size-control">
                <label>{{ $t('soloWorkspace.toolbar.arrow.headSize') }}: {{ currentArrowSize || 15 }}px</label>
                <input
                  type="range"
                  min="8"
                  max="30"
                  :value="currentArrowSize || 15"
                  @input="$emit('arrow-size-change', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
            </div>
          </Transition>
        </div>

        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.tools.rectangle')"
          :shortcut="$t('soloWorkspace.toolbar.shortcuts.rectangle')"
          :active="currentTool === 'rectangle'"
          @click="$emit('tool-change', 'rectangle')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </template>
        </ToolButton>

        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.tools.circle')"
          :shortcut="$t('soloWorkspace.toolbar.shortcuts.circle')"
          :active="currentTool === 'circle'"
          @click="$emit('tool-change', 'circle')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9"/>
            </svg>
          </template>
        </ToolButton>
      </div>
    </div>

    <div class="solo-toolbar__divider" />

    <!-- Text & Selection group -->
    <div class="solo-toolbar__group">
      <span class="solo-toolbar__group-label">{{ $t('soloWorkspace.toolbar.sections.text') }}</span>
      <div class="solo-toolbar__section">
        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.tools.text')"
          :shortcut="$t('soloWorkspace.toolbar.shortcuts.text')"
          :active="currentTool === 'text'"
          @click="$emit('tool-change', 'text')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 7 4 4 20 4 20 7"/>
              <line x1="9" y1="20" x2="15" y2="20"/>
              <line x1="12" y1="4" x2="12" y2="20"/>
            </svg>
          </template>
        </ToolButton>

        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.tools.note')"
          :shortcut="$t('soloWorkspace.toolbar.shortcuts.note')"
          :active="currentTool === 'note'"
          @click="$emit('tool-change', 'note')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15.5 3H5a2 2 0 00-2 2v14c0 1.1.9 2 2 2h14a2 2 0 002-2V8.5L15.5 3z"/>
              <path d="M15 3v6h6"/>
            </svg>
          </template>
        </ToolButton>

        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.tools.select')"
          :shortcut="$t('soloWorkspace.toolbar.shortcuts.select')"
          :active="currentTool === 'select'"
          @click="$emit('tool-change', 'select')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
              <path d="M13 13l6 6"/>
            </svg>
          </template>
        </ToolButton>
      </div>
    </div>

    <div class="solo-toolbar__divider" />

    <!-- Color & Size -->
    <div class="solo-toolbar__group">
      <span class="solo-toolbar__group-label">{{ $t('soloWorkspace.toolbar.sections.style') }}</span>
      <div class="solo-toolbar__section solo-toolbar__section--style">
        <ColorPicker
          :model-value="currentColor"
          :preset-colors="presetColors"
          @update:model-value="$emit('color-change', $event)"
        />
        <SizePicker
          :model-value="currentSize"
          :preset-sizes="presetSizes"
          @update:model-value="$emit('size-change', $event)"
        />
      </div>
    </div>

    <div class="solo-toolbar__divider" />

    <!-- Actions group -->
    <div class="solo-toolbar__group">
      <span class="solo-toolbar__group-label">{{ $t('soloWorkspace.toolbar.sections.actions') }}</span>
      <div class="solo-toolbar__section">
        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.actions.undo')"
          shortcut="Ctrl+Z"
          @click="$emit('undo')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
            </svg>
          </template>
        </ToolButton>

        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.actions.redo')"
          shortcut="Ctrl+Y"
          @click="$emit('redo')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 7v6h-6"/>
              <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
            </svg>
          </template>
        </ToolButton>

        <ToolButton
          :tooltip="$t('soloWorkspace.toolbar.actions.clear')"
          @click="$emit('clear')"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </template>
        </ToolButton>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import type { Tool, ArrowStyle } from '../../types/solo'
import ToolButton from './ToolButton.vue'
import ColorPicker from './ColorPicker.vue'
import SizePicker from './SizePicker.vue'

defineProps<{
  currentTool: Tool
  currentColor: string
  currentSize: number
  presetColors: string[]
  presetSizes: number[]
  currentArrowStyle?: ArrowStyle
  currentArrowSize?: number
}>()

const emit = defineEmits<{
  'tool-change': [tool: Tool]
  'color-change': [color: string]
  'size-change': [size: number]
  'arrow-style-change': [style: ArrowStyle]
  'arrow-size-change': [size: number]
  undo: []
  redo: []
  clear: []
}>()

const showArrowMenu = ref(false)
const isMobile = ref(false)

function selectArrowStyle(style: ArrowStyle) {
  emit('arrow-style-change', style)
  emit('tool-change', 'arrow')
  showArrowMenu.value = false
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.arrow-tool-wrapper')) {
    showArrowMenu.value = false
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.solo-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--color-bg-primary, #ffffff);
  border-right: 1px solid var(--color-border, #e2e8f0);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
  overflow-y: auto;
  transition: all 0.2s ease;
}

.solo-toolbar--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  border-right: none;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.solo-toolbar__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.solo-toolbar--horizontal .solo-toolbar__group {
  flex-direction: row;
  align-items: center;
}

.solo-toolbar__group-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--color-text-secondary, #475569);
  margin-bottom: 8px;
  padding: 0 4px;
  user-select: none;
}

.solo-toolbar--horizontal .solo-toolbar__group-label {
  display: none;
}

.solo-toolbar__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.solo-toolbar--horizontal .solo-toolbar__section {
  flex-direction: row;
}

.solo-toolbar__section--style {
  flex-direction: row;
  gap: 8px;
}

.solo-toolbar__divider {
  height: 1px;
  background: var(--color-border, #e2e8f0);
  margin: 4px 0;
}

.solo-toolbar--horizontal .solo-toolbar__divider {
  width: 1px;
  height: 32px;
  margin: 0 8px;
}

/* Arrow dropdown styles */
.arrow-tool-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.arrow-dropdown-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 24px;
  padding: 0;
  margin-left: -6px;
  background: var(--color-bg-secondary, #f1f5f9);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-secondary, #64748b);
  transition: all 0.15s ease;
}

.arrow-dropdown-btn:hover,
.arrow-dropdown-btn.active {
  background: var(--color-brand, #2563eb);
  border-color: var(--color-brand, #2563eb);
  color: white;
}

.arrow-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  min-width: 160px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 6px;
  margin-top: 6px;
}

.arrow-dropdown-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary, #1e293b);
  transition: all 0.1s ease;
}

.arrow-dropdown-menu button:hover {
  background: var(--color-bg-secondary, #f1f5f9);
}

.arrow-dropdown-menu button.selected {
  background: var(--color-brand-light, #dbeafe);
  color: var(--color-brand, #2563eb);
}

.arrow-dropdown-menu button svg {
  flex-shrink: 0;
}

.arrow-size-control {
  padding: 10px 12px;
  border-top: 1px solid var(--color-border, #e2e8f0);
  margin-top: 6px;
}

.arrow-size-control label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary, #64748b);
  margin-bottom: 6px;
}

.arrow-size-control input[type="range"] {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-bg-tertiary, #e2e8f0);
  border-radius: 2px;
  outline: none;
}

.arrow-size-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--color-brand, #2563eb);
  border-radius: 50%;
  cursor: pointer;
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .solo-toolbar {
    background: var(--color-bg-primary-dark, #1e293b);
    border-color: var(--color-border-dark, #334155);
  }

  .solo-toolbar__divider {
    background: var(--color-border-dark, #334155);
  }

  .arrow-dropdown-menu {
    background: var(--color-bg-primary-dark, #1e293b);
    border-color: var(--color-border-dark, #334155);
  }

  .arrow-dropdown-menu button {
    color: var(--color-text-dark, #f1f5f9);
  }

  .arrow-dropdown-menu button:hover {
    background: var(--color-bg-secondary-dark, #334155);
  }
}

/* Responsive */
@media (max-width: 767px) {
  .solo-toolbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    flex-direction: row;
    justify-content: center;
    padding: 8px 12px;
    border-top: 1px solid var(--color-border, #e2e8f0);
    border-right: none;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
    z-index: 50;
  }

  .solo-toolbar__group-label {
    display: none;
  }

  .solo-toolbar__section {
    flex-direction: row;
  }
}
</style>
