/**
 * [WB:B2.2] Unit tests for WBExportDialog component
 *
 * Tests export format selection, options, state transitions, polling, timeout.
 * winterboardApi is mocked since A2.2 is not yet implemented.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBExportDialog from '@/modules/winterboard/components/export/WBExportDialog.vue'

// ── Mock winterboardApi ──────────────────────────────────────────────────
const mockCreateExport = vi.fn()
const mockGetExport = vi.fn()

vi.mock('@/modules/winterboard/api/winterboardApi', () => ({
  winterboardApi: {
    createExport: (...args: unknown[]) => mockCreateExport(...args),
    getExport: (...args: unknown[]) => mockGetExport(...args),
  },
}))

// ── Mock useToast ────────────────────────────────────────────────────────
const mockShowToast = vi.fn()
vi.mock('@/modules/winterboard/composables/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
    toasts: { value: [] },
    dismissToast: vi.fn(),
    clearAllToasts: vi.fn(),
  }),
}))

// ── i18n setup ───────────────────────────────────────────────────────────
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      winterboard: {
        export: {
          title: 'Export Board',
          description: 'Choose format',
          format: 'Format',
          close: 'Close',
          startExport: 'Export',
          processing: 'Processing…',
          ready: 'Export ready!',
          download: 'Download',
          error: 'Export error',
          retry: 'Retry',
          exportError: 'Failed to start export',
          pollError: 'Failed to check export status',
          timeout: 'Export is taking too long.',
          formats: {
            png: 'PNG Image',
            pngDesc: 'Export current page as image',
            pdf: 'PDF Document',
            pdfDesc: 'Export all pages as PDF',
            json: 'JSON Data',
            jsonDesc: 'Export raw board data',
          },
          pageSelection: 'Pages',
          currentPage: 'Current page only',
          allPages: 'All pages',
          pngOptions: 'PNG Options',
          quality: 'Quality',
          qualityHigh: 'High (2x)',
          qualityMedium: 'Standard (1x)',
          qualityLow: 'Low',
          background: 'Background',
          bgWhite: 'White',
          bgTransparent: 'Transparent',
          pdfOptions: 'PDF Options',
          pageSize: 'Page Size',
          orientation: 'Orientation',
          portrait: 'Portrait',
          landscape: 'Landscape',
          original: 'Original',
          jsonOptions: 'JSON Options',
          prettyPrint: 'Pretty print',
        },
      },
    },
  },
})

// ── Helpers ──────────────────────────────────────────────────────────────
function mountDialog(propsOverride = {}) {
  return mount(WBExportDialog, {
    props: {
      sessionId: 'test-session-123',
      isOpen: true,
      ...propsOverride,
    },
    global: {
      plugins: [i18n],
      stubs: {
        Teleport: true,
        Transition: false,
      },
    },
  })
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('[WB:B2.2] WBExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders format selection when open', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('.wb-export-dialog__title').text()).toBe('Export Board')
    expect(wrapper.findAll('.wb-export-format')).toHaveLength(3)
  })

  it('does not render when isOpen is false', () => {
    const wrapper = mountDialog({ isOpen: false })
    expect(wrapper.find('.wb-export-dialog').exists()).toBe(false)
  })

  it('defaults to PNG format', () => {
    const wrapper = mountDialog()
    const radios = wrapper.findAll<HTMLInputElement>('input[name="wb-export-format"]')
    const checked = radios.find((r) => r.element.checked)
    expect(checked?.element.value).toBe('png')
  })

  it('shows PNG options when PNG is selected', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('PNG Options')
    expect(wrapper.text()).toContain('Quality')
    expect(wrapper.text()).toContain('Background')
  })

  it('shows page selection fieldset', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('Pages')
    expect(wrapper.text()).toContain('Current page only')
    expect(wrapper.text()).toContain('All pages')
  })

  it('shows PDF options when PDF is selected', async () => {
    const wrapper = mountDialog()
    const pdfRadio = wrapper.findAll<HTMLInputElement>('input[name="wb-export-format"]')[1]
    await pdfRadio.setValue(true)
    await flushPromises()
    expect(wrapper.text()).toContain('PDF Options')
    expect(wrapper.text()).toContain('Page Size')
    expect(wrapper.text()).toContain('Orientation')
  })

  it('shows JSON options when JSON is selected', async () => {
    const wrapper = mountDialog()
    const jsonRadio = wrapper.findAll<HTMLInputElement>('input[name="wb-export-format"]')[2]
    await jsonRadio.setValue(true)
    await flushPromises()
    expect(wrapper.text()).toContain('JSON Options')
    expect(wrapper.text()).toContain('Pretty print')
  })

  it('transitions to processing state on export start', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'export-1',
      status: 'processing',
      file_url: null,
      error: null,
    })

    const wrapper = mountDialog()
    await wrapper.find('.wb-export-dialog__action-btn').trigger('click')
    await flushPromises()

    expect(mockCreateExport).toHaveBeenCalledWith('test-session-123', 'png')
    expect(wrapper.text()).toContain('Processing…')
  })

  it('transitions to ready state when export is immediately done', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'export-1',
      status: 'done',
      file_url: 'https://cdn.example.com/export.png',
      error: null,
    })

    const wrapper = mountDialog()
    await wrapper.find('.wb-export-dialog__action-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Export ready!')
    expect(wrapper.text()).toContain('Download')
  })

  it('transitions to error state on API failure', async () => {
    mockCreateExport.mockRejectedValue(new Error('Network error'))

    const wrapper = mountDialog()
    await wrapper.find('.wb-export-dialog__action-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Export error')
    expect(mockShowToast).toHaveBeenCalledWith('Failed to start export', 'error')
  })

  it('emits close on overlay click', async () => {
    const wrapper = mountDialog()
    await wrapper.find('.wb-export-overlay').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close on Escape key', async () => {
    const wrapper = mountDialog()
    await wrapper.find('.wb-export-dialog').trigger('keydown.escape')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits exported when export completes', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'export-1',
      status: 'done',
      file_url: 'https://cdn.example.com/export.png',
      error: null,
    })

    const wrapper = mountDialog()
    await wrapper.find('.wb-export-dialog__action-btn').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('exported')).toBeTruthy()
  })

  it('retry button resets to idle state', async () => {
    mockCreateExport.mockRejectedValue(new Error('fail'))

    const wrapper = mountDialog()
    await wrapper.find('.wb-export-dialog__action-btn').trigger('click')
    await flushPromises()

    // Should be in error state
    expect(wrapper.text()).toContain('Export error')

    // Click retry
    await wrapper.find('.wb-export-dialog__action-btn').trigger('click')
    await flushPromises()

    // Should be back to idle (format selection visible)
    expect(wrapper.findAll('.wb-export-format').length).toBe(3)
  })

  it('has proper ARIA attributes on dialog', () => {
    const wrapper = mountDialog()
    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-label')).toBe('Export Board')
  })
})
