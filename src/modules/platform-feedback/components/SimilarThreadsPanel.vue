<template>
  <!--
    C1.5 (audit 2026-05-24, friendly UI): absolute-positioned dropdown.
    - Якщо немає результатів — нічого НЕ рендеримо (жодного панелі, жодного loader-у).
    - Show only коли results.length > 0.
    - position: absolute → НЕ змінює layout навколишніх елементів.
    - Transition fade для плавності.
    Caller (NewThread.vue) має мати position: relative на батьківському контейнері.
  -->
  <transition name="similar-fade">
    <div
      v-if="results.length > 0"
      class="similar-dropdown"
      role="listbox"
    >
      <p class="text-xs font-medium text-amber-900 mb-2 px-1">
        {{ $t('feedback.similar.title') }}
      </p>
      <ul class="space-y-1">
        <li v-for="item in results" :key="item.id">
          <button
            type="button"
            class="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-amber-100 transition"
            @click="$emit('select', item)"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-900 truncate">{{ item.title }}</div>
              <div class="text-xs text-slate-600 mt-0.5">
                <span class="inline-block px-1.5 py-0.5 rounded bg-white border border-amber-200">
                  {{ $t(`feedback.status.${item.status}`, item.status) }}
                </span>
                <span class="ml-2">⬆ {{ item.vote_count }}</span>
              </div>
            </div>
            <span class="text-xs text-amber-700 whitespace-nowrap">
              {{ $t('feedback.similar.openAndVote') }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  results: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
defineEmits(['select'])
</script>

<style scoped>
.similar-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 30;
  margin-top: 4px;
  max-height: 320px;
  overflow-y: auto;
  padding: 8px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  box-shadow: 0 6px 16px -4px rgba(120, 53, 15, 0.15);
}

/* Fade transition — без layout impact, тільки opacity */
.similar-fade-enter-active,
.similar-fade-leave-active {
  transition: opacity 0.15s ease;
}
.similar-fade-enter-from,
.similar-fade-leave-to {
  opacity: 0;
}
</style>
