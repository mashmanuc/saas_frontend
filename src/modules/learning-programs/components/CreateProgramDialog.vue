<template>
  <Modal :open="open" :title="t('learningPrograms.create.title')" size="md" @close="emit('close')">
    <div class="cpd" data-testid="lp-create">
      <section class="cpd__step">
        <h4 class="cpd__label">{{ t('learningPrograms.create.learner') }}</h4>
        <ConductStudentChoice :current-id="learnerId ?? undefined" :busy="saving" @choose="onChoose" />
        <p v-if="noneChosen" class="cpd__error" role="alert">{{ t('learningPrograms.create.needLearner') }}</p>
      </section>

      <section class="cpd__step">
        <h4 class="cpd__label">{{ t('learningPrograms.create.template') }}</h4>
        <p v-if="loadingTemplates" class="cpd__muted">{{ t('loader.loading') }}</p>
        <p v-else-if="!templates.length" class="cpd__muted">{{ t('learningPrograms.create.noTemplates') }}</p>
        <label v-for="v in templates" :key="v.id" class="cpd__option">
          <input v-model="templateId" type="radio" name="lp-template" :value="v.id" data-testid="lp-create-template" />
          <span>{{ v.title }}</span>
        </label>
      </section>

      <section class="cpd__step">
        <h4 class="cpd__label">{{ t('learningPrograms.create.level') }}</h4>
        <p class="cpd__muted">{{ t('learningPrograms.create.levelHint') }}</p>
        <div class="cpd__levels">
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="cpd__level"
            :class="{ 'cpd__level--on': level === n }"
            :aria-pressed="level === n"
            @click="level = n"
          >{{ n }}</button>
        </div>
      </section>

      <p v-if="failed" class="cpd__error" role="alert">{{ failed }}</p>
    </div>
    <template #footer>
      <Button variant="ghost" @click="emit('close')">{{ t('common.cancel') }}</Button>
      <Button :loading="saving" :disabled="!canSave" data-testid="lp-create-save" @click="save">
        {{ t('learningPrograms.create.save') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
/**
 * Створення програми учню (ТЗ §5.1): учень — той самий вибір «З ким урок?», що на «Провести» (свої учні, учень без
 * акаунта, нове ім'я); шаблон — версія з сервера; рівень 1–5 обов'язковий для активної програми. Повтор натискання
 * не створює другу програму — кожне відкриття вікна несе новий ключ лише на момент «Створити».
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import ConductStudentChoice from '@/modules/knowledge/components/ConductStudentChoice.vue'
import { learningProgramsApi, errorCode, type ProgramDetail, type TemplateVersion } from '../api/learningProgramsApi'

const props = defineProps<{ open: boolean; presetLearnerId?: number | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'created', p: ProgramDetail): void }>()
const { t } = useI18n({ useScope: 'global' })

const learnerId = ref<number | null>(null)
const noneChosen = ref(false)
const templates = ref<TemplateVersion[]>([])
const templateId = ref<string>('')
const loadingTemplates = ref(false)
const level = ref<number>(3)
const saving = ref(false)
const failed = ref('')

const canSave = computed(() => !!learnerId.value && !!templateId.value && !saving.value)

watch(() => props.open, async (open) => {
  if (!open) return
  failed.value = ''
  noneChosen.value = false
  learnerId.value = props.presetLearnerId ?? null
  loadingTemplates.value = true
  try {
    templates.value = await learningProgramsApi.templates()
    if (templates.value.length === 1) templateId.value = templates.value[0].id
  } catch {
    templates.value = []
  } finally {
    loadingTemplates.value = false
  }
}, { immediate: true })

function onChoose(id: number | null) {
  noneChosen.value = id === null
  learnerId.value = id
}

async function save() {
  if (!canSave.value || !learnerId.value) return
  saving.value = true
  failed.value = ''
  try {
    const created = await learningProgramsApi.create({
      template_version_id: templateId.value, learnerId: learnerId.value, level: level.value, status: 'active',
    })
    emit('created', created)
  } catch (e) {
    const code = errorCode(e)
    failed.value = code === 'learner_not_active'
      ? t('learningPrograms.errors.learnerNotActive')
      : t('learningPrograms.errors.generic')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.cpd { display: flex; flex-direction: column; gap: 18px; }
.cpd__label { margin: 0 0 6px; font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.cpd__muted { margin: 0; font-size: var(--text-sm); color: var(--text-secondary); }
.cpd__error { margin: 0; font-size: var(--text-sm); color: var(--ui-color-danger); }
.cpd__option { display: flex; gap: 8px; align-items: center; padding: 6px 0; cursor: pointer; }
.cpd__levels { display: flex; gap: 8px; margin-top: 8px; }
.cpd__level {
  width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--border-color);
  background: var(--card-bg); font-weight: 600; cursor: pointer;
}
.cpd__level--on { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
</style>
