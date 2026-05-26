<template>
  <div class="wb-help" :class="{ 'wb-help--open': open }">
    <!-- Panel -->
    <Transition name="wb-help-panel-fade">
      <div v-if="open" class="wb-help__panel" role="tooltip" aria-label="Підказки">
        <ul class="wb-help__list">
          <li class="wb-help__item">
            <span class="wb-help__key">←</span>
            <span>Інструменти малювання у лівій панелі</span>
          </li>
          <li class="wb-help__item">
            <span class="wb-help__key">→</span>
            <span>Перетягни зображення, відео або YouTube на дошку</span>
          </li>
          <li class="wb-help__item">
            <span class="wb-help__key">✦</span>
            <span>Натисни на об'єкт — з'являться кнопки дій</span>
          </li>
          <li class="wb-help__item">
            <span class="wb-help__key">⌥Z</span>
            <span>Відмінити дію</span>
          </li>
        </ul>
      </div>
    </Transition>

    <!-- Trigger -->
    <button
      type="button"
      class="wb-help__btn"
      :aria-expanded="open"
      aria-label="Підказки"
      @click.stop="open = !open"
    >
      ?
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const open = ref(false)

function closeOnOutside(e: MouseEvent): void {
  const el = (e.target as HTMLElement).closest('.wb-help')
  if (!el) open.value = false
}

onMounted(() => document.addEventListener('click', closeOnOutside))
onBeforeUnmount(() => document.removeEventListener('click', closeOnOutside))
</script>

<style scoped>
.wb-help {
  position: fixed;
  bottom: 24px;
  left: 56px;   /* правіше лівої toolbar (40px) */
  z-index: 60;
}

/* ── Trigger ── */
.wb-help__btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  background: rgba(15, 23, 42, 0.72);
  color: rgba(255, 255, 255, 0.75);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.wb-help__btn:hover,
.wb-help--open .wb-help__btn {
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.35);
}

/* ── Panel ── */
.wb-help__panel {
  position: absolute;
  bottom: 40px;
  left: 0;
  min-width: 280px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 12px 14px;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.wb-help__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wb-help__item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.3;
}

.wb-help__key {
  flex-shrink: 0;
  width: 28px;
  text-align: center;
  font-size: 13px;
  opacity: 0.6;
}

/* ── Transition ── */
.wb-help-panel-fade-enter-active,
.wb-help-panel-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.wb-help-panel-fade-enter-from,
.wb-help-panel-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
