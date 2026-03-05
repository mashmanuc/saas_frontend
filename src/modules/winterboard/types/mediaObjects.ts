/**
 * Phase 3C: Extended asset types for audio/video board objects.
 *
 * WBAsset.type is 'image' | 'sticky' in core types.
 * At runtime, board_dnd_service creates objects with type='audio_player'|'video_player'.
 * These interfaces extend WBAsset with media-specific fields.
 *
 * We do NOT modify WBAsset to respect the boardStore type contract.
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
