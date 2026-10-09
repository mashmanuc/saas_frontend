/**
 * «Дзеркало уроку» — спільні типи рушія переходів між фото-станами запису (ТЗ
 * `saas_docs/domains/winterboard/TZ_LESSON_MIRROR_VIDEO_PILOT_2026-10-09.md`, прототип і пороги —
 * `saas_docs/domains/winterboard/prototypes/lesson_mirror_engine/README.md`).
 *
 * Рушій лише читає вже збережені в записі фото й нічого не пише: ні операцій, ні файлів.
 */

/** Фото-фон сторінки запису після операції `seq` (початковий стан запису — `seq` = start_seq − 1). */
export interface MirrorPhotoState {
  seq: number
  url: string
}

/** Сторінка запису з послідовністю фото-фонів у межах start_seq…end_seq, у порядку `seq`. */
export interface MirrorPhotoPage {
  pageId: string
  /** Підпис для вибору («Сторінка 2») */
  label: string
  states: MirrorPhotoState[]
}

/**
 * Що сталося між двома сусідніми фото тієї самої сторінки:
 *  - `write` — з'явилась нова крейда (проявляємо написи в порядку читання);
 *  - `erase` — дошку стерли («губка» зліва направо), можливо з новими написами після;
 *  - `light_only` — змінилось лише світло: без кроку й без паузи (фото лишається в записі);
 *  - `snap` — сумнівний перехід (інша сцена, розміри, пікселі недоступні): точний наступний кадр.
 */
export type TransitionKind = 'write' | 'erase' | 'light_only' | 'snap'
