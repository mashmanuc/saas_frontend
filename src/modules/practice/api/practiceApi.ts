/**
 * Practice API — інтеграція з 4 backend-ендпоінтами (Ф1).
 * apiClient response-інтерсептор повертає res.data напряму → кастимо тип результату.
 */
import apiClient from '@/utils/apiClient'

export interface GameProfile {
  xp: number
  gems: number
  current_streak: number
  longest_streak: number
  last_practice_date: string | null
}

export interface PathNode {
  index: number
  problem_external_id: string
  status: 'done' | 'current' | 'locked'
}

export interface PathState {
  id: number
  topic: string
  diff_profile: string
  length: number
  current_index: number | null
  completed: boolean
  nodes: PathNode[]
}

export interface NextPuzzle {
  problem_external_id: string
  index: number
  total: number
  problem_type: 'single_choice' | 'open_answer' | 'matching'
  difficulty: number
  question: string
  payload: any
}

export interface UnlockedArtifact {
  id: string
  title: string
  preview: string
  studio?: string
  source: string
  world_title?: string  // #11: для celebration «Світ «...» пройдено»
}

export interface SubmitResult {
  correct: boolean
  solution: string
  xp_earned: number
  attempt_no: number
  unlocked?: UnlockedArtifact[]
  profile: Pick<GameProfile, 'xp' | 'gems' | 'current_streak' | 'longest_streak'>
  path?: { current_index: number | null; completed: boolean }
}

export interface SubmitBody {
  problem_external_id: string
  path_id: number
  answer: Record<string, any>
}

// ── F2 progression ──────────────────────────────────────────────────────────

export interface WorldTopic {
  slug: string
  completed: boolean
}

export interface ArtifactRef {
  id: string
  title: string
  studio?: string
  preview: string
}

export interface World {
  id: string
  title: string
  theme: string
  topics: WorldTopic[]
  completed_count: number
  total: number
  status: 'new' | 'active' | 'done'
  artifact: ArtifactRef | null
  artifact_unlocked: boolean
}

export interface CollectionArtifact {
  id: string
  title: string
  preview: string | null
  unlocked: boolean
  source: string | null
  unlocked_at: string | null
}

export interface Collection {
  artifacts: CollectionArtifact[]
  unlocked_count: number
  total_artifacts: number
}

// ── Topics (#2 — server-authoritative чузер) ─────────────────────────────────
export interface TopicItem {
  slug: string
  label: string
}
export interface TopicWorld {
  world_id: string
  world_title: string
  topics: TopicItem[]
}

export const practiceApi = {
  async getProfile(): Promise<GameProfile> {
    return (await apiClient.get('/v1/practice/profile/')) as unknown as GameProfile
  },
  async getTopics(): Promise<{ worlds: TopicWorld[] }> {
    return (await apiClient.get('/v1/practice/topics/')) as unknown as { worlds: TopicWorld[] }
  },
  async getPath(topic: string): Promise<PathState> {
    return (await apiClient.get('/v1/practice/path/', { params: { topic } })) as unknown as PathState
  },
  async getNext(topic: string): Promise<NextPuzzle> {
    return (await apiClient.get('/v1/practice/next/', { params: { topic } })) as unknown as NextPuzzle
  },
  async submit(body: SubmitBody): Promise<SubmitResult> {
    return (await apiClient.post('/v1/practice/submit/', body)) as unknown as SubmitResult
  },
  async getWorlds(): Promise<World[]> {
    return (await apiClient.get('/v1/practice/worlds/')) as unknown as World[]
  },
  async getCollection(): Promise<Collection> {
    return (await apiClient.get('/v1/practice/collection/')) as unknown as Collection
  },
}
