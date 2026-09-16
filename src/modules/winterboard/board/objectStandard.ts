/**
 * TLV2-05A · СТАНДАРТ ОБ'ЄКТІВ ДОШКИ — одне джерело правди про можливості типу.
 *
 * ЧОМУ ЦЕЙ ФАЙЛ ІСНУЄ
 *
 * До нього «що вміє цей тип» було розкидано по чотирьох місцях:
 *   • `WBCanvas.KONVA_PROXY_TYPES` — чи є невидимий Konva-проксі (drag/resize/select);
 *   • `overlayRegistry.expandable` — чи є board-expand;
 *   • `WBCanvas.isResizableMedia` — чи має медіа ручки розміру;
 *   • сам рендерер — які кнопки він малює.
 * Тип можна було додати в один список і забути про решту. Саме так сталося з
 * `visual_capsule` (TLV2-03): у реєстрі overlay він був, у решті контракту — ні,
 * тому картку не можна було ні рухати, ні масштабувати (відгук власника 2026-09-16).
 *
 * ПРАВИЛА
 *   1. Тип лише ДЕКЛАРУЄ можливості. Обробники, панель і кнопки не дублюються по компонентах.
 *   2. Немає можливості → немає ні кнопки, ні дії.
 *   3. Невідомий тип — fail-closed: жодної можливості (`NO_CAPABILITIES`).
 *   4. Примітиви (штрихи) НЕ отримують карткових дій автоматично: у них власна таблиця.
 *
 * ⚠️ Ця таблиця описує ЧИННУ поведінку, а не бажану. Міняти значення = міняти
 * поведінку дошки, і це видно в тестах (`__tests__/boardObjectStandard.spec.ts`),
 * які звіряють похідні списки з тим, що було до реєстру.
 */

/** Картка — об'єкт-вікно з власною рамкою й прямокутною областю. Примітив — елемент малювання. */
export type BoardObjectKind = 'card' | 'primitive'

/** Яким шляхом тип потрапляє на полотно (визначає, звідки беруться drag/resize). */
export type BoardRenderPath =
  /** HTML-оверлей + невидимий Konva-проксі під ним (`KONVA_PROXY_TYPES`). */
  | 'overlay'
  /** Нативний Konva-вузол у шарі асетів (image, sticky, document_viewer). */
  | 'konva'
  /** HTML-оверлей медіа з власним drag у `WBCanvas` (audio/video/youtube). */
  | 'media'

export interface BoardObjectCapabilities {
  /** Переміщення мишею/пером. */
  movable: boolean
  /** Зміна розміру (Konva Transformer або власні ручки медіа). */
  resizable: boolean
  /** Board-expand на всю дошку (`expandedAssetId`, кнопка ⛶ у шапці картки). */
  fullscreen: boolean
  /** Дублювання (копіювати+вставити з панелі виділення). */
  duplicable: boolean
  /** Видалення (× на картці, кошик у панелі, Delete). */
  deletable: boolean
  /** Блокування (🔒 панелі виділення, `asset.locked`). */
  lockable: boolean
  /** Зміна шару (на передній/задній план, порядок у `page.assets[]`). */
  layerable: boolean
  /** Згортання в нижній трей — вмикається у TLV2-05B; поки в жодного типу немає. */
  minimizable: boolean
}

export interface BoardObjectStandardEntry {
  kind: BoardObjectKind
  render: BoardRenderPath
  capabilities: BoardObjectCapabilities
}

/** Невідомий тип: fail-closed. Жодної дії, жодної кнопки. */
export const NO_CAPABILITIES: BoardObjectCapabilities = Object.freeze({
  movable: false,
  resizable: false,
  fullscreen: false,
  duplicable: false,
  deletable: false,
  lockable: false,
  layerable: false,
  minimizable: false,
})

function caps(patch: Partial<BoardObjectCapabilities>): BoardObjectCapabilities {
  return Object.freeze({ ...NO_CAPABILITIES, ...patch })
}

/**
 * Повний набір картки: рухається, масштабується, дублюється, видаляється,
 * блокується, змінює шар. `fullscreen` — окремо, бо його має не кожна картка.
 */
const CARD_BASE: Partial<BoardObjectCapabilities> = {
  movable: true,
  resizable: true,
  duplicable: true,
  deletable: true,
  lockable: true,
  layerable: true,
}

function card(render: BoardRenderPath, patch: Partial<BoardObjectCapabilities> = {}): BoardObjectStandardEntry {
  return Object.freeze({ kind: 'card', render, capabilities: caps({ ...CARD_BASE, ...patch }) })
}

/**
 * Усі 22 типи `WBAsset['type']` (`types/winterboard.ts:196-239`).
 *
 * `fullscreen: true` — це ті самі типи, що мали `expandable: true` в
 * `overlayRegistry` до TLV2-05A, плюс `visual_capsule` (ТЗ TLV2-05A §3).
 */
