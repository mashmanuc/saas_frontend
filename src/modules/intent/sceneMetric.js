// Phase 1 (North Ship, блок A): маппінг board_action → wb.scene.* метрика.
//
// ЧИСТА функція без Vue-залежностей — тестована напряму (PHASE_1 §7.1).
// Мапа insert_id→kind з PHASE_1 §6.1. Повертає null для не-сцен (жодної події).

const SCENE_KIND_BY_INSERT = {
  'analysis.graphCalc': 'graph_calculator',
  '3d.blank': 'graphmash_3d',       // P0 (рев'ю №001): GraphMASH 3D — utils/mashImport.ts
  '3d.surface': 'graphmash_3d',
  '3d.curve': 'graphmash_3d',
  '3d.vectorField': 'graphmash_3d',
  'trig.circle': 'trig_circle',
  'geomash.scene': 'geomash_scene', // P0 (рев'ю №001): жива геометрія — втрачена, тепер сцена
}

// Префікс-мапа: planimetry.* → geometry_2d_v2, stereo.* → nmt3d (P0, рев'ю №001).
const SCENE_INSERT_PREFIX = { planimetry: 'geometry_2d_v2', stereo: 'nmt3d' }

// P1 (рев'ю №001 §2.1): явні набори для guard-тесту проти дрейфу каталогу.
export const SCENE_INSERT_IDS = Object.keys(SCENE_KIND_BY_INSERT)
export const SCENE_INSERT_PREFIXES = Object.keys(SCENE_INSERT_PREFIX)
// Свідомо не-сцени (інструменти/віджети, не живі сцени):
export const NON_SCENE_INSERT_IDS = [
  'analysis.calculus.derivative',
  'analysis.calculus.integral',
  'quadratic.card',
  'trig.helix',
  'trig.solver',
]

export function sceneMetricFromAction(action) {
  const kind = action?.kind
  const payload = action?.payload || {}
  if (kind === 'add_graph') return { event: 'created', kind: 'graph_calculator' }
  if (kind === 'add_tool') {
    const id = String(payload.insert_id || '')
    if (SCENE_KIND_BY_INSERT[id]) return { event: 'created', kind: SCENE_KIND_BY_INSERT[id] }
    const prefix = Object.keys(SCENE_INSERT_PREFIX).find((p) => id.startsWith(p + '.'))
    if (prefix) return { event: 'created', kind: SCENE_INSERT_PREFIX[prefix] }
    return null // не-сцена: calculus/quadratic/helix/solver
  }
  if (kind === 'set_param' && payload.type === 'graph_expression') {
    return { event: 'word_edit', kind: 'graph_calculator', op: 'graph_expression' }
  }
  if (kind === 'set_geometry') return { event: 'word_edit', kind: 'geometry_2d_v2', op: 'set_geometry' }
  return null
}