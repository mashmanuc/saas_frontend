/**
 * Exam (Assessment) API — Solo-режим НМТ-симулятора. Phase 1.
 * apiClient response-інтерсептор повертає res.data напряму → кастимо тип.
 * Backend: /api/v1/assessment/ (gate FEATURE_ASSESSMENT). Ref: ASSESSMENT_SSOT §5.
 */
import apiClient from '@/utils/apiClient'

export type ProblemType = 'single_choice' | 'open_answer' | 'matching'

export interface PublicProblem {
  external_id: string
  problem_type: ProblemType
  text: string
  content: {
    choices?: Array<{ label: string; text: string }>
    answer_type?: string
    left_items?: Array<{ id: string; text: string }>
    right_items?: Array<{ id: string; text: string }>
  }
}

export interface RunSection {
  section_order: number
  name: string
  subject: string
  time_limit_sec: number | null
  items: PublicProblem[]
}

export interface RunState {
  id: string
  mode: string
  status: 'in_progress' | 'finished' | 'expired' | 'not_started'
  blueprint_title: string
  started_at: string | null
  deadline_at: string | null
  remaining_sec: number | null
  answers: Record<string, Record<string, any>> // ext → submitted_answer (БЕЗ is_correct)
  sections?: RunSection[]
}

export interface ReviewItem {
  external_id: string
  is_correct: boolean
  answered: boolean
  solution: string
}

export interface SectionResult {
  section_order: number
  subject: string
  subject_label: string
  raw_score: number
  max_score: number
  rating: number | null
  topic_stats: Record<string, { correct: number; total: number }>
}

export interface RunResult {
  run_id: string
  status: string
  test_score: number
  max_score: number
  rating: number | null
  rating_calibrated: boolean
  duration_sec: number | null
  sections: SectionResult[]
  review: ReviewItem[]
}

export interface BlueprintSummary {
  id: string
  type: string
  title: string
  language: string
  status: string
  version: number
  sections: Array<{
    order: number
    name: string
    subject: string
    time_limit_sec: number | null
    scoring_policy: string
  }>
}

export const examApi = {
  async listBlueprints(scope?: 'available'): Promise<{ blueprints: BlueprintSummary[] }> {
    return (await apiClient.get('/v1/assessment/blueprints/', {
      params: scope ? { scope } : {},
    })) as unknown as { blueprints: BlueprintSummary[] }
  },
  async getTopics(): Promise<{ topics: Array<{ slug: string; label: string }>; diff_profiles: string[] }> {
    return (await apiClient.get('/v1/assessment/topics/')) as unknown as {
      topics: Array<{ slug: string; label: string }>
      diff_profiles: string[]
    }
  },
  async createBlueprint(payload: {
    type: string
    title: string
    sections: Array<{
      order: number
      name: string
      subject?: string
      time_limit_sec?: number | null
      scoring_policy?: string
      selection: Record<string, any>
    }>
  }): Promise<BlueprintSummary> {
    return (await apiClient.post('/v1/assessment/blueprints/', payload)) as unknown as BlueprintSummary
  },
  async publishBlueprint(id: string): Promise<BlueprintSummary> {
    return (await apiClient.post(
      `/v1/assessment/blueprints/${id}/publish/`,
      {},
    )) as unknown as BlueprintSummary
  },
  async startRun(blueprintId: string, timeLimitSec?: number | null): Promise<RunState> {
    const body: Record<string, any> = { blueprint_id: blueprintId }
    if (timeLimitSec != null) body.time_limit_sec = timeLimitSec
    return (await apiClient.post('/v1/assessment/runs/', body)) as unknown as RunState
  },
  async getRun(runId: string): Promise<RunState> {
    return (await apiClient.get(`/v1/assessment/runs/${runId}/`)) as unknown as RunState
  },
  async saveAnswer(
    runId: string,
    problemExternalId: string,
    answer: Record<string, any>,
  ): Promise<{ saved: boolean; problem_external_id: string }> {
    return (await apiClient.post(`/v1/assessment/runs/${runId}/answer/`, {
      problem_external_id: problemExternalId,
      answer,
    })) as unknown as { saved: boolean; problem_external_id: string }
  },
  async finishRun(runId: string): Promise<RunResult> {
    return (await apiClient.post(
      `/v1/assessment/runs/${runId}/finish/`,
      {},
    )) as unknown as RunResult
  },
  async getResult(runId: string): Promise<RunResult> {
    return (await apiClient.get(`/v1/assessment/runs/${runId}/result/`)) as unknown as RunResult
  },
}
