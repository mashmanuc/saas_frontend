/**
 * PR-4 (Knowledge plan 2026-05-02) — folder breadcrumb pure-render tests.
 *
 * Hard contract:
 *   - Component renders `board.folder_path` AS-IS from backend.
 *   - No computation, no traversal, no fallback string-building.
 *   - Null folder_path → element absent (root sessions).
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WBBoardCard from '../components/boards/WBBoardCard.vue'
import WBBoardListItem from '../components/boards/WBBoardListItem.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string, opts?: Record<string, unknown>) => opts ? `${key}:${JSON.stringify(opts)}` : key }),
}))
vi.mock('@/composables/useSeasonalLogo', () => ({
  useSeasonalLogo: () => ({ logoSrc: 'logo.svg' }),
}))

function makeBoard(overrides: Partial<{ folder_path: string | null }> = {}) {
  return {
    id: 's1',
    name: 'Lesson 1',
    page_count: 3,
    thumbnail_url: null,
    rev: 1,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    has_lesson: false,
    lesson_info: null,
    folder: null,
    folder_path: null,
    ...overrides,
  }
}

describe('WBBoardCard — folder breadcrumb', () => {
  it('renders folder_path EXACTLY as received from backend', () => {
    const w = mount(WBBoardCard, {
      props: { board: makeBoard({ folder_path: 'Math/Algebra/Lesson 1' }) },
    })
    const path = w.find('.wb-board-card__path')
    expect(path.exists()).toBe(true)
    expect(path.text()).toBe('Math/Algebra/Lesson 1')
  })

  it('omits breadcrumb when folder_path is null (root session)', () => {
    const w = mount(WBBoardCard, {
      props: { board: makeBoard({ folder_path: null }) },
    })
    expect(w.find('.wb-board-card__path').exists()).toBe(false)
  })

  it('uses native title attribute for full-path tooltip on hover', () => {
    const w = mount(WBBoardCard, {
      props: { board: makeBoard({ folder_path: 'A/B/C/D/E' }) },
    })
    const path = w.find('.wb-board-card__path')
    expect(path.attributes('title')).toBe('A/B/C/D/E')
  })

  it('does NOT split or truncate folder_path in JS — value preserved verbatim', () => {
    const long = 'Very Long Folder Name That Should Truncate via CSS / Sub / Lesson 99'
    const w = mount(WBBoardCard, {
      props: { board: makeBoard({ folder_path: long }) },
    })
    const path = w.find('.wb-board-card__path')
    // Pure render — full text in DOM, CSS handles overflow
    expect(path.text()).toBe(long)
    expect(path.attributes('title')).toBe(long)
  })
})

describe('WBBoardListItem — folder breadcrumb', () => {
  it('renders folder_path inline у meta line', () => {
    const w = mount(WBBoardListItem, {
      props: { board: makeBoard({ folder_path: 'Math/Algebra' }) },
    })
    const path = w.find('.wb-board-list-item__path')
    expect(path.exists()).toBe(true)
    expect(path.text()).toBe('Math/Algebra')
    expect(path.attributes('title')).toBe('Math/Algebra')
  })

  it('omits breadcrumb for root session', () => {
    const w = mount(WBBoardListItem, {
      props: { board: makeBoard({ folder_path: null }) },
    })
    expect(w.find('.wb-board-list-item__path').exists()).toBe(false)
  })

  it('omits leading separator dot when folder_path is null (PR-4 micro-fix)', () => {
    // Regression guard: meta line MUST start with pageCount, not "· pageCount".
    // Both breadcrumb AND its trailing separator share the same v-if.
    const w = mount(WBBoardListItem, {
      props: { board: makeBoard({ folder_path: null }) },
    })
    const meta = w.find('.wb-board-list-item__meta').text()
    expect(meta.trimStart().startsWith('·')).toBe(false)
  })
})