export const BOARD_ASSET_STANDARD: Readonly<Record<string, BoardObjectStandardEntry>> = Object.freeze({
  // ── HTML-оверлеї з Konva-проксі ───────────────────────────────────────────
  geometry_solid: card('overlay'),
  graph_calculator: card('overlay', { fullscreen: true }),
  geometry_2d_v2: card('overlay'),
  calculus_card: card('overlay'),
  quadratic_card: card('overlay'),
  formula_card: card('overlay'),
  trig_circle: card('overlay', { fullscreen: true }),
  helix: card('overlay', { fullscreen: true }),
  trig_solver: card('overlay'),
  nmt3d: card('overlay', { fullscreen: true }),
  nmt_task: card('overlay', { fullscreen: true }),
  theory_card: card('overlay'),
  mash_scene: card('overlay'),
  geomash_scene: card('overlay', { fullscreen: true }),
  graphmash_3d: card('overlay', { fullscreen: true }),
  // TLV2-05A: капсула — така сама картка, як решта; власної механіки не має.
  visual_capsule: card('overlay', { fullscreen: true }),

  // ── Нативні Konva-вузли ───────────────────────────────────────────────────
  image: card('konva'),
  sticky: card('konva'),
  // Повноекранний перегляд презентації — заглушка (`WBSoloRoom.presentation-expand`),
  // тому `fullscreen: false`: кнопки без дії стандарт не дозволяє.
  document_viewer: card('konva'),

  // ── Медіа-оверлеї з власним drag ──────────────────────────────────────────
  // Аудіо не має ручок розміру (`WBCanvas.isResizableMedia` — лише video/youtube).
  audio_player: card('media', { resizable: false }),
  video_player: card('media'),
  youtube_player: card('media'),
})

/**
 * Примітиви — це НЕ асети, а `WBStroke` з `tool`. Карткових дій вони не
 * успадковують; тут лише те, що вони фактично вміють сьогодні.
 * `resizable` має лише текст (ручка ширини, `handleTextTransformEnd`).
 */
export const BOARD_PRIMITIVE_STANDARD: Readonly<Record<string, BoardObjectStandardEntry>> = Object.freeze({
  pen: primitive(),
  highlighter: primitive(),
  line: primitive(),
  rectangle: primitive(),
  circle: primitive(),
  text: primitive({ resizable: true }),
})

function primitive(patch: Partial<BoardObjectCapabilities> = {}): BoardObjectStandardEntry {
  return Object.freeze({
    kind: 'primitive',
    render: 'konva',
    capabilities: caps({
      movable: true,
      duplicable: true,
      deletable: true,
      lockable: true,
      layerable: true,
      ...patch,
    }),
  })
}

/** Запис стандарту для типу асета; невідомий тип — `null`. */
export function assetStandard(type: string | undefined | null): BoardObjectStandardEntry | null {
  if (!type) return null
  return BOARD_ASSET_STANDARD[type] ?? null
}

/** Можливості типу асета. Невідомий тип — fail-closed. */
export function assetCapabilities(type: string | undefined | null): BoardObjectCapabilities {
  return assetStandard(type)?.capabilities ?? NO_CAPABILITIES
}

/** Можливості примітива за `tool`. Невідомий інструмент — fail-closed. */
export function primitiveCapabilities(tool: string | undefined | null): BoardObjectCapabilities {
  if (!tool) return NO_CAPABILITIES
  return BOARD_PRIMITIVE_STANDARD[tool]?.capabilities ?? NO_CAPABILITIES
}

/** Чи це картковий об'єкт (об'єкт-вікно), а не примітив і не невідомий тип. */
export function isCardAsset(type: string | undefined | null): boolean {
  return assetStandard(type)?.kind === 'card'
}

/** Чи має тип board-expand. Джерело для `overlayRegistry.expandable`. */
export function isFullscreenAsset(type: string | undefined | null): boolean {
  return assetCapabilities(type).fullscreen
}

/** Чи має тип ручки зміни розміру медіа (`WBCanvas.isResizableMedia`). */
export function isResizableMediaAsset(type: string | undefined | null): boolean {
  const entry = assetStandard(type)
  return entry?.render === 'media' && entry.capabilities.resizable
}

/**
 * Типи, що рендеряться HTML-оверлеєм поверх невидимого Konva-проксі.
 * Джерело для `WBCanvas.KONVA_PROXY_TYPES`: проксі = і drag, і resize, і select.
 */
export const OVERLAY_PROXY_TYPES: ReadonlySet<string> = Object.freeze(
  new Set(
    Object.entries(BOARD_ASSET_STANDARD)
      .filter(([, entry]) => entry.render === 'overlay' && entry.capabilities.movable && entry.capabilities.resizable)
      .map(([type]) => type),
  ),
) as ReadonlySet<string>

/** Усі типи асетів зі стандарту (для тестів і звірок). */
export const STANDARD_ASSET_TYPES: readonly string[] = Object.freeze(Object.keys(BOARD_ASSET_STANDARD))
