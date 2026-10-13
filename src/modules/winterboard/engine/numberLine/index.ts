/** Числова пряма (Б-184) — рушій без DOM. ТЗ: saas_docs, «Числова пряма на дошці». */
export * from './types'
export { parseLine, parseLines, parseNumber, conditionToText, displayOp } from './parse'
export { parseIntervalsLine, solveIntervals, denominatorHoles, type ParsedIntervalsLine } from './intervals'
export { inequalityLatex, numberLatex, setLatex, statementLatex } from './latex'
export { chooseNumberLine, type ChooseInput, type ChooseOutcome, type ChosenFields, type SolveFn } from './choose'
export {
  evaluate,
  formatAnswer,
  answerFromPieces,
  numberLineKind,
  type AnswerPiece,
  type NumberLineKind,
  describeNumberLine,
  solverBoundLabel,
  solverBoundTex,
  formulaParts,
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
