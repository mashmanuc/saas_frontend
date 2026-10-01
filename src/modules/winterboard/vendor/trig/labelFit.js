// labelFit.js — підписи, яким бракує місця, ховаємо, а не тиснемо один на одного.
//
// Власник 2026-10-01: мала картка кола — каша з градусів, радіан і значень. Як
// роблять графіки (autoSkip у Chart.js, hideOverlap в ECharts) і карти: шрифт не
// зменшуємо, показуємо стільки підписів, скільки поміщається, — від найважливіших.
// Рішення залежить лише від розміру КАРТКИ (логічні пікселі полотна), тож на будь-
// якому масштабі дошки картка та сама.

/** Рамка тексту за вирівнюванням canvas (`textAlign`, `textBaseline`). */
export function textBox(x, y, width, height, align, baseline) {
  const left = align === 'left' || align === 'start'
    ? x
    : (align === 'right' || align === 'end' ? x - width : x - width / 2)
  const top = baseline === 'top' || baseline === 'hanging'
    ? y
    : (baseline === 'bottom' || baseline === 'alphabetic' || baseline === 'ideographic' ? y - height : y - height / 2)
  return { left, top, right: left + width, bottom: top + height }
}

/** Чи налазять рамки одна на одну (з проміжком `pad`). */
export function boxesOverlap(a, b, pad = 0) {
  return a.left < b.right + pad && b.left < a.right + pad && a.top < b.bottom + pad && b.top < a.bottom + pad
}

function anyOverlap(boxes, pad) {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i], boxes[j], pad)) return true
    }
  }
  return false
}

/**
 * Варіанти від найповнішого до найскупішого: перший, у якому жодні дві рамки не
 * налазять. Не помістився жоден — найскупіший (його й так показуємо).
 * @param {{ boxes: object[] }[]} variants
 */
export function firstFittingVariant(variants, pad = 0) {
  for (const v of variants) {
    if (!anyOverlap(v.boxes, pad)) return v
  }
  return variants[variants.length - 1]
}

/**
 * Групи рамок від найважливішої: беремо поспіль, доки чергова група не налізе сама на
 * себе чи на вже взяті. Перша група — завжди. Повертає, скільки груп узято.
 * @param {object[][]} groups
 */
export function fitLabelGroups(groups, pad = 0) {
  const taken = []
  let count = 0
  for (const group of groups) {
    const clash = count > 0 && (
      anyOverlap(group, pad) || group.some((b) => taken.some((t) => boxesOverlap(b, t, pad)))
    )
    if (clash) break
    taken.push(...group)
    count++
  }
  return count
}
