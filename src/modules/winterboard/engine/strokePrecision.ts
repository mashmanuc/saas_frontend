/**
 * Легші штрихи (власник 2026-10-17, «роби»): точки нового штриха зберігаються до сотих.
 *
 * Навіщо. Точка пера з планшета йшла як
 * `{"t":1792175481747,"x":97.77804461761923,"y":67.68753665846491,"pressure":0.1904296875}` —
 * 16 знаків після коми, яких ніхто не бачить. Важкі штрихи роздувають стан дошки, а сервер
 * копіює його цілком на кожну дію (`saas_docs/domains/winterboard/stabilization_2026-05-06/
 * BACKLOG_STATE_COMPACTION_DEF8.md`) і не дає зберегти урок понад 2 МБ.
 *
 * Чому якість та сама. Аркуш — 1920 точок завширшки, найбільше збільшення — ×5 (`zoomPan.ts`):
 * сота частка точки — це 0,05 пікселя екрана навіть на ньому. Сусідні точки й так не ближчі за
 * 1 точку (фільтр у `WBCanvas.handleMouseMove`). Натиск — до тисячних: товщина лінії
 * змінюється на соті частки пікселя, а рівне «0.5» (ознака миші, `hasPressureData` у
 * `WBCanvas.vue`) у пера випадково майже не з'явиться.
 *
 * Час точки `t` не чіпаємо: за ним відтворення малює штрих з тією самою швидкістю.
 * Формат op той самий — ті самі поля, коротші числа; сервер точок не розбирає.
 * Лише НОВІ штрихи: стан, що прийшов із сервера, не переписується (інакше локальна дошка
 * розійшлася б із серверною).
 */
import type { WBPoint } from '../types/winterboard'

export const POINT_DECIMALS = 2
export const PRESSURE_DECIMALS = 3

function roundTo(value: number, decimals: number): number {
  const k = 10 ** decimals
  return Math.round(value * k) / k
}

export function roundStrokePoint(point: WBPoint): WBPoint {
  const out: WBPoint = {
    ...point,
    x: roundTo(point.x, POINT_DECIMALS),
    y: roundTo(point.y, POINT_DECIMALS),
  }
  if (typeof point.pressure === 'number') out.pressure = roundTo(point.pressure, PRESSURE_DECIMALS)
  return out
}

export function roundStrokePoints(points: readonly WBPoint[]): WBPoint[] {
  return points.map(roundStrokePoint)
}
