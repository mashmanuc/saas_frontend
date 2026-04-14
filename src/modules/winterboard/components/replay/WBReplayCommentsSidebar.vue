<template>
  <aside class="wb-replay-comments" aria-label="Коментарі">
    <header class="wb-replay-comments__head">
      <h3>{{ t('winterboard.replay.comments.title', 'Коментарі') }}</h3>
      <span class="wb-replay-comments__count">{{ comments.length }}</span>
    </header>

    <ul v-if="comments.length > 0" class="wb-replay-comments__list">
      <li
        v-for="c in comments"
        :key="c.id"
        class="wb-replay-comments__item"
        :class="{ 'wb-replay-comments__item--active': isActive(c) }"
        :ref="(el) => setRef(c.id, el as HTMLLIElement | null)"
      >
        <button type="button" class="wb-replay-comments__btn" @click="$emit('jump', c)">
          <span class="wb-replay-comments__dot" />
          <div class="wb-replay-comments__body">
            <div class="wb-replay-comments__meta">
              <strong>{{ c.author.name }}</strong>
              <span>@op{{ c.operation_index }}</span>
            </div>
            <p class="wb-replay-comments__text">{{ c.text }}</p>
          </div>
          <button
            v-if="canDelete(c)"
            type="button"
            class="wb-replay-comments__delete"
            :aria-label="t('common.delete', 'Delete')"
            @click.stop="$emit('delete', c)"
          >×</button>
        </button>
      </li>
    </ul>
    <p v-else class="wb-replay-comments__empty">
      {{ t('winterboard.replay.comments.empty', 'Коментарів ще немає') }}
    </p>

    <!-- Inline input: при паузі в режимі replay -->
    <form v-if="canComment" class="wb-replay-comments__form" @submit.prevent="onSubmit">
      <!-- UX FIX (2026-04-08): видимий timestamp label — показує до якого
           моменту прив'яжеться коментар. Раніше було незрозуміло. -->
      <div class="wb-replay-comments__timestamp">
        📍 {{ t('winterboard.replay.comments.pinnedTo', 'Прив’язано до моменту') }}
        <strong>@op{{ currentOpIndex }}</strong>
      </div>
      <textarea
        v-model="draft"
        rows="4"
        :placeholder="t('winterboard.replay.comments.placeholder', 'Напишіть коментар до поточного моменту…')"
        :disabled="submitting"
      />
      <button type="submit" :disabled="!draft.trim() || submitting">
        {{ submitting ? '…' : t('winterboard.replay.comments.send', 'Надіслати') }}
      </button>
    </form>
  </aside>
</template>

<script setup lang="ts">
// Phase C.2/C.3: sidebar з коментарями + jump-to-comment.
// Інтегрується з WBReplayCommentsSidebar через events jump/delete.
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ReplayComment } from '../../api/replay'

const props = defineProps<{
  comments: ReadonlyArray<ReplayComment>
  currentOpIndex: number
  canComment: boolean
  currentUserId: number | null
  sessionOwnerId: number | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'jump', comment: ReplayComment): void
  (e: 'delete', comment: ReplayComment): void
  (e: 'submit', text: string): void
}>()

const { t } = useI18n({ useScope: 'global' })

const draft = ref('')
const itemRefs = new Map<string, HTMLLIElement>()

function setRef(id: string, el: HTMLLIElement | null): void {
  if (el) itemRefs.set(id, el)
  else itemRefs.delete(id)
}

function isActive(c: ReplayComment): boolean {
  // Активний — найближчий до поточної позиції в межах ±1% total (спрощено: +/- 2 ops)
  return Math.abs(c.operation_index - props.currentOpIndex) <= 2
}

function canDelete(c: ReplayComment): boolean {
  if (props.currentUserId == null) return false
  return c.author.id === props.currentUserId || props.sessionOwnerId === props.currentUserId
}

function onSubmit(): void {
  const text = draft.value.trim()
  if (!text) return
  emit('submit', text)
  draft.value = ''
}

// C.3: auto-scroll активного коментаря в видиму зону
watch(
  () => props.currentOpIndex,
  async () => {
    await nextTick()
    const active = props.comments.find(isActive)
    if (!active) return
    const el = itemRefs.get(active.id)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)
</script>

<style scoped>
.wb-replay-comments {
  width: var(--wb-replay-comments-width, 280px);
  flex-shrink: 0;
  background: var(--color-surface, #ffffff);
  border-left: 1px solid var(--color-border, #e2e8f0);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.wb-replay-comments__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
}
.wb-replay-comments__head h3 { margin: 0; font-size: 14px; font-weight: 700; }
.wb-replay-comments__count {
  background: var(--color-surface-alt, #f1f5f9);
  color: var(--color-text-muted, #64748b);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}
.wb-replay-comments__list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wb-replay-comments__btn {
  width: 100%;
  display: flex;
  gap: 10px;
  padding: 10px 10px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  align-items: flex-start;
  transition: background 0.15s;
}
.wb-replay-comments__btn:hover { background: var(--color-surface-alt, #f8fafc); }
.wb-replay-comments__item--active .wb-replay-comments__btn {
  background: #fef3c7;
  border-left: 3px solid #f59e0b;
}
.wb-replay-comments__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #f59e0b;
  flex-shrink: 0;
  margin-top: 4px;
}
.wb-replay-comments__body { flex: 1; min-width: 0; }
.wb-replay-comments__meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-muted, #64748b);
  margin-bottom: 2px;
}
.wb-replay-comments__meta strong { color: var(--color-text, #0f172a); font-weight: 600; }
.wb-replay-comments__text {
  margin: 0;
  font-size: 13px;
  color: var(--color-text, #0f172a);
  white-space: pre-wrap;
  word-break: break-word;
}
.wb-replay-comments__delete {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #94a3b8);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.wb-replay-comments__delete:hover { color: #dc2626; }
.wb-replay-comments__empty {
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted, #94a3b8);
  font-size: 13px;
  margin: 0;
}
.wb-replay-comments__form {
  padding: 10px;
  border-top: 1px solid var(--color-border, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--color-surface-alt, #f8fafc);
}
.wb-replay-comments__timestamp {
  font-size: 11px;
  color: var(--color-text-muted, #64748b);
  padding: 2px 2px 0;
}
.wb-replay-comments__timestamp strong {
  color: var(--color-primary, #2563eb);
  font-weight: 700;
}
.wb-replay-comments__form textarea {
  resize: vertical;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  background: #ffffff;
}
.wb-replay-comments__form textarea:focus {
  outline: none;
  border-color: var(--color-primary, #2563eb);
}
.wb-replay-comments__form button {
  align-self: flex-end;
  padding: 6px 14px;
  background: var(--color-primary, #2563eb);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.wb-replay-comments__form button:disabled { opacity: 0.5; cursor: not-allowed; }

/* R2: Mobile — full-width when inside bottom-sheet */
@media (max-width: 639px) {
  .wb-replay-comments {
    width: 100%;
    border-left: none;
  }
  .wb-replay-comments__btn {
    min-height: 44px;
  }
  .wb-replay-comments__form textarea {
    min-height: 56px;
    font-size: 16px; /* prevent iOS zoom */
  }
}
</style>
