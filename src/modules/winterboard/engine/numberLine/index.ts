/** Числова пряма (Б-184) — рушій без DOM. ТЗ: saas_docs, «Числова пряма на дошці». */
export * from './types'
export { parseLine, parseLines, parseNumber, conditionToText, displayOp } from './parse'
export {
  evaluate,
  formatAnswer,
  describeNumberLine,
  displayNumber,
  type IntervalName,
  type NumberLineAnswer,
  type NumberLineEvaluation,
  type NumberLineLayout,
  type LayoutPoint,
  type LayoutSegment,
  type LayoutHatch,
} from './evaluate'
