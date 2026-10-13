/** Числова пряма (Б-184) — рушій без DOM. ТЗ: saas_docs, «Числова пряма на дошці». */
export * from './types'
export { parseLine, parseLines, parseNumber, conditionToText, displayOp } from './parse'
export { parseIntervalsLine, solveIntervals, type ParsedIntervalsLine } from './intervals'
export {
  evaluate,
  formatAnswer,
  describeNumberLine,
  intervalsFormula,
  displayNumber,
  type IntervalName,
  type NumberLineAnswer,
  type NumberLineEvaluation,
  type NumberLineLayout,
  type LayoutPoint,
  type LayoutSegment,
  type LayoutHatch,
  type LayoutSign,
} from './evaluate'
