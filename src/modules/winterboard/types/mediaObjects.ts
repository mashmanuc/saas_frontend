/**
 * Phase 3C: Extended asset types for audio/video board objects.
 *
 * WBAsset.type now includes 'audio_player' | 'video_player'.
 * These interfaces narrow the type union with media-specific required fields.
 */
import type { WBAsset } from './winterboard'

export interface WBAudioAsset extends Omit<WBAsset, 'type'> {
  type: 'audio_player'
  title?: string
  duration?: number
  content_ref?: { content_id: number; content_version: number; content_type: string }
}

export interface WBVideoAsset extends Omit<WBAsset, 'type'> {
  type: 'video_player'
  title?: string
  duration?: number
  thumbnail?: string
  content_ref?: { content_id: number; content_version: number; content_type: string }
}

export type WBMediaAsset = WBAudioAsset | WBVideoAsset
