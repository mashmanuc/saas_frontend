/**
 * Чи тягне цей комп'ютер об'ємну карту (закон §9 v1.78): є WebGL і він не програмний «заглушковий». Ні — картка
 * показує ту саму пласку карту, що до v1.78. Відповідь одна на вкладку.
 */
let cached: boolean | null = null

export function webglSupported(): boolean {
  if (cached !== null) return cached
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null
    cached = !!gl && typeof gl.getParameter === 'function'
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
