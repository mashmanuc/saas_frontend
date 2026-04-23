<template>
  <div
    ref="containerRef"
    class="wb-canvas"
    :class="[cursorClass, { 'wb-canvas--panning': isPanningRef }]"
    tabindex="0"
    @keydown="handleKeydown"
    @dragover.prevent
    @dragenter.prevent
    @drop.prevent="handleDrop"
    @wheel.prevent="handleWheel"
    @mousedown.middle.prevent="handlePanStart"
  >
    <!-- A6.1: Loading spinner while Konva initializes -->
    <div v-if="!konvaReady" class="wb-canvas-loading">
      <div class="wb-canvas-loading__spinner" />
      <span class="wb-canvas-loading__text">Loading canvas...</span>
    </div>

    <v-stage
      v-show="konvaReady"
      ref="stageRef"
      :config="stageConfig"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @touchstart="handleMouseDown"
      @touchmove="handleMouseMove"
      @touchend="handleMouseUp"
    >
      <!-- Background layer -->
      <v-layer ref="backgroundLayerRef">
        <!-- A5.2: White base rect (always present) -->
        <v-rect :config="backgroundConfig" />
        <!-- A5.2: PDF background image -->
        <v-image
          v-if="pdfBackgroundConfig"
          :config="pdfBackgroundConfig"
        />
        <!-- A9: Per-page grid pattern overlay (usePageGrid — per-page, configurable opacity) -->
        <v-rect
          v-if="pageGridPatternConfig"
          :config="pageGridPatternConfig"
        />
      </v-layer>

      <!-- Assets layer (images + sticky notes) — BELOW strokes -->
      <v-layer ref="assetsLayerRef">
        <template v-for="asset in assets" :key="asset.id">
          <!-- Phase 3C: audio/video rendered as HTML overlays — skip in Konva -->
          <template v-if="asset.type === 'audio_player' || asset.type === 'video_player'" />
          <!-- v5 A9: Sticky note rendering -->
          <WBStickyNote
            v-else-if="asset.type === 'sticky'"
            :sticky="asset"
            :is-selected="wbStore.selectedIds.includes(asset.id)"
            :scale="props.zoom"
            @select="handleStickySelect"
            @drag-end="handleStickyDragEnd"
            @transform-end="handleStickyTransformEnd"
            @edit-text="startStickyTextEdit"
          />
          <!-- PLAN_v4: Document Viewer — interactive asset with page navigation -->
          <DocumentViewerAsset
            v-else-if="asset.type === 'document_viewer'"
            :asset="asset"
            :is-selected="wbStore.selectedIds.includes(asset.id)"
            :scale="props.zoom"
            @select="handleDocViewerSelect"
            @drag-end="handleDocViewerDragEnd"
            @transform-end="handleDocViewerTransformEnd"
            @page-change="handleDocViewerPageChange"
            @page-jump="(id: string) => emit('doc-viewer-page-jump', id)"
            @expand="handleDocViewerExpand"
          />
          <!-- GeoBoard: 2D geometry rendering -->
          <WBGeometry2D
            v-else-if="asset.type === 'geometry_2d'"
            :asset="asset"
            :is-selected="wbStore.selectedIds.includes(asset.id)"
            :scale="props.zoom"
            :interactive="currentTool === 'select'"
            @select="(id) => handleStickySelect(id)"
            @vertex-move="handleGeometryVertexMove"
            @vertex-drag-start="handleGeometryVertexDragStart"
            @vertex-drag-end="handleGeometryVertexDragEnd"
            @circle-move="handleGeometryCircleMove"
            @circle-drag-end="handleGeometryCircleDragEnd"
          />
          <!-- Phase 35: Image with borderRadius > 0 — wrap in Group with clipFunc -->
          <v-group
            v-else-if="(asset.borderRadius ?? 0) > 0"
            :config="{ ...getClipGroupConfig(asset), id: asset.id, name: 'asset' }"
          >
            <v-image :config="{ ...getClipChildImageConfig(asset), id: asset.id }" />
          </v-group>
          <!-- Regular image asset (no borderRadius — no clip overhead) -->
          <v-image
            v-else
            :config="{ ...getAssetConfig(asset), id: asset.id, name: 'asset' }"
          />
        </template>
      </v-layer>

      <!-- Strokes layer — ABOVE images -->
      <v-layer ref="strokesLayerRef">
        <template v-for="stroke in strokes" :key="stroke.id">
          <!-- Pen / Highlighter -->
          <v-path
            v-if="stroke.tool === 'pen' || stroke.tool === 'highlighter'"
            :config="{ ...getStrokeConfig(stroke), id: stroke.id, name: 'stroke' }"
          />
          <!-- Line -->
          <v-line
            v-else-if="stroke.tool === 'line'"
            :config="{ ...getLineConfig(stroke), id: stroke.id, name: 'stroke' }"
          />
          <!-- Rectangle -->
          <v-rect
            v-else-if="stroke.tool === 'rectangle'"
            :config="{ ...getRectConfig(stroke), id: stroke.id, name: 'stroke' }"
          />
          <!-- Circle / Ellipse -->
          <v-ellipse
            v-else-if="stroke.tool === 'circle'"
            :config="{ ...getCircleConfig(stroke), id: stroke.id, name: 'stroke' }"
          />
          <!-- Text -->
          <v-text
            v-else-if="stroke.tool === 'text'"
            :config="{ ...getTextConfig(stroke), id: stroke.id, name: 'stroke' }"
            @transformend="(e) => handleTextTransformEnd(stroke, e)"
          />
        </template>
      </v-layer>

      <!-- A4.2: Dedicated preview layer for shape previews during drawing -->
      <v-layer ref="previewLayerRef" :config="{ listening: false, clearBeforeDraw: true }">
        <!-- Rectangle preview -->
        <v-rect
          v-if="konvaShapePreview.type === 'rectangle'"
          :config="konvaShapePreview.config"
        />
        <!-- Circle preview -->
        <v-ellipse
          v-if="konvaShapePreview.type === 'circle'"
          :config="konvaShapePreview.config"
        />
        <!-- Line preview -->
        <v-line
          v-if="konvaShapePreview.type === 'line'"
          :config="konvaShapePreview.config"
        />
      </v-layer>

      <!-- UI layer (transformer + selection) -->
      <v-layer ref="uiLayerRef">
        <v-transformer
          v-if="selectedNode"
          ref="transformerRef"
          :config="transformerConfig"
        />
        <!-- v5 A1: Selection rubber band rect during drag -->
        <v-rect
          v-if="selectionRectConfig"
          :config="selectionRectConfig"
        />
        <!-- v5 A1: Selection indicators around selected items -->
        <v-rect
          v-for="indicator in selectionIndicators"
          :key="indicator.key"
          :config="indicator.config"
        />
        <!-- v5 A2: Group indicators — dashed border around grouped items -->
        <v-rect
          v-for="indicator in groupIndicators"
          :key="indicator.key"
          :config="indicator.config"
        />
      </v-layer>
    </v-stage>

    <!-- Group selection drag overlay — invisible hitbox for multi-select move -->
    <!-- MUST intercept ALL events: pointerdown, mousedown, touchstart, click -->
    <div
      v-if="groupDragOverlayStyle"
      class="wb-group-drag-overlay"
      :style="groupDragOverlayStyle"
      @pointerdown.stop.prevent="handleGroupDragStart"
      @mousedown.stop.prevent
      @touchstart.stop.prevent
      @click.stop.prevent
      @dblclick.stop.prevent
    >
      <!-- Move icon in center -->
      <svg
        class="wb-group-drag-overlay__icon"
        width="24" height="24" viewBox="0 0 24 24" fill="none"
      >
        <path d="M12 2l3 3h-2v4h4v-2l3 3-3 3v-2h-4v4h2l-3 3-3-3h2v-4H7v2l-3-3 3-3v2h4V5H9l3-3z" fill="currentColor"/>
      </svg>
    </div>

    <!-- Offscreen preview canvas overlay -->
    <canvas ref="previewCanvasRef" class="wb-preview-canvas" />

    <!-- Text editing overlay (v-if ensures clean mount/unmount cycle) -->
    <textarea
      v-if="editingText"
      ref="textareaRef"
      v-model="editingTextValue"
      class="wb-text-edit-overlay"
      :style="textEditStyle"
      @blur="finishTextEdit"
      @keydown.escape="finishTextEdit"
      @mousedown.stop
      @pointerdown.stop
    />

    <!-- v5 A9: Sticky note text editing overlay -->
    <textarea
      v-if="stickyEditingId"
      ref="stickyTextareaRef"
      v-model="stickyEditingText"
      class="wb-sticky-edit-overlay"
      :style="stickyEditStyle"
      @blur="finishStickyTextEdit"
      @mousedown.stop
      @pointerdown.stop
    />

    <!-- Phase 3C: Media HTML overlays (audio/video players) — positioned over canvas -->
    <!-- Media overlays support: click to select, pointer-drag to move, Delete to delete -->
    <template v-for="asset in mediaAssets" :key="`media-${asset.id}`">
      <div
        :data-media-id="asset.id"
        class="wb-media-overlay"
        :class="{
          'wb-media-overlay--selected': wbStore.selectedIds.includes(asset.id),
          'wb-media-overlay--selectable': currentTool === 'select',
        }"
        :style="{
          left: `${asset.x * props.zoom}px`,
          top: `${asset.y * props.zoom}px`,
          width: `${asset.w * props.zoom}px`,
          height: asset.type !== 'audio_player' ? `${asset.h * props.zoom}px` : undefined,
        }"
        @mousedown.stop
        @click.stop
        @pointerdown.stop="handleMediaPointerDown(asset, $event)"
      >
        <AudioPlayerObject
          v-if="asset.type === 'audio_player'"
          :obj="asAudioAsset(asset)"
          :is-tutor="props.isTutor !== false"
        />
        <VideoPlayerObject
          v-else-if="asset.type === 'video_player'"
          :obj="asVideoAsset(asset)"
          :is-tutor="props.isTutor !== false"
          :video-states="localVideoStates"
          :send-play="localSendPlay"
          :send-pause="localSendPause"
          :send-seek="localSendSeek"
        />
        <YouTubePlayerObject
          v-else-if="asset.type === 'youtube_player'"
          :obj="asYouTubeAsset(asset)"
          :is-tutor="props.isTutor !== false"
        />
        <!-- Transparent drag surface — covers video/youtube in select mode for drag -->
        <!-- Video controls work when NOT in select mode (pen, draw, etc.) -->
        <div
          v-if="currentTool === 'select' && (asset.type === 'video_player' || asset.type === 'youtube_player')"
          class="wb-media-drag-surface"
        />
        <!-- Resize handles for video/youtube (visible when selected in select mode) -->
        <template v-if="isResizableMedia(asset) && wbStore.selectedIds.includes(asset.id) && currentTool === 'select'">
          <div
            v-for="corner in RESIZE_CORNERS"
            :key="corner.name"
            class="wb-media-resize-handle"
            :class="`wb-media-resize-handle--${corner.name}`"
            :style="{ cursor: corner.cursor }"
            @pointerdown.stop.prevent="handleMediaResizeStart(asset, corner.name, $event)"
          />
        </template>
      </div>
    </template>

    <!-- BUG-2 FIX: Laser trail — fading dots behind the pointer -->
    <div
      v-for="(tp, idx) in laserTrailWithOpacity"
      :key="`trail-${idx}`"
      class="wb-laser-trail-dot"
      :style="{
        left: `${tp.x * props.zoom}px`,
        top: `${tp.y * props.zoom}px`,
        opacity: tp.opacity,
        transform: `translate(-50%, -50%) scale(${0.3 + tp.opacity * 0.7})`,
      }"
    />

    <!-- Remote laser trail — fading dots for remote users -->
    <div
      v-for="(tp, idx) in remoteTrailWithOpacity"
      :key="`rtrail-${idx}`"
      class="wb-laser-trail-dot"
      :style="{
        left: `${tp.x * props.zoom}px`,
        top: `${tp.y * props.zoom}px`,
        opacity: tp.opacity,
        backgroundColor: tp.color,
        transform: `translate(-50%, -50%) scale(${0.3 + tp.opacity * 0.7})`,
      }"
    />

    <!-- v5 A4: Local laser dot -->
    <div
      v-if="laserPointer.isActive.value && laserPointer.localPosition.value"
      class="wb-laser-dot wb-laser-dot--local"
      :style="{
        left: `${laserPointer.localPosition.value.x * props.zoom}px`,
        top: `${laserPointer.localPosition.value.y * props.zoom}px`,
      }"
    />

    <!-- v5 A4: Remote laser dots -->
    <div
      v-for="laser in laserPointer.activeRemoteLasers.value"
      :key="laser.userId"
      class="wb-laser-dot wb-laser-dot--remote"
      :style="{
        left: `${laser.x * props.zoom}px`,
        top: `${laser.y * props.zoom}px`,
        backgroundColor: laser.color,
        boxShadow: `0 0 8px 4px ${laser.color}40`,
      }"
    >
      <span class="wb-laser-dot__label" :style="{ color: laser.color }">{{ laser.displayName }}</span>
    </div>

    <!-- Object Audio: Badge overlay (pointer-events: none container, only icon clickable) -->
    <div
      v-for="item in itemsWithAudio"
      :key="`audio-badge-${item.id}`"
      class="wb-audio-badge"
      :style="audioBadgePosition(item)"
    >
      <AudioBadge
        :audio-url="item.audioUrl!"
        :is-tutor="props.isTutor !== false"
        :object-id="item.id"
        :state="getAudioBadgeState(item.id)"
        @click="handleAudioBadgeClick(item)"
      />
    </div>

    <!-- Object Text: Badge overlay (same pattern as audio) -->
    <div
      v-for="item in itemsWithText"
      :key="`text-badge-${item.id}`"
      class="wb-text-badge"
      :style="textBadgePosition(item)"
    >
      <TextBadge
        :object-id="item.id"
        :has-text="!!(item as any).text"
        :is-open="activeTextObjectId === item.id"
        @click="handleTextBadgeClick(item.id)"
      />
    </div>

    <!-- Object Text: Overlay (opens on badge click) -->
    <div
      v-if="activeTextObjectId && activeTextObject"
      class="wb-text-overlay-wrapper"
      :style="textOverlayPosition"
    >
      <TextOverlay
        :text="(activeTextObject as any).text ?? ''"
        :readonly="wbStore.mode !== 'edit'"
        @save="handleTextOverlaySave"
        @close="activeTextObjectId = null"
        @delete="handleTextOverlayDelete"
      />
    </div>

  </div>
</template>

<script setup lang="ts">
// WB: WBCanvas — main Konva canvas component for Winterboard
// Ref: ARCHITECTURE.md ADR-01, BoardCanvas.vue (classroom reference)
// Stripped of: classroom session linking, stealth autosave, save window guards, presence cursors

import { ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Konva from 'konva'
import getStroke from 'perfect-freehand'
import type { WBStroke, WBAsset, WBToolType, WBPoint, WBPageBackground, WBPdfBackground, WBSelectionRect } from '../../types/winterboard'
import { useWBStore } from '../../board/state/boardStore'
import { usePageGrid } from '../../composables/usePageGrid'
import { useRectSelect, getStrokeBBox, getAssetBBox } from '../../composables/useRectSelect'
import { useGrouping } from '../../composables/useGrouping'
import { useLocking } from '../../composables/useLocking'
import { useLaserPointer } from '../../composables/useLaserPointer'
import { useDuplicate } from '../../composables/useDuplicate'
import { useStickyNotes } from '../../composables/useStickyNotes'
import WBStickyNote from './WBStickyNote.vue'
import WBGeometry2D from './WBGeometry2D.vue'
import DocumentViewerAsset from './DocumentViewerAsset.vue'
import AudioBadge from './AudioBadge.vue'
import TextBadge from './TextBadge.vue'
import TextOverlay from './TextOverlay.vue'
import { audioManager } from '../../utils/audioManager'
import AudioPlayerObject from '../board/objects/AudioPlayerObject.vue'
import VideoPlayerObject from '../board/objects/VideoPlayerObject.vue'
import YouTubePlayerObject, { type WBYouTubeAsset } from '../board/objects/YouTubePlayerObject.vue'
import type { WBAudioAsset, WBVideoAsset } from '../../types/mediaObjects'
import type { VideoSyncState } from '../../composables/useMediaSync'
import { useImageCache } from '../../composables/useImageCache'
import { getSmoothedPoints, clearSmoothedCache } from '../../engine/smoothing'
import { handleDrop as imageHandleDrop } from '../../composables/useImageUpload'
import { SIDEBAR_DRAG_MIME, CONTENT_DRAG_MIME } from '../../types/boardDrop'
import { loadKonva } from '../../engine/konvaLoader'
import { PAGE_SHADOW } from '../../constants/pageShadow'
import { WBSpatialIndex } from '../../engine/spatialIndex'
import {
  snapZoom,
  zoomToCursor,
  fitToPage,
  pinchDistance,
  pinchCenter,
  ZOOM_WHEEL_STEP,
  ZOOM_MIN,
  ZOOM_MAX,
} from '../../engine/zoomPan'

// A3.3: Performance benchmark flag — set to true in dev to see console.time markers
const __DEV_PERF__ = import.meta.env.DEV && import.meta.env.VITE_WB_PERF === 'true'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  tool?: WBToolType
  color?: string
  size?: number
  opacity?: number
  strokes?: WBStroke[]
  assets?: WBAsset[]
  width?: number
  height?: number
  zoom?: number
  /** A5.2: Page background — 'white' | 'grid' | 'dots' | 'lined' | WBPdfBackground */
  background?: WBPageBackground
  /** Phase 3C: show full audio/video controls (true for tutor/solo, false for student) */
  isTutor?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tool: 'pen',
  color: '#1e293b',
  size: 2,
  opacity: 1,
  width: 1920,
  height: 1080,
  zoom: 1,
  background: 'white',
  // Default to tutor mode so solo boards always show controls.
  // Classroom passes isTutor explicitly based on user role.
  isTutor: true,
})

