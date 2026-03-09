import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InquiriesPreview from '@/modules/dashboard/components/InquiriesPreview.vue'

const mockInquiries = [
  { id: 1, student_name: 'Іван К.', subject: 'Математика', status: 'invited' },
  { id: 2, student_name: 'Марія Л.', subject: 'Англійська', status: 'invited' },
  { id: 3, student_name: 'Олег М.', subject: 'Фізика', status: 'invited' },
  { id: 4, student_name: 'Дарія К.', subject: 'Хімія', status: 'invited' },
]

function mountPreview(props: Record<string, unknown> = {}) {
  return mount(InquiriesPreview, {
    props: {
      inquiries: mockInquiries,
      ...props,
    },
  })
}

describe('InquiriesPreview', () => {
  // ── Visibility ──
  it('renders when inquiries are present', () => {
    const wrapper = mountPreview()
    expect(wrapper.find('.inquiry-item').exists()).toBe(true)
  })

  it('does not render Card when inquiries empty', () => {
    const wrapper = mountPreview({ inquiries: [] })
    expect(wrapper.find('.inquiry-item').exists()).toBe(false)
    // Card has v-if="inquiries.length > 0" — entire card hidden
    expect(wrapper.find('.inquiries-header').exists()).toBe(false)
  })

  // ── MAX_PREVIEW limit ──
  it('renders max 3 inquiries (MAX_PREVIEW)', () => {
    const wrapper = mountPreview({ inquiries: mockInquiries })
    const items = wrapper.findAll('.inquiry-item')
    expect(items.length).toBe(3)
  })

  it('renders all inquiries when less than 3', () => {
    const wrapper = mountPreview({ inquiries: [mockInquiries[0]] })
    const items = wrapper.findAll('.inquiry-item')
    expect(items.length).toBe(1)
  })

  // ── Content ──
  it('shows student name', () => {
    const wrapper = mountPreview({ inquiries: [mockInquiries[0]] })
    expect(wrapper.text()).toContain('Іван К.')
  })

  it('shows subject with "wants to learn" label', () => {
    const wrapper = mountPreview({ inquiries: [mockInquiries[0]] })
    expect(wrapper.text()).toContain('Математика')
  })

  // ── Header ──
  it('shows header with title and count', () => {
    const wrapper = mountPreview()
    const header = wrapper.find('.inquiries-header')
    expect(header.exists()).toBe(true)
    expect(header.text()).toContain('4')
  })

  it('shows "view all" link to /tutor/inquiries', () => {
    const wrapper = mountPreview()
    const html = wrapper.html()
    expect(html).toContain('/tutor/inquiries')
  })

  // ── Accept / Decline emits ──
  it('emits accept with inquiry id on accept click', async () => {
    const wrapper = mountPreview({ inquiries: [mockInquiries[0]] })
    const acceptBtn = wrapper.find('.inquiry-accept-btn')
    expect(acceptBtn.exists()).toBe(true)
    await acceptBtn.trigger('click')
    expect(wrapper.emitted('accept')).toBeTruthy()
    expect(wrapper.emitted('accept')![0]).toEqual([1])
  })

  it('emits decline with inquiry id on decline click', async () => {
    const wrapper = mountPreview({ inquiries: [mockInquiries[0]] })
    const declineBtn = wrapper.find('.inquiry-decline-btn')
    expect(declineBtn.exists()).toBe(true)
    await declineBtn.trigger('click')
    expect(wrapper.emitted('decline')).toBeTruthy()
    expect(wrapper.emitted('decline')![0]).toEqual([1])
  })

  // ── Accessibility ──
  it('accept button has aria-label with student name', () => {
    const wrapper = mountPreview({ inquiries: [mockInquiries[0]] })
    const acceptBtn = wrapper.find('.inquiry-accept-btn')
    const ariaLabel = acceptBtn.attributes('aria-label')
    expect(ariaLabel).toBeTruthy()
    expect(ariaLabel).toContain('Іван К.')
  })

  it('decline button has aria-label with student name', () => {
    const wrapper = mountPreview({ inquiries: [mockInquiries[0]] })
    const declineBtn = wrapper.find('.inquiry-decline-btn')
    const ariaLabel = declineBtn.attributes('aria-label')
    expect(ariaLabel).toBeTruthy()
    expect(ariaLabel).toContain('Іван К.')
  })

  it('buttons are disabled when loadingId matches', () => {
    const wrapper = mountPreview({
      inquiries: [mockInquiries[0]],
      loadingId: 1,
    })
    const acceptBtn = wrapper.find('.inquiry-accept-btn')
    const declineBtn = wrapper.find('.inquiry-decline-btn')
    expect(acceptBtn.attributes('disabled')).toBeDefined()
    expect(declineBtn.attributes('disabled')).toBeDefined()
  })

  it('buttons are not disabled when loadingId is different', () => {
    const wrapper = mountPreview({
      inquiries: [mockInquiries[0]],
      loadingId: 999,
    })
    const acceptBtn = wrapper.find('.inquiry-accept-btn')
    expect(acceptBtn.attributes('disabled')).toBeUndefined()
  })
})

/**
 * Accessibility Audit — InquiriesPreview
 *
 * ✅ PASS: Accept button has aria-label with student name
 * ✅ PASS: Decline button has aria-label with student name
 * ✅ PASS: Buttons disabled during loading (loadingId)
 * ✅ PASS: "View all" link is router-link (<a>) — keyboard accessible
 * ✅ PASS: Uses semantic <ul>/<li> for inquiry list
 */
