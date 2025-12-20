<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { marketplaceApi, type Certification, type CertificationStatus } from '../../api/marketplace'
import { notifyError, notifySuccess } from '@/utils/notify'

const { t } = useI18n()

const certifications = ref<Certification[]>([])
const isLoading = ref(false)
const isUploading = ref(false)
const uploadProgress = ref<number | null>(null)

const newTitle = ref('')
const newIssuer = ref('')
const newIssuedYear = ref<number | null>(null)
const newIsPublic = ref(true)
const newFile = ref<File | null>(null)

const canSubmit = computed(() => {
  return !!newFile.value && newTitle.value.trim().length > 0
})

function statusLabel(status: CertificationStatus): string {
  if (status === 'pending') return t('marketplace.profile.editor.certificationsStatusPending')
  if (status === 'approved') return t('marketplace.profile.editor.certificationsStatusApproved')
  return t('marketplace.profile.editor.certificationsStatusRejected')
}

async function load() {
  isLoading.value = true
  try {
    certifications.value = await marketplaceApi.getMyCertifications()
  } catch (err) {
    notifyError(t('marketplace.profile.editor.certificationsLoadError'))
  } finally {
    isLoading.value = false
  }
}

function resetForm() {
  newTitle.value = ''
  newIssuer.value = ''
  newIssuedYear.value = null
  newIsPublic.value = true
  newFile.value = null
  uploadProgress.value = null
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] || null
  input.value = ''
  newFile.value = file
}

async function putWithProgress(uploadUrl: string, file: File): Promise<void> {
  uploadProgress.value = 0

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)

    if (file.type) {
      xhr.setRequestHeader('Content-Type', file.type)
    }

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return
      uploadProgress.value = Math.round((evt.loaded / evt.total) * 100)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        uploadProgress.value = 100
        resolve()
        return
      }
      reject(Object.assign(new Error('put_failed'), { status: xhr.status }))
    }

    xhr.onerror = () => reject(Object.assign(new Error('put_failed'), { status: xhr.status }))

    xhr.send(file)
  })
}

async function createCertification() {
  if (!canSubmit.value || isUploading.value) return

  const file = newFile.value as File
  const title = newTitle.value.trim()
  const issuer = newIssuer.value.trim()
  const issuedYear = typeof newIssuedYear.value === 'number' ? newIssuedYear.value : null

  const allowed = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
  ])

  if (!allowed.has(file.type)) {
    notifyError(t('marketplace.profile.editor.certificationsUnsupportedType'))
    return
  }

  const HARD_MAX_BYTES = 5 * 1024 * 1024
  if (file.size > HARD_MAX_BYTES) {
    notifyError(t('marketplace.profile.editor.certificationsTooLarge'))
    return
  }

  isUploading.value = true
  try {
    const presign = await marketplaceApi.presignCertificationUpload({
      filename: file.name,
      content_type: file.type,
      size: file.size,
    })

    await putWithProgress(presign.upload_url, file)

    await marketplaceApi.createMyCertification({
      title,
      issuer,
      issued_year: issuedYear,
      asset_key: presign.asset_key,
      is_public: newIsPublic.value,
    })

    await load()
    notifySuccess(t('marketplace.profile.editor.certificationsCreateSuccess'))
    resetForm()
  } catch (err: any) {
    const status = err?.response?.status ?? err?.status

    if (status === 413) {
      notifyError(t('marketplace.profile.editor.certificationsTooLarge'))
      return
    }

    if (status === 415) {
      notifyError(t('marketplace.profile.editor.certificationsUnsupportedType'))
      return
    }

    if (status === 422) {
      notifyError(t('marketplace.profile.editor.certificationsValidationError'))
      return
    }

    if (status === 429) {
      notifyError(t('marketplace.profile.editor.certificationsRateLimited'))
      return
    }

    notifyError(t('marketplace.profile.editor.certificationsUploadError'))
  } finally {
    isUploading.value = false
  }
}

async function togglePublic(c: Certification) {
  const next = !c.is_public
  try {
    const updated = await marketplaceApi.updateMyCertification(c.id, { is_public: next })
    certifications.value = certifications.value.map((x) => (x.id === c.id ? updated : x))
  } catch (err: any) {
    const status = err?.response?.status ?? err?.status
    if (status === 429) {
      notifyError(t('marketplace.profile.editor.certificationsRateLimited'))
      return
    }
    notifyError(t('marketplace.profile.editor.certificationsUpdateError'))
  }
}