// v5 A1: Store + rectangle select composable
const wbStore = useWBStore()
const rectSelect = useRectSelect(wbStore)
// v5 A2: Grouping composable
const grouping = useGrouping(wbStore)
// v5 A3: Locking composable
const locking = useLocking(wbStore)
// v5 A4: Laser pointer composable (ephemeral — not persisted)
const laserPointer = useLaserPointer({
  onBroadcast: (data) => emit('laser-broadcast', data),
  getPageId: () => wbStore.currentPage?.id ?? '',
})
// Remote laser listener (classroom sync)
function onRemoteLaser(e: Event) {
  const d = (e as CustomEvent).detail
  if (!d) return
  console.info(`[WB:Sync] onRemoteLaser x=${d.x?.toFixed?.(0)} y=${d.y?.toFixed?.(0)} active=${d.active} from=${d.userId}`)
  laserPointer.updateRemoteLaser({
    userId: d.userId,
    displayName: d.displayName,
    x: d.x,
    y: d.y,
    pageId: d.pageId ?? '',
    active: d.active,
    color: d.color ?? '#ff0000',
    lastUpdate: Date.now(),
  })
}
window.addEventListener('wb:remote-laser', onRemoteLaser)

// v5 A5: Duplicate composable
const duplicate = useDuplicate(wbStore)
// v5 A9: Sticky notes composable
const stickyNotes = useStickyNotes(wbStore)
// A9 (responsive): Per-page grid composable — starts the watcher that generates gridPatternDataUrl
const { currentPageGrid } = usePageGrid()

// Stable references — use props directly, fallback to empty array only once
const allStrokes = computed(() => props.strokes ?? [])
const assets = computed(() => props.assets ?? [])

// Phase 3C: Media assets (audio/video) rendered as HTML overlays — excluded from Konva
const mediaAssets = computed(() =>
  assets.value.filter(a => a.type === 'audio_player' || a.type === 'video_player' || a.type === 'youtube_player'),
)

// Phase 3C: Type cast helpers for media assets
function asAudioAsset(asset: WBAsset): WBAudioAsset { return asset as unknown as WBAudioAsset }
function asVideoAsset(asset: WBAsset): WBVideoAsset { return asset as unknown as WBVideoAsset }
function asYouTubeAsset(asset: WBAsset): WBYouTubeAsset { return asset as unknown as WBYouTubeAsset }

// ── Object Audio: badge overlay + toolbar integration ───────────────────────

// Items (strokes + assets) that have an audio annotation
const itemsWithAudio = computed(() => {
  const result: (WBStroke | WBAsset)[] = []
  for (const s of allStrokes.value) {
    if (s.audioUrl) result.push(s)
  }
  for (const a of assets.value) {
    if (a.audioUrl) result.push(a)
  }
  return result
})

// Position badge at top-right corner of object (canvas coords → screen coords)
// FIX: include canvasOffset for correct positioning during pan/scroll
function audioBadgePosition(item: WBStroke | WBAsset) {
  const zoom = props.zoom
  const offset = wbStore.canvasOffset
  let x: number, y: number, w: number

  if ('points' in item && (item as WBStroke).points) {
    const stroke = item as WBStroke
    if ((stroke.tool === 'rectangle' || stroke.tool === 'circle' || stroke.tool === 'line') && stroke.points[0]) {
      x = stroke.points[0].x
      y = stroke.points[0].y
      w = stroke.width ?? 0
    } else {
      let minX = Infinity, minY = Infinity, maxX = -Infinity
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
      }
      x = minX
      y = minY
      w = maxX - minX
    }
  } else {
    const asset = item as WBAsset
    x = asset.x
    y = asset.y
    w = asset.w
  }

  // INV I2: In replay mode, audio badges must be ABOVE the readonly overlay
  // (z-index 20 in WBSoloRoom) so clicks reach the AudioBadge icon.
  // In edit mode, z-index 15 is enough (no overlay).
  const badgeZ = wbStore.mode === 'replay' ? 25 : 15

  return {
    position: 'absolute' as const,
    left: `${(x + w) * zoom + offset.x - 12}px`,
    top: `${y * zoom + offset.y - 12}px`,
    pointerEvents: 'none' as const,
    zIndex: badgeZ,
  }
}

function getAudioBadgeState(objectId: string): 'idle' | 'recording' | 'playing' | 'uploading' {
  const obj = wbStore.getObjectById(objectId)
  if (!obj) return 'idle'
  const url = (obj as WBStroke).audioUrl ?? (obj as WBAsset).audioUrl
  if (url && audioManager.isUrlPlaying(url)) return 'playing'
  return 'idle'
}

function handleAudioBadgeClick(item: WBStroke | WBAsset) {
  const url = (item as WBStroke).audioUrl ?? (item as WBAsset).audioUrl
  if (!url) return

  // Emit for parent to handle (replay mode needs pause/resume integration)
  emit('audio-badge-click', url)

  // Default behavior: select object + toggle audio (edit mode).
  // In replay mode, parent's handler will manage via useReplayAudio instead.
  if (wbStore.mode !== 'replay') {
    wbStore.selectItems([item.id])
    audioManager.toggle(url)
  }
}

// ── Object Text: badge overlay + overlay integration ─────────────────────────

const itemsWithText = computed(() => {
  const result: (WBStroke | WBAsset)[] = []
  for (const s of allStrokes.value) {
    if (s.text) result.push(s)
  }
  for (const a of assets.value) {
    // Exclude stickies — they have their own text rendering
    if (a.text && a.type !== 'sticky') result.push(a)
  }
  return result
})

// Text badge position: offset from audio badge (shifted left)
function textBadgePosition(item: WBStroke | WBAsset) {
  const base = audioBadgePosition(item)
  // Offset to the left of audio badge (or where audio badge would be)
  const hasAudio = (item as WBStroke).audioUrl || (item as WBAsset).audioUrl
  const leftOffset = hasAudio ? -30 : 0
  return {
    ...base,
    left: `calc(${base.left} + ${leftOffset}px)`,
  }
}

// Overlay state
const activeTextObjectId = ref<string | null>(null)

const activeTextObject = computed(() => {
  if (!activeTextObjectId.value) return null
  return wbStore.getObjectById(activeTextObjectId.value) ?? null
})

// Close overlay if object is deleted (watch selectedIds instead of deep pages — no perf cost)
watch(() => wbStore.selectedIds, () => {
  if (activeTextObjectId.value && !wbStore.getObjectById(activeTextObjectId.value)) {
    activeTextObjectId.value = null
  }
})

const textOverlayPosition = computed(() => {
  if (!activeTextObject.value) return {}
  const item = activeTextObject.value
  const zoom = props.zoom
  const offset = wbStore.canvasOffset
  const isAsset = 'w' in item && 'h' in item
  const x = isAsset ? (item as WBAsset).x : ((item as WBStroke).points?.[0]?.x ?? 0)
  const y = isAsset ? (item as WBAsset).y + (item as WBAsset).h : ((item as WBStroke).points?.[0]?.y ?? 0) + 30
  return {
    position: 'absolute' as const,
    left: `${x * zoom + offset.x}px`,
    top: `${y * zoom + offset.y + 16}px`,
    zIndex: 30,
    pointerEvents: 'auto' as const,
  }
})

function handleTextBadgeClick(objectId: string) {
  // Toggle: click again to close
  activeTextObjectId.value = activeTextObjectId.value === objectId ? null : objectId
}

function handleTextOverlaySave(text: string) {
  if (!activeTextObjectId.value) return
  wbStore.setObjectText(activeTextObjectId.value, text)
  // Keep overlay open → it will close itself via emit('close')
}

function handleTextOverlayDelete() {
  if (!activeTextObjectId.value) return
  wbStore.setObjectText(activeTextObjectId.value, undefined)
  activeTextObjectId.value = null
}

function handleDeleteSelected() {
  const ids = [...wbStore.selectedIds]
  for (const id of ids) {
    const obj = wbStore.getObjectById(id)
    if (!obj) continue
    const objType = wbStore.getObjectType(obj)
    if (objType && ['image', 'audio_player', 'video_player', 'youtube_player', 'sticky', 'pdf'].includes(objType)) {
      emit('asset-delete', id)
    } else {
      emit('stroke-delete', id)
    }
  }
  wbStore.clearSelection()
}

function handleAudioUploaded(objectId: string, audioUrl: string, duration: number | null) {
  const obj = wbStore.getObjectById(objectId)
  if (!obj) return
  const isAsset = 'w' in obj && 'h' in obj && 'type' in obj
  if (isAsset) {
    emit('asset-update', { ...(obj as WBAsset), audioUrl, audioDuration: duration ?? undefined })
  } else {
    emit('stroke-update', { ...(obj as WBStroke), audioUrl, audioDuration: duration ?? undefined })
  }
}

function handleAudioDeleted(objectId: string) {
  const obj = wbStore.getObjectById(objectId)
  if (!obj) return
  const isAsset = 'w' in obj && 'h' in obj && 'type' in obj
  if (isAsset) {
    const { audioUrl: _a, audioDuration: _d, ...rest } = obj as WBAsset
    emit('asset-update', { ...rest, audioUrl: undefined, audioDuration: undefined } as WBAsset)
  } else {
    const { audioUrl: _a, audioDuration: _d, ...rest } = obj as WBStroke
    emit('stroke-update', { ...rest, audioUrl: undefined, audioDuration: undefined } as WBStroke)
  }
}

// Phase 3C: Local video state (no WebSocket in solo mode — managed locally)
const localVideoStates = ref<Record<string, VideoSyncState>>({})

function localSendPlay(objectId: string, position?: number) {
  localVideoStates.value = {
    ...localVideoStates.value,
    [objectId]: { playing: true, position: position ?? 0, serverTimestamp: Date.now() },
  }
}
function localSendPause(objectId: string) {
  const prev = localVideoStates.value[objectId]
  localVideoStates.value = {
    ...localVideoStates.value,
    [objectId]: { playing: false, position: prev?.position ?? 0, serverTimestamp: Date.now() },
  }
}
function localSendSeek(objectId: string, position: number) {
  const prev = localVideoStates.value[objectId]
  localVideoStates.value = {
    ...localVideoStates.value,
    [objectId]: { playing: prev?.playing ?? false, position, serverTimestamp: Date.now() },
  }
}

// A9: Per-page grid pattern image — loaded from wbStore.gridPatternDataUrl (canvas tile dataURL)
// shallowRef avoids deep reactivity overhead on an HTMLImageElement
const gridPatternImageEl = shallowRef<HTMLImageElement | null>(null)

// Phase 35 B6: Force Konva background layer redraw when page background color changes.
// Background layer is cached (cacheBackgroundLayer), so clearCache + batchDraw is required.
watch(
  () => wbStore.currentPageBgColor,
  () => {
    nextTick(() => {
      const layer = backgroundLayerRef.value?.getNode?.()
      layer?.clearCache?.()
      layer?.batchDraw?.()
    })
  },
)

// REPLAY-FIX-7: Page switch (page_navigate / replay) — always invalidate cached
// background layer. Watcher на currentPageBgColor не спрацьовує, якщо у нової сторінки
// той самий колір (або undefined→fallback), тому фон попередньої сторінки лишається
// "запеченим" у Konva cache. Hard-redraw на зміну currentPageIndex гарантує оновлення.
watch(
  () => wbStore.currentPageIndex,
  () => {
    nextTick(() => {
      const layer = backgroundLayerRef.value?.getNode?.()
      layer?.clearCache?.()
      layer?.batchDraw?.()
    })
  },
)

watch(
  () => wbStore.gridPatternDataUrl,
  (dataUrl) => {
    if (!dataUrl) {
      gridPatternImageEl.value = null
      // BUG-1b FIX: Clear Konva layer cache before redraw.
      // cacheBackgroundLayer() freezes the layer as a static bitmap on mount.
      // Without clearCache(), batchDraw() repaints the OLD cached grid — changes are invisible.
      nextTick(() => {
        const layer = backgroundLayerRef.value?.getNode?.()
        layer?.clearCache?.()
        layer?.batchDraw?.()
      })
      return
    }
    const img = new Image()
    img.onload = () => {
      gridPatternImageEl.value = img
      // BUG-1b FIX: Clear layer cache so Konva re-renders with new fillPatternImage.
      // nextTick ensures vue-konva has applied updated pageGridPatternConfig to Konva node first.
      nextTick(() => {
        const layer = backgroundLayerRef.value?.getNode?.()
        layer?.clearCache?.()
        layer?.batchDraw?.()
      })
    }
    img.src = dataUrl
  },
  { immediate: true },
)

// A6.2: Spatial index for viewport culling (replaces A3.3 inline filter)
const spatialIndex = new WBSpatialIndex(500)

