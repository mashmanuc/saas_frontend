/**
 * TLV2-06R · ГОТОВІ РЕЦЕПТИ ОБ'ЄКТІВ ДОШКИ — лише дані.
 *
 * Правило ревізії (`C_TLV2_06_ARCHITECTURE_REVIEW`, ТЗ 43): **один механізм — один
 * runtime-власник; варіант уроку = дані, не компонент.** Рецепт каже, ЯКИЙ чинний
 * об'єкт дошки створити і з ЯКИМИ даними. Власного рендерера, шаблона, кроків чи
 * залежності від рушія тут немає:
 *   • накладання трикутників → `visual_capsule` (V-D3.1, `capsuleRegistry`);
 *   • паралелограм           → `geometry_2d_v2`, preset `parallelogram`;
 *   • рівняння кола          → `graph_calculator`.
 *
 * Рецепти НЕ є інструментами: їх немає в `insertRegistry`/Tools. Їх резолвлять за id
 * згенерований урок та Інтегралик (`add_tool`) — той самий реєстр, той самий builder.
 * Інтегралик дізнається про supported-рецепти з прихованого AI-каталогу
 * (`preparedRecipesForAI` → `buildToolCatalog`), який UI не показує.
 *
 * TLV2-06R.1: асет будує КАНОНІЧНА factory цільового типу — та сама, що й drag/`+`
 * інструмента: `buildVisualCapsuleAsset`, `buildGeometry2DV2Asset`, `buildGraphCalculatorAsset`.
 * Тут лише дані, валідація, `gap` і мапінг на factory; конверта WBAsset немає.
 *
 * `gap` — конфігурація D-VM2, яку чинний власник не виражає своїми параметрами. Такий
 * рецепт картки не створює й повертає причину. Добудовувати runtime заради 6/6 заборонено.
 *
 * Джерело — D-VM2 `planimetry.geometry2d.configs.js` (sha256 `2c4d9a8b…`). Числа в
 * `targetData` виведені з його параметрів; тест звіряє їх із копією файла.
 */
import type { VisualCapsuleAssetData, WBAsset } from '../types/winterboard'
import type { GraphViewport } from '../types/graphCalculator'
import { buildGeometry2DV2Asset } from '../constants/geometry2dV2Defaults'
import { buildGraphCalculatorAsset } from '../constants/graphCalculatorDefaults'
import { buildVisualCapsuleAsset } from '../components/board/objects/visualCapsules/capsuleRegistry'
import { isParseValid } from '../utils/graphCalculatorUtils'

/** Payload `addAtPosition`: `{ "recipeId": "tpl.…" }`. Не drag-джерело полиці. */
export const BOARD_RECIPE_MIME = 'application/x-m4sh-board-recipe'

export const DVM2_CONFIGS_SHA256 = '2c4d9a8b20897c392f34ca1383e8a59621b92a243ce5de32f015fe56c7f56f5b'

export type BoardRecipeTargetType = 'visual_capsule' | 'geometry_2d_v2' | 'graph_calculator'

export interface BoardRecipeProvenance {
  readonly source: 'D-VM2'
  readonly sourceFile: 'planimetry.geometry2d.configs.js'
  readonly sourceHash: string
  /** `variants[].id` у файлі конфігурацій. */
  readonly variantId: string
  /** `visual_family_id` каталогу — довідка, не runtime. */
  readonly familyId: string
}

interface RecipeBase {
  /** Стабільний id D-VM2 (`tpl.*`) — його резолвлять урок та Інтегралик. */
  readonly id: string
  readonly needId: string
  /** Назва D-VM2 — для повідомлень і AI-каталогу, не для списку інструментів. */
  readonly title: string
  /**
   * Короткий опис матеріалу для AI-каталогу Інтегралика — зі слів D-VM2 (`subtitle`,
   * `source`) і, для капсули, з її власного тексту. Не показується в UI.
   */
  readonly description: string
  readonly targetType: BoardRecipeTargetType
  readonly provenance: BoardRecipeProvenance
}

/** Капсула: лише адреса й режим (дані `visual_capsule`). */
export interface CapsuleTargetData {
  readonly visual_id: string
  readonly capsule_version: number
  readonly mode: VisualCapsuleAssetData['mode']
}

/** Чинний preset Geometry2D + його штатні поля даних (точки й toggles). */
export interface Geometry2DTargetData {
  readonly preset: string
  readonly pointsSnapshot?: Readonly<Record<string, { x: number; y: number }>>
  readonly toggles?: Readonly<Record<string, boolean>>
}

/** Вирази й вікно Graph Calculator; id виразів видає builder. */
export interface GraphCalculatorTargetData {
  readonly expressions: ReadonlyArray<{ readonly src: string; readonly color: string }>
  readonly viewport: GraphViewport
}

export type BoardRecipeTargetData = CapsuleTargetData | Geometry2DTargetData | GraphCalculatorTargetData

export interface SupportedBoardRecipe extends RecipeBase {
  readonly status: 'supported'
  readonly targetData: BoardRecipeTargetData
  /** Що з конфігурації D-VM2 чинний об'єкт свідомо не відтворює (кроки, режими). */
  readonly limits: readonly string[]
}

