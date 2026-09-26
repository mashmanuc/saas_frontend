<template>
  <!-- «Фото на дошку» (LAW §9 v1.9): камера або галерея → прев'ю → підтвердження →
       завантаження в «Матеріали» (REST) → ноутбук сам перевіряє й кладе фото.
       До підтвердження файл нікуди не йде; повтори — лише рукою вчителя. -->
  <section class="wb-remote-photo" data-testid="remote-photo">
    <p class="wb-remote-photo__title">{{ t('winterboard.remote.photo.title') }}</p>

    <div v-if="phase === 'idle'" class="wb-remote-photo__row">
      <button type="button" class="wb-remote-photo__btn" data-testid="photo-take" :disabled="!ready" @click="cameraInput?.click()">
        📷 {{ t('winterboard.remote.photo.take') }}
      </button>
      <button type="button" class="wb-remote-photo__btn" data-testid="photo-pick" :disabled="!ready" @click="galleryInput?.click()">
        🖼 {{ t('winterboard.remote.photo.pick') }}
      </button>
    </div>
    <!-- capture — лише побажання браузеру (задня камера); галерея — окремою дією -->
    <input ref="cameraInput" class="wb-remote-photo__input" type="file" accept="image/*" capture="environment" data-testid="photo-camera-input" @change="onFile">
    <input ref="galleryInput" class="wb-remote-photo__input" type="file" accept="image/*" data-testid="photo-gallery-input" @change="onFile">

    <p v-if="phase === 'preparing'" class="wb-remote-photo__status" role="status">{{ t('winterboard.remote.photo.preparing') }}</p>

    <div v-else-if="phase === 'preview' && prepared" class="wb-remote-photo__confirm">
      <img :src="previewUrl" alt="" class="wb-remote-photo__preview" data-testid="photo-preview">
      <p class="wb-remote-photo__meta">
        {{ t('winterboard.remote.photo.info', { width: prepared.width, height: prepared.height, size: fmtSize(prepared.file.size) }) }}
      </p>
      <p class="wb-remote-photo__question">{{ t('winterboard.remote.photo.confirm', { page: (pageIndex ?? 0) + 1 }) }}</p>
      <div class="wb-remote-photo__row">
        <button type="button" class="wb-remote-photo__btn is-on" data-testid="photo-add" :disabled="!ready" @click="upload">
          {{ t('winterboard.remote.photo.add') }}
        </button>
        <button type="button" class="wb-remote-photo__btn" data-testid="photo-cancel" @click="reset">
          {{ t('winterboard.remote.photo.cancel') }}
        </button>
      </div>
    </div>

    <p v-else-if="phase === 'uploading'" class="wb-remote-photo__status" role="status">{{ t('winterboard.remote.photo.uploading') }}</p>
    <p v-else-if="phase === 'sending'" class="wb-remote-photo__status" role="status" data-testid="photo-sending">{{ t('winterboard.remote.photo.sending') }}</p>

    <div v-else-if="phase === 'placed'" class="wb-remote-photo__done" role="status" data-testid="photo-placed">
      <p class="wb-remote-photo__ok">✓ {{ t('winterboard.remote.photo.placed') }}</p>
      <button type="button" class="wb-remote-photo__btn" @click="reset">{{ t('winterboard.remote.photo.another') }}</button>
    </div>

    <div v-else-if="phase === 'rejected' && reason" class="wb-remote-photo__problem" role="status" data-testid="photo-rejected" :data-reason="reason">
      <p>{{ t(`winterboard.remote.photo.reason.${reason}`, { page: (pageIndex ?? 0) + 1 }) }}</p>
      <div class="wb-remote-photo__row">
        <button v-if="RETRYABLE.has(reason)" type="button" class="wb-remote-photo__btn is-on" data-testid="photo-retry" :disabled="!ready" @click="retryAfterReject">
          {{ reason === 'page_changed' ? t('winterboard.remote.photo.placeHere') : t('winterboard.remote.photo.retry') }}
        </button>
        <button type="button" class="wb-remote-photo__btn" data-testid="photo-done" @click="reset">{{ t('winterboard.remote.photo.done') }}</button>
      </div>
    </div>

    <div v-else-if="phase === 'unconfirmed'" class="wb-remote-photo__problem" role="status" data-testid="photo-unconfirmed">
      <p>{{ t('winterboard.remote.photo.unconfirmed') }}</p>
      <div class="wb-remote-photo__row">
        <button type="button" class="wb-remote-photo__btn is-on" data-testid="photo-resend" :disabled="!ready" @click="send">
          {{ t('winterboard.remote.photo.resend') }}
        </button>
        <button type="button" class="wb-remote-photo__btn" @click="reset">{{ t('winterboard.remote.photo.done') }}</button>
      </div>
    </div>

    <div v-else-if="phase === 'upload_error'" class="wb-remote-photo__problem" role="status" data-testid="photo-upload-error" :data-code="uploadError?.key">
      <p>{{ uploadError ? t(`winterboard.remote.photo.uploadError.${uploadError.key}`, uploadError.params) : '' }}</p>
      <div class="wb-remote-photo__row">
        <button type="button" class="wb-remote-photo__btn is-on" :disabled="!ready" @click="upload">{{ t('winterboard.remote.photo.retry') }}</button>
        <button type="button" class="wb-remote-photo__btn" @click="reset">{{ t('winterboard.remote.photo.cancel') }}</button>
      </div>
    </div>

    <div v-else-if="phase === 'prepare_error'" class="wb-remote-photo__problem" role="status" data-testid="photo-prepare-error" :data-code="prepareError">
      <p>{{ t(`winterboard.remote.photo.prepareError.${prepareError}`) }}</p>
      <button type="button" class="wb-remote-photo__btn" @click="reset">{{ t('winterboard.remote.photo.done') }}</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, shallowRef, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { uploadAsset } from '../../api/library'