// A6.2: Virtual rendering — spatial index query for visible strokes
// 7.A2: viewport origin uses scroll offset so culling works when panned
const strokes = computed(() => {
  const all = allStrokes.value
  if (all.length <= LAZY_RENDER_THRESHOLD) return all

  // Viewport bounds in canvas coordinates (account for scroll offset)
  const vw = props.width / props.zoom
  const vh = props.height / props.zoom
  const vx = (containerRef.value?.scrollLeft ?? 0) / props.zoom
  const vy = (containerRef.value?.scrollTop ?? 0) / props.zoom

  const visibleIds = spatialIndex.query({ x: vx, y: vy, w: vw, h: vh })

  return all.filter((s) => visibleIds.has(s.id))
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'stroke-add': [stroke: WBStroke]
  'stroke-update': [stroke: WBStroke]
  'stroke-delete': [strokeId: string]
  'asset-add': [asset: WBAsset]
  'asset-update': [asset: WBAsset]
  'asset-delete': [assetId: string]
  'select': [id: string | null]
  'cursor-move': [payload: { x: number; y: number; tool: WBToolType; color: string }]
  // A5.3: Zoom/pan events
  'zoom-change': [zoom: number]
  'scroll-change': [scrollX: number, scrollY: number]
  'fit-to-page': []
  // v5 A4: Tool change from keyboard shortcut
  'tool-change': [tool: WBToolType]
  'laser-broadcast': [data: { x: number; y: number; active: boolean; page_id?: string }]
  // PLAN_v4: Document Viewer expand (presentation fullscreen)
  'presentation-expand': [asset: WBAsset]
  // Audio layer: emitted on audio badge click — parent decides behavior
  // (edit mode: toggle audio; replay mode: pause replay + play audio)
  'audio-badge-click': [url: string]
  // GeoBoard: geometry creation at canvas position
  'geometry-create': [x: number, y: number]
  // DocumentViewer: double-click on page counter → open page jump input
  'doc-viewer-page-jump': [assetId: string]
}>()

// ─── Refs ───────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<InstanceType<typeof Konva.Stage> | null>(null)
const backgroundLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const strokesLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const assetsLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const previewLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const uiLayerRef = ref(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const transformerRef = ref<{ getNode: () => Konva.Transformer } | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const stickyTextareaRef = ref<HTMLTextAreaElement | null>(null)

// ─── State ──────────────────────────────────────────────────────────────────

// A6.1: Loading state — true after Konva is ready
const konvaReady = ref(false)

// A6.3: Container dimensions for responsive sizing
const containerWidth = ref(0)
const containerHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

const isDrawing = ref(false)
const currentPoints = ref<WBPoint[]>([])

// P1.4: Stuck-drawing safeguard handlers (need setup-level scope for cleanup)
let forceStopDrawing: (() => void) | null = null
let onVisibilityChange: (() => void) | null = null

// A4.1: Pressure sensitivity — track last native PointerEvent for pressure capture
let lastNativePointerEvent: PointerEvent | null = null
let currentPointerType: string = 'mouse'

// BUG-1 FIX: Timestamp of last pen/stylus activity.
// Used to block zoom events that arrive shortly after pen strokes
// (tablet drivers and browsers emit synthetic wheel/pinch events).
let lastPenActivityTime = 0
const PEN_ZOOM_BLOCK_MS = 800
const shapePreview = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const selectedNode = shallowRef<Konva.Node | null>(null)
const editingText = ref<WBStroke | null>(null)
const editingTextValue = ref('')
// BUG-FIX: Guard against immediate blur after textarea creation
let textEditCreatedAt = 0
const TEXT_BLUR_GUARD_MS = 300
// v5 A9: Sticky note text editing state
const stickyEditingId = ref<string | null>(null)
const stickyEditingText = ref('')
let stickyEditCreatedAt = 0
// Plain Map — NOT reactive: Vue must NOT re-render all assets on every image load (flicker fix)
const loadedImages = new Map<string, HTMLImageElement>()

// Stroke config cache for performance (R10)
const strokeConfigCache = new Map<string, { sig: string; config: Record<string, unknown> }>()

// Asset config cache — memoizes getAssetConfig per asset to prevent Konva node churn during drawing
const assetConfigCache = new Map<string, { sig: string; config: Record<string, unknown> }>()

// rAF scheduling for preview canvas (A3.3)
let previewRafId: number | null = null

// A5.2: Image cache for PDF background images
const bgImageCache = useImageCache(() => {
  // Force Konva redraw when background image loads
  backgroundLayerRef.value?.getNode?.()?.batchDraw?.()
})

// A5.3: Pan state (middle mouse drag)
let isPanning = false
let panStartX = 0
let panStartY = 0
let panScrollStartX = 0
let panScrollStartY = 0

// A5.3: Pinch-to-zoom state
let isPinching = false
let pinchStartDist = 0
let pinchStartZoom = 1
let pinchCenterX = 0
let pinchCenterY = 0

// A5.3: Double-tap detection
let lastTapTime = 0
const DOUBLE_TAP_THRESHOLD_MS = 300

// A5.3: Smooth zoom animation
let zoomAnimFrameId: number | null = null
let zoomAnimTarget = 1
let zoomAnimCurrent = 1
let zoomAnimStartTime = 0

// Lazy rendering threshold (A3.3: >500 strokes → viewport culling)
const LAZY_RENDER_THRESHOLD = 500

// ─── Computed ───────────────────────────────────────────────────────────────

const currentTool = computed(() => props.tool)

const cursorClass = computed(() => {
  // v5 A4: Laser active → hide cursor (dot replaces it)
  if (props.tool === 'laser' && laserPointer.isActive.value) return 'wb-canvas--laser-active'
  switch (props.tool) {
    case 'eraser': return 'wb-canvas--eraser'
    case 'text': return 'wb-canvas--text'
    case 'select': return 'wb-canvas--select'
    case 'laser': return 'wb-canvas--laser'
    default: return 'wb-canvas--drawing'
  }
})

// INV-1: Canvas NEVER resizes — only stage.scale() + stage.position()
// Use container size for stage width/height, zoom only for scale transform.
// When container size is available from store, use it; otherwise fallback to props.
const stageConfig = computed(() => {
  const cw = wbStore.containerWidth
  const ch = wbStore.containerHeight
  const offset = wbStore.canvasOffset
  return {
    width: cw > 0 ? cw : props.width * props.zoom,
    height: ch > 0 ? ch : props.height * props.zoom,
    scaleX: props.zoom,
    scaleY: props.zoom,
    x: cw > 0 ? offset.x : 0,
    y: ch > 0 ? offset.y : 0,
  }
})

const backgroundConfig = computed(() => ({
  x: 0,
  y: 0,
  width: props.width,
  height: props.height,
  // Phase 35 B6: Per-page background color
  fill: wbStore.currentPageBgColor || '#ffffff',
  name: 'background',
  // Page boundary shadow — config from constants/pageShadow.ts
  ...PAGE_SHADOW,
}))

// A5.2: PDF background image config
const pdfBackgroundConfig = computed<Record<string, unknown> | null>(() => {
  const bg = props.background
  if (!bg || typeof bg === 'string') return null
  if (bg.type !== 'pdf') return null

  const img = bgImageCache.get(bg.url)
  if (!img) return null

  return {
    x: 0,
    y: 0,
    width: props.width,
    height: props.height,
    image: img,
    listening: false,
    name: 'pdf-background',
  }
})

// A5.2: Background pattern type helper
const bgPatternType = computed<string>(() => {
  const bg = props.background
  if (!bg) return 'white'
  if (typeof bg === 'string') return bg
  return bg.type
})

// A5.2: PDF background loading state
const pdfBgLoading = computed<boolean>(() => {
  const bg = props.background
  if (!bg || typeof bg === 'string') return false
  if (bg.type !== 'pdf') return false
  return bgImageCache.getState(bg.url) === 'loading'
})

const pdfBgError = computed<boolean>(() => {
  const bg = props.background
  if (!bg || typeof bg === 'string') return false
  if (bg.type !== 'pdf') return false
  return bgImageCache.isBroken(bg.url)
})

// A9: Per-page grid pattern config — fillPatternImage tiles across the full page
// Only renders when grid is enabled AND the tile image is loaded into Konva
const pageGridPatternConfig = computed<Record<string, unknown> | null>(() => {
  const img = gridPatternImageEl.value
  const grid = currentPageGrid.value
  if (!img || !grid.enabled) return null
  return {
    x: 0,
    y: 0,
    width: props.width,
    height: props.height,
    fillPatternImage: img,
    fillPatternRepeat: 'repeat',
    listening: false,
    name: 'page-grid-overlay',
  }
})


// A4.2: Konva shape preview config for dedicated preview layer
const konvaShapePreview = computed<{ type: string; config: Record<string, unknown> }>(() => {
  if (!isDrawing.value || !shapePreview.value) return { type: '', config: {} }

  const tool = currentTool.value
  const sp = shapePreview.value

  if (tool === 'rectangle') {
    return {
      type: 'rectangle',
      config: {
        x: sp.x,
        y: sp.y,
        width: sp.width,
        height: sp.height,
        stroke: props.color,
        strokeWidth: props.size,
        fill: 'transparent',
        opacity: props.opacity,
        perfectDrawEnabled: false,
        listening: false,
      },
    }
  }

  if (tool === 'circle') {
    return {
      type: 'circle',
      config: {
        x: sp.x + sp.width / 2,
        y: sp.y + sp.height / 2,
        radiusX: sp.width / 2,
        radiusY: sp.height / 2,
        stroke: props.color,
        strokeWidth: props.size,
        fill: 'transparent',
        opacity: props.opacity,
        perfectDrawEnabled: false,
        listening: false,
      },
    }
  }

  if (tool === 'line' && currentPoints.value.length >= 2) {
    const start = currentPoints.value[0]
    const end = currentPoints.value[currentPoints.value.length - 1]
    return {
      type: 'line',
      config: {
        points: [start.x, start.y, end.x, end.y],
        stroke: props.color,
        strokeWidth: props.size,
        lineCap: 'round',
        lineJoin: 'round',
        opacity: props.opacity,
        perfectDrawEnabled: false,
        listening: false,
      },
    }
  }

  return { type: '', config: {} }
})

// Soft selection transformer — indigo palette, subtle handles
const transformerConfig = computed(() => ({
  anchorSize: 9,
  anchorCornerRadius: 2,
  anchorFill: '#ffffff',
  anchorStroke: 'rgba(99, 102, 241, 0.7)',
  anchorStrokeWidth: 1.5,
  borderStroke: 'rgba(99, 102, 241, 0.45)',
  borderStrokeWidth: 1,
  padding: 3,
  anchorShadowColor: 'rgba(99, 102, 241, 0.2)',
  anchorShadowBlur: 6,
  anchorShadowOffsetX: 0,
  anchorShadowOffsetY: 1,
  rotateEnabled: true,
  keepRatio: true,
  enabledAnchors: [
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ],
}))

// Selection rect (rubber band) — soft indigo
const selectionRectConfig = computed(() => {
  const rect = wbStore.selectionRect
  if (!rect) return null
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    fill: 'rgba(99, 102, 241, 0.06)',
    stroke: 'rgba(99, 102, 241, 0.45)',
    strokeWidth: 1 / props.zoom,
    dash: [5 / props.zoom, 3 / props.zoom],
    cornerRadius: 2 / props.zoom,
    shadowColor: 'rgba(99, 102, 241, 0.15)',
    shadowBlur: 6 / props.zoom,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    listening: false,
    perfectDrawEnabled: false,
  }
})

// v5 A1: Selection indicator configs — WOW design: solid glow border around each selected item
const selectionIndicators = computed(() => {
  const ids = new Set(wbStore.selectedIds)
  if (ids.size === 0) return []

  const page = wbStore.currentPage
  if (!page) return []

  const indicators: Array<{ key: string; config: Record<string, unknown> }> = []
  const pad = 4 / props.zoom
  const sw = 1.5 / props.zoom
  const glow = 10 / props.zoom

  // Soft selection indicator — indigo glow, barely-there border
  const selConfig = (x: number, y: number, w: number, h: number) => ({
    x: x - pad,
    y: y - pad,
    width: w + pad * 2,
    height: h + pad * 2,
    cornerRadius: 3 / props.zoom,
    stroke: 'rgba(99, 102, 241, 0.4)',
    strokeWidth: sw,
    fill: 'rgba(99, 102, 241, 0.03)',
    shadowColor: 'rgba(99, 102, 241, 0.25)',
    shadowBlur: glow,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    listening: false,
    perfectDrawEnabled: false,
  })

  for (const stroke of page.strokes) {
    if (!ids.has(stroke.id)) continue
    const bbox = getStrokeBBox(stroke)
    indicators.push({
      key: `sel-${stroke.id}`,
      config: selConfig(bbox.x, bbox.y, bbox.width, bbox.height),
    })
  }

  for (const asset of page.assets) {
    if (!ids.has(asset.id)) continue
    // Media assets get CSS ring from wb-media-overlay--selected, skip Konva indicator for them
    if (asset.type === 'audio_player' || asset.type === 'video_player' || asset.type === 'youtube_player') continue
    const bbox = getAssetBBox(asset)
    indicators.push({
      key: `sel-${asset.id}`,
      config: selConfig(bbox.x, bbox.y, bbox.width, bbox.height),
    })
  }

  return indicators
})

// v5 A2: Group indicator configs — dashed border around group bounding box
const groupIndicators = computed(() => {
  const selectedIds = new Set(wbStore.selectedIds)
  if (selectedIds.size === 0) return []

  const page = wbStore.currentPage
  if (!page) return []

  const groups = page.groups ?? []
  if (groups.length === 0) return []

  const indicators: Array<{ key: string; config: Record<string, unknown> }> = []

  for (const group of groups) {
    // Only show group indicator if at least one item in the group is selected
    const hasSelectedItem = group.itemIds.some((id) => selectedIds.has(id))
    if (!hasSelectedItem) continue

    // Compute union bounding box of all items in the group
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const itemId of group.itemIds) {
      const stroke = page.strokes.find((s) => s.id === itemId)
      if (stroke) {
        const bbox = getStrokeBBox(stroke)
        if (bbox.x < minX) minX = bbox.x
        if (bbox.y < minY) minY = bbox.y
        if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width
        if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height
        continue
      }
      const asset = page.assets.find((a) => a.id === itemId)
      if (asset) {
        const bbox = getAssetBBox(asset)
        if (bbox.x < minX) minX = bbox.x
        if (bbox.y < minY) minY = bbox.y
        if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width
        if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height
      }
    }

    if (!isFinite(minX)) continue

    const pad = 10 / props.zoom
    indicators.push({
      key: `grp-${group.id}`,
      config: {
        x: minX - pad,
        y: minY - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
        // WOW: purple group indicator (distinct from blue selection)
        stroke: '#8b5cf6',
        strokeWidth: 1.5 / props.zoom,
        dash: [6 / props.zoom, 4 / props.zoom],
        fill: 'rgba(139, 92, 246, 0.04)',
        cornerRadius: 6 / props.zoom,
        shadowColor: 'rgba(139, 92, 246, 0.3)',
        shadowBlur: 6 / props.zoom,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        listening: false,
        perfectDrawEnabled: false,
      },
    })
  }

  return indicators
})

// ─── Group Drag Overlay ──────────────────────────────────────────────────────
// HTML div overlay for multi-selection group move. Covers entire selection bbox.
// This approach avoids needing to click on thin strokes — click ANYWHERE inside.

const OVERLAY_PAD = 12 // px padding around selection bbox

const groupDragOverlayStyle = computed(() => {
  if (wbStore.selectedIds.length < 2) return null
  if (currentTool.value !== 'select') return null

  const page = wbStore.currentPage
  if (!page) return null

  // Compute union bbox of all selected items (canvas-space)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const id of wbStore.selectedIds) {
    const stroke = page.strokes.find(s => s.id === id)
    if (stroke) {
      const bbox = getStrokeBBox(stroke)
      minX = Math.min(minX, bbox.x)
      minY = Math.min(minY, bbox.y)
      maxX = Math.max(maxX, bbox.x + bbox.width)
      maxY = Math.max(maxY, bbox.y + bbox.height)
      continue
    }
    const asset = page.assets.find(a => a.id === id)
    if (asset) {
      minX = Math.min(minX, asset.x)
      minY = Math.min(minY, asset.y)
      maxX = Math.max(maxX, asset.x + asset.w)
      maxY = Math.max(maxY, asset.y + asset.h)
    }
  }

  if (!isFinite(minX)) return null

  // Canvas-space → screen-space (relative to canvas container)
  const offset = wbStore.canvasOffset
  const zoom = props.zoom

  const left = (minX * zoom) + offset.x - OVERLAY_PAD
  const top = (minY * zoom) + offset.y - OVERLAY_PAD
  const width = (maxX - minX) * zoom + OVERLAY_PAD * 2
  const height = (maxY - minY) * zoom + OVERLAY_PAD * 2

  return {
    position: 'absolute' as const,
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    zIndex: 50, // above ALL canvas layers, below text editing (1000)
  }
})

// ── Group drag state & pointer handlers ──

/**
 * CRITICAL: Disable Konva stage event processing during overlay drag.
 * This is the only reliable way to prevent canvas from stealing events —
 * stopPropagation alone does NOT work because Konva listens at document/window level.
 */
function setStageListening(enabled: boolean): void {
  const stage = stageRef.value?.getStage?.()
  if (!stage) return
  stage.listening(enabled)
}

/** Прапор: group drag overlay активний — забороняє canvas очищати selection.
 *  MUST be ref() — used in template binding (:group-drag-active prop). */
const groupDragActive = ref(false)
/** Прапор: group move відбувся (drag delta > 0). Запобігає click-скиданню виділення. */
let groupMoveOccurred = false
/** Guard проти подвійного emit: handleGroupDragEnd реєструється на 3 events
 *  (pointerup/pointercancel/lostpointercapture). Браузер може стригерити більше одного. */
let groupDragEndProcessed = false
let groupDragLastPos = { x: 0, y: 0 }
let groupDragOverlayEl: HTMLElement | null = null

function handleGroupDragStart(e: PointerEvent): void {
  // Check if ALL selected are locked — skip drag
  const allLocked = wbStore.selectedIds.every(id => wbStore.isItemLocked(id))
  if (allLocked) return

  groupDragActive.value = true
  groupMoveOccurred = false
  groupDragEndProcessed = false
  groupDragLastPos = { x: e.clientX, y: e.clientY }

  // CRITICAL: Disable Konva stage — overlay becomes the ONLY event source.
  // This prevents canvas mousedown/click from firing clearSelection().
  setStageListening(false)

  // CRITICAL: use currentTarget (the overlay div), NOT target (could be child SVG)
  groupDragOverlayEl = e.currentTarget as HTMLElement

  // Pointer capture — drag won't break even with fast mouse movement
  groupDragOverlayEl.setPointerCapture(e.pointerId)
  groupDragOverlayEl.addEventListener('pointermove', handleGroupDragMove)
  groupDragOverlayEl.addEventListener('pointerup', handleGroupDragEnd)
  groupDragOverlayEl.addEventListener('pointercancel', handleGroupDragEnd)
  groupDragOverlayEl.addEventListener('lostpointercapture', handleGroupDragEnd)
}

function handleGroupDragMove(e: PointerEvent): void {
  if (!groupDragActive.value) return

  const zoom = props.zoom || 1
  // Delta in canvas-space (screen pixels → canvas units)
  const dx = (e.clientX - groupDragLastPos.x) / zoom
  const dy = (e.clientY - groupDragLastPos.y) / zoom

  if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return

  wbStore.moveSelectedUnlocked(dx, dy)
  groupDragLastPos = { x: e.clientX, y: e.clientY }
  groupMoveOccurred = true
}

