/**
 * insertIcons — спільне ДЖЕРЕЛО SVG-іконок вставних елементів (BoardMASH Фаза 2).
 *
 * Раніше кожен трей визначав свій FunctionalComponent-іконок локально (TemplateIcon,
 * PresetIcon, ModeIcon). Тепер один `InsertIcon` малює їх по (family, iconKey) → і трей,
 * і плитки пошуку (InsertResultTile), і майбутня палітра показують ТІ САМІ іконки.
 *
 * Іконки чисті (лише key→SVG, без стану/i18n) — тому витяг = байт-ідентичний рендер.
 * Ітеративні родини (stereo/planimetry/analysis) перенесені ТОЧНО з трейв → трей
 * рефакторяться на <InsertIcon>. Синглтони (quadratic/trig) мають репрезентативні
 * іконки для плиток; їхні трей поки лишаються з власними (поступова міграція).
 */
import { h, type FunctionalComponent, type VNode } from 'vue'

const CUR = 'currentColor'

// ── stereo (nmt3d, 18×18, sw 1.5) — ТОЧНА копія Nmt3dTray.TemplateIcon ──────────
function stereoIcon(key: string): VNode {
  const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: CUR, 'stroke-width': '1.5', 'stroke-linejoin': 'round' }
  switch (key) {
    case 'cube':
      return h('svg', base, [
        h('polygon', { points: '12,3 21,7.5 12,12 3,7.5' }),
        h('polygon', { points: '3,7.5 12,12 12,21 3,16.5' }),
        h('polygon', { points: '12,12 21,7.5 21,16.5 12,21' }),
      ])
    case 'cuboid':
      return h('svg', base, [
        h('polygon', { points: '12,5 22,8.5 12,12 2,8.5' }),
        h('polygon', { points: '2,8.5 12,12 12,21 2,17.5' }),
        h('polygon', { points: '12,12 22,8.5 22,17.5 12,21' }),
      ])
    case 'prism4':
      return h('svg', base, [
        h('polygon', { points: '5,17 17,17 21,12 9,12' }),
        h('polygon', { points: '5,7 17,7 21,2 9,2' }),
        h('line', { x1: 5, y1: 7, x2: 5, y2: 17 }),
        h('line', { x1: 17, y1: 7, x2: 17, y2: 17 }),
        h('line', { x1: 21, y1: 2, x2: 21, y2: 12 }),
        h('line', { x1: 9, y1: 2, x2: 9, y2: 12, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'prism6':
      return h('svg', base, [
        h('polygon', { points: '8,19 16,19 20,16 20,12 16,9 8,9 4,12 4,16' }),
        h('polygon', { points: '8,10 16,10 20,7 20,3 16,0 8,0 4,3 4,7', opacity: '0' }),
        h('line', { x1: 8, y1: 9, x2: 8, y2: 19 }),
        h('line', { x1: 16, y1: 9, x2: 16, y2: 19 }),
        h('line', { x1: 20, y1: 7, x2: 20, y2: 12 }),
        h('line', { x1: 4, y1: 7, x2: 4, y2: 12, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'obliquePrism4':
      return h('svg', base, [
        h('polygon', { points: '3,19 15,19 18,14 6,14' }),
        h('polygon', { points: '9,7 21,7 18,2 6,2' }),
        h('line', { x1: 3, y1: 19, x2: 9, y2: 7 }),
        h('line', { x1: 15, y1: 19, x2: 21, y2: 7 }),
        h('line', { x1: 18, y1: 14, x2: 18, y2: 2 }),
        h('line', { x1: 6, y1: 14, x2: 6, y2: 2, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'pyramid4':
      return h('svg', base, [
        h('line', { x1: 12, y1: 3, x2: 4, y2: 14 }),
        h('line', { x1: 12, y1: 3, x2: 20, y2: 14 }),
        h('line', { x1: 12, y1: 3, x2: 4, y2: 21 }),
        h('line', { x1: 12, y1: 3, x2: 20, y2: 21 }),
        h('line', { x1: 4, y1: 14, x2: 20, y2: 14 }),
        h('line', { x1: 4, y1: 14, x2: 4, y2: 21 }),
        h('line', { x1: 20, y1: 14, x2: 20, y2: 21 }),
        h('line', { x1: 4, y1: 21, x2: 20, y2: 21 }),
      ])
    case 'pyramid3':
      return h('svg', base, [
        h('line', { x1: 12, y1: 3, x2: 5, y2: 18 }),
        h('line', { x1: 12, y1: 3, x2: 19, y2: 18 }),
        h('line', { x1: 12, y1: 3, x2: 12, y2: 21 }),
        h('line', { x1: 5, y1: 18, x2: 19, y2: 18 }),
        h('line', { x1: 5, y1: 18, x2: 12, y2: 21 }),
        h('line', { x1: 19, y1: 18, x2: 12, y2: 21 }),
      ])
    case 'pyramid6':
      return h('svg', base, [
        h('polygon', { points: '12,4 20,9 20,15 12,20 4,15 4,9' }),
        h('line', { x1: 12, y1: 1, x2: 4, y2: 9 }),
        h('line', { x1: 12, y1: 1, x2: 12, y2: 4 }),
        h('line', { x1: 12, y1: 1, x2: 20, y2: 9 }),
        h('line', { x1: 12, y1: 1, x2: 20, y2: 15 }),
        h('line', { x1: 12, y1: 1, x2: 12, y2: 20 }),
        h('line', { x1: 12, y1: 1, x2: 4, y2: 15 }),
      ])
    case 'tetrahedron':
      return h('svg', base, [
        h('polygon', { points: '12,3 21,19 3,19' }),
        h('line', { x1: 3, y1: 19, x2: 15.5, y2: 11, 'stroke-dasharray': '2 1.5' }),
        h('line', { x1: 21, y1: 19, x2: 15.5, y2: 11 }),
        h('line', { x1: 12, y1: 3, x2: 15.5, y2: 11 }),
      ])
    case 'trapPyramid':
      return h('svg', base, [
        h('line', { x1: 12, y1: 3, x2: 3, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 21, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 8, y2: 13 }),
        h('line', { x1: 12, y1: 3, x2: 16, y2: 13 }),
        h('line', { x1: 3, y1: 19, x2: 21, y2: 19 }),
        h('line', { x1: 8, y1: 13, x2: 16, y2: 13, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'frustumPyramid4':
      return h('svg', base, [
        h('polygon', { points: '3,20 21,20 18,14 6,14' }),
        h('polygon', { points: '7,8 17,8 15,4 9,4' }),
        h('line', { x1: 3, y1: 20, x2: 7, y2: 8 }),
        h('line', { x1: 21, y1: 20, x2: 17, y2: 8 }),
        h('line', { x1: 18, y1: 14, x2: 15, y2: 4 }),
        h('line', { x1: 6, y1: 14, x2: 9, y2: 4, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'cylinder':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 6, rx: 8, ry: 2.5 }),
        h('line', { x1: 4, y1: 6, x2: 4, y2: 18 }),
        h('line', { x1: 20, y1: 6, x2: 20, y2: 18 }),
        h('ellipse', { cx: 12, cy: 18, rx: 8, ry: 2.5 }),
      ])
    case 'cone':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 19, rx: 9, ry: 2.5 }),
        h('line', { x1: 12, y1: 3, x2: 3, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 21, y2: 19 }),
      ])
    case 'frustumCone':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 19, rx: 9, ry: 2.5 }),
        h('ellipse', { cx: 12, cy: 7, rx: 5, ry: 1.5 }),
        h('line', { x1: 7, y1: 7, x2: 3, y2: 19 }),
        h('line', { x1: 17, y1: 7, x2: 21, y2: 19 }),
      ])
    case 'sphere':
      return h('svg', base, [
        h('circle', { cx: 12, cy: 12, r: 9 }),
        h('ellipse', { cx: 12, cy: 12, rx: 9, ry: 3.5, 'stroke-dasharray': '3 2' }),
      ])
    case 'cubeInscribedSphere':
      return h('svg', base, [
        h('polygon', { points: '12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5' }),
        h('circle', { cx: 12, cy: 12, r: 5, stroke: '#3b7b9b' }),
      ])
    case 'cubeCircumSphere':
      return h('svg', base, [
        h('circle', { cx: 12, cy: 12, r: 9, stroke: '#3b7b9b' }),
        h('polygon', { points: '8,7 16,7 19,12 16,17 8,17 5,12' }),
      ])
    case 'cylinderInscribedSphere':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 5, rx: 7, ry: 2 }),
        h('line', { x1: 5, y1: 5, x2: 5, y2: 19 }),
        h('line', { x1: 19, y1: 5, x2: 19, y2: 19 }),
        h('ellipse', { cx: 12, cy: 19, rx: 7, ry: 2 }),
        h('circle', { cx: 12, cy: 12, r: 7, stroke: '#3b7b9b' }),
      ])
    case 'sphereInscribedCone':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 19, rx: 9, ry: 2.5 }),
        h('line', { x1: 12, y1: 3, x2: 3, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 21, y2: 19 }),
        h('circle', { cx: 12, cy: 14, r: 5, stroke: '#3b7b9b' }),
      ])
    case 'coneInscribedCylinder':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 19, rx: 9, ry: 2.5 }),
        h('line', { x1: 12, y1: 3, x2: 3, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 21, y2: 19 }),
        h('ellipse', { cx: 12, cy: 12, rx: 5, ry: 1.5, stroke: '#3b7b9b' }),
        h('line', { x1: 7, y1: 12, x2: 7, y2: 19, stroke: '#3b7b9b' }),
        h('line', { x1: 17, y1: 12, x2: 17, y2: 19, stroke: '#3b7b9b' }),
      ])
    case 'cubeSection3':
      return h('svg', base, [
        h('polygon', { points: '12,3 21,7.5 12,12 3,7.5' }),
        h('polygon', { points: '3,7.5 12,12 12,21 3,16.5' }),
        h('polygon', { points: '12,12 21,7.5 21,16.5 12,21' }),
        h('polygon', { points: '5,10 18,5 18,15 9,19', fill: '#c4622a', 'fill-opacity': '0.25', stroke: '#c4622a' }),
      ])
    default:
      return h('svg', base, [h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 })])
  }
}

