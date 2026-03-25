/**
 * Phase 37: Test grading — pure functions for auto-checking answers.
 * No side effects, no store dependency. Can be used in tests directly.
 */
import type {
  WBTestObject,
  WBTestInput,
  WBTestRadio,
  WBTestCheckbox,
  WBTestGapFill,
  WBTestMatching,
} from '../types/winterboard'

export interface GradeResult {
  totalPoints: number
  earnedPoints: number
  percentage: number
  details: Array<{
    objectId: string
    correct: boolean
    points: number
    studentAnswer: unknown
    correctAnswer: unknown
  }>
}

/**
 * Check if a single answer is correct for a test object.
 */
export function checkAnswer(obj: WBTestObject, answer: unknown): boolean {
  switch (obj.type) {
    case 'input': {
      const inputObj = obj as WBTestInput
      const expected = obj.correctAnswer ?? ''
      const actual = String(answer ?? '').trim()
      if (!actual) return false
      if (inputObj.inputType === 'number') {
        return Number(actual) === Number(expected)
      }
      if (inputObj.caseSensitive) {
        return actual === expected.trim()
      }
      return actual.toLowerCase() === expected.trim().toLowerCase()
    }

    case 'radio':
    case 'dropdown': {
      const radioObj = obj as WBTestRadio
      return answer === radioObj.correctIndex
    }

    case 'checkbox': {
      const checkObj = obj as WBTestCheckbox
      const selected = (answer as number[]) ?? []
      const correct = checkObj.correctIndices
      if (selected.length !== correct.length) return false
      const sortedSel = [...selected].sort()
      const sortedCor = [...correct].sort()
      return sortedSel.every((v, i) => v === sortedCor[i])
    }

    case 'gap-fill': {
      // FIX-10: повна реалізація gap-fill grading
      const gapObj = obj as WBTestGapFill
      const studentGaps = (answer as string[]) ?? []
      if (studentGaps.length !== gapObj.gaps.length) return false
      return gapObj.gaps.every((gap, i) => {
        const expected = gap.correctAnswer
        const actual = (studentGaps[i] ?? '').trim()
        if (!actual) return false
        if (gap.caseSensitive) return actual === expected.trim()
        return actual.toLowerCase() === expected.trim().toLowerCase()
      })
    }

    case 'matching': {
      const matchObj = obj as WBTestMatching
      const studentPairs = (answer as number[]) ?? []
      if (studentPairs.length !== matchObj.correctPairs.length) return false
      return matchObj.correctPairs.every((correct, i) => studentPairs[i] === correct)
    }

    default:
      return false
  }
}

/**
 * Grade all test objects on a page. Returns structured result.
 */
export function gradeTest(
  testObjects: WBTestObject[],
  answers: Map<string, unknown>,
): GradeResult {
  let totalPoints = 0
  let earnedPoints = 0
  const details: GradeResult['details'] = []

  for (const obj of testObjects) {
    totalPoints += obj.points
    const answer = answers.get(obj.id)
    const correct = checkAnswer(obj, answer)

    if (correct) earnedPoints += obj.points

    details.push({
      objectId: obj.id,
      correct,
      points: correct ? obj.points : 0,
      studentAnswer: answer,
      correctAnswer: getCorrectAnswer(obj),
    })
  }

  return {
    totalPoints,
    earnedPoints,
    percentage: totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0,
    details,
  }
}

/**
 * Extract the correct answer for display purposes.
 */
function getCorrectAnswer(obj: WBTestObject): unknown {
  switch (obj.type) {
    case 'input':
      return obj.correctAnswer
    case 'radio':
    case 'dropdown':
      return (obj as WBTestRadio).correctIndex
    case 'checkbox':
      return (obj as WBTestCheckbox).correctIndices
    case 'gap-fill':
      return (obj as WBTestGapFill).gaps.map(g => g.correctAnswer)
    case 'matching':
      return (obj as WBTestMatching).correctPairs
    default:
      return null
  }
}