function handleGroupDragEnd(e: PointerEvent): void {
  if (!groupDragActive.value || groupDragEndProcessed) return
  groupDragEndProcessed = true  // prevent duplicate emits from multi-event triggers

  // Cleanup listeners
  if (groupDragOverlayEl) {
    groupDragOverlayEl.removeEventListener('pointermove', handleGroupDragMove)
    groupDragOverlayEl.removeEventListener('pointerup', handleGroupDragEnd)
    groupDragOverlayEl.removeEventListener('pointercancel', handleGroupDragEnd)
    groupDragOverlayEl.removeEventListener('lostpointercapture', handleGroupDragEnd)
    try { groupDragOverlayEl.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    groupDragOverlayEl = null
  }

  // Emit ops for moved objects (one-time, not per-frame)
  wbStore.emitMoveOpsForSelected()

  // Re-enable Konva stage BEFORE clearing the flag.
  // Delay clearing the active flag so that any bubbled click/mouseup
  // that reaches the canvas is still blocked by the guard.
  setStageListening(true)
  setTimeout(() => {
    groupDragActive.value = false
  }, 50)
}

const textEditStyle = computed((): Record<string, string> => {
  if (!editingText.value) return {}
  const stroke = editingText.value
  const w = stroke.width || 200
  return {
    left: `${stroke.points[0].x * props.zoom}px`,
    top: `${stroke.points[0].y * props.zoom}px`,
    width: `${w * props.zoom}px`,
    fontSize: `${(stroke.size || 16) * props.zoom}px`,
    color: stroke.color,
    fontWeight: stroke.fontWeight === 700 ? 'bold' : 'normal',
    fontStyle: stroke.fontStyle === 'italic' ? 'italic' : 'normal',
    textAlign: stroke.textAlign || 'left',
    lineHeight: '1.4',
  }
})

// v5 A9: Sticky note text editing style
const stickyEditStyle = computed(() => {
  if (!stickyEditingId.value) return {}
  const page = wbStore.currentPage
  if (!page) return {}
  const asset = page.assets.find((a) => a.id === stickyEditingId.value)
  if (!asset || asset.type !== 'sticky') return {}
  return {
    position: 'absolute' as const,
    left: `${asset.x * props.zoom}px`,
    top: `${asset.y * props.zoom}px`,
    width: `${asset.w * props.zoom}px`,
    height: `${asset.h * props.zoom}px`,
    fontSize: `${(asset.fontSize || 14) * props.zoom}px`,
    color: asset.textColor || '#1e293b',
    backgroundColor: asset.bgColor || '#fde047',
    border: '1.5px solid rgba(99, 102, 241, 0.5)',
    borderRadius: '4px',
    padding: '8px',
    resize: 'none' as const,
    outline: 'none',
    zIndex: 1000,
    fontFamily: 'inherit',
    lineHeight: '1.4',
    boxSizing: 'border-box' as const,
  }
})

// BUG-2 FIX: Computed trail points with opacity based on age
const laserTrailWithOpacity = computed(() => {
  const points = laserPointer.trailPoints.value
  if (points.length === 0) return []
  const now = Date.now()
  const duration = laserPointer.TRAIL_DURATION_MS
  return points.map((p) => {
    const age = now - p.t
    const opacity = Math.max(0, 1 - age / duration) * 0.8
    return { x: p.x, y: p.y, opacity }
  }).filter((p) => p.opacity > 0.01)
})

const remoteTrailWithOpacity = computed(() => {
  const points = laserPointer.remoteTrailPoints.value
  if (points.length === 0) return []
  const now = Date.now()
  const duration = laserPointer.TRAIL_DURATION_MS
  // Build userId→color map from active remote lasers
  const colorMap = new Map<string, string>()
  for (const laser of laserPointer.activeRemoteLasers.value) {
    colorMap.set(laser.userId, laser.color ?? '#ff0000')
  }
  return points.map((p) => {
    const age = now - p.t
    const opacity = Math.max(0, 1 - age / duration) * 0.8
    return { x: p.x, y: p.y, opacity, color: colorMap.get(p.userId) ?? '#ff0000' }
  }).filter((p) => p.opacity > 0.01)
})

function startStickyTextEdit(assetId: string): void {
  const page = wbStore.currentPage
  if (!page) return
  const asset = page.assets.find((a) => a.id === assetId)
  if (!asset || asset.type !== 'sticky') return
  if (asset.locked) return

  stickyEditCreatedAt = Date.now()
  stickyEditingId.value = assetId
  stickyEditingText.value = asset.text || ''

  nextTick(() => {
    setTimeout(() => {
      const ta = stickyTextareaRef.value
      if (ta) {
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      }
    }, 50)
  })
}

function finishStickyTextEdit(): void {
  if (!stickyEditingId.value) return
  if (Date.now() - stickyEditCreatedAt < TEXT_BLUR_GUARD_MS) return

  const id = stickyEditingId.value
  const text = stickyEditingText.value
  stickyNotes.updateText(id, text)

  stickyEditingId.value = null
  stickyEditingText.value = ''
}

function handleStickySelect(id: string): void {
  wbStore.selectItems([id])
}

function handleStickyDragEnd(id: string, x: number, y: number): void {
  stickyNotes.updatePosition(id, x, y)
}

function handleStickyTransformEnd(id: string, w: number, h: number): void {
  stickyNotes.updateDimensions(id, w, h)
}

// ─── PLAN_v4: Document Viewer handlers ──────────────────────────────────────

function handleDocViewerSelect(id: string): void {
  if (currentTool.value !== 'select') return
  wbStore.selectItems([id])
  emit('select', id)

  // Find the Konva Group node for this document viewer
  const layer = assetsLayerRef.value?.getNode?.()
  const node = layer?.findOne(`#${id}`) ?? null
  if (!node) return

  // Set selectedNode first — this triggers v-transformer to render (v-if="selectedNode")
  selectedNode.value = node

  // After v-transformer renders, attach it to the node for resize handles
  nextTick(() => {
    nextTick(() => {
      const transformer = transformerRef.value?.getNode()
      if (transformer && node) {
        transformer.nodes([node])
      }
    })
  })
}

function handleDocViewerDragEnd(id: string, x: number, y: number): void {
  const idx = assets.value.findIndex(a => a.id === id)
  if (idx === -1) return
  const updated = { ...assets.value[idx], x, y }
  assets.value[idx] = updated
  emit('asset-update', updated)
}

function handleDocViewerTransformEnd(id: string, w: number, h: number): void {
  const idx = assets.value.findIndex(a => a.id === id)
  if (idx === -1) return
  const layer = assetsLayerRef.value?.getNode?.()
  const node = layer?.findOne(`#${id}`)
  if (node) {
    // For Group nodes: compute final size from scale * original dimensions
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const origW = assets.value[idx].w
    const origH = assets.value[idx].h
    const finalW = Math.max(200, Math.round(origW * scaleX))
    const finalH = Math.max(200, Math.round(origH * scaleY))
    // Reset scale to 1 — we store absolute w/h
    node.scaleX(1)
    node.scaleY(1)
    const updated = { ...assets.value[idx], x: node.x(), y: node.y(), w: finalW, h: finalH }
    assets.value[idx] = updated
    emit('asset-update', updated)
  } else {
    // Fallback: use values from component emit
    const updated = { ...assets.value[idx], w, h }
    assets.value[idx] = updated
    emit('asset-update', updated)
  }
}

function handleDocViewerPageChange(id: string, page: number): void {
  const idx = assets.value.findIndex(a => a.id === id)
  if (idx === -1) return
  const asset = assets.value[idx]
  // Clamp page
  const totalPages = asset.totalPages ?? 0
  const clamped = Math.max(0, Math.min(page, totalPages - 1))
  const updated = { ...asset, currentPage: clamped }
  assets.value[idx] = updated
  // Broadcast only currentPage (P3: pages[] NOT in WS)
  emit('asset-update', updated)
}

function handleDocViewerExpand(asset: WBAsset): void {
  // Emit to room component — it will handle fullscreen presentation
  emit('presentation-expand', asset)
}

// ─── GeoBoard: Geometry 2D handlers ────────────────────────────────────────

function handleGeometryVertexMove(assetId: string, vertexIndex: number, x: number, y: number): void {
  // S1: granular Pinia mutation — only update the specific vertex
  wbStore.updateGeometryVertex(assetId, vertexIndex, { x, y })
}

function handleGeometryVertexDragStart(_assetId: string, _vertexIndex: number): void {
  // S3: undo blocked during active vertex drag — handled by disabling undo hotkey
  // in WBCanvas keydown handler when isDraggingGeometryVertex is true
}

function handleGeometryVertexDragEnd(asset: WBAsset): void {
  // G9: emit authoritative final state (full asset_update with all vertices)
  emit('asset-update', asset)
}

function handleGeometryCircleMove(assetId: string, cx: number, cy: number, radius: number): void {
  const idx = assets.value.findIndex(a => a.id === assetId)
  if (idx === -1) return
  const asset = assets.value[idx]
  if (!asset.geometryParams) return
  const updated: WBAsset = {
    ...asset,
    geometryParams: { ...asset.geometryParams, cx, cy, radius },
  }
  emit('asset-update', updated)
}

function handleGeometryCircleDragEnd(asset: WBAsset): void {
  emit('asset-update', asset)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * A4.1: Check if stroke points contain real pressure data (not all default 0.5).
 * Used to decide whether perfect-freehand should simulatePressure.
 */
function hasPressureData(points: WBPoint[]): boolean {
  if (points.length === 0) return false
  return points.some((p) => p.pressure !== undefined && p.pressure !== 0.5)
}

function getPointerPosition(): WBPoint | null {
  const stage = stageRef.value?.getStage()
  if (!stage) return null
  const pos = stage.getPointerPosition()
  if (!pos) return null

  // A4.1: Capture pressure from native PointerEvent
  let pressure = 0.5 // default for mouse
  if (lastNativePointerEvent) {
    const pe = lastNativePointerEvent
    currentPointerType = pe.pointerType || 'mouse'
    if (pe.pointerType === 'pen') {
      // Stylus: real pressure (0.0-1.0)
      pressure = pe.pressure > 0 ? pe.pressure : 0.5
      // BUG-1: Track pen activity time for zoom blocking
      lastPenActivityTime = Date.now()
    } else if (pe.pointerType === 'touch') {
      // Touch: use force if available, otherwise default
      pressure = pe.pressure > 0 ? pe.pressure : 0.5
    }
    // Mouse: always 0.5
  }

  return {
    x: pos.x / props.zoom,
    y: pos.y / props.zoom,
    t: Date.now(),
    pressure,
  }
}

/** Convert perfect-freehand output to SVG path */
function getSvgPathFromStroke(strokePoints: number[][]): string {
  if (!strokePoints.length) return ''
  const d = strokePoints.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...strokePoints[0], 'Q'] as (string | number)[],
  )
  d.push('Z')
  return d.join(' ')
}

// ─── Hit Graph Freeze (R10: performance during drawing) ─────────────────────

function freezeHitGraph(freeze: boolean): void {
  const layers = [strokesLayerRef, assetsLayerRef]
  for (const layerRef of layers) {
    const konvaLayer = layerRef.value?.getNode?.()
    if (!konvaLayer) continue
    try {
      konvaLayer.listening(!freeze)
    } catch (error) {
      console.warn('[WB:Canvas] freezeHitGraph failed', error)
    }
  }
}

// A4.2: Prevent main strokes layer from re-rendering during active drawing.
// We cache the layer and toggle its `visible` or skip batchDraw calls.
// Instead of hiding the layer (which would flash), we simply avoid triggering
// unnecessary redraws by using batchDraw only on mouseUp.
let mainLayerFrozen = false

function freezeMainLayerRendering(freeze: boolean): void {
  mainLayerFrozen = freeze
  // When unfreezing, schedule a single batchDraw to sync the layer
  if (!freeze) {
    const strokesLayer = strokesLayerRef.value?.getNode?.()
    if (strokesLayer) strokesLayer.batchDraw()
    const assetsLayer = assetsLayerRef.value?.getNode?.()
    if (assetsLayer) assetsLayer.batchDraw()
  }
}

// ─── Preview Canvas (offscreen double-buffer) ───────────────────────────────

interface CanvasBuffer {
  canvas: OffscreenCanvas | HTMLCanvasElement
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
}

const supportsOffscreenCanvas =
  typeof window !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
const isSafari =
  typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

const offscreenBuffers: CanvasBuffer[] = []
let activeBufferIndex = 0
let previewCtx: CanvasRenderingContext2D | null = null
let currentBitmap: ImageBitmap | null = null

function getStagePixelSize() {
  return {
    width: stageConfig.value.width,
    height: stageConfig.value.height,
  }
}

function createOffscreenBuffer(width: number, height: number): CanvasBuffer | null {
  if (supportsOffscreenCanvas) {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    return { canvas, ctx }
  }
  const fallback = document.createElement('canvas')
  fallback.width = width
  fallback.height = height
  const ctx = fallback.getContext('2d')
  if (!ctx) return null
  return { canvas: fallback, ctx }
}

function initPreviewCanvas(): void {
  const canvas = previewCanvasRef.value
  if (!canvas) return
  const { width, height } = getStagePixelSize()
  canvas.width = width
  canvas.height = height
  previewCtx = canvas.getContext('2d')

  offscreenBuffers.length = 0
  activeBufferIndex = 0
  for (let i = 0; i < 2; i++) {
    const buffer = createOffscreenBuffer(width, height)
    if (buffer) offscreenBuffers.push(buffer)
  }
  clearPreviewCanvas()
}

function getActiveBuffer(): CanvasBuffer | null {
  return offscreenBuffers[activeBufferIndex] ?? null
}

function advanceBuffer(): void {
  if (!offscreenBuffers.length) return
  activeBufferIndex = (activeBufferIndex + 1) % offscreenBuffers.length
}

function clearPreviewCanvas(): void {
  const { width, height } = getStagePixelSize()
  previewCtx?.clearRect(0, 0, width, height)
}

function flushPreviewCanvas(): void {
  if (!previewCtx) return
  const activeBuffer = getActiveBuffer()
  if (!activeBuffer) return

  const { width, height } = getStagePixelSize()
  previewCtx.clearRect(0, 0, width, height)

  if (
    !isSafari &&
    supportsOffscreenCanvas &&
    activeBuffer.canvas instanceof OffscreenCanvas &&
    'transferToImageBitmap' in activeBuffer.canvas
  ) {
    const bitmap = activeBuffer.canvas.transferToImageBitmap()
    currentBitmap?.close()
    currentBitmap = bitmap
    previewCtx.drawImage(bitmap, 0, 0, width, height)
  } else {
    previewCtx.drawImage(activeBuffer.canvas, 0, 0, width, height)
  }
}

/** Schedule preview draw via requestAnimationFrame (A3.3: avoid redundant draws) */
function schedulePreviewDraw(): void {
  if (previewRafId !== null) return
  previewRafId = requestAnimationFrame(() => {
    previewRafId = null
    drawPreviewCanvas()
  })
}

function drawPreviewCanvas(): void {
  if (__DEV_PERF__) console.time('[WB:Perf] drawPreview')
  const buffer = getActiveBuffer()
  if (!isDrawing.value || !buffer || !previewCtx) {
    clearPreviewCanvas()
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
    return
  }

  const tool = currentTool.value

  // A4.2: Shape previews (rect/circle/line) now use dedicated Konva preview layer
  // via konvaShapePreview computed — only pen/highlighter need Canvas2D preview
  if (tool === 'rectangle' || tool === 'line' || tool === 'circle') {
    // Konva preview layer handles these via reactive computed — just batchDraw it
    const previewLayer = previewLayerRef.value?.getNode?.()
    if (previewLayer) previewLayer.batchDraw()
    clearPreviewCanvas()
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
    return
  }

  if (tool !== 'pen' && tool !== 'highlighter') {
    clearPreviewCanvas()
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
    return
  }

  if (currentPoints.value.length < 2) {
    clearPreviewCanvas()
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
    return
  }

  const { width, height } = getStagePixelSize()
  const ctx = buffer.ctx
  ctx.save()
  ctx.clearRect(0, 0, width, height)

  const scale = props.zoom

  // A4.1: Apply Catmull-Rom smoothing to live preview (pen/highlighter only)
  const smoothed = currentPoints.value.length >= 4
    ? getSmoothedPoints('__preview__', tool, currentPoints.value)
    : currentPoints.value
  // A4.1: Pass pressure as triplets [x, y, pressure] to perfect-freehand
  const scaledPoints = smoothed.map((p) => [
    p.x * scale,
    p.y * scale,
    p.pressure ?? 0.5,
  ] as [number, number, number])
  const strokePath = getSvgPathFromStroke(
    getStroke(scaledPoints, {
      size: props.size * scale,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: !hasPressureData(currentPoints.value),
    }),
  )
  const path = new Path2D(strokePath)
  ctx.fillStyle = props.color
  ctx.globalAlpha = tool === 'highlighter' ? 0.4 : props.opacity
  ctx.globalCompositeOperation = tool === 'highlighter' ? 'multiply' : 'source-over'
  ctx.fill(path)

  ctx.restore()
  flushPreviewCanvas()
  advanceBuffer()
  if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  // Guard: if group drag overlay is active, canvas must NOT process events
  if (groupDragActive.value) return

  const pos = getPointerPosition()
  if (!pos) return

  // Selection mode (v5 A1: rectangle drag select + multi-select)
  if (currentTool.value === 'select') {
    const target = e.target
    const isBackground = target === stageRef.value?.getStage() || target.name() === 'background'
    const nativeEvent = (e.evt as MouseEvent | TouchEvent)
    const shiftKey = nativeEvent && 'shiftKey' in nativeEvent ? (nativeEvent as MouseEvent).shiftKey : false

    if (isBackground) {
      if (!shiftKey) {
        // Start rectangle drag selection on empty area
        rectSelect.startRectSelect(pos)
        isDrawing.value = true // reuse isDrawing flag for drag tracking
      } else {
        // Shift+click on empty — do nothing (keep current selection)
      }
    }
    // Click on a specific item is handled by handleStrokeClick/handleAssetClick
    return
  }

  // v5 A4: Laser pointer mode — ephemeral, no stroke creation
  if (currentTool.value === 'laser') {
    laserPointer.startLaser(pos.x, pos.y)
    return
  }

  // Eraser mode
  if (currentTool.value === 'eraser') {
    isDrawing.value = true
    handleErase(pos)
    return
  }

  // Text tool
  if (currentTool.value === 'text') {
    createTextAtPosition(pos)
    return
  }

  // BUG-4 FIX: Sticky note tool — create sticky at click position
  if (currentTool.value === 'sticky') {
    stickyNotes.createSticky(pos.x, pos.y)
    return
  }

  // GeoBoard: Geometry tool — emit creation event to parent
  if (currentTool.value === 'geometry') {
    emit('geometry-create', pos.x, pos.y)
    return
  }

  // Start drawing
  isDrawing.value = true
  currentPoints.value = [pos]

  if (currentTool.value === 'rectangle' || currentTool.value === 'line' || currentTool.value === 'circle') {
    shapePreview.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
  }

  // R10: Freeze hit graph during drawing for performance
  freezeHitGraph(true)
  // A4.2: Freeze main layer rendering during drawing
  freezeMainLayerRendering(true)
  schedulePreviewDraw()
}

