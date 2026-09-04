import { describe, expect, it } from 'vitest'
import {
  EN_GUIDE_NAVIGATION,
  describeEnGuideRoute,
  explainEnGuideCapabilities,
} from './enGuideCatalog'

describe('English Guide route catalog', () => {
  it('describes known routes without asking a model', () => {
    expect(describeEnGuideRoute({ name: 'MyLessons', path: '/knowledge/my-lessons' }))
      .toBe('You are in My Lessons. This is where your saved lessons are listed.')
  })

  it('uses the literal path for an unknown route instead of inventing a section', () => {
    expect(describeEnGuideRoute({ name: 'tutor-inquiries', path: '/tutor/inquiries' }))
      .toBe('You are on /tutor/inquiries. This section is not yet described in English Guide.')
  })

  it('offers only fixed router destinations', () => {
    expect(EN_GUIDE_NAVIGATION.map((item) => item.routeName)).toEqual([
      'winterboard-boards', 'MyLessons', 'winterboard-library', 'help',
    ])
  })

  it('states the guide boundary in a deterministic answer', () => {
    expect(explainEnGuideCapabilities({ name: 'help' })).toContain('cannot create, change, save, publish, or generate')
  })
})
