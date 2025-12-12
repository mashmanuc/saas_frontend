// F5: Permissions Engine - Permission checks for actions
import type { RoomPermissions } from '../api/classroom'

// Map event types to permission keys
const EVENT_PERMISSION_MAP: Record<string, keyof RoomPermissions> = {
  // Drawing
  draw_start: 'can_draw',
  draw_move: 'can_draw',
  draw_end: 'can_draw',
  stroke_add: 'can_draw',
  
  // Erasing
  erase: 'can_erase',
  erase_stroke: 'can_erase',
  
  // Layers
  layer_add: 'can_add_layers',
  layer_create: 'can_add_layers',
  layer_delete: 'can_delete_layers',
  layer_remove: 'can_delete_layers',
  
  // Images
  image_add: 'can_upload_images',
  image_upload: 'can_upload_images',
  
  // Board management
  board_clear: 'can_clear_board',
  clear_all: 'can_clear_board',
  
  // Video
  video_toggle: 'can_toggle_video',
  video_start: 'can_toggle_video',
  video_stop: 'can_toggle_video',
  
  // Session
  session_terminate: 'can_terminate',
  terminate: 'can_terminate',
}

export class PermissionsEngine {
  private permissions: RoomPermissions

  constructor(permissions: RoomPermissions) {
    this.permissions = permissions
  }

  canPerform(eventType: string): boolean {
    const permissionKey = EVENT_PERMISSION_MAP[eventType]
    
    // If no mapping exists, allow by default (for unknown events)
    if (!permissionKey) {
      return true
    }

    return this.permissions[permissionKey] === true
  }

  canDraw(): boolean {
    return this.permissions.can_draw
  }

  canErase(): boolean {
    return this.permissions.can_erase
  }

  canAddLayers(): boolean {
    return this.permissions.can_add_layers
  }

  canDeleteLayers(): boolean {
    return this.permissions.can_delete_layers
  }

  canUploadImages(): boolean {
    return this.permissions.can_upload_images
  }

  canClearBoard(): boolean {
    return this.permissions.can_clear_board
  }

  canToggleVideo(): boolean {
    return this.permissions.can_toggle_video
  }

  canTerminate(): boolean {
    return this.permissions.can_terminate
  }

  updatePermissions(newPermissions: Partial<RoomPermissions>): void {
    this.permissions = { ...this.permissions, ...newPermissions }
  }

  getPermissions(): RoomPermissions {
    return { ...this.permissions }
  }

  // Check multiple permissions at once
  hasAll(...keys: (keyof RoomPermissions)[]): boolean {
    return keys.every((key) => this.permissions[key] === true)
  }

  hasAny(...keys: (keyof RoomPermissions)[]): boolean {
    return keys.some((key) => this.permissions[key] === true)
  }

  // Get list of allowed actions
  getAllowedActions(): string[] {
    const allowed: string[] = []
    
    for (const [eventType, permKey] of Object.entries(EVENT_PERMISSION_MAP)) {
      if (this.permissions[permKey]) {
        allowed.push(eventType)
      }
    }
    
    return allowed
  }
}

// Default permissions for different roles
export const DEFAULT_PERMISSIONS: Record<string, RoomPermissions> = {
  host: {
    can_draw: true,
    can_erase: true,
    can_add_layers: true,
    can_delete_layers: true,
    can_upload_images: true,
    can_clear_board: true,
    can_toggle_video: true,
    can_terminate: true,
  },
  student: {
    can_draw: true,
    can_erase: true,
    can_add_layers: false,
    can_delete_layers: false,
    can_upload_images: false,
    can_clear_board: false,
    can_toggle_video: true,
    can_terminate: false,
  },
  viewer: {
    can_draw: false,
    can_erase: false,
    can_add_layers: false,
    can_delete_layers: false,
    can_upload_images: false,
    can_clear_board: false,
    can_toggle_video: true,
    can_terminate: false,
  },
  solo: {
    can_draw: true,
    can_erase: true,
    can_add_layers: true,
    can_delete_layers: true,
    can_upload_images: true,
    can_clear_board: true,
    can_toggle_video: false,
    can_terminate: true,
  },
}
