// WB: imageFit — aspect-preserving "contain" fit for page backgrounds (PDF/image).
// A PDF page rendered into the fixed board rect must never be stretched: scale it
// to fit WITHIN the box preserving aspect ratio, centered. For a portrait page on
// a landscape board this fits by height and leaves equal side margins.

export interface FitBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Scale an `imgW × imgH` image to fit inside a `boxW × boxH` rect preserving
 * aspect ratio, centered. Returns the destination rect.
 *
 * Degrades to filling the box when image dimensions are unknown (<= 0) — i.e.
 * before the image has loaded — matching the previous full-box behaviour.
 */
export function containFit(imgW: number, imgH: number, boxW: number, boxH: number): FitBox {
  if (imgW <= 0 || imgH <= 0 || boxW <= 0 || boxH <= 0) {
    return { x: 0, y: 0, width: boxW, height: boxH }
  }
  const scale = Math.min(boxW / imgW, boxH / imgH)
  const width = imgW * scale
  const height = imgH * scale
  return {
    x: (boxW - width) / 2,
    y: (boxH - height) / 2,
    width,
    height,
  }
}
