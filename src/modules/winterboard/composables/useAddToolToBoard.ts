/**
 * useAddToolToBoard — provide/inject bridge for sidebar tray "+" buttons.
 *
 * WBSoloRoom provides ADD_TOOL_TO_BOARD_KEY with a function that:
 *   1. Computes current viewport center in canvas coordinates.
 *   2. Delegates to contentDrop.addAtPosition(mime, payload, center).
 *
 * Each Tray injects via useAddToolToBoard() and calls the function when
 * the user clicks the "+" button on a card — same result as drag-and-drop
 * to the viewport center.
 *
 * HARD RULE: Tray ONLY passes MIME + JSON payload. Asset creation logic
 * remains exclusively in useContentDrop (addAtPosition). No local asset
 * creation in trays.
 */
import { inject } from 'vue'

export const ADD_TOOL_TO_BOARD_KEY = Symbol('addToolToBoard')

export type AddToolFn = (mime: string, payload: string) => void

export function useAddToolToBoard(): AddToolFn {
  return inject<AddToolFn>(ADD_TOOL_TO_BOARD_KEY, () => {
    console.warn('[useAddToolToBoard] provider not found — ensure WBSoloRoom provides ADD_TOOL_TO_BOARD_KEY')
  })
}
