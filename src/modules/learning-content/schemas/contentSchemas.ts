export interface ProblemContent {
  statement: string
  hint?: string
  solution?: string
  answer?: string
  images?: string[]
}

export interface TheoryContent {
  body: string
  summary?: string
  examples?: unknown[]
}

export interface TestContent {
  question: string
  options: string[]
  correct_index: number
}

export interface VideoContent {
  url: string
  duration_sec?: number
  transcript?: string
}

export interface PresentationContent {
  slides: unknown[]
}

export interface LinkContent {
  url: string
  label: string
}

export function isProblem(content: unknown): content is ProblemContent {
  return typeof content === 'object' && content !== null && 'statement' in content
}

export function isTheory(content: unknown): content is TheoryContent {
  return typeof content === 'object' && content !== null && 'body' in content
}

export function isTest(content: unknown): content is TestContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'question' in content &&
    'options' in content
  )
}

export function isVideo(content: unknown): content is VideoContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'url' in content &&
    !('label' in content) &&
    !('slides' in content)
  )
}

export function isPresentation(content: unknown): content is PresentationContent {
  return typeof content === 'object' && content !== null && 'slides' in content
}

export function isLink(content: unknown): content is LinkContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'url' in content &&
    'label' in content
  )
}