import {
  PHOTO_UPLOAD_PURPOSE, newRequestId,
  type PhotoRejectReason, type RemotePhotoResult,
} from '../../remote/photoContract'
import { preparePhoto, PhotoPrepareError, type PhotoPrepareErrorCode, type PreparedPhoto } from '../../remote/preparePhoto'
import { photoUploadError, type PhotoUploadErrorInfo } from '../../remote/photoUploadError'

const props = defineProps<{
  /** Пульт на зв'язку з дошкою й знає її поточну сторінку */
  ready: boolean
  pageIndex: number | null
  /** Останній `remote.state.photo` від ноутбука */
  result: RemotePhotoResult | null
  /** Надіслати photo.add; false — канал не відправив */
  send: (args: { library_asset_id: number; request_id: string; page_index: number }) => boolean
  tel?: (event: string, ctx?: Record<string, unknown>) => void
}>()

/** Скільки чекати відповіді ноутбука, перш ніж чесно сказати «не підтверджено» */
const ACK_TIMEOUT_MS = 15_000
/**
 * Відмови, після яких має сенс спробувати ще раз без нового завантаження: стан дошки
 * міг змінитись (перегорнули; «Новий запис» зняв заморозку; на новій сторінці є місце).
 */
const RETRYABLE: ReadonlySet<PhotoRejectReason> = new Set(['page_changed', 'input_locked', 'load_failed', 'error', 'limit', 'frozen'])

type Phase = 'idle' | 'preparing' | 'preview' | 'uploading' | 'sending' | 'placed'
  | 'rejected' | 'unconfirmed' | 'upload_error' | 'prepare_error'

const { t } = useI18n()
const phase = ref<Phase>('idle')
const cameraInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const prepared = shallowRef<PreparedPhoto | null>(null)
const previewUrl = ref('')
const libraryAssetId = ref<number | null>(null)
const requestId = ref<string | null>(null)
/** Сторінка, яку вчитель бачив, натискаючи «Додати» (а не та, що буде після завантаження) */
const attemptPage = ref<number | null>(null)
const reason = ref<PhotoRejectReason | null>(null)
const uploadError = ref<PhotoUploadErrorInfo | null>(null)
const prepareError = ref<PhotoPrepareErrorCode>('undecodable')
let ackTimer: ReturnType<typeof setTimeout> | null = null

function tel(event: string, ctx: Record<string, unknown> = {}): void {
  props.tel?.(event, ctx)
}

function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function clearAckTimer(): void {
  if (ackTimer) { clearTimeout(ackTimer); ackTimer = null }
}

function reset(): void {
  clearAckTimer()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  prepared.value = null
  libraryAssetId.value = null
  requestId.value = null
  attemptPage.value = null
  reason.value = null
  uploadError.value = null
  phase.value = 'idle'
}

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''   // той самий файл можна вибрати вдруге
  if (!file) return
  reset()
  phase.value = 'preparing'
  try {
    const p = await preparePhoto(file)
    prepared.value = p
    previewUrl.value = URL.createObjectURL(p.file)
    phase.value = 'preview'
  } catch (err) {
    prepareError.value = err instanceof PhotoPrepareError ? err.code : 'undecodable'
    phase.value = 'prepare_error'
    tel('photo_prepare_failed', { code: prepareError.value, type: file.type || 'unknown' })
  }
}