function handleMouseMove(_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (groupDragActive.value) return

  const pos = getPointerPosition()
  if (!pos) return

  // 7.A1: Emit cursor position for presence (always, even when not drawing)
  emit('cursor-move', {
    x: pos.x,
    y: pos.y,
    tool: currentTool.value,
    color: props.color,
  })

  // v5 A4: Laser pointer move
  if (currentTool.value === 'laser' && laserPointer.isActive.value) {
    laserPointer.moveLaser(pos.x, pos.y)
    return
  }

  if (!isDrawing.value) return

  // v5 A1: Rectangle drag select update
  if (currentTool.value === 'select' && rectSelect.isDragging.value) {
    rectSelect.updateRectSelect(pos)
    return
  }

  // v5 A1: Move selected group
  if (currentTool.value === 'select' && rectSelect.isMoving.value) {
    rectSelect.updateMoveSelected(pos)
    groupMoveOccurred = true
    return
  }

  // Eraser drag
  if (currentTool.value === 'eraser') {
    handleErase(pos)
    return
  }

  // Drawing tools
  if (currentTool.value === 'pen' || currentTool.value === 'highlighter') {
    // Min distance filter to reduce noise (LAW-15: drawing fidelity)
    const lastPt = currentPoints.value[currentPoints.value.length - 1]
    if (lastPt) {
      const dx = pos.x - lastPt.x
      const dy = pos.y - lastPt.y
      if (dx * dx + dy * dy < 1) return // skip sub-pixel moves
    }
    currentPoints.value = [...currentPoints.value, pos]
  } else if (
    currentTool.value === 'rectangle' ||
    currentTool.value === 'line' ||
    currentTool.value === 'circle'
  ) {
    const start = currentPoints.value[0]
    shapePreview.value = {
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      width: Math.abs(pos.x - start.x),
      height: Math.abs(pos.y - start.y),
    }
    currentPoints.value = [start, pos]
  }

  schedulePreviewDraw()
}

// BUG-3 FIX: Global mouseup handler — stops drawing when mouse released outside canvas
function globalMouseUp(): void {
  if (groupDragActive.value) return
  if (isDrawing.value) {
    handleMouseUp()
  }
  // Also stop laser if active outside canvas
  if (currentTool.value === 'laser' && laserPointer.isActive.value) {
    laserPointer.stopLaser()
  }
}

function handleMouseUp(): void {
  if (groupDragActive.value) return

  // v5 A4: Stop laser pointer
  if (currentTool.value === 'laser') {
    laserPointer.stopLaser()
    return
  }

  // v5 A1: Finish rectangle drag select
  if (currentTool.value === 'select' && rectSelect.isDragging.value) {
    isDrawing.value = false
    rectSelect.finishRectSelect()
    return
  }

  // v5 A1: Finish move selected group
  if (currentTool.value === 'select' && rectSelect.isMoving.value) {
    isDrawing.value = false
    rectSelect.finishMoveSelected()
    return
  }

  if (!isDrawing.value) return
  isDrawing.value = false

  // R10: Unfreeze hit graph
  freezeHitGraph(false)
  // A4.2: Unfreeze main layer rendering — triggers single batchDraw
  freezeMainLayerRendering(false)

  if (currentPoints.value.length < 2) {
    currentPoints.value = []
    shapePreview.value = null
    return
  }

  // Create stroke
  const stroke: WBStroke = {
    id: generateId(),
    tool: currentTool.value as WBStroke['tool'],
    color: props.color,
    size: props.size,
    opacity: currentTool.value === 'highlighter' ? 0.4 : props.opacity,
    points: [...currentPoints.value],
  }

  if ((currentTool.value === 'rectangle' || currentTool.value === 'circle') && shapePreview.value) {
    stroke.width = shapePreview.value.width
    stroke.height = shapePreview.value.height
    stroke.points = [{ x: shapePreview.value.x, y: shapePreview.value.y, t: Date.now() }]
  }

  // Line: keep only start + end points
  if (currentTool.value === 'line' && stroke.points.length >= 2) {
    stroke.points = [stroke.points[0], stroke.points[stroke.points.length - 1]]
  }

  emit('stroke-add', stroke)

  // Reset
  currentPoints.value = []
  shapePreview.value = null

  // A4.2: Use batchDraw (not draw) for efficient composite after stroke finalization
  void nextTick(() => {
    const stage = stageRef.value?.getStage?.()
    stage?.batchDraw()
    requestAnimationFrame(() => {
      clearPreviewCanvas()
      // Clear Konva preview layer shapes
      const previewLayer = previewLayerRef.value?.getNode?.()
      if (previewLayer) previewLayer.batchDraw()
    })
  })
}

function handleErase(pos: WBPoint): void {
  const eraserRadius = Math.max(props.size * 2, 10)
  const toDelete: string[] = []

  // Use allStrokes (not viewport-filtered) so eraser works on all elements
  for (const stroke of allStrokes.value) {
    // v5 A3: Skip locked items — eraser cannot delete them
    if (stroke.locked) continue

    // Shapes (rectangle, circle): check bounding box
    if (stroke.tool === 'rectangle' || stroke.tool === 'circle') {
      const sx = stroke.points[0]?.x || 0
      const sy = stroke.points[0]?.y || 0
      const sw = stroke.width || 0
      const sh = stroke.height || 0

      if (
        pos.x >= sx - eraserRadius &&
        pos.x <= sx + sw + eraserRadius &&
        pos.y >= sy - eraserRadius &&
        pos.y <= sy + sh + eraserRadius
      ) {
        toDelete.push(stroke.id)
        continue
      }
    }

    // Text: check approximate bounding box (position + estimated size)
    if (stroke.tool === 'text') {
      const tx = stroke.points[0]?.x || 0
      const ty = stroke.points[0]?.y || 0
      const textLen = (stroke.text || '').length
      const estWidth = textLen * (stroke.size || 16) * 0.6
      const estHeight = (stroke.size || 16) * 1.4

      if (
        pos.x >= tx - eraserRadius &&
        pos.x <= tx + estWidth + eraserRadius &&
        pos.y >= ty - eraserRadius &&
        pos.y <= ty + estHeight + eraserRadius
      ) {
        toDelete.push(stroke.id)
        continue
      }
    }

    // Pen/highlighter/line: check points proximity
    let hit = false
    for (const point of stroke.points) {
      const dx = point.x - pos.x
      const dy = point.y - pos.y
      if (dx * dx + dy * dy < (eraserRadius + stroke.size) * (eraserRadius + stroke.size)) {
        hit = true
        break
      }
    }
    if (hit) {
      toDelete.push(stroke.id)
    }
  }

  // Emit deletions (batch to avoid multiple re-renders)
  for (const id of toDelete) {
    emit('stroke-delete', id)
  }
}

function createTextAtPosition(pos: WBPoint): void {
  const stroke: WBStroke = {
    id: generateId(),
    tool: 'text',
    color: props.color,
    size: Math.max(props.size * 4, 16),
    opacity: 1,
    points: [pos],
    text: '',
    width: 200,
    fontWeight: 400,
    fontStyle: 'normal',
    textAlign: 'left',
  }

  textEditCreatedAt = Date.now()
  editingText.value = stroke
  editingTextValue.value = ''

  // v-if textarea needs nextTick for DOM mount,
  // then setTimeout to escape Konva's event processing cycle.
  nextTick(() => {
    // Use setTimeout to break out of Konva's synchronous event chain
    // which can steal focus back to the stage element
    setTimeout(() => {
      const ta = textareaRef.value
      if (ta) {
        ta.focus()
      }
    }, 30)
  })
}

function handleTextEdit(stroke: WBStroke): void {
  textEditCreatedAt = Date.now()
  editingText.value = stroke
  editingTextValue.value = stroke.text || ''
  nextTick(() => {
    setTimeout(() => {
      const ta = textareaRef.value
      if (ta) {
        ta.focus()
      }
    }, 30)
  })
}

function finishTextEdit(): void {
  if (!editingText.value) return
  // Guard: ignore blur events that fire immediately after textarea creation
  // (caused by Konva stage reclaiming focus during its event processing)
  if (Date.now() - textEditCreatedAt < TEXT_BLUR_GUARD_MS) return

  const stroke: WBStroke = {
    ...editingText.value,
    text: editingTextValue.value,
  }

  if (editingTextValue.value.trim()) {
    if (editingText.value.text === undefined || editingText.value.text === '') {
      emit('stroke-add', stroke)
    } else {
      emit('stroke-update', stroke)
    }
  }

  editingText.value = null
  editingTextValue.value = ''
}

function handleKeydown(e: KeyboardEvent): void {
  // v5 A2: Ctrl+G → group selected, Ctrl+Shift+G → ungroup
  if (e.key === 'g' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    if (grouping.canGroup.value) {
      e.preventDefault()
      grouping.groupSelected()
    }
    return
  }
  if (e.key === 'G' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
    if (grouping.canUngroup.value) {
      e.preventDefault()
      grouping.ungroupSelected()
    }
    return
  }

  // v5 A3: Ctrl+Shift+L → lock selected items
  // Design decision: Ctrl+L conflicts with browser address bar, so we use Ctrl+Shift+L
  if (e.key === 'L' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
    if (locking.canLock.value) {
      e.preventDefault()
      locking.lockSelected()
    }
    return
  }
  // v5 A3: Ctrl+Shift+U → unlock selected items
  if (e.key === 'U' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
    if (locking.canUnlock.value) {
      e.preventDefault()
      locking.unlockSelected()
    }
    return
  }

  // Delete selected — v5 A1: support multi-select delete
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // v5 A1: Multi-select delete
    if (wbStore.hasSelection) {
      e.preventDefault()
      // v5 A3: Filter out locked items — they cannot be deleted
      const unlocked = wbStore.selectedIds.filter((id) => !wbStore.isItemLocked(id))
      if (unlocked.length > 0) {
        // Select only unlocked items, then delete
        wbStore.selectItems(unlocked)
        const deletedIds = [...unlocked]
        rectSelect.deleteSelected()
        // v5 A2: Auto-cleanup groups when items are deleted
        wbStore.removeItemsFromGroups(deletedIds)
      } else {
        // All selected items are locked — just clear selection
        wbStore.clearSelection()
      }
      selectedNode.value = null
      const transformer = transformerRef.value?.getNode()
      if (transformer) transformer.nodes([])
      return
    }

    // Legacy single-select delete
    if (selectedNode.value) {
      const nodeId = selectedNode.value.id()
      // v5 A3: Skip locked items
      if (wbStore.isItemLocked(nodeId)) return

      e.preventDefault()
      const nodeName = selectedNode.value.name() || ''

      if (nodeName.startsWith('stroke-')) {
        emit('stroke-delete', nodeId)
      } else if (nodeName.startsWith('asset-')) {
        emit('asset-delete', nodeId)
      }
      // v5 A2: Auto-cleanup groups
      wbStore.removeItemsFromGroups([nodeId])

      selectedNode.value = null
      const transformer = transformerRef.value?.getNode()
      if (transformer) transformer.nodes([])
    }
  }

  // v5 A5: Ctrl+D → duplicate selected items
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault() // prevent browser bookmark dialog
    if (duplicate.canDuplicate.value) {
      duplicate.duplicateSelected()
    }
    return
  }

  // v5 A9: 'S' → create sticky note at canvas center, switch to select tool
  if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    if (editingText.value) return
    if (stickyEditingId.value) return
    e.preventDefault()
    const cx = (props.width / 2) / (props.zoom || 1) + (wbStore.scrollX || 0)
    const cy = (props.height / 2) / (props.zoom || 1) + (wbStore.scrollY || 0)
    stickyNotes.createSticky(cx - 100, cy - 75)
    emit('tool-change', 'select')
    return
  }

  // v5 A4: 'L' → switch to laser tool (single-key, no modifier, not in text input)
  if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    if (editingText.value) return
    e.preventDefault()
    emit('tool-change', 'laser')
    return
  }

  // GeoBoard: 'G' (no modifier) → switch to geometry tool
  if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    if (editingText.value) return
    if (stickyEditingId.value) return
    e.preventDefault()
    emit('tool-change', 'geometry')
    return
  }

  // v5 A1: Escape clears selection
  if (e.key === 'Escape' && wbStore.hasSelection) {
    wbStore.clearSelection()
    selectedNode.value = null
    const transformer = transformerRef.value?.getNode()
    if (transformer) transformer.nodes([])
  }
}

// A4.3: Image drop handler — uses useImageUpload for validation (5MB, PNG/JPEG/WebP/GIF) + data URL
async function handleDrop(e: DragEvent): Promise<void> {
  // Skip sidebar/content-panel drops — they are handled by the parent component's drop handler.
  // Use dataTransfer.types (always accessible) instead of getData() for reliable detection.
  // This prevents a ghost asset being created when Chrome adds the dragged <img> to dataTransfer.files.
  const dragTypes = Array.from(e.dataTransfer?.types ?? [])
  if (dragTypes.includes(SIDEBAR_DRAG_MIME) || dragTypes.includes(CONTENT_DRAG_MIME)) return

  // Calculate drop position in canvas coordinates
  let dropX = props.width / 2
  let dropY = 100
  const rect = containerRef.value?.getBoundingClientRect()
  if (rect) {
    dropX = (e.clientX - rect.left) / (props.zoom || 1)
    dropY = (e.clientY - rect.top) / (props.zoom || 1)
  }

  const asset = await imageHandleDrop(e, dropX, dropY)
  if (asset) {
    // Center the asset on the drop point
    asset.x = dropX - asset.w / 2
    asset.y = dropY - asset.h / 2
    // Preload image into loadedImages cache
    preloadAssetImage(asset)
    emit('asset-add', asset)
  }
}

// A4.3: Image paste — now handled by useBoardClipboard composable in Room views

// ─── Media Overlay: Resize ───────────────────────────────────────────────────

const RESIZE_CORNERS = [
  { name: 'top-left', cursor: 'nwse-resize' },
  { name: 'top-right', cursor: 'nesw-resize' },
  { name: 'bottom-left', cursor: 'nesw-resize' },
  { name: 'bottom-right', cursor: 'nwse-resize' },
] as const

function isResizableMedia(asset: WBAsset): boolean {
  return asset.type === 'video_player' || asset.type === 'youtube_player'
}

const MIN_MEDIA_SIZE = 160 // мінімальний розмір (px) для відео/YouTube

/**
 * Pointer-based resize для media overlays (video/youtube).
 * Зберігає aspect ratio (16:9 або поточні пропорції).
 */