// ── planimetry (geo2d, 18×18, sw 1.6) — ТОЧНА копія Geometry2DTray.PresetIcon ────
function geoIcon(key: string): VNode {
  const b = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: CUR, 'stroke-width': '1.6' }
  switch (key) {
    case 'triangle':
      return h('svg', b, [h('polygon', { points: '12,4 4,20 20,20' })])
    case 'circle':
      return h('svg', b, [h('circle', { cx: 12, cy: 12, r: 8 })])
    case 'polygon':
      return h('svg', b, [h('polygon', { points: '6,5 19,8 18,19 5,16' })])
    case 'pythagoras':
      return h('svg', b, [
        h('polygon', { points: '4,20 4,8 16,20' }),
        h('rect', { x: 1, y: 8, width: 3, height: 3 }),
        h('rect', { x: 16, y: 20, width: 3, height: 3 }),
      ])
    case 'thales':
      return h('svg', b, [
        h('line', { x1: 3, y1: 6, x2: 21, y2: 6 }),
        h('line', { x1: 3, y1: 12, x2: 21, y2: 12 }),
        h('line', { x1: 3, y1: 18, x2: 21, y2: 18 }),
        h('line', { x1: 6, y1: 3, x2: 18, y2: 21 }),
      ])
    case 'unitCircle':
      return h('svg', b, [
        h('circle', { cx: 12, cy: 12, r: 8 }),
        h('line', { x1: 4, y1: 12, x2: 20, y2: 12 }),
        h('line', { x1: 12, y1: 4, x2: 12, y2: 20 }),
        h('line', { x1: 12, y1: 12, x2: 18, y2: 7 }),
      ])
    case 'similar':
      return h('svg', b, [
        h('polygon', { points: '3,18 8,18 5,13', stroke: '#2563eb' }),
        h('polygon', { points: '3,18 21,18 13,4', stroke: '#ea580c' }),
      ])
    case 'parallels':
      return h('svg', b, [
        h('line', { x1: 2, y1: 8, x2: 22, y2: 8, stroke: '#2563eb' }),
        h('line', { x1: 2, y1: 16, x2: 22, y2: 16, stroke: '#2563eb' }),
        h('line', { x1: 6, y1: 3, x2: 18, y2: 21, stroke: '#dc2626' }),
      ])
    case 'trapezium':
      return h('svg', b, [h('polygon', { points: '3,19 21,19 17,6 7,6' })])
    case 'euler9':
      return h('svg', b, [
        h('polygon', { points: '4,20 20,20 12,4' }),
        h('circle', { cx: 12, cy: 14, r: 5, 'stroke-dasharray': '2 2', stroke: '#ea580c' }),
        h('line', { x1: 6, y1: 17, x2: 18, y2: 11, stroke: '#a855f7', 'stroke-dasharray': '2 1.5' }),
      ])
    case 'simson':
      return h('svg', b, [
        h('circle', { cx: 12, cy: 13, r: 9 }),
        h('polygon', { points: '5,18 19,18 12,6' }),
        h('circle', { cx: 4, cy: 13, r: 1, fill: '#dc2626', stroke: 'none' }),
        h('line', { x1: 7, y1: 15, x2: 13, y2: 21, stroke: '#a855f7', 'stroke-width': '1.2' }),
      ])
    case 'inversion':
      return h('svg', b, [
        h('circle', { cx: 12, cy: 12, r: 8, stroke: '#2563eb' }),
        h('circle', { cx: 12, cy: 12, r: 0.8, fill: CUR, stroke: 'none' }),
        h('circle', { cx: 9, cy: 12, r: 1, fill: '#dc2626', stroke: 'none' }),
        h('circle', { cx: 19, cy: 12, r: 1, fill: '#ea580c', stroke: 'none' }),
        h('line', { x1: 12, y1: 12, x2: 21, y2: 12, stroke: '#94a3b8', 'stroke-dasharray': '1.5 1.5', 'stroke-width': '0.8' }),
      ])
    default:
      return h('svg', b, [h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 })])
  }
}

