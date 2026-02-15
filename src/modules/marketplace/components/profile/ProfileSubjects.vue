<script setup lang="ts">
import { computed } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { SubjectPublic, SpecialtyTagPublic, TagGroup } from '../../api/marketplace'

interface Props {
  subjects: SubjectPublic[]
}

const props = defineProps<Props>()

const { t } = useI18n()

/**
 * v1.0: Визначити чи тег є форматом навчання (online/offline/hybrid)
 * для особливого виділення на профілі
 */
function isFormatModeTag(tagCode: string): boolean {
  return ['online', 'offline', 'hybrid'].includes(tagCode)
}

function getTagDisplayClass(tag: SpecialtyTagPublic): string {
  if (tag.code === 'online') return 'tag-display--online'
  if (tag.code === 'offline') return 'tag-display--offline'
  if (tag.code === 'hybrid') return 'tag-display--hybrid'
  return 'tag-display--neutral'
}

function groupTagsByGroup(tags: SpecialtyTagPublic[]): Record<TagGroup, SpecialtyTagPublic[]> {
  const grouped: Record<string, SpecialtyTagPublic[]> = {}
  
  for (const tag of tags) {
    if (!grouped[tag.group]) {
      grouped[tag.group] = []
    }
    grouped[tag.group].push(tag)
  }
  
  return grouped as Record<TagGroup, SpecialtyTagPublic[]>
}

const normalizedSubjects = computed(() => {
  if (!Array.isArray(props.subjects)) {
    return []
  }

  return props.subjects.map((subject) => ({
    ...subject,
    tags: Array.isArray(subject.tags) ? subject.tags : [],
    custom_direction_text: subject.custom_direction_text || '',
  }))
})
</script>

<template>
  <section class="profile-subjects">
    <h2>
      <BookOpen :size="20" />
      {{ t('marketplace.profile.subjectsTitle') }}
    </h2>

    <div class="subjects-list">
      <div
        v-for="subject in normalizedSubjects"
        :key="subject.code"
        class="subject-item"
      >
        <h3 class="subject-title">{{ subject.title }}</h3>

        <div v-if="subject.tags.length" class="tags-groups">
          <div
            v-for="(groupTags, groupName) in groupTagsByGroup(subject.tags)"
            :key="groupName"
            class="tag-group"
          >
            <span class="group-label">
              {{ t(`marketplace.tagGroups.${groupName}`) }}
            </span>
            <div class="tags">
              <span
                v-for="tag in groupTags"
                :key="tag.code"
                :class="['tag-display', getTagDisplayClass(tag)]"
              >
                {{ tag.label }}
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="subject.custom_direction_text"
          class="custom-text"
        >
          <h4>{{ t('marketplace.profile.aboutApproach') }}</h4>
          <p>{{ subject.custom_direction_text }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.profile-subjects {
  padding: 1rem;
  background: var(--bg-primary, #fff);
  border-radius: 12px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.profile-subjects h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.subjects-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.subject-item {
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.subject-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.subject-title {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.tags-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.tag-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Tag стилі — використовуються глобальні .tag-display з main.css */

.custom-text {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-secondary, #f9fafb);
  border-radius: 8px;
}

.custom-text h4 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
  color: var(--text-secondary, #6b7280);
}

.custom-text p {
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}
</style>