export interface GapBoardRecipe extends RecipeBase {
  readonly status: 'gap'
  readonly gapReason: string
}

export type PreparedBoardRecipe = SupportedBoardRecipe | GapBoardRecipe

export type BoardRecipeErrorCode = 'unknown_recipe' | 'gap' | 'invalid_target_data'

/** Контрольована помилка рецепта: `code` — для логіки, `reason` — для видимого повідомлення. */
export class BoardRecipeError extends Error {
  readonly code: BoardRecipeErrorCode
  readonly recipeId: string
  readonly reason: string

  constructor(code: BoardRecipeErrorCode, recipeId: unknown, reason = '') {
    const id = typeof recipeId === 'string' ? recipeId : String(recipeId)
    super(`[board-recipe] ${code}: ${id}${reason ? ` — ${reason}` : ''}`)
    this.name = 'BoardRecipeError'
    this.code = code
    this.recipeId = id
    this.reason = reason
  }
}

const provenance = (variantId: string, familyId: string): BoardRecipeProvenance => ({
  source: 'D-VM2',
  sourceFile: 'planimetry.geometry2d.configs.js',
  sourceHash: DVM2_CONFIGS_SHA256,
  variantId,
  familyId,
})

const TRIANGLES_NEED = 'vn.triangles.correspondence'
const PARALLELOGRAM_NEED = 'vn.parallelogram-rhombus-trapezoid.parallelogram-sides-angles'
const CIRCLE_NEED = 'vn.plane-vectors-coordinates.circle-equation-locus'

const RECIPES: readonly PreparedBoardRecipe[] = [
  {
    id: 'tpl.g7-l16-abc-edf',
    needId: TRIANGLES_NEED,
    title: '△ABC = △EDF',
    description: 'накладання рівних трикутників ΔABC = ΔEDF: відповідні елементи',
    targetType: 'visual_capsule',
    status: 'supported',
    // Та сама пара: ΔABC = ΔEDF, DE = 5, EF = 6, DF = 7 см, B лягає на D.
    targetData: { visual_id: 'visual.triangles.congruence.overlay', capsule_version: 1, mode: 'full' },
    limits: [
      'Режиму assess капсула не має (лише full | recall).',
      'Кроки, прогноз і підписи — власні тексти капсули V-D3.1, а не формулювання D-VM2.',
    ],
    provenance: provenance('g7-l16-abc-edf', 'vf.rigid-overlay'),
  },
  {
    id: 'tpl.g7-l16-xyz-hkg',
    needId: TRIANGLES_NEED,
    title: '△XYZ = △HKG',
    description: 'накладання рівних трикутників ΔXYZ = ΔHKG: відповідні елементи',
    targetType: 'visual_capsule',
    status: 'gap',
    gapReason:
      'Капсула visual.triangles.congruence.overlay v1 має фіксовані букви ABC/EDF і сторони 5·6·7 '
      + '(trianglesOverlayGeometry.ts, тексти капсули); параметра варіанта немає. XYZ/HKG 9·11·13 не виражається без зміни капсули.',
    provenance: provenance('g7-l16-xyz-hkg', 'vf.rigid-overlay'),
  },
  {
    id: 'tpl.g8-l04-abcd',
    needId: PARALLELOGRAM_NEED,
    title: 'Паралелограм ABCD',
    description: 'паралелограм ABCD, сторони сталі · кут змінюється',
    targetType: 'geometry_2d_v2',
    status: 'supported',
    // AB = 5, AD = 3, ∠A = 58° (D-VM2 sideA / sideB / theta0); C = D + (B − A) рахує preset.
    targetData: {
      preset: 'parallelogram',
      pointsSnapshot: {
        A: { x: -2.5, y: -1.5 },
        B: { x: 2.5, y: -1.5 },
        D: { x: -0.910242, y: 1.044144 },
      },
      toggles: { angles: true },
    },
    limits: [
      'Кроки acute → predicting → flexing → right → obtuse → diagonal не програються: кут змінює вчитель, тягнучи D.',
      'Режимів recall/assess preset не має; висновки D-VM2 не показуються (діагоналі й висоти — штатні toggles).',
    ],
    provenance: provenance('g8-l04-abcd', 'vf.hinge-flex-quadrilateral'),
  },
  {
    id: 'tpl.g8-l04-klmn',
    needId: PARALLELOGRAM_NEED,
    title: 'Паралелограм KLMN',
    description: 'паралелограм KLMN, сторони сталі · кут змінюється',
    targetType: 'geometry_2d_v2',
    status: 'gap',
    gapReason:
      'Preset parallelogram має фіксовані підписи A, B, C, D; параметра букв немає. '
      + 'KLMN не виражається без зміни preset-а, а підставити ABCD означало б змінити зміст уроку.',
    provenance: provenance('g8-l04-klmn', 'vf.hinge-flex-quadrilateral'),
  },
  {
    id: 'tpl.g9-l27-c3-m2-r4',
    needId: CIRCLE_NEED,
    title: 'Коло (x − 3)² + (y + 2)² = 16',
    description: 'рівняння кола (x − 3)² + (y + 2)² = 16, центр (3; −2) · R = 4',
    targetType: 'graph_calculator',
    status: 'supported',
    // Центр (3; −2), R = 4; вікно — D-VM2 view [-3, -8, 10, 4] у картці 480×360.
    targetData: {
      expressions: [{ src: '(x - 3)^2 + (y + 2)^2 = 16', color: '#c4622a' }],
      viewport: { cx: 3.5, cy: -2, scale: 30 },
    },
    limits: [
      'Точки P/Q, обхід кола й пробні точки (sweeping, off_circle) не програються; рівняння й коло — так.',
      'Режиму assess Graph Calculator не має.',
    ],
    provenance: provenance('g9-l27-c3-m2-r4', 'vf.trace-locus'),
  },
  {
    id: 'tpl.g9-l27-cm2-5-r3',
    needId: CIRCLE_NEED,
    title: 'Коло (x + 2)² + (y − 5)² = 9',
    description: 'рівняння кола (x + 2)² + (y − 5)² = 9, центр (−2; 5) · R = 3',
    targetType: 'graph_calculator',
    status: 'supported',
    // Центр (−2; 5), R = 3; вікно — D-VM2 view [-7.5, -2, 5, 10] у картці 480×360.
    targetData: {
      expressions: [{ src: '(x + 2)^2 + (y - 5)^2 = 9', color: '#c4622a' }],
      viewport: { cx: -1.25, cy: 4, scale: 30 },
    },
    limits: [
      'Точки M/N, обхід кола й пробні точки (sweeping, off_circle) не програються; рівняння й коло — так.',
      'Режиму assess Graph Calculator не має.',
    ],
    provenance: provenance('g9-l27-cm2-5-r3', 'vf.trace-locus'),
  },
]

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v)
  }
  return value
}