function handleMediaResizeStart(asset: WBAsset, corner: string, e: PointerEvent): void {
  const startX = e.clientX
  const startY = e.clientY
  const startW = asset.w
  const startH = asset.h
  const startAx = asset.x
  const startAy = asset.y
  const aspectRatio = startW / startH
  const zoom = props.zoom || 1

  const el = (e.target as HTMLElement).closest('.wb-media-overlay') as HTMLElement
  if (!el) return

  // Disable Konva during resize to prevent event stealing
  setStageListening(false)

  function onPointerMove(ev: PointerEvent) {
    const dx = (ev.clientX - startX) / zoom
    const dy = (ev.clientY - startY) / zoom

    let newW = startW
    let newH = startH
    let newX = startAx
    let newY = startAy

    // Визначаємо delta по домінуючій вісі та зберігаємо aspect ratio
    if (corner === 'bottom-right') {
      newW = Math.max(MIN_MEDIA_SIZE, startW + dx)
      newH = newW / aspectRatio
    } else if (corner === 'bottom-left') {
      newW = Math.max(MIN_MEDIA_SIZE, startW - dx)
      newH = newW / aspectRatio
      newX = startAx + (startW - newW)
    } else if (corner === 'top-right') {
      newW = Math.max(MIN_MEDIA_SIZE, startW + dx)
      newH = newW / aspectRatio
      newY = startAy + (startH - newH)
    } else if (corner === 'top-left') {
      newW = Math.max(MIN_MEDIA_SIZE, startW - dx)
      newH = newW / aspectRatio
      newX = startAx + (startW - newW)
      newY = startAy + (startH - newH)
    }

    // Оновити DOM напряму для smooth UX
    el.style.width = `${newW * zoom}px`
    el.style.height = `${newH * zoom}px`
    el.style.left = `${newX * zoom}px`
    el.style.top = `${newY * zoom}px`
  }

  function onPointerUp(ev: PointerEvent) {
    document.removeEventListener('pointermove', onPointerMove)
    // Re-enable Konva stage after resize
    setStageListening(true)

    const dx = (ev.clientX - startX) / zoom
    let newW = startW
    let newX = startAx
    let newY = startAy

    if (corner === 'bottom-right') {
      newW = Math.max(MIN_MEDIA_SIZE, startW + dx)
    } else if (corner === 'bottom-left') {
      newW = Math.max(MIN_MEDIA_SIZE, startW - dx)
      newX = startAx + (startW - newW)
    } else if (corner === 'top-right') {
      newW = Math.max(MIN_MEDIA_SIZE, startW + dx)
    } else if (corner === 'top-left') {
      newW = Math.max(MIN_MEDIA_SIZE, startW - dx)
      newX = startAx + (startW - newW)
    }
    const newH = newW / aspectRatio
    if (corner === 'top-right' || corner === 'top-left') {
      newY = startAy + (startH - newH)
    }

    emit('asset-update', { ...asset, w: Math.round(newW), h: Math.round(newH), x: newX, y: newY })
  }

  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp, { once: true })
}

// ─── Media Overlay: Drag + Select ───────────────────────────────────────────

/**
 * Phase 3C: Handle pointerdown on a media overlay (audio/video player).
 * - Selects the asset (adds to wbStore.selectedIds)
 * - In select mode: initiates custom pointer drag (DOM-direct, bypasses Konva)
 * - Stops propagation always to prevent drawing strokes on top of media
 *
 * Skip drag initiation if the click target is a native control element
 * (audio element, buttons, inputs) so that audio/video controls still work.
 */
function handleMediaPointerDown(asset: WBAsset, e: PointerEvent): void {
  // Always stop — prevents Konva canvas from receiving drawing events under overlay
  // (.stop on the template handles stopPropagation; this function handles drag logic)

  if (currentTool.value !== 'select') return

  // Don't initiate drag when clicking native media controls or buttons
  const target = e.target as HTMLElement
  if (target.closest('audio, button, input, select, [role="button"]')) {
    // Just select, don't drag
    wbStore.selectItems([asset.id])
    selectedNode.value = null
    const transformer = transformerRef.value?.getNode?.()
    if (transformer) transformer.nodes([])
    emit('select', asset.id)
    return
  }

  // Select the media asset
  wbStore.selectItems([asset.id])
  selectedNode.value = null
  const transformer = transformerRef.value?.getNode?.()
  if (transformer) transformer.nodes([])
  emit('select', asset.id)

  // Disable Konva during media drag to prevent event stealing
  setStageListening(false)

  // Custom pointer drag — track pointer globally, update DOM directly for smooth UX
  const startClientX = e.clientX
  const startClientY = e.clientY
  const startAssetX = asset.x
  const startAssetY = asset.y
  const el = e.currentTarget as HTMLElement
  let hasMoved = false

  function onPointerMove(ev: PointerEvent) {
    const dx = (ev.clientX - startClientX) / (props.zoom || 1)
    const dy = (ev.clientY - startClientY) / (props.zoom || 1)
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      hasMoved = true
      el.style.left = `${(startAssetX + dx) * (props.zoom || 1)}px`
      el.style.top = `${(startAssetY + dy) * (props.zoom || 1)}px`
      el.style.cursor = 'grabbing'
    }
  }

  function onPointerUp(ev: PointerEvent) {
    document.removeEventListener('pointermove', onPointerMove)
    // Re-enable Konva stage after media drag
    setStageListening(true)
    el.style.cursor = ''
    if (!hasMoved) return
    const dx = (ev.clientX - startClientX) / (props.zoom || 1)
    const dy = (ev.clientY - startClientY) / (props.zoom || 1)
    emit('asset-update', { ...asset, x: startAssetX + dx, y: startAssetY + dy })
  }

  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp, { once: true })
}

// ─── Phase 34 B8: Long Press for Mobile Multi-Select ───────────────────────

let longPressTimer: ReturnType<typeof setTimeout> | null = null
const LONG_PRESS_MS = 500

function handleTouchStart(itemId: string, e: TouchEvent): void {
  longPressTimer = setTimeout(() => {
    // Toggle selection (like shift+click)
    wbStore.toggleSelection(itemId)
    longPressTimer = null
  }, LONG_PRESS_MS)
}

function handleTouchEnd(): void {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handleTouchMove(): void {
  // Cancel long press if finger moves
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

// ─── Event Delegation Helpers ───────────────────────────────────────────────

interface ResolvedTarget {
  id: string
  type: 'stroke' | 'asset'
}

function resolveTarget(e: Konva.KonvaEventObject<Event>): ResolvedTarget | null {
  const target = e.target as Konva.Node | undefined
  if (!target) return null

  // Click on layer/stage itself — ignore
  if (target === e.currentTarget) return null

  // Ignore transformer/UI nodes
  if (target.hasName?.('transformer')) return null

  const id = target.id?.()
  const type = target.name?.()

  if (!id || !type) return null

  if (type === 'stroke') return { id, type: 'stroke' }
  if (type === 'asset') return { id, type: 'asset' }

  return null
}

function handlePointerDown(e: Konva.KonvaEventObject<Event>): void {
  const res = resolveTarget(e)
  if (!res) return

  if (res.type === 'stroke') {
    handleStrokeMouseDownById(res.id, e)
  } else {
    handleAssetMouseDownById(res.id, e)
  }
}

function handleClick(e: Konva.KonvaEventObject<Event>): void {
  const res = resolveTarget(e)
  if (!res) return

  if (res.type === 'stroke') {
    handleStrokeClickById(res.id, e)
  } else {
    handleAssetClickById(res.id, e)
  }
}

function handleDragEnd(e: Konva.KonvaEventObject<Event>): void {
  const res = resolveTarget(e)
  if (!res) return

  if (res.type === 'stroke') {
    handleStrokeDragEndById(res.id, e)
  } else {
    handleAssetDragEndById(res.id, e)
  }
}

// ─── ID-based wrapper functions for event delegation ────────────────────────

function handleStrokeMouseDownById(id: string, e: Konva.KonvaEventObject<Event>): void {
  const stroke = wbStore.currentStrokes.find(s => s.id === id)
  if (!stroke) return
  handleItemMouseDown(id, e as Konva.KonvaEventObject<MouseEvent | TouchEvent>)
}

function handleAssetMouseDownById(id: string, e: Konva.KonvaEventObject<Event>): void {
  handleItemMouseDown(id, e as Konva.KonvaEventObject<MouseEvent | TouchEvent>)
}

function handleStrokeClickById(id: string, e: Konva.KonvaEventObject<Event>): void {
  const stroke = wbStore.currentStrokes.find(s => s.id === id)
  if (!stroke) return
  handleStrokeClick(stroke, e as Konva.KonvaEventObject<MouseEvent>)
}

function handleAssetClickById(id: string, e: Konva.KonvaEventObject<Event>): void {
  const asset = wbStore.currentAssets.find(a => a.id === id)
  if (!asset) return
  handleAssetClick(asset, e as Konva.KonvaEventObject<MouseEvent>)
}

function handleStrokeDragEndById(id: string, e: Konva.KonvaEventObject<Event>): void {
  const stroke = wbStore.currentStrokes.find(s => s.id === id)
  if (!stroke) return
  handleStrokeDragEnd(stroke, e)
}

function handleAssetDragEndById(id: string, e: Konva.KonvaEventObject<Event>): void {
  const asset = wbStore.currentAssets.find(a => a.id === id)
  if (!asset) return
  handleAssetDragEnd(asset, e)
}

// ─── Group Move: mousedown on multi-selected item (backup for Konva items) ─

function handleItemMouseDown(itemId: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (currentTool.value !== 'select') return

  // Only start group move when item is part of multi-selection
  if (wbStore.selectedIds.length > 1 && wbStore.selectedIds.includes(itemId)) {
    e.cancelBubble = true // запобігти спрацюванню stage mousedown
    const pos = getPointerPosition()
    if (!pos) return
    groupMoveOccurred = false
    rectSelect.startMoveSelected(pos)
    isDrawing.value = true
  }
}

// ─── Selection Handlers ─────────────────────────────────────────────────────

function handleStrokeClick(stroke: WBStroke, e: Konva.KonvaEventObject<MouseEvent>): void {
  if (currentTool.value !== 'select') return
  e.cancelBubble = true

  // Guard: block during/after group drag
  if (groupDragActive.value || groupMoveOccurred) {
    groupMoveOccurred = false
    return
  }

  // Phase 34 FIX-1: locked items ARE selectable (but not movable/deletable)

  const nativeEvent = e.evt as MouseEvent
  const shiftKey = nativeEvent?.shiftKey ?? false

  // v5 A2: If item is in a group → select whole group
  const group = grouping.getGroupForItem(stroke.id)
  if (group && !shiftKey) {
    grouping.selectGroup(group.id)
    selectedNode.value = null
    const transformer = transformerRef.value?.getNode()
    if (transformer) transformer.nodes([])
    emit('select', stroke.id)
    return
  }

  // v5 A1: Multi-select with Shift+click
  rectSelect.handleClick(stroke.id, shiftKey)

  // Legacy single-select transformer support
  if (!shiftKey && wbStore.selectedIds.length <= 1) {
    selectedNode.value = e.target
    emit('select', stroke.id)
    nextTick(() => {
      const transformer = transformerRef.value?.getNode()
      if (transformer && e.target) {
        transformer.nodes([e.target])
      }
    })
  } else {
    // Multi-select: clear transformer (we use custom selection indicators)
    selectedNode.value = null
    const transformer = transformerRef.value?.getNode()
    if (transformer) transformer.nodes([])
    emit('select', stroke.id)
  }
}

function handleStrokeDragEnd(stroke: WBStroke, e: Konva.KonvaEventObject<Event>): void {
  if (currentTool.value !== 'select') return

  const node = e.target
  const nodeX = node.x()
  const nodeY = node.y()

  // BUG-2 FIX: Shapes that set x/y in their Konva config (text, rect, circle)
  // return initial_position + drag_offset from node.x()/y() after drag.
  // Shapes without x/y (pen, highlighter, line) return just the drag_offset.
  // We must subtract the initial config position to get the pure drag delta.
  const tool = stroke.tool
  const hasConfigPosition = tool === 'text' || tool === 'rectangle' || tool === 'circle'

  let dx: number, dy: number
  if (hasConfigPosition && stroke.points[0]) {
    // For circle, config x = points[0].x + width/2, but drag delta is the same
    if (tool === 'circle') {
      dx = nodeX - (stroke.points[0].x + (stroke.width || 0) / 2)
      dy = nodeY - (stroke.points[0].y + (stroke.height || 0) / 2)
    } else {
      dx = nodeX - stroke.points[0].x
      dy = nodeY - stroke.points[0].y
    }
  } else {
    dx = nodeX
    dy = nodeY
  }

  // Reset node position — offset stored in stroke data
  node.x(hasConfigPosition && stroke.points[0] ? (tool === 'circle' ? stroke.points[0].x + (stroke.width || 0) / 2 : stroke.points[0].x) : 0)
  node.y(hasConfigPosition && stroke.points[0] ? (tool === 'circle' ? stroke.points[0].y + (stroke.height || 0) / 2 : stroke.points[0].y) : 0)

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return

  const updatedStroke: WBStroke = {
    ...stroke,
    points: stroke.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
  }
  emit('stroke-update', updatedStroke)
}

/** Clear selection and transformer nodes */
function clearSelection(): void {
  selectedNode.value = null
  emit('select', null)
  const transformer = transformerRef.value?.getNode()
  if (transformer) {
    transformer.nodes([])
  }
}

function handleAssetClick(asset: WBAsset, e: Konva.KonvaEventObject<MouseEvent>): void {
  if (currentTool.value !== 'select') return
  e.cancelBubble = true

  // Guard: block during/after group drag
  if (groupDragActive.value || groupMoveOccurred) {
    groupMoveOccurred = false
    return
  }

  // Phase 34 FIX-1: locked assets ARE selectable (but not movable/deletable)

  const nativeEvent = e.evt as MouseEvent
  const shiftKey = nativeEvent?.shiftKey ?? false

  // v5 A2: If asset is in a group → select whole group
  const group = grouping.getGroupForItem(asset.id)
  if (group && !shiftKey) {
    grouping.selectGroup(group.id)
    selectedNode.value = null
    const transformer = transformerRef.value?.getNode()
    if (transformer) transformer.nodes([])
    emit('select', asset.id)
    return
  }

  // v5 A1: Multi-select with Shift+click
  rectSelect.handleClick(asset.id, shiftKey)

  if (!shiftKey && wbStore.selectedIds.length <= 1) {
    selectedNode.value = e.target
    emit('select', asset.id)
    nextTick(() => {
      const transformer = transformerRef.value?.getNode()
      if (transformer && e.target) {
        transformer.nodes([e.target])
      }
    })
  } else {
    selectedNode.value = null
    const transformer = transformerRef.value?.getNode()
    if (transformer) transformer.nodes([])
    emit('select', asset.id)
  }
}

function handleAssetDragEnd(asset: WBAsset, e: Konva.KonvaEventObject<Event>): void {
  const node = e.target
  emit('asset-update', {
    ...asset,
    x: node.x(),
    y: node.y(),
  })
}

function handleAssetTransformEnd(asset: WBAsset, e: Konva.KonvaEventObject<Event>): void {
  const node = e.target
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()

  node.scaleX(1)
  node.scaleY(1)

  emit('asset-update', {
    ...asset,
    x: node.x(),
    y: node.y(),
    w: Math.round(node.width() * scaleX),
    h: Math.round(node.height() * scaleY),
    rotation: node.rotation(),
  })
}

// Text transform: update width from resize handle
function handleTextTransformEnd(stroke: WBStroke, e: Konva.KonvaEventObject<Event>): void {
  const node = e.target
  const scaleX = node.scaleX()

  // Reset scale — Konva applies scale, we convert to width
  node.scaleX(1)
  node.scaleY(1)

  const newWidth = Math.round((stroke.width || 200) * scaleX)
  wbStore.updateObject(stroke.id, {
    width: Math.max(50, newWidth),
  })
  // Update position if dragged during transform
  const page = wbStore.currentPage
  if (!page) return
  const s = page.strokes.find(st => st.id === stroke.id)
  if (s && s.points[0]) {
    const updated = { ...s, points: [{ x: node.x(), y: node.y() }] }
    emit('stroke-update', updated)
  }
}

// ─── Stroke Config Generators ───────────────────────────────────────────────

/** Check if item is part of a multi-selection (>1 items selected) */
function isInMultiSelection(itemId: string): boolean {
  return wbStore.selectedIds.length > 1 && wbStore.selectedIds.includes(itemId)
}

/** Build cache signature for any stroke */
function buildStrokeSig(stroke: WBStroke, selectable: boolean): string {
  const last = stroke.points[stroke.points.length - 1]
  const first = stroke.points[0]
  const multiSel = isInMultiSelection(stroke.id) ? 1 : 0
  return `${stroke.tool}|${stroke.color}|${stroke.size}|${stroke.opacity}|${selectable ? 1 : 0}|${stroke.points.length}|${first?.x ?? 0},${first?.y ?? 0}|${last?.x ?? 0},${last?.y ?? 0}|${stroke.width ?? 0}|${stroke.height ?? 0}|${stroke.text ?? ''}|${stroke.locked ? 1 : 0}|${stroke.fontWeight ?? 0}|${stroke.fontStyle ?? ''}|${stroke.textAlign ?? ''}|ms${multiSel}`
}

/** Get cached config or build new one */
function getCachedConfig(stroke: WBStroke, builder: () => Record<string, unknown>): Record<string, unknown> {
  const selectable = currentTool.value === 'select'
  const sig = buildStrokeSig(stroke, selectable)
  const cached = strokeConfigCache.get(stroke.id)
  if (cached && cached.sig === sig) return cached.config
  const config = builder()
  strokeConfigCache.set(stroke.id, { sig, config })
  return config
}

function getStrokeConfig(stroke: WBStroke): Record<string, unknown> {
  if (stroke.points.length < 2) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
    // A4.1: Apply Catmull-Rom smoothing for pen/highlighter (display only, original points stay in store)
    const displayPoints = getSmoothedPoints(stroke.id, stroke.tool, stroke.points)
    // A4.1: Pass pressure triplets for variable-width rendering
    const hasPressure = hasPressureData(stroke.points)
    const strokePath = getSvgPathFromStroke(
      getStroke(
        displayPoints.map((p) => [p.x, p.y, p.pressure ?? 0.5]),
        {
          size: stroke.size,
          thinning: hasPressure ? 0.5 : 0.5,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: !hasPressure,
        },
      ),
    )

    const isLockedItem = !!stroke.locked
    const isMultiSel = isInMultiSelection(stroke.id)
    return {
      id: stroke.id,
      name: `stroke-${stroke.id}`,
      data: strokePath,
      fill: stroke.color,
      opacity: isLockedItem ? Math.min(stroke.opacity, 0.85) : stroke.opacity,
      globalCompositeOperation: stroke.tool === 'highlighter' ? 'multiply' : 'source-over',
      draggable: selectable && !isLockedItem && !isMultiSel,
      perfectDrawEnabled: false,
      listening: selectable,
    }
  })
}