// ── analysis (calculus modes 20×20, sw 1.6) — ТОЧНА копія CalculusTray.ModeIcon ──
function analysisIcon(key: string): VNode {
  const b = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: CUR, 'stroke-width': '1.6' }
  if (key === 'derivative') {
    return h('svg', b, [
      h('path', { d: 'M3 19 Q 9 19 12 12 T 21 5', fill: 'none' }),
      h('line', { x1: 7, y1: 18, x2: 17, y2: 9, stroke: '#3b7b9b' }),
      h('circle', { cx: 12, cy: 12, r: 1.8, fill: '#c4622a', stroke: 'none' }),
    ])
  }
  if (key === 'integral') {
    return h('svg', b, [
      h('path', { d: 'M3 18 Q 12 4 21 18', fill: 'rgba(196,98,42,0.25)', stroke: CUR }),
      h('line', { x1: 3, y1: 18, x2: 21, y2: 18 }),
    ])
  }
  // graphCalc — репрезентативна крива y=f(x) (плитка; трей юзає текст «f(x)»)
  return h('svg', b, [
    h('line', { x1: 3, y1: 21, x2: 21, y2: 21, stroke: '#94a3b8' }),
    h('line', { x1: 3, y1: 3, x2: 3, y2: 21, stroke: '#94a3b8' }),
    h('path', { d: 'M4 18 Q 10 2 20 8', stroke: '#3b7b9b', fill: 'none' }),
  ])
}

