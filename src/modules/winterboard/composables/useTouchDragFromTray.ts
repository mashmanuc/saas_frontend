/**
 * useTouchDragFromTray — touch drag support for sidebar tray buttons.
 *
 * HTML5 Drag-and-Drop API (@dragstart / DataTransfer) does NOT fire on touch
 * devices (iOS, Android, large touch panels). This composable replaces it with
 * Pointer Events API for touch input while leaving mouse @dragstart untouched.
 *
 * Pattern (gesture disambiguation):
 *   1. Tray button adds v-bind="dragHandlers(mime, payload, label)".
 *   2. On touch pointerdown → save start position, wait.
 *   3. On pointermove → if |dx| > |dy| && dx > THRESHOLD → start drag (setPointerCapture).
 *                        if |dy| > |dx| && dy > THRESHOLD → cancel drag, let browser scroll.
 *   4. On pointerup inside #wb-canvas → addAtClientPos called.
 *   5. On pointercancel → ghost hidden, state reset.
 *
 * This lets the user vertically scroll the sidebar by swiping on any item,
 * while still dragging items to the canvas with a horizontal gesture.
 *
 * Mouse events (pointerType === 'mouse') are skipped — HTML5 DnD still handles those.
 *
 * WBSoloRoom and WBClassroomRoom provide ADD_TOOL_AT_CLIENT_KEY.
 */

import { inject, type InjectionKey } from 'vue'

// ── Injection key ──────────────────────────────────────────────────────────

export type AddToolAtClientFn = (
  mime: string,
  payload: string,
  clientX: number,
  clientY: number,
) => void

export const ADD_TOOL_AT_CLIENT_KEY: InjectionKey<AddToolAtClientFn> =
  Symbol('addToolAtClientPosition')

// ── Ghost element (module singleton) ───────────────────────────────────────
// Created once, reused across all drags. No Vue reactivity needed.

let _ghostEl: HTMLElement | null = null

function _getGhost(): HTMLElement {
  if (!_ghostEl) {
    _ghostEl = document.createElement('div')
    _ghostEl.setAttribute('data-wb-touch-ghost', '')
    _ghostEl.style.cssText = [
      'position:fixed',
      'z-index:99999',
      'pointer-events:none',
      'background:rgba(99,102,241,0.15)',
      'border:2px dashed #6366f1',
      'border-radius:8px',
      'padding:6px 14px',
      'font-size:13px',
      'font-weight:600',
      'color:#3730a3',
      'white-space:nowrap',
      'box-shadow:0 4px 16px rgba(99,102,241,0.22)',
      'transform:translate(-50%,-110%)',
      'display:none',
    ].join(';')
    document.body.appendChild(_ghostEl)
  }
  return _ghostEl
}

function _showGhost(x: number, y: number, label: string): void {
  const g = _getGhost()
  g.textContent = `+ ${label}`
  g.style.left = `${x}px`
  g.style.top = `${y}px`
  g.style.display = 'block'
}

function _moveGhost(x: number, y: number): void {
  if (!_ghostEl || _ghostEl.style.display === 'none') return
  _ghostEl.style.left = `${x}px`
  _ghostEl.style.top = `${y}px`
}

function _hideGhost(): void {
  if (_ghostEl) _ghostEl.style.display = 'none'
}

// ── Module-level drag state (no reactivity — perf sensitive) ───────────────

// Minimum horizontal movement (px) before a drag gesture is confirmed.
// Must be > |dx| of typical vertical scroll to avoid false positives.
const DRAG_THRESHOLD_PX = 8

const _drag = {
  active: false,    // drag confirmed and in progress
  decided: false,   // gesture direction decided (drag or scroll)
  mime: '',
  payload: '',
  pointerId: -1,
  startX: 0,
  startY: 0,
  el: null as Element | null,
}

// ── Composable ─────────────────────────────────────────────────────────────

export function useTouchDragFromTray() {
  // null default = composable still works even if provider is absent (no-op drop)
  const addAtClientPos = inject<AddToolAtClientFn | null>(ADD_TOOL_AT_CLIENT_KEY, null)

  /**
   * Returns Vue event handler bindings for a draggable tray button.
   *
   * Usage:
   *   <button :draggable="true" @dragstart="..." v-bind="dragHandlers(MIME, payload, label)">
   */
  function dragHandlers(mime: string, payload: string, label: string) {
    return {
      onPointerdown(e: PointerEvent): void {
        if (e.pointerType === 'mouse') return   // mouse uses HTML5 DnD

        // Save start position. Do NOT capture or prevent default yet —
        // we need to wait for gesture direction to be determined on pointermove.
        _drag.active = false
        _drag.decided = false
        _drag.mime = mime
        _drag.payload = payload
        _drag.pointerId = e.pointerId
        _drag.startX = e.clientX
        _drag.startY = e.clientY
        _drag.el = e.currentTarget as Element
      },

      onPointermove(e: PointerEvent): void {
        if (e.pointerType === 'mouse' || e.pointerId !== _drag.pointerId) return

        if (_drag.active) {
          // Drag confirmed — move ghost, prevent scroll
          e.preventDefault()
          _moveGhost(e.clientX, e.clientY)
          return
        }

        if (_drag.decided) return  // already decided to scroll — ignore

        const dx = Math.abs(e.clientX - _drag.startX)
        const dy = Math.abs(e.clientY - _drag.startY)

        if (dx > dy && dx >= DRAG_THRESHOLD_PX) {
          // Horizontal movement first → drag intent
          e.preventDefault()            // prevent browser from starting a scroll
          _drag.active = true
          _drag.decided = true
          _drag.el?.setPointerCapture(e.pointerId)
          _showGhost(e.clientX, e.clientY, label)
        } else if (dy > dx && dy >= DRAG_THRESHOLD_PX) {
          // Vertical movement first → scroll intent; cancel drag
          _drag.decided = true
          _drag.pointerId = -1
          _drag.el = null
        }
      },

      onPointerup(e: PointerEvent): void {
        if (e.pointerType === 'mouse' || e.pointerId !== _drag.pointerId) return
        const wasDragging = _drag.active
        _drag.active = false
        _drag.decided = false
        _drag.pointerId = -1
        _drag.el = null
        _hideGhost()

        if (!wasDragging) return

        // Check if finger lifted inside the board canvas area
        const canvasEl = document.getElementById('wb-canvas')
        if (!canvasEl) return
        const rect = canvasEl.getBoundingClientRect()
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          addAtClientPos?.(mime, payload, e.clientX, e.clientY)
        }
      },

      onPointercancel(e: PointerEvent): void {
        if (e.pointerId !== _drag.pointerId) return
        _drag.active = false
        _drag.decided = false
        _drag.pointerId = -1
        _drag.el = null
        _hideGhost()
      },
    }
  }

  return { dragHandlers }
}
