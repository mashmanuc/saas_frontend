/**
 * Nested Error Mapper
 * 
 * Maps backend validation errors with nested field paths (e.g., "subjects[0].custom_direction_text")
 * to structured errors that can be displayed inline in UI components.
 * 
 * @example
 * Backend error: { "subjects[0].custom_direction_text": ["Must be at least 50 characters"] }
 * Mapped to: { path: ['subjects', '0', 'custom_direction_text'], index: 0, messages: [...] }
 */

import type { MarketplaceValidationErrors } from './apiErrors'

export interface NestedError {
  /** Full path as array: ['subjects', '0', 'custom_direction_text'] */
  path: string[]
  /** Field name only: 'custom_direction_text' */
  field: string
  /** Array index if present: 0, or null */
  index: number | null
  /** Parent field: 'subjects' or 'languages' */
  parent: string | null
  /** Error messages */
  messages: string[]
  /** Original field path from backend */
  originalPath: string
}

/**
 * Parse nested field path like "subjects[0].custom_direction_text"
 * into structured components
 */
export function parseNestedFieldPath(fieldPath: string): NestedError {
  const messages: string[] = []
  
  // Match pattern: parent[index].field or parent[index] or simple field
  const arrayFieldMatch = fieldPath.match(/^(\w+)\[(\d+)\](?:\.(\w+))?$/)
  
  if (arrayFieldMatch) {
    const [, parent, indexStr, field] = arrayFieldMatch
    const index = parseInt(indexStr, 10)
    
    return {
      path: field ? [parent, indexStr, field] : [parent, indexStr],
      field: field || parent,
      index,
      parent,
      messages,
      originalPath: fieldPath,
    }
  }
  
  // Simple field without array index
  return {
    path: [fieldPath],
    field: fieldPath,
    index: null,
    parent: null,
    messages,
    originalPath: fieldPath,
  }
}

/**
 * Map validation errors to nested error structures
 */
export function mapValidationErrors(
  errors: MarketplaceValidationErrors
): Map<string, NestedError[]> {
  const errorMap = new Map<string, NestedError[]>()
  
  for (const [fieldPath, messages] of Object.entries(errors)) {
    const nestedError = parseNestedFieldPath(fieldPath)
    nestedError.messages = messages
    
    // Group by parent field (subjects, languages) or use field name
    const groupKey = nestedError.parent || nestedError.field
    
    if (!errorMap.has(groupKey)) {
      errorMap.set(groupKey, [])
    }
    
    errorMap.get(groupKey)!.push(nestedError)
  }
  
  return errorMap
}

/**
 * Get errors for specific array item
 * @example getErrorsForArrayItem(errorMap, 'subjects', 0)
 */
export function getErrorsForArrayItem(
  errorMap: Map<string, NestedError[]>,
  parent: string,
  index: number
): NestedError[] {
  const parentErrors = errorMap.get(parent) || []
  return parentErrors.filter((err) => err.index === index)
}

/**
 * Get error for specific nested field
 * @example getErrorForField(errorMap, 'subjects', 0, 'custom_direction_text')
 */
export function getErrorForField(
  errorMap: Map<string, NestedError[]>,
  parent: string,
  index: number,
  field: string
): NestedError | null {
  const itemErrors = getErrorsForArrayItem(errorMap, parent, index)
  return itemErrors.find((err) => err.field === field) || null
}

/**
 * Check if array item has any errors
 */
export function hasErrorsForArrayItem(
  errorMap: Map<string, NestedError[]>,
  parent: string,
  index: number
): boolean {
  return getErrorsForArrayItem(errorMap, parent, index).length > 0
}

/**
 * Get all error messages for array item (all fields)
 */
export function getAllMessagesForArrayItem(
  errorMap: Map<string, NestedError[]>,
  parent: string,
  index: number
): string[] {
  const itemErrors = getErrorsForArrayItem(errorMap, parent, index)
  return itemErrors.flatMap((err) => err.messages)
}

/**
 * Format error messages for display
 */
export function formatErrorMessages(messages: string[]): string {
  if (messages.length === 0) return ''
  if (messages.length === 1) return messages[0]
  return messages.join('; ')
}
