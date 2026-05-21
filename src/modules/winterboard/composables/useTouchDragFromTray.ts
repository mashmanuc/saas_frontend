/**
 * useTouchDragFromTray — touch drag support for sidebar tray buttons.
 *
 * HTML5 Drag-and-Drop API (@dragstart / DataTransfer) does NOT fire on touch
 * devices (iOS, Android, large touch panels). This composable replaces it with
 * Pointer Events API for touch input while leaving mouse @dragstart untouched.
 *
 * Pattern:
 *   1. Tray button adds v-bind="dragHandlers(mime, payload, label)".
 *   2. On touch pointerdown → setPointerCapture → floating ghost appears.
 *   3. On pointermove → ghost follows the finger.
 *   4. On pointerup inside #wb-canvas → addAtClientPos called.
 *   5. On pointercancel → ghost hidden, state reset.
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

const _drag = {
  active: false,
  mime: '',
  payload: '',
  pointerId: -1,
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
        e.preventDefault()                       // prevent text selection / long-press menu
        _drag.active = true
        _drag.mime = mime
        _drag.payload = payload
        _drag.pointerId = e.pointerId
        // Route all pointer events to this element even when finger moves off it
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
        _showGhost(e.clientX, e.clientY, label)
      },

      onPointermove(e: PointerEvent): void {
        if (!_drag.active || e.pointerType === 'mouse' || e.pointerId !== _drag.pointerId) return
        e.preventDefault()
        _moveGhost(e.clientX, e.clientY)
      },

      onPointerup(e: PointerEvent): void {
        if (!_drag.active || e.pointerType === 'mouse' || e.pointerId !== _drag.pointerId) return
        _drag.active = false
        _hideGhost()

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
        _hideGhost()
      },
    }
  }

  return { dragHandlers }
}
