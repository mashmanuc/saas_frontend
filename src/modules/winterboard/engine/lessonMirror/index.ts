/**
 * «Дзеркало уроку» — рушій переходів між фото-станами запису (ТЗ TZ_LESSON_MIRROR_VIDEO_PILOT_2026-10-09).
 * Один аналіз пари обслуговує плеєр, передперегляд і експорт.
 */
export type { MirrorPhotoPage, MirrorPhotoState, TransitionKind } from './types'
export { analyzePair, MIRROR_ENGINE, type PairAnalysis, type PairReason } from './analyze'
export { planTransition, drawTransition, disposeTransition, type TransitionPlan } from './transition'
export { analyzeRange, clipExportSupport, exportClip, loadImage, CLIP, type ClipAnalysis, type ClipStep } from './exportClip'
export { buildMp4, type Mp4Input, type Mp4Sample } from './mp4'