// ── quadratic (репрезентативна для плитки; QuadraticTray має власну inline) ──────
function quadIcon(): VNode {
  return h('svg', { width: 20, height: 18, viewBox: '0 0 24 22', fill: 'none', stroke: CUR, 'stroke-width': '1.7' }, [
    h('line', { x1: 2, y1: 20, x2: 22, y2: 20, stroke: '#94a3b8' }),
    h('path', { d: 'M2 20 Q 12 0 22 20', stroke: '#3b7b9b', fill: 'none' }),
    h('circle', { cx: 5, cy: 20, r: 2, fill: '#3b7b9b', stroke: 'none' }),
    h('circle', { cx: 19, cy: 20, r: 2, fill: '#3b7b9b', stroke: 'none' }),
    h('circle', { cx: 12, cy: 2.5, r: 2, fill: '#c4622a', stroke: 'none' }),
  ])
}

// ── trig (репрезентативні для плитки; TrigCircleTray має власні) ─────────────────
function trigIcon(key: string): VNode {
  const b = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: CUR, 'stroke-width': '1.5' }
  if (key === 'helix') {
    return h('svg', b, [h('path', { d: 'M6 3 C 18 6, 6 9, 18 12 S 6 18, 18 21', fill: 'none' })])
  }
  if (key === 'solver') {
    return h('svg', b, [
      h('path', { d: 'M3 9 Q 8 3 12 9 T 21 9', stroke: '#3b7b9b', fill: 'none' }),
      h('line', { x1: 4, y1: 16, x2: 20, y2: 16 }),
      h('line', { x1: 4, y1: 19, x2: 20, y2: 19 }),
    ])
  }
  // trig_circle
  return h('svg', b, [
    h('circle', { cx: 12, cy: 12, r: 8 }),
    h('line', { x1: 4, y1: 12, x2: 20, y2: 12, stroke: '#94a3b8' }),
    h('line', { x1: 12, y1: 4, x2: 12, y2: 20, stroke: '#94a3b8' }),
    h('line', { x1: 12, y1: 12, x2: 18, y2: 7, stroke: '#c4622a' }),
  ])
}

