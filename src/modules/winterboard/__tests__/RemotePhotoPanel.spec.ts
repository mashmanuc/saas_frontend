/**
 * Пульт: панель «Фото на дошку» (LAW §9 v1.9). Підготовка фото й завантаження
 * підмінені (jsdom не має canvas); перевіряємо саму взаємодію:
 * до «Додати» — нічого не завантажується; рівно одне завантаження й одна команда;
 * результат зараховується лише для своєї спроби; повтори — лише рукою.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { PHOTO_REQUEST_ID_RE, type RemotePhotoResult } from '../remote/photoContract'

const uploadAsset = vi.fn()
vi.mock('../api/library', () => ({ uploadAsset: (...a: unknown[]) => uploadAsset(...a) }))

const preparePhoto = vi.fn()
vi.mock('../remote/preparePhoto', async (orig) => ({
  ...(await orig<typeof import('../remote/preparePhoto')>()),
  preparePhoto: (...a: unknown[]) => preparePhoto(...a),
}))

import RemotePhotoPanel from '../components/remote/RemotePhotoPanel.vue'
import { PhotoPrepareError } from '../remote/preparePhoto'

function preparedOf(name = 'phone-photo.jpg') {
  const file = new File([new Uint8Array(2048)], name, { type: 'image/jpeg' })
  return { file, width: 3072, height: 2304, original: { width: 4032, height: 3024, bytes: 3_500_000, type: 'image/jpeg' }, reencoded: true }
}

type SendArgs = { library_asset_id: number; request_id: string; page_index: number }

function mountPanel(over: Record<string, unknown> = {}) {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const send = vi.fn((_args: SendArgs) => true)
  const tel = vi.fn()
  const w = mount(RemotePhotoPanel, {
    props: { ready: true, pageIndex: 2, result: null as RemotePhotoResult | null, send, tel, ...over },
    global: { plugins: [i18n] },
  })
  /** Аргументи n-го виклику send (типізовано для vue-tsc) */
  const sent = (n: number): SendArgs => send.mock.calls[n]![0]
  return { w, send, sent, tel }
}

