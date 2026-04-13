/**
 * GeoBoard — Composable for creating geometry_2d assets on the board.
 * Called from WBSoloRoom/WBClassroomRoom when geometry tool is active.
 */

import type { WBAsset } from '../types/winterboard'
import type { Geometry2DShape, Geometry2DParams } from '../types/geometry'
import { GEOMETRY_DEFAULTS, roundCoord } from '../types/geometry'
import { regularPolygonVertices, defaultTriangleVertices } from '../engine/geometryMeasurements'

/** Create a geometry_2d WBAsset at the given canvas position */
export function createGeometryAsset(
  shape: Geometry2DShape,
  cx: number,
  cy: number,
  opts?: { sides?: number; size?: number },
): WBAsset {
  const id = `geometry_2d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const size = opts?.size ?? 120

  let geometryParams: Geometry2DParams

  switch (shape) {
    case 'triangle':
      geometryParams = {
        shape: 'triangle',
        vertices: defaultTriangleVertices(roundCoord(cx), roundCoord(cy), size),
        fillColor: GEOMETRY_DEFAULTS.fillColor,
        strokeColor: GEOMETRY_DEFAULTS.strokeColor,
        strokeWidth: GEOMETRY_DEFAULTS.strokeWidth,
        showMeasurements: true,
        buildProgress: 1.0,
      }
      break

    case 'circle':
      geometryParams = {
        shape: 'circle',
        cx: roundCoord(cx),
        cy: roundCoord(cy),
        radius: roundCoord(size / 2),
        fillColor: GEOMETRY_DEFAULTS.fillColor,
        strokeColor: GEOMETRY_DEFAULTS.strokeColor,
        strokeWidth: GEOMETRY_DEFAULTS.strokeWidth,
        showMeasurements: true,
        buildProgress: 1.0,
      }
      break

    case 'polygon': {
      const sides = opts?.sides ?? 6
      geometryParams = {
        shape: 'polygon',
        sides,
        vertices: regularPolygonVertices(roundCoord(cx), roundCoord(cy), size / 2, sides),
        fillColor: GEOMETRY_DEFAULTS.fillColor,
        strokeColor: GEOMETRY_DEFAULTS.strokeColor,
        strokeWidth: GEOMETRY_DEFAULTS.strokeWidth,
        showMeasurements: true,
        buildProgress: 1.0,
      }
      break
    }
  }

  return {
    id,
    type: 'geometry_2d',
    src: '',
    x: roundCoord(cx - size / 2),
    y: roundCoord(cy - size / 2),
    w: size,
    h: size,
    rotation: 0,
    geometryParams,
  }
}