async function removeCertification(c: Certification) {
  const ok = window.confirm(t('common.confirmDelete'))
  if (!ok) return

  try {
    await marketplaceApi.deleteMyCertification(c.id)
    certifications.value = certifications.value.filter((x) => x.id !== c.id)
    notifySuccess(t('marketplace.profile.editor.certificationsDeleteSuccess'))
  } catch (err) {
    notifyError(t('marketplace.profile.editor.certificationsDeleteError'))
    throw err
  }
}

onMounted(() => {
  load()
})
</script>

<template>
  <div class="certifications-editor" data-test="marketplace-certifications-editor">
    <div class="header-row">
      <div class="title">{{ t('marketplace.profile.editor.certificationsTitle') }}</div>
      <div v-if="isLoading" class="loading">{{ t('common.loading') }}</div>
    </div>

    <div class="create-card" data-test="marketplace-certifications-create">
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.profile.editor.certificationsTitleLabel') }}</label>
          <input v-model="newTitle" type="text" :disabled="isUploading" />
        </div>
        <div class="form-group">
          <label>{{ t('marketplace.profile.editor.certificationsIssuerLabel') }}</label>
          <input v-model="newIssuer" type="text" :disabled="isUploading" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.profile.editor.certificationsIssuedYearLabel') }}</label>
          <input v-model.number="newIssuedYear" type="number" min="1900" max="2100" :disabled="isUploading" />
        </div>

        <div class="form-group">
          <label>{{ t('marketplace.profile.editor.certificationsFileLabel') }}</label>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            :disabled="isUploading"
            data-test="marketplace-certifications-file"
            @change="handleFileChange"
          />
        </div>
      </div>

      <label class="checkbox-label">
        <input v-model="newIsPublic" type="checkbox" :disabled="isUploading" />
        {{ t('marketplace.profile.editor.certificationPublic') }}
      </label>

      <div v-if="uploadProgress != null" class="progress" data-test="marketplace-certifications-progress">
        <div class="progress-bar" :style="{ width: uploadProgress + '%' }" />
        <div class="progress-text">{{ uploadProgress }}%</div>
      </div>

      <button
        type="button"
        class="btn btn-secondary"
        :disabled="!canSubmit || isUploading"
        data-test="marketplace-certifications-submit"
        @click="createCertification"
      >
        {{ isUploading ? t('marketplace.profile.editor.certificationsUploading') : t('marketplace.profile.editor.certificationsAdd') }}
      </button>
    </div>

    <div class="list" data-test="marketplace-certifications-list">
      <div v-if="!isLoading && certifications.length === 0" class="empty">
        {{ t('marketplace.profile.editor.certificationsEmpty') }}
      </div>

      <div v-for="c in certifications" :key="c.id" class="item" data-test="marketplace-certifications-item">
        <div class="item-main">
          <div class="item-title">
            <a v-if="c.file_url" :href="c.file_url" target="_blank" rel="noopener noreferrer">{{ c.title }}</a>
            <span v-else>{{ c.title }}</span>
          </div>
          <div class="item-meta">
            <span>{{ c.issuer }}</span>
            <span>·</span>
            <span>{{ c.issued_year }}</span>
          </div>
          <div class="item-status">
            <span class="status" :data-status="c.status">{{ statusLabel(c.status) }}</span>
            <span v-if="c.status === 'rejected' && c.rejection_reason" class="rejection">{{ c.rejection_reason }}</span>
          </div>
        </div>

        <div class="item-actions">
          <label class="checkbox-label">
            <input :checked="c.is_public" type="checkbox" @change="togglePublic(c)" />
            {{ t('marketplace.profile.editor.certificationPublic') }}
          </label>
          <button type="button" class="btn btn-ghost" @click="removeCertification(c)">
            {{ t('marketplace.profile.editor.remove') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.certifications-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-weight: 600;
}

.create-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.form-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
}

.form-group input {
  width: 100%;
}

.progress {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-primary) 12%, var(--border-color));
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent-primary);
}

.progress-text {
  margin-top: 0.35rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  padding: 0.75rem 1rem;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.item-title {
  font-weight: 600;
}

.item-meta {
  color: var(--text-muted);
  font-size: 0.875rem;
  display: flex;
  gap: 0.5rem;
}

.item-status {
  margin-top: 0.35rem;
}

.status {
  font-size: 0.8125rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
}

.status[data-status='approved'] {
  border-color: color-mix(in srgb, var(--success-bg) 45%, var(--border-color));
}

.status[data-status='pending'] {
  border-color: color-mix(in srgb, var(--warning-bg) 45%, var(--border-color));
}

.status[data-status='rejected'] {
  border-color: color-mix(in srgb, var(--danger-bg) 45%, var(--border-color));
}

.rejection {
  display: block;
  margin-top: 0.35rem;
  color: color-mix(in srgb, var(--danger-bg) 70%, var(--text-muted));
  font-size: 0.875rem;
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
}
</style>