export const PREPARED_BOARD_RECIPES: readonly PreparedBoardRecipe[] = deepFreeze(RECIPES)

const BY_ID: ReadonlyMap<string, PreparedBoardRecipe> = new Map(PREPARED_BOARD_RECIPES.map((r) => [r.id, r]))

/** Рецепт або `null` — без винятку. */
export function findBoardRecipe(id: unknown): PreparedBoardRecipe | null {
  return typeof id === 'string' ? BY_ID.get(id) ?? null : null
}

/**
 * ЄДИНИЙ builder рецепта: валідація + мапінг на КАНОНІЧНУ factory цільового типу
 * (центр — у точці `pos`). `gap` чи невідомий id — `BoardRecipeError`, жодної картки
 * й жодного fallback. На дошку асет кладе caller штатним `asset_add` (`useContentDrop`).
 */
export function buildBoardRecipeAsset(id: unknown, pos: { x: number; y: number }): WBAsset {
  const recipe = findBoardRecipe(id)
  if (!recipe) throw new BoardRecipeError('unknown_recipe', id)
  if (recipe.status === 'gap') throw new BoardRecipeError('gap', recipe.id, recipe.gapReason)

  if (recipe.targetType === 'visual_capsule') {
    const target = recipe.targetData as CapsuleTargetData
    try {
      return buildVisualCapsuleAsset(pos, target) as unknown as WBAsset
    } catch (err) {
      throw new BoardRecipeError('invalid_target_data', recipe.id, err instanceof Error ? err.message : String(err))
    }
  }

  if (recipe.targetType === 'geometry_2d_v2') {
    const target = recipe.targetData as Geometry2DTargetData
    return buildGeometry2DV2Asset(pos, target.preset, {
      pointsSnapshot: target.pointsSnapshot,
      toggles: target.toggles,
    }) as unknown as WBAsset
  }

  const target = recipe.targetData as GraphCalculatorTargetData
  const invalid = target.expressions.find((e) => !isParseValid(e.src))
  if (invalid) throw new BoardRecipeError('invalid_target_data', recipe.id, invalid.src)
  return buildGraphCalculatorAsset(pos, { expressions: target.expressions, viewport: target.viewport })
}

/** Як Інтегралик називає цільовий матеріал в описі (слова каталогу інструментів). */
const AI_TARGET_KIND: Readonly<Record<BoardRecipeTargetType, string>> = {
  visual_capsule: 'анімація',
  geometry_2d_v2: 'планіметрія 2D',
  graph_calculator: 'графік',
}

export interface BoardRecipeAIEntry {
  id: string
  label: string
  desc: string
}

/**
 * Прихований AI-каталог: ЛИШЕ supported-рецепти у форматі каталогу інструментів
 * (`buildToolCatalog`). `gap` моделі не передається. UI цього списку не читає.
 */
export function preparedRecipesForAI(): BoardRecipeAIEntry[] {
  return PREPARED_BOARD_RECIPES
    .filter((r): r is SupportedBoardRecipe => r.status === 'supported')
    .map((r) => ({
      id: r.id,
      label: r.title,
      desc: `[готовий матеріал · ${AI_TARGET_KIND[r.targetType]}] ${r.description}`,
    }))
}
