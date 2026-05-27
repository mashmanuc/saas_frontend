/**
 * NMT3D — defaults, MIME, template registry.
 *
 * Refs:
 *   - types/nmt3d.ts
 *   - vendor/nmt3d/index.ts
 *   - Mirror pattern: helixDefaults.ts
 *
 * HARD INVARIANT (per winterboard ops pattern):
 *   - DEFAULT_NMT3D_W/H і buildDefaultNmt3dData() визначені ТУТ і ТІЛЬКИ ТУТ.
 *   - Tray передає тільки { templateKey }; drop handler hydrates data.
 */

import type { Nmt3dData } from '../types/nmt3d'

export type { Nmt3dDragPayload } from '../types/nmt3d'

export const NMT3D_DRAG_MIME = 'application/x-nmt3d'

/** Default card size (px) при drop. Wide to accommodate the 3D scene + labels. */
export const DEFAULT_NMT3D_W = 680
export const DEFAULT_NMT3D_H = 500

/**
 * Canonical order of the 23 NMT3D templates (same order as standalone page).
 * Used by Nmt3dTray to render buttons in the sidebar.
 * 21 original + ngonPyramid + ngonPrism (added 2026-05-26).
 */
export const NMT3D_TEMPLATE_ORDER: ReadonlyArray<string> = [
  'cube', 'cuboid',
  'prism4', 'prism6', 'obliquePrism4',
  'pyramid4', 'pyramid3', 'pyramid6', 'tetrahedron', 'trapPyramid',
  'frustumPyramid4',
  'ngonPyramid', 'ngonPrism',
  'cylinder', 'cone', 'frustumCone', 'sphere',
  'cubeInscribedSphere', 'cubeCircumSphere', 'cylinderInscribedSphere',
  'sphereInscribedCone', 'coneInscribedCylinder',
  'cubeSection3',
]

/**
 * Ukrainian fallback labels shown before the NMT3D bundle finishes loading.
 * After load, runtime names come from window.NMT3D.TEMPLATES[key].name.
 */
export const NMT3D_TEMPLATE_LABELS: Readonly<Record<string, string>> = {
  cube:                 'Куб',
  cuboid:               'Паралелепіпед',
  prism4:               'Призма ч/к',
  prism6:               'Призма ш/к',
  obliquePrism4:        'Похила призма',
  pyramid4:             'Піраміда ч/к',
  pyramid3:             'Піраміда т/к',
  pyramid6:             'Піраміда ш/к',
  tetrahedron:          'Тетраедр',
  trapPyramid:          'Піраміда (трап.)',
  frustumPyramid4:      'Зрізана піраміда',
  ngonPyramid:          'Піраміда n/к',
  ngonPrism:            'Призма n/к',
  cylinder:             'Циліндр',
  cone:                 'Конус',
  frustumCone:          'Зрізаний конус',
  sphere:               'Сфера',
  cubeInscribedSphere:  'Куля в кубі',
  cubeCircumSphere:     'Куб у кулі',
  cylinderInscribedSphere: 'Куля в циліндрі',
  sphereInscribedCone:  'Куля в конусі',
  coneInscribedCylinder:'Циліндр у конусі',
  cubeSection3:         'Переріз куба',
}

/** Build fresh default Nmt3dData for a newly dropped card. */
export function buildDefaultNmt3dData(templateKey: string): Nmt3dData {
  return {
    version: 1,
    templateKey,
    mode: 'adapt',
  }
}