/** «Додати»: рівно одне завантаження; команда — лише після успішного завантаження. */
async function upload(): Promise<void> {
  const p = prepared.value
  if (!p || phase.value === 'uploading') return
  // Сторінку фіксуємо ЗАРАЗ: поки файл їде (секунди), дошку можуть перегорнути —
  // тоді ноутбук відповість page_changed, а не покладе фото мовчки на іншу сторінку.
  attemptPage.value = props.pageIndex
  phase.value = 'uploading'
  try {
    const asset = await uploadAsset(p.file, null, { purpose: PHOTO_UPLOAD_PURPOSE })
    libraryAssetId.value = asset.id
    requestId.value = newRequestId()
    tel('photo_uploaded', { kb: Math.round(p.file.size / 1024), reencoded: p.reencoded })
    send()
  } catch (err) {
    uploadError.value = photoUploadError(err)
    phase.value = 'upload_error'
    tel('photo_upload_failed', { code: uploadError.value.key })
  }
}

/** photo.add зі сторінкою цієї спроби. Повтор тієї ж спроби — той самий request_id і сторінка. */
function send(): void {
  if (libraryAssetId.value === null || !requestId.value) return
  clearAckTimer()
  const page = attemptPage.value
  if (page === null || !props.ready || !props.send({
    library_asset_id: libraryAssetId.value, request_id: requestId.value, page_index: page,
  })) {
    phase.value = 'unconfirmed'
    tel('photo_unconfirmed', { why: 'not_sent' })
    return
  }
  phase.value = 'sending'
  ackTimer = setTimeout(() => {
    ackTimer = null
    if (phase.value !== 'sending') return
    phase.value = 'unconfirmed'
    tel('photo_unconfirmed', { why: 'timeout' })
  }, ACK_TIMEOUT_MS)
}

/** Після явної відмови фото не лягло — нова спроба з новим request_id (LAW §9 v1.9). */
function retryAfterReject(): void {
  requestId.value = newRequestId()
  attemptPage.value = props.pageIndex   // нова спроба — на поточну сторінку
  send()
}

watch(() => props.result, (r) => {
  if (!r || !requestId.value || r.request_id !== requestId.value) return
  // пізня відповідь після «не підтверджено» теж зараховується; а «placed» виправляє
  // й показану відмову (стара відмова могла приїхати раніше за нову відповідь)
  const open = phase.value === 'sending' || phase.value === 'unconfirmed'
  if (!open && !(phase.value === 'rejected' && r.status === 'placed')) return
  clearAckTimer()
  if (r.status === 'placed') {
    phase.value = 'placed'
    tel('photo_placed')
  } else {
    reason.value = r.reason
    phase.value = 'rejected'
    tel('photo_rejected', { reason: r.reason })
  }
})

onBeforeUnmount(() => {
  clearAckTimer()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped>
.wb-remote-photo { display: flex; flex-direction: column; gap: 10px; }
.wb-remote-photo__title { margin: 0; font-size: 14px; font-weight: 700; color: #cbd5e1; }
.wb-remote-photo__row { display: flex; gap: 10px; }
.wb-remote-photo__btn {
  flex: 1; min-height: 56px; border: 0; border-radius: 14px; background: #1e293b; color: #f8fafc;
  font-size: 15px; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.wb-remote-photo__btn.is-on { background: #0f766e; }
.wb-remote-photo__btn:active { background: #334155; }
.wb-remote-photo__btn:disabled { opacity: .35; }
.wb-remote-photo__input { display: none; }
.wb-remote-photo__status { margin: 0; padding: 12px; border-radius: 12px; background: #1e293b; text-align: center; font-size: 15px; }
.wb-remote-photo__confirm { display: flex; flex-direction: column; gap: 8px; }
.wb-remote-photo__preview { width: 100%; max-height: 50vh; object-fit: contain; border-radius: 12px; background: #020617; }
.wb-remote-photo__meta { margin: 0; font-size: 12px; color: #94a3b8; text-align: center; }
.wb-remote-photo__question { margin: 0; font-size: 15px; font-weight: 600; text-align: center; }
.wb-remote-photo__done { display: flex; flex-direction: column; gap: 8px; }
.wb-remote-photo__ok { margin: 0; padding: 12px; border-radius: 12px; background: #064e3b; color: #ecfdf5; font-weight: 700; text-align: center; }
.wb-remote-photo__problem {
  display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px;
  background: #1e293b; border: 1px solid #f59e0b; font-size: 15px; line-height: 1.4;
}
.wb-remote-photo__problem p { margin: 0; }
</style>
