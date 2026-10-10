/**
 * «Дзеркало уроку» зі списку «Мої записи»: завантажити свій завершений запис тими самими запитами, що й
 * плеєр власника (сам запис — межі start_seq…end_seq; playback — start_state і ops), і добрати сторінки з
 * ≥ 2 фото-фонами тим самим `collectMirrorPhotoPages`. Лише читання; лише на дію вчителя (кнопка «Відео»).
 */
import { getReplay } from '../api/replayLifecycleApi'
import { fetchOwnerReplayPlayback } from '../api/replay'
import { collectMirrorPhotoPages } from './replayPhotoStates'
import type { MirrorPhotoPage } from '../engine/lessonMirror/types'

export async function loadReplayMirrorPages(replayId: string, signal?: AbortSignal): Promise<MirrorPhotoPage[]> {
  const [meta, timeline] = await Promise.all([getReplay(replayId), fetchOwnerReplayPlayback(replayId, signal)])
  return collectMirrorPhotoPages({
    start_state: timeline.start_state,
    operations: timeline.operations,
    start_seq: meta.start_seq,
    end_seq: meta.end_seq,
  })
}