function getLineConfig(stroke: WBStroke): Record<string, unknown> {
  if (stroke.points.length < 2) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
    const start = stroke.points[0]
    const end = stroke.points[stroke.points.length - 1]
    const isLockedItem = !!stroke.locked
    const isMultiSel = isInMultiSelection(stroke.id)
    return {
      id: stroke.id,
      name: `stroke-${stroke.id}`,
      points: [start.x, start.y, end.x, end.y],
      stroke: stroke.color,
      strokeWidth: stroke.size,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: isLockedItem ? Math.min(stroke.opacity, 0.85) : stroke.opacity,
      draggable: selectable && !isLockedItem && !isMultiSel,
      perfectDrawEnabled: false,
      listening: selectable,
    }
  })
}

function getRectConfig(stroke: WBStroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
    const isLockedItem = !!stroke.locked
    return {
      id: stroke.id,
      name: `stroke-${stroke.id}`,
      x: stroke.points[0].x,
      y: stroke.points[0].y,
      width: stroke.width || 0,
      height: stroke.height || 0,
      stroke: stroke.color,
      strokeWidth: stroke.size,
      fill: 'transparent',
      opacity: isLockedItem ? Math.min(stroke.opacity, 0.85) : stroke.opacity,
      draggable: selectable && !isLockedItem && !isInMultiSelection(stroke.id),
      perfectDrawEnabled: false,
      listening: selectable,
    }
  })
}

function getCircleConfig(stroke: WBStroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
    const isLockedItem = !!stroke.locked
    return {
      id: stroke.id,
      name: `stroke-${stroke.id}`,
      x: stroke.points[0].x + (stroke.width || 0) / 2,
      y: stroke.points[0].y + (stroke.height || 0) / 2,
      radiusX: (stroke.width || 0) / 2,
      radiusY: (stroke.height || 0) / 2,
      stroke: stroke.color,
      strokeWidth: stroke.size,
      fill: 'transparent',
      opacity: isLockedItem ? Math.min(stroke.opacity, 0.85) : stroke.opacity,
      draggable: selectable && !isLockedItem && !isInMultiSelection(stroke.id),
      perfectDrawEnabled: false,
      listening: selectable,
    }
  })
}

// Phase 35: Konva fontStyle = "bold italic" | "bold" | "italic" | "normal"
function buildKonvaFontStyle(fontWeight?: number, fontStyle?: string): string {
  const parts: string[] = []
  if (fontWeight === 700) parts.push('bold')
  if (fontStyle === 'italic') parts.push('italic')
  return parts.length > 0 ? parts.join(' ') : 'normal'
}

function getTextConfig(stroke: WBStroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
    const isLockedItem = !!stroke.locked
    const hasWidth = stroke.width && stroke.width > 0
    return {
      id: stroke.id,
      name: `stroke-${stroke.id}`,
      x: stroke.points[0].x,
      y: stroke.points[0].y,
      text: stroke.text || '',
      fontSize: stroke.size || 16,
      fill: stroke.color,
      // Phase 35: Font system — use stroke fields with safe defaults
      fontFamily: stroke.fontFamily || 'Inter, sans-serif',
      fontStyle: buildKonvaFontStyle(stroke.fontWeight, stroke.fontStyle),
      align: stroke.textAlign || 'left',
      // Width enables text wrapping and proper resize
      ...(hasWidth ? { width: stroke.width } : {}),
      wrap: 'word',
      opacity: isLockedItem ? 0.85 : 1,
      draggable: selectable && !isLockedItem && !isInMultiSelection(stroke.id),
      perfectDrawEnabled: false,
      listening: selectable,
    }
  })
}

// URL-нормалізатор: виправляє подвійний /media/ prefix що міг зберегтись у старих asset'ах.
// Django FileSystemStorage повертає /media/content/... (root-relative) — якщо _to_absolute_url
// не мав перевірки на '/', URL ставав /media//media/content/... і 404-ив.
// Ця функція прозоро виправляє вже збережені URL без перезапуску сервера.
function normalizeAssetUrl(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('http')) return url
  return url.replace(/^\/media\/\/media\//, '/media/')
}

// Set URL'ів що остаточно не завантажились — захист від нескінченного циклу 404.
// preloadAssetImage викликається з getAssetConfig на КОЖЕН рендер; без цього Set'у
// кожна невдала картинка ретраєтиметься при кожному strokeEnd/mousemove.
const failedImages = new Set<string>()

// Media proxy: when CORS fails for images.m4sh.org, route through backend proxy
// which adds proper CORS headers via Django middleware.
const _PROXY_HOSTS = ['images.m4sh.org']
const _apiBase = (() => {
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined
  return env || '/api'
})()
function _buildMediaProxyUrl(src: string): string | null {
  try {
    const u = new URL(src, window.location.origin)
    if (!_PROXY_HOSTS.includes(u.hostname)) return null
    return `${_apiBase}/v1/uploads/media-proxy/?url=${encodeURIComponent(src)}`
  } catch { return null }
}

// A4.3: Preload an asset image into the loadedImages cache (for immediate rendering after drop/paste)
// FLICKER FIX: loadedImages is a plain Map (not reactive) — we imperatively update the Konva node
// instead of relying on Vue reactivity, which would re-render ALL assets on every image load.
// E3: Video hosts that should never be preloaded as images
const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com']

function preloadAssetImage(asset: WBAsset): void {
  const src = normalizeAssetUrl(asset.src)
  if (loadedImages.has(src) || failedImages.has(src)) return
  // E3: Skip video URLs — they are embeds, not images
  if (VIDEO_HOSTS.some(h => src.includes(h))) return
  const isDataUrl = src.startsWith('data:')

  function applyImage(image: HTMLImageElement): void {
    loadedImages.set(src, image)
    // Invalidate the memoized config for this asset so next render picks up the image
    assetConfigCache.delete(asset.id)
    // Imperatively update the Konva node — no Vue reactive re-render triggered
    const assetsLayer = assetsLayerRef.value?.getNode?.()
    if (assetsLayer) {
      const node = assetsLayer.findOne(`#${asset.id}`) as Konva.Image | undefined
      if (node) {
        node.image(image)
      }
      assetsLayer.batchDraw()
    }
  }

  const image = new Image()
  if (!isDataUrl) {
    // Try with CORS first (needed for canvas read-back), fall back to no-CORS for display-only
    image.crossOrigin = 'anonymous'
  }
  image.onload = () => { applyImage(image) }
  image.onerror = () => {
    if (isDataUrl) {
      console.warn('[WB:Canvas] Failed to preload data-URL asset:', asset.id)
      failedImages.add(src)
      return
    }
    // CORS failed — retry through backend media proxy (preserves canvas non-tainted state)
    const proxyUrl = _buildMediaProxyUrl(src)
    if (proxyUrl) {
      console.info('[WB:Canvas] CORS failed, retrying via media proxy:', asset.id)
      const imgProxy = new Image()
      imgProxy.crossOrigin = 'anonymous'
      imgProxy.onload = () => { applyImage(imgProxy) }
      imgProxy.onerror = () => {
        // Proxy also failed — last resort: display-only without crossOrigin (canvas tainted)
        console.warn('[WB:Canvas] Proxy failed, retrying without crossOrigin:', src)
        const imgNoCors = new Image()
        imgNoCors.onload = () => { applyImage(imgNoCors) }
        imgNoCors.onerror = () => {
          console.error('[WB:Canvas] Image completely inaccessible, skipping retries:', src)
          failedImages.add(src)
          assetConfigCache.delete(asset.id)
        }
        imgNoCors.src = src
      }
      imgProxy.src = proxyUrl
    } else {
      // Not a proxyable URL — fallback to no-CORS directly
      console.warn('[WB:Canvas] CORS failed, retrying without crossOrigin:', src)
      const imgNoCors = new Image()
      imgNoCors.onload = () => { applyImage(imgNoCors) }
      imgNoCors.onerror = () => {
        console.error('[WB:Canvas] Image completely inaccessible, skipping retries:', src)
        failedImages.add(src)
        assetConfigCache.delete(asset.id)
      }
      imgNoCors.src = src
    }
  }
  image.src = src
}

function getAssetConfig(asset: WBAsset): Record<string, unknown> {
  const src = normalizeAssetUrl(asset.src)
  if (!loadedImages.has(src) && !failedImages.has(src)) {
    // Lazy-load image on first render (non-blocking — Konva node gets image imperatively on load)
    preloadAssetImage(asset)
  }

  const selectable = currentTool.value === 'select'
  const isLockedItem = !!asset.locked
  const hasImage = loadedImages.has(src)

  // Memoize by signature — return cached config object if nothing changed.
  // This prevents Vue-Konva from detecting a new config object on every stroke render,
  // which would cause all Konva Image nodes to re-draw (the source of flickering during drawing).
  // Phase 35: Include opacity + borderRadius in cache signature
  const baseOpacity = asset.opacity ?? 1
  const effectiveOpacity = isLockedItem ? Math.min(baseOpacity, 0.85) : baseOpacity
  const borderRadius = Math.min(asset.borderRadius ?? 0, 20) // FIX-8: cap at 20
  const isMultiSel = isInMultiSelection(asset.id)
  const sig = `${asset.x}|${asset.y}|${asset.w}|${asset.h}|${asset.rotation}|${isLockedItem ? 1 : 0}|${selectable ? 1 : 0}|${hasImage ? 1 : 0}|${effectiveOpacity}|${borderRadius}|ms${isMultiSel ? 1 : 0}`
  const cached = assetConfigCache.get(asset.id)
  if (cached && cached.sig === sig) return cached.config

  const config: Record<string, unknown> = {
    id: asset.id,
    name: `asset-${asset.id}`,
    x: asset.x,
    y: asset.y,
    width: asset.w,
    height: asset.h,
    rotation: asset.rotation,
    image: loadedImages.get(src),
    // Phase 35: Image opacity from asset field
    opacity: effectiveOpacity,
    draggable: selectable && !isLockedItem && !isMultiSel,
    perfectDrawEnabled: false,
    listening: selectable,
  }
  assetConfigCache.set(asset.id, { sig, config })
  return config
}

// Phase 35: clipFunc helper for borderRadius (FIX-8: max 20px, REC-3: only when radius > 0)
function roundedRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  r = Math.min(r, 20) // FIX-8: cap at 20
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(w - r, 0)
  ctx.quadraticCurveTo(w, 0, w, r)
  ctx.lineTo(w, h - r)
  ctx.quadraticCurveTo(w, h, w - r, h)
  ctx.lineTo(r, h)
  ctx.quadraticCurveTo(0, h, 0, h - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
}

// Phase 35: Group config for image with borderRadius (wraps v-image for clipFunc)
function getClipGroupConfig(asset: WBAsset): Record<string, unknown> {
  const selectable = currentTool.value === 'select'
  const isLockedItem = !!asset.locked
  const r = Math.min(asset.borderRadius ?? 0, 20)
  const isMultiSel = isInMultiSelection(asset.id)
  return {
    id: asset.id,
    name: `asset-${asset.id}`,
    x: asset.x,
    y: asset.y,
    rotation: asset.rotation,
    draggable: selectable && !isLockedItem && !isMultiSel,
    listening: selectable,
    clipFunc: (ctx: CanvasRenderingContext2D) => roundedRect(ctx, asset.w, asset.h, r),
  }
}

// Phase 35: Child image config inside clip group (position = 0,0 relative to group)
function getClipChildImageConfig(asset: WBAsset): Record<string, unknown> {
  const src = normalizeAssetUrl(asset.src)
  const baseOpacity = asset.opacity ?? 1
  const isLockedItem = !!asset.locked
  return {
    x: 0,
    y: 0,
    width: asset.w,
    height: asset.h,
    image: loadedImages.get(src),
    opacity: isLockedItem ? Math.min(baseOpacity, 0.85) : baseOpacity,
    perfectDrawEnabled: false,
    listening: false,
  }
}

// ─── Background layer cache ─────────────────────────────────────────────────

function hasRenderableArea(layer: Konva.Layer): boolean {
  const stage = layer.getStage?.()
  if (!stage) return false
  const stageSize = stage.size?.()
  if (!stageSize || stageSize.width <= 0 || stageSize.height <= 0) return false
  const childrenCount = typeof layer.getChildren === 'function' ? layer.getChildren().length : 0
  if (childrenCount === 0) return false
  return true
}

function cacheBackgroundLayer(): void {
  const konvaLayer = backgroundLayerRef.value?.getNode?.()
  if (!konvaLayer) return
  if (!hasRenderableArea(konvaLayer)) return
  try {
    if (!konvaLayer.isCached?.()) {
      konvaLayer.cache()
    }
  } catch (error) {
    console.warn('[WB:Canvas] background layer cache failed', error)
  }
}

// ─── Font prewarm ───────────────────────────────────────────────────────────

function prewarmFonts(): void {
  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 50
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const fonts = ['system-ui', '-apple-system', 'sans-serif']
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789АБВГДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгдеєжзиіїйклмнопрстуфхцчшщьюя'

  for (const font of fonts) {
    ctx.font = `16px ${font}`
    ctx.fillText(alphabet, 0, 20)
  }

  canvas.width = 0
  canvas.height = 0
}

// ─── A5.3: Zoom / Pan / Pinch handlers ──────────────────────────────────────

const isPanningRef = ref(false)

/** BUG-1: Check if zoom should be blocked (pen active or drawing) */
function isZoomBlocked(): boolean {
  // Block during active drawing/erasing
  if (isDrawing.value) return true
  // Block if pen/stylus was active recently — tablet drivers emit
  // synthetic wheel events (ctrlKey=true) from pinch gestures
  if (Date.now() - lastPenActivityTime < PEN_ZOOM_BLOCK_MS) return true
  return false
}

/** Ctrl+scroll = zoom to cursor position; plain scroll = vertical pan */
function handleWheel(e: WheelEvent): void {
  // BUG-1 FIX: Block zoom during drawing or recent pen activity
  if (isZoomBlocked()) return

  if (e.ctrlKey || e.metaKey) {
    // Zoom to cursor
    const rect = containerRef.value?.getBoundingClientRect()
    if (!rect) return

    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    const delta = -e.deltaY * ZOOM_WHEEL_STEP * 0.1
    const oldZoom = props.zoom
    const rawZoom = oldZoom + delta
    const newZoom = snapZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rawZoom)))

    if (Math.abs(newZoom - oldZoom) < 0.001) return

    const scroll = zoomToCursor(cursorX, cursorY, 0, 0, oldZoom, newZoom)
    emit('zoom-change', newZoom)
    emit('scroll-change', scroll.scrollX, scroll.scrollY)
  }
  // Plain scroll without Ctrl is default browser behavior (prevented by .prevent on template)
  // We could add pan here if needed
}

/** Middle mouse button → start panning */
function handlePanStart(e: MouseEvent): void {
  isPanning = true
  isPanningRef.value = true
  panStartX = e.clientX
  panStartY = e.clientY
  panScrollStartX = 0
  panScrollStartY = 0

  const onPanMove = (ev: MouseEvent) => {
    if (!isPanning) return
    const dx = ev.clientX - panStartX
    const dy = ev.clientY - panStartY
    emit('scroll-change', panScrollStartX - dx, panScrollStartY - dy)
  }

  const onPanEnd = () => {
    isPanning = false
    isPanningRef.value = false
    document.removeEventListener('mousemove', onPanMove)
    document.removeEventListener('mouseup', onPanEnd)
  }

  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onPanEnd)
}

