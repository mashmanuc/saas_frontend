/**
 * GeoMASH active-tool state — спільний між GeomashInspector (палітра-плитки)
 * та GeomashRenderer (кліки по полотну будують об'єкти).
 *
 * Stage B (2026-07-09): побудова кліком по полотну. Інспектор виставляє активний
 * інструмент + додаткові скаляри (радіус/сторони/вираз); рендерер ловить pointer,
 * hitTest-ить об'єкти під роль, і коли всі ролі заповнені — конструює через bridge.
 * NOT persisted, FE UI only.
 */
import { reactive } from 'vue'
import type { GeoToolSpecEntry } from '../../vendor/geomash'

export const geomashToolState = reactive<{
  /** Активний інструмент побудови (з toolSpec) — null коли selectMode. */
  activeEntry: GeoToolSpecEntry | null
  /** Режим вибору на полотні (стрілка): клік виділяє геооб'єкт, drag рухає вільну точку. */
  selectMode: boolean
  /** Виділений на полотні геооб'єкт (для кольору/видалення/перетягу). */
  selectedGeoId: string | null
  /** Заповнені ролі: role → obj id (кліки по полотну / селекти інспектора). */
  picks: Record<string, string>
  /** Буфер точок для multi-інструментів (polygon/polyline): клік додає, дабл-клік завершує. */
  poly: string[]
  /** Координати кліку для ролей, яким потрібна позиція (point-on). */
  pickCoords: Record<string, { wx: number; wy: number }>
  /** Додаткові скаляри з інспектора (радіус кола, к-ть сторін, параметри повзунка, вираз). */
  extra: { r: number; n: number; name: string; min: number; max: number; value: number; expr: string }
}>({
  activeEntry: null,
  selectMode: false,
  selectedGeoId: null,
  picks: {},
  poly: [],
  pickCoords: {},
  extra: { r: 1, n: 5, name: 'a', min: 0, max: 5, value: 1, expr: '' },
})

/** Обрати інструмент побудови (або зняти) → вимикає selectMode + скидає піки. */
export function setGeomashTool(entry: GeoToolSpecEntry | null): void {
  geomashToolState.activeEntry = entry
  geomashToolState.selectMode = false
  geomashToolState.picks = {}
  geomashToolState.poly = []
  geomashToolState.pickCoords = {}
}

/** Увімкнути режим вибору (стрілка) → знімає інструмент побудови. */
export function enterSelectMode(): void {
  geomashToolState.activeEntry = null
  geomashToolState.selectMode = true
  geomashToolState.picks = {}
  geomashToolState.poly = []
  geomashToolState.pickCoords = {}
}

/** Скинути все (Esc / зняли виділення). */
export function resetGeomashTool(): void {
  geomashToolState.activeEntry = null
  geomashToolState.selectMode = false
  geomashToolState.selectedGeoId = null
  geomashToolState.picks = {}
  geomashToolState.poly = []
  geomashToolState.pickCoords = {}
}

/** Скинути лише накопичені піки (після успішної побудови — інструмент лишається активним). */
export function clearGeomashPicks(): void {
  geomashToolState.picks = {}
  geomashToolState.poly = []
  geomashToolState.pickCoords = {}
}
