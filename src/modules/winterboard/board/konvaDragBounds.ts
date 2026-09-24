/**
 * Жива межа перетягування Konva-вузлів (власник 2026-09-24: «не вилазили за
 * лівий і верхній край»). Konva кличе її на кожен рух із запропонованою
 * абсолютною позицією вузла; рахуємо, де опиниться його рамка в координатах
 * аркуша (шар = аркуш), і не пускаємо лівіше x=0 та вище y=0.
 *
 * Одна функція на ВСІ перетягувані вузли: ті, що будує WBCanvas (картки,
 * картинки, штрихи), і ті, що мають власний компонент (документ PDF/DOCX,
 * стікер) — інакше документ під час руху заїжджав за край (скрін власника 09-24).
 * Кінець руху ще раз клемпить стор (board/pageBounds.ts).
 */
import type Konva from 'konva'

export function keepInsideTopLeft(this: Konva.Node, pos: Konva.Vector2d): Konva.Vector2d {
  const layer = this.getLayer()
  if (!layer) return pos
  const cur = this.absolutePosition()
  const scale = layer.getAbsoluteScale().x || 1
  const rect = this.getClientRect({ relativeTo: layer, skipShadow: true, skipStroke: true })
  const nx = rect.x + (pos.x - cur.x) / scale
  const ny = rect.y + (pos.y - cur.y) / scale
  return {
    x: nx < 0 ? pos.x - nx * scale : pos.x,
    y: ny < 0 ? pos.y - ny * scale : pos.y,
  }
}