// ── 3D (graphmash_3d стартери) ──────────────────────────────────────────────────
function threeDIcon(key: string): VNode {
  const b = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: CUR, 'stroke-width': '1.5', 'stroke-linejoin': 'round' }
  if (key === 'surface') {
    return h('svg', b, [h('path', { d: 'M3 15 Q 8 9 12 13 T 21 11', stroke: '#2d70b3' }), h('path', { d: 'M3 18 Q 8 12 12 16 T 21 14', opacity: '0.5' })])
  }
  if (key === 'curve') {
    return h('svg', b, [h('path', { d: 'M5 20 C 20 16, 4 10, 19 5', stroke: '#c74440', fill: 'none' })])
  }
  if (key === 'vectorField') {
    return h('svg', b, [
      h('line', { x1: 5, y1: 8, x2: 9, y2: 8, stroke: '#388c46' }), h('path', { d: 'M9 8 l -2 -1.5 v3 z', fill: '#388c46', stroke: 'none' }),
      h('line', { x1: 14, y1: 12, x2: 18, y2: 12, stroke: '#388c46' }), h('path', { d: 'M18 12 l -2 -1.5 v3 z', fill: '#388c46', stroke: 'none' }),
      h('line', { x1: 6, y1: 16, x2: 10, y2: 16, stroke: '#388c46' }), h('path', { d: 'M10 16 l -2 -1.5 v3 z', fill: '#388c46', stroke: 'none' }),
    ])
  }
  // blank — куб-каркас
  return h('svg', b, [
    h('polygon', { points: '12,4 20,8 12,12 4,8' }),
    h('line', { x1: 4, y1: 8, x2: 4, y2: 16 }), h('line', { x1: 12, y1: 12, x2: 12, y2: 20 }),
    h('line', { x1: 20, y1: 8, x2: 20, y2: 16 }), h('line', { x1: 4, y1: 16, x2: 12, y2: 20 }),
    h('line', { x1: 12, y1: 20, x2: 20, y2: 16 }),
  ])
}

// ── GeoMASH scene ──────────────────────────────────────────────────────────────
function geomashIcon(): VNode {
  const b = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: CUR, 'stroke-width': '1.5' }
  return h('svg', b, [
    h('circle', { cx: 9, cy: 13, r: 6, stroke: '#1a5c38' }),
    h('polygon', { points: '13,4 21,10 15,18', stroke: '#c74440' }),
    h('circle', { cx: 9, cy: 13, r: 1, fill: CUR, stroke: 'none' }),
  ])
}

/**
 * Спільна іконка вставки. `family` + `iconKey`:
 *   stereo → tplKey · planimetry → preset type · analysis → mode|graphCalc
 *   quadratic → 'card' · trig → 'circle'|'helix'|'solver' · 3d → starter · geomash → 'scene'
 */
export const InsertIcon: FunctionalComponent<{ family: string; iconKey: string }> = (props) => {
  switch (props.family) {
    case 'stereo': return stereoIcon(props.iconKey)
    case 'planimetry': return geoIcon(props.iconKey)
    case 'analysis': return analysisIcon(props.iconKey)
    case 'quadratic': return quadIcon()
    case 'trig': return trigIcon(props.iconKey)
    case '3d': return threeDIcon(props.iconKey)
    case 'geomash': return geomashIcon()
    default:
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: CUR, 'stroke-width': '1.5' },
        [h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 })])
  }
}