async function pickFile(w: ReturnType<typeof mount>) {
  const input = w.find('[data-testid="photo-gallery-input"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'IMG_1.HEIC', { type: 'image/heic' })], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('RemotePhotoPanel', () => {
  beforeEach(() => {
    uploadAsset.mockReset()
    preparePhoto.mockReset()
    preparePhoto.mockResolvedValue(preparedOf())
    uploadAsset.mockResolvedValue({ id: 77, cdn_url: 'https://cdn/x.jpg', status: 'active', content_type: 'image/jpeg' })
    ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:preview')
    ;(URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn()
  })
  afterEach(() => { vi.useRealTimers() })

  it('до «Додати» нічого не завантажується; «Скасувати» — теж', async () => {
    const { w, send, sent } = mountPanel()
    await pickFile(w)
    expect(w.find('[data-testid="photo-preview"]').exists()).toBe(true)
    expect(uploadAsset).not.toHaveBeenCalled()
    await w.find('[data-testid="photo-cancel"]').trigger('click')
    expect(uploadAsset).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(w.find('[data-testid="photo-take"]').exists()).toBe(true)
  })

  it('«Додати» → рівно одне завантаження з purpose, потім одна команда з ідентифікаторами', async () => {
    const { w, send, sent } = mountPanel()
    await pickFile(w)
    await w.find('[data-testid="photo-add"]').trigger('click')
    await flushPromises()
    expect(uploadAsset).toHaveBeenCalledTimes(1)
    expect(uploadAsset.mock.calls[0][1]).toBeNull()
    expect(uploadAsset.mock.calls[0][2]).toEqual({ purpose: 'remote_photo' })
    expect(send).toHaveBeenCalledTimes(1)
    const args = sent(0)
    expect(Object.keys(args).sort()).toEqual(['library_asset_id', 'page_index', 'request_id'])
    expect(args.library_asset_id).toBe(77)
    expect(args.page_index).toBe(2)
    expect(args.request_id).toMatch(PHOTO_REQUEST_ID_RE)
    expect(w.find('[data-testid="photo-sending"]').exists()).toBe(true)
  })

  it('сторінка — та, що була при «Додати», а не після завантаження (перегорнули під час завантаження)', async () => {
    let finish: (v: unknown) => void = () => {}
    uploadAsset.mockImplementation(() => new Promise((r) => { finish = r }))
    const { w, sent } = mountPanel({ pageIndex: 2 })
    await pickFile(w)
    expect(w.text()).toContain('Додати на сторінку 3 дошки?')
    await w.find('[data-testid="photo-add"]').trigger('click')
    await w.setProps({ pageIndex: 5 })                       // поки файл їде
    finish({ id: 77, cdn_url: 'https://cdn/x.jpg', status: 'active', content_type: 'image/jpeg' })
    await flushPromises()
    expect(sent(0).page_index).toBe(2)                        // ноутбук відповість page_changed, а не покладе на 6
  })

  it('стара відмова, а потім «placed» тієї ж спроби — показуємо правду: фото на дошці', async () => {
    const { w, sent } = mountPanel()
    await pickFile(w)
    await w.find('[data-testid="photo-add"]').trigger('click')
    await flushPromises()
    const rid = sent(0).request_id
    await w.setProps({ result: { request_id: rid, status: 'rejected', reason: 'load_failed' } })
    expect(w.find('[data-testid="photo-rejected"]').exists()).toBe(true)
    await w.setProps({ result: { request_id: rid, status: 'placed' } })
    expect(w.find('[data-testid="photo-placed"]').exists()).toBe(true)
  })

  it('ліміт об’єктів і заморожена дошка — повтор без нового завантаження', async () => {
    const { w, send } = mountPanel()
    await pickFile(w)
    await w.find('[data-testid="photo-add"]').trigger('click')
    await flushPromises()
    for (const reason of ['limit', 'frozen'] as const) {
      const last = send.mock.calls[send.mock.calls.length - 1]![0]
      await w.setProps({ result: { request_id: last.request_id, status: 'rejected', reason } })
      expect(w.find('[data-testid="photo-retry"]').exists()).toBe(true)
      await w.find('[data-testid="photo-retry"]').trigger('click')
    }
    expect(uploadAsset).toHaveBeenCalledTimes(1)
  })

  it('«Скасувати» звільняє прев’ю', async () => {
    const { w } = mountPanel()
    await pickFile(w)
    await w.find('[data-testid="photo-cancel"]').trigger('click')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('результат чужої спроби ігнорується; своєї — «Фото на дошці»', async () => {
    const { w, send, sent } = mountPanel()
    await pickFile(w)
    await w.find('[data-testid="photo-add"]').trigger('click')
    await flushPromises()
    const rid = sent(0).request_id
    await w.setProps({ result: { request_id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', status: 'placed' } })
    expect(w.find('[data-testid="photo-sending"]').exists()).toBe(true)
    await w.setProps({ result: { request_id: rid, status: 'placed' } })
    expect(w.find('[data-testid="photo-placed"]').exists()).toBe(true)
  })

  it('page_changed → «Додати на поточну» з НОВИМ request_id і поточною сторінкою, без нового завантаження', async () => {
    const { w, send, sent } = mountPanel()
    await pickFile(w)
    await w.find('[data-testid="photo-add"]').trigger('click')
    await flushPromises()
    const first = sent(0)
    await w.setProps({ result: { request_id: first.request_id, status: 'rejected', reason: 'page_changed' }, pageIndex: 4 })
    expect(w.find('[data-testid="photo-rejected"]').attributes('data-reason')).toBe('page_changed')
    // старий результат, що ще в дорозі, нову спробу не закриє
    await w.find('[data-testid="photo-retry"]').trigger('click')
    const second = sent(1)
    expect(second.page_index).toBe(4)
    expect(second.library_asset_id).toBe(77)
    expect(second.request_id).not.toBe(first.request_id)
    expect(uploadAsset).toHaveBeenCalledTimes(1)
    await w.setProps({ result: { request_id: first.request_id, status: 'rejected', reason: 'page_changed' } })
    expect(w.find('[data-testid="photo-sending"]').exists()).toBe(true)
  })

  it('немає відповіді → «не підтверджено»; «Надіслати ще раз» — той самий request_id; пізня відповідь зараховується', async () => {
    vi.useFakeTimers()
    const { w, send, sent } = mountPanel()
    await pickFile(w)
    await w.find('[data-testid="photo-add"]').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(16_000)
    await flushPromises()
    expect(w.find('[data-testid="photo-unconfirmed"]').exists()).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)          // сам не повторює
    await w.find('[data-testid="photo-resend"]').trigger('click')
    expect(send).toHaveBeenCalledTimes(2)
    expect(sent(1).request_id).toBe(sent(0).request_id)
    vi.advanceTimersByTime(16_000)
    await flushPromises()
    await w.setProps({ result: { request_id: sent(0).request_id, status: 'placed' } })
    expect(w.find('[data-testid="photo-placed"]').exists()).toBe(true)
  })

  it('невдале завантаження — причина словами, команда не надсилається', async () => {
    uploadAsset.mockRejectedValue({ response: { status: 400, data: { error: 'unsupported_format' } } })
    const { w, send, sent } = mountPanel()
    await pickFile(w)
    await w.find('[data-testid="photo-add"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="photo-upload-error"]').attributes('data-code')).toBe('unsupported_format')
    expect(w.text()).toContain('JPEG, PNG або WebP')
    expect(send).not.toHaveBeenCalled()
  })

  it('формат, який браузер не відкриває (HEIC у Chrome), — пояснення й жодного завантаження', async () => {
    preparePhoto.mockRejectedValue(new PhotoPrepareError('undecodable'))
    const { w, tel } = mountPanel()
    await pickFile(w)
    expect(w.find('[data-testid="photo-prepare-error"]').attributes('data-code')).toBe('undecodable')
    expect(w.text()).toContain('HEIC')
    expect(uploadAsset).not.toHaveBeenCalled()
    expect(tel).toHaveBeenCalledWith('photo_prepare_failed', { code: 'undecodable', type: 'image/heic' })
  })

  it('немає зв’язку з дошкою — кнопки вимкнені', async () => {
    const { w } = mountPanel({ ready: false })
    expect(w.find('[data-testid="photo-take"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="photo-pick"]').attributes('disabled')).toBeDefined()
  })
})