/** Touch start — detect pinch (2 fingers) or double-tap */
function handleTouchStartZoom(e: TouchEvent): void {
  // BUG-1 FIX: Block touch zoom during drawing or recent pen activity
  if (isZoomBlocked()) return

  if (e.touches.length === 2) {
    // Pinch start
    isPinching = true
    pinchStartDist = pinchDistance(e.touches[0], e.touches[1])
    pinchStartZoom = props.zoom
    const center = pinchCenter(e.touches[0], e.touches[1])
    const rect = containerRef.value?.getBoundingClientRect()
    if (rect) {
      pinchCenterX = center.x - rect.left
      pinchCenterY = center.y - rect.top
    }
    e.preventDefault()
    return
  }

  if (e.touches.length === 1) {
    // Double-tap detection
    const now = Date.now()
    if (now - lastTapTime < DOUBLE_TAP_THRESHOLD_MS) {
      // Double-tap: toggle between 1x and 2x
      e.preventDefault()
      const newZoom = props.zoom < 1.5 ? 2.0 : 1.0
      emit('zoom-change', newZoom)
      lastTapTime = 0
    } else {
      lastTapTime = now
    }
  }
}

/** Touch move — pinch zoom */
function handleTouchMoveZoom(e: TouchEvent): void {
  if (!isPinching || e.touches.length < 2) return
  // BUG-1 FIX: Stop pinch if drawing started
  if (isZoomBlocked()) { isPinching = false; return }
  e.preventDefault()

  const dist = pinchDistance(e.touches[0], e.touches[1])
  const scale = dist / pinchStartDist
  const rawZoom = pinchStartZoom * scale
  const newZoom = snapZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rawZoom)))

  const scroll = zoomToCursor(pinchCenterX, pinchCenterY, 0, 0, props.zoom, newZoom)
  emit('zoom-change', newZoom)
  emit('scroll-change', scroll.scrollX, scroll.scrollY)
}

/** Touch end — stop pinch */
function handleTouchEndZoom(): void {
  isPinching = false
}

/** Fit entire page in viewport */
function handleFitToPage(): void {
  const container = containerRef.value
  if (!container) return
  const zoom = fitToPage(
    props.width,
    props.height,
    container.clientWidth,
    container.clientHeight,
  )
  emit('zoom-change', zoom)
  emit('scroll-change', 0, 0)
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  containerRef.value?.focus()

  // A4.1: Capture native PointerEvent for pressure data
  const container = containerRef.value
  if (container) {
    const capturePointer = (e: PointerEvent) => {
      lastNativePointerEvent = e
      // BUG-1: Track pen activity directly from pointer events
      if (e.pointerType === 'pen') {
        lastPenActivityTime = Date.now()
        currentPointerType = 'pen'
      }
    }
    container.addEventListener('pointerdown', capturePointer)
    container.addEventListener('pointermove', capturePointer)
    container.addEventListener('pointerup', capturePointer)
    // Store refs for cleanup
    ;(container as unknown as Record<string, unknown>).__wbPointerCapture = capturePointer
  }

  // BUG-3 FIX: Global mouseup/pointerup to stop drawing when released outside canvas
  window.addEventListener('mouseup', globalMouseUp)
  window.addEventListener('pointerup', globalMouseUp)

  // P1.4 FIX: Force-stop drawing on visibility/focus loss to prevent stuck pencil
  forceStopDrawing = () => {
    if (isDrawing.value) {
      // handleMouseUp takes no args — it reads state from reactive refs.
      // Previous code passed `new MouseEvent('mouseup')` which was a TS error
      // (TS2554: expected 0 arguments) and a no-op — the fake event was never
      // inspected. See function signature at line 2141: `function handleMouseUp(): void`.
      handleMouseUp()
    }
  }
  onVisibilityChange = () => {
    if (document.hidden && forceStopDrawing) forceStopDrawing()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('blur', forceStopDrawing)
  window.addEventListener('pointercancel', forceStopDrawing)

  // A5.3: Register touch zoom listeners (passive: false for preventDefault)
  if (container) {
    container.addEventListener('touchstart', handleTouchStartZoom, { passive: false })
    container.addEventListener('touchmove', handleTouchMoveZoom, { passive: false })
    container.addEventListener('touchend', handleTouchEndZoom)
  }

  // A6.1: Ensure Konva is loaded (populates singleton cache for konvaLoader)
  await loadKonva()

  // ED1: Event Delegation — attach listeners to layers (not individual nodes)
  const strokesLayer = strokesLayerRef.value?.getNode()
  const assetsLayer = assetsLayerRef.value?.getNode()

  if (strokesLayer) {
    strokesLayer.on('mousedown touchstart', handlePointerDown)
    strokesLayer.on('click tap', handleClick)
    strokesLayer.on('dragend', handleDragEnd)
  }

  if (assetsLayer) {
    assetsLayer.on('mousedown touchstart', handlePointerDown)
    assetsLayer.on('click tap', handleClick)
    assetsLayer.on('dragend', handleDragEnd)
  }

  // A6.3: ResizeObserver for responsive canvas sizing
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          containerWidth.value = Math.round(width)
          containerHeight.value = Math.round(height)
        }
      }
    })
    resizeObserver.observe(containerRef.value)
  }

  // Konva pixelRatio
  if (typeof Konva !== 'undefined') {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    Konva.pixelRatio = Math.min(Math.max(dpr, 1), 2)
  }

  prewarmFonts()

  // A6.1: Mark canvas as ready after Konva init
  konvaReady.value = true

  nextTick(() => {
    cacheBackgroundLayer()
    initPreviewCanvas()
  })
})

onUnmounted(() => {
  // Remote laser cleanup
  window.removeEventListener('wb:remote-laser', onRemoteLaser)
  // BUG-3 FIX: Remove global mouseup listeners
  window.removeEventListener('mouseup', globalMouseUp)
  window.removeEventListener('pointerup', globalMouseUp)
  // P1.4: Remove stuck-drawing safeguards
  if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange)
  if (forceStopDrawing) {
    window.removeEventListener('blur', forceStopDrawing)
    window.removeEventListener('pointercancel', forceStopDrawing)
  }
  clearPreviewCanvas()
  currentBitmap?.close?.()
  currentBitmap = null
  offscreenBuffers.length = 0
  previewCtx = null
  // A3.3: Cancel pending rAF
  if (previewRafId !== null) {
    cancelAnimationFrame(previewRafId)
    previewRafId = null
  }
  // A5.3: Cancel zoom animation
  if (zoomAnimFrameId !== null) {
    cancelAnimationFrame(zoomAnimFrameId)
    zoomAnimFrameId = null
  }
  // A4.1: Remove pointer listeners
  const container = containerRef.value
  if (container) {
    const capturePointer = (container as unknown as Record<string, unknown>).__wbPointerCapture as EventListener | undefined
    if (capturePointer) {
      container.removeEventListener('pointerdown', capturePointer)
      container.removeEventListener('pointermove', capturePointer)
      container.removeEventListener('pointerup', capturePointer)
    }
    lastNativePointerEvent = null
  }
  // A5.3: Remove touch listeners
  if (container) {
    container.removeEventListener('touchstart', handleTouchStartZoom)
    container.removeEventListener('touchmove', handleTouchMoveZoom)
    container.removeEventListener('touchend', handleTouchEndZoom)
  }
  // A6.3: Disconnect ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  // ED1: Remove layer event delegation listeners
  const strokesLayer = strokesLayerRef.value?.getNode()
  const assetsLayer = assetsLayerRef.value?.getNode()
  if (strokesLayer) {
    strokesLayer.off('mousedown touchstart', handlePointerDown)
    strokesLayer.off('click tap', handleClick)
    strokesLayer.off('dragend', handleDragEnd)
  }
  if (assetsLayer) {
    assetsLayer.off('mousedown touchstart', handlePointerDown)
    assetsLayer.off('click tap', handleClick)
    assetsLayer.off('dragend', handleDragEnd)
  }
  resizeObserver = null
  // A6.2: Clear spatial index
  spatialIndex.clear()
})

watch(
  () => [props.width, props.height, props.zoom],
  () => {
    initPreviewCanvas()
    drawPreviewCanvas()
  },
  { immediate: false },
)

// Auto-deselect when switching away from select tool
watch(
  () => props.tool,
  (newTool) => {
    if (newTool !== 'select' && selectedNode.value) {
      clearSelection()
    }
  },
)

// A6.2: Rebuild spatial index when strokes change
watch(
  allStrokes,
  (newStrokes) => {
    if (__DEV_PERF__) console.time('[WB:Perf] spatialIndex.rebuild')
    spatialIndex.rebuild(newStrokes)
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] spatialIndex.rebuild')
  },
  { immediate: true },
)

// A6.2: Memory cleanup on page switch — clear caches + reset selection state.
// CRITICAL FIX: Watch currentPageIndex, NOT props.strokes.
// props.strokes changes on EVERY mutation (move, add, delete, update) which
// was causing clearSelection() to fire during group drag — destroying the
// selection mid-drag and making group move impossible.
// currentPageIndex changes ONLY on actual page switch — the intended trigger.
watch(
  () => wbStore.currentPageIndex,
  () => {
    // Clear stroke config cache (stale entries from previous page)
    strokeConfigCache.clear()
    // Clear asset config memoization cache
    assetConfigCache.clear()
    // Clear smoothing cache
    clearSmoothedCache()
    // GHOST FIX: Stale selectedNode causes the Konva transformer to render a ghost
    // rectangle on the new page (transformer renders at the old node's last position).
    // Must clear selection state whenever the page changes.
    selectedNode.value = null
    const transformer = transformerRef.value?.getNode?.()
    if (transformer) transformer.nodes([])
    wbStore.clearSelection()
  },
)

// Invalidate stroke/asset config caches when strokes change (add/delete/update).
// Selection is NOT cleared here — only caches, so group drag keeps working.
watch(
  () => props.strokes,
  () => {
    strokeConfigCache.clear()
    assetConfigCache.clear()
    clearSmoothedCache()
  },
)

// ─── Smart Drop Animation ────────────────────────────────────────────────────

const _knownAssetIds = new Set<string>()

watch(
  assets,
  (newAssets, oldAssets) => {
    if (!konvaReady.value) {
      // Initial load — seed known IDs without animating
      for (const a of newAssets) _knownAssetIds.add(a.id)
      return
    }
    const oldIds = new Set((oldAssets ?? []).map(a => a.id))
    const freshIds: string[] = []
    for (const a of newAssets) {
      if (!oldIds.has(a.id) && !_knownAssetIds.has(a.id)) {
        freshIds.push(a.id)
      }
      _knownAssetIds.add(a.id)
    }
    if (!freshIds.length) return

    // Wait for Vue to render v-image nodes, then animate via Konva
    nextTick(() => {
      const layer = assetsLayerRef.value?.getNode?.() as Konva.Layer | null
      if (!layer) return
      for (const id of freshIds) {
        const node = layer.findOne(`#${id}`) as Konva.Node | null
        if (!node) continue
        node.opacity(0)
        node.scaleX(0.85)
        node.scaleY(0.85)
        new Konva.Tween({
          node,
          duration: 0.25,
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          easing: Konva.Easings.EaseOut,
          onFinish: () => layer.batchDraw(),
        }).play()
      }
    })
  },
  { immediate: true },
)

// ─── Expose ─────────────────────────────────────────────────────────────────

defineExpose({
  getStage: () => stageRef.value?.getStage?.() || null,
  fitToPage: handleFitToPage,
  /** Open text overlay for object (called from WBSelectionToolbar via parent) */
  openTextOverlay: (objectId: string) => { activeTextObjectId.value = objectId },
})
</script>

<style scoped>
.wb-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--wb-canvas-area-bg, #d5e0d8);
  outline: none;
  /* A6.3: Prevent browser zoom on canvas — pinch handled by JS */
  touch-action: none;
}

.wb-canvas--eraser {
  cursor: crosshair;
}

.wb-canvas--text {
  cursor: text;
}

.wb-canvas--select {
  cursor: default;
}

.wb-canvas--drawing {
  cursor: crosshair;
}

/* A5.3: Panning cursor */
.wb-canvas--panning {
  cursor: grabbing !important;
}

.wb-canvas:focus {
  outline: 1.5px solid rgba(99, 102, 241, 0.3);
  outline-offset: -1px;
}

.wb-preview-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 10;
  filter: none;
  backdrop-filter: none;
  box-shadow: none;
}

/* A6.1: Loading spinner */
.wb-canvas-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 5;
}

.wb-canvas-loading__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--wb-border, #e2e8f0);
  border-top-color: var(--wb-brand, #2563eb);
  border-radius: 50%;
  animation: wb-spin 0.8s linear infinite;
}

.wb-canvas-loading__text {
  font-size: 0.8125rem;
  color: var(--wb-fg-secondary, #64748b);
}

@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

/* ── Group drag overlay — invisible hitbox for multi-select movement ──────── */
.wb-group-drag-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  border: 1.5px dashed rgba(99, 102, 241, 0.4);
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.04);
  transition: background 0.15s ease, border-color 0.15s ease;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  /* CRITICAL: overlay must intercept ALL pointer events, above everything */
  pointer-events: all;
}

.wb-group-drag-overlay:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.6);
}

.wb-group-drag-overlay:active {
  background: rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.7);
}

.wb-group-drag-overlay__icon {
  color: rgba(99, 102, 241, 0.35);
  pointer-events: none;
  transition: color 0.15s ease;
}

.wb-group-drag-overlay:hover .wb-group-drag-overlay__icon {
  color: rgba(99, 102, 241, 0.65);
}

.wb-text-edit-overlay {
  position: absolute;
  background: rgba(255, 255, 255, 0.95);
  border: 1.5px solid rgba(99, 102, 241, 0.4);
  padding: 8px;
  min-width: 150px;
  min-height: 40px;
  resize: both;
  outline: none;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  z-index: 1000;
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-y: auto;
  box-sizing: border-box;
}

/* v5 A4: Laser pointer cursor classes */
.wb-canvas--laser {
  cursor: crosshair;
}

.wb-canvas--laser-active {
  cursor: none;
}

/* BUG-2 FIX: Laser trail dot styles — denser, more visible trail */
.wb-laser-trail-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #dc2626;
  box-shadow: 0 0 6px 2px rgba(220, 38, 38, 0.5);
  pointer-events: none;
  z-index: 999;
  will-change: opacity, transform;
}

/* v5 A4: Laser dot styles */
.wb-laser-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 1000;
  transform: translate(-50%, -50%);
}

/* PROB-2 FIX: Local dot — NO transition, must follow cursor instantly */
.wb-laser-dot--local {
  background: #dc2626;
  box-shadow: 0 0 8px 4px rgba(220, 38, 38, 0.5);
}

/* Remote dots — slight transition to smooth network jitter */
.wb-laser-dot--remote {
  transition: left 0.05s linear, top 0.05s linear;
}

.wb-laser-dot__label {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  white-space: nowrap;
  color: #dc2626;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

/* v5 A9: Sticky note text editing overlay */
.wb-sticky-edit-overlay {
  position: absolute;
  overflow: hidden;
  word-wrap: break-word;
  white-space: pre-wrap;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-laser-dot {
    transition: none;
    box-shadow: none;
  }
}

/* Phase 3C: Media HTML overlay (audio/video players) */
.wb-media-overlay {
  position: absolute;
  z-index: 20;
  transform-origin: top left;
  border-radius: 10px;
  overflow: visible;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transition: box-shadow 0.2s ease;
}
.wb-media-overlay--selectable {
  cursor: default;
}
.wb-media-overlay--selectable:hover {
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.06);
}
/* Soft selection — subtle glow, NO harsh outline */
.wb-media-overlay--selected {
  box-shadow:
    0 0 0 1.5px rgba(99, 102, 241, 0.35),
    0 4px 20px rgba(99, 102, 241, 0.15),
    0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Resize handles — subtle, appear only on hover/selected */
.wb-media-resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1.5px solid rgba(99, 102, 241, 0.5);
  border-radius: 50%;
  z-index: 30;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform 0.12s, border-color 0.12s, background 0.12s;
  opacity: 0;
}
.wb-media-overlay--selected .wb-media-resize-handle {
  opacity: 1;
}
.wb-media-resize-handle:hover {
  transform: scale(1.3);
  background: #fff;
  border-color: rgba(99, 102, 241, 0.8);
  box-shadow: 0 1px 6px rgba(99, 102, 241, 0.3);
}
.wb-media-resize-handle--top-left { top: -5px; left: -5px; }
.wb-media-resize-handle--top-right { top: -5px; right: -5px; }
.wb-media-resize-handle--bottom-left { bottom: -5px; left: -5px; }
.wb-media-resize-handle--bottom-right { bottom: -5px; right: -5px; }

/* Transparent drag surface — covers video/youtube in select mode */
/* Captures pointer events for drag, prevents video controls from blocking move */
.wb-media-drag-surface {
  position: absolute;
  inset: 0;
  z-index: 5;
  cursor: grab;
  background: transparent;
}
.wb-media-drag-surface:active {
  cursor: grabbing;
}
</style>
