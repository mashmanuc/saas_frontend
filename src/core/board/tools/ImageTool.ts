// TASK F13: ImageTool - Image placement tool
// TASK FX6: Enhanced with URL and file validation

import { BaseTool } from './BaseTool'
import type { ToolType, Point, ImageData } from '../types'
import { validateImageUrl, validateFileType, validateFileSize } from '../utils/sanitize'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_IMAGE_DIMENSION = 4096

export interface ImageToolCallbacks {
  onImagePlace: (layerId: number, data: ImageData, position: Point) => string
  onImageResize: (id: string, size: { width: number; height: number }) => void
  onImageEnd: (id: string) => void
  onError: (error: { code: string; message: string }) => void
  getActiveLayerId: () => number | null
  openImagePicker: () => Promise<{ src: string; width: number; height: number } | null>
  uploadImage?: (file: File) => Promise<string>
}

export class ImageTool extends BaseTool {
  private callbacks: ImageToolCallbacks
  private pendingImage: { src: string; width: number; height: number } | null = null
  private placingId: string | null = null
  private startPoint: Point | null = null
  private isPlacing = false

  constructor(callbacks: ImageToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'image'
  }

  get cursor(): string {
    return this.pendingImage ? 'copy' : 'default'
  }

  async selectImage(): Promise<void> {
    const image = await this.callbacks.openImagePicker()
    if (image) {
      this.pendingImage = image
    }
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    if (!this.pendingImage) {
      // No image selected, try to open picker
      this.selectImage()
      return
    }

    const layerId = this.callbacks.getActiveLayerId()
    if (layerId === null) return

    this.isPlacing = true
    this.startPoint = point

    const imageData: ImageData = {
      src: this.pendingImage.src,
      originalWidth: this.pendingImage.width,
      originalHeight: this.pendingImage.height,
    }

    this.placingId = this.callbacks.onImagePlace(layerId, imageData, point)
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    if (!this.isPlacing || !this.startPoint || !this.placingId || !this.pendingImage) return

    const width = Math.abs(point.x - this.startPoint.x)
    const height = Math.abs(point.y - this.startPoint.y)

    // Maintain aspect ratio
    const aspectRatio = this.pendingImage.width / this.pendingImage.height
    const adjustedHeight = width / aspectRatio

    this.callbacks.onImageResize(this.placingId, {
      width: Math.max(50, width),
      height: Math.max(50, adjustedHeight),
    })
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    if (!this.isPlacing || !this.placingId) return

    this.callbacks.onImageEnd(this.placingId)

    this.isPlacing = false
    this.startPoint = null
    this.placingId = null
    this.pendingImage = null
  }

  deactivate(): void {
    super.deactivate()
    if (this.isPlacing && this.placingId) {
      this.callbacks.onImageEnd(this.placingId)
    }
    this.isPlacing = false
    this.startPoint = null
    this.placingId = null
    this.pendingImage = null
  }

  /**
   * Validate and load image from URL.
   */
  async validateAndLoadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      // Validate URL first
      const validUrl = validateImageUrl(url)
      if (!validUrl) {
        reject(new Error('Invalid image URL'))
        return
      }

      const img = new Image()

      img.onload = () => {
        // Check dimensions
        if (img.width > MAX_IMAGE_DIMENSION || img.height > MAX_IMAGE_DIMENSION) {
          reject(new Error(`Image too large (max ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION})`))
          return
        }
        resolve(img)
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      // Set crossOrigin for external images
      if (!validUrl.startsWith('/') && !validUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous'
      }

      img.src = validUrl
    })
  }

  /**
   * Handle image file upload with validation.
   */
  async handleImageUpload(file: File): Promise<{ src: string; width: number; height: number } | null> {
    // Validate file type
    if (!validateFileType(file, ALLOWED_IMAGE_TYPES)) {
      this.callbacks.onError({
        code: 'INVALID_FILE_TYPE',
        message: 'Only PNG, JPEG, GIF, and WebP images are allowed',
      })
      return null
    }

    // Validate file size
    if (!validateFileSize(file, MAX_IMAGE_SIZE)) {
      this.callbacks.onError({
        code: 'FILE_TOO_LARGE',
        message: 'Image must be smaller than 10MB',
      })
      return null
    }

    try {
      // Upload if callback provided
      let url: string
      if (this.callbacks.uploadImage) {
        url = await this.callbacks.uploadImage(file)
      } else {
        // Create local data URL
        url = await this.fileToDataUrl(file)
      }

      // Validate and load
      const img = await this.validateAndLoadImage(url)

      return {
        src: url,
        width: img.width,
        height: img.height,
      }
    } catch (error) {
      this.callbacks.onError({
        code: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Failed to upload image',
      })
      return null
    }
  }

  /**
   * Convert file to data URL.
   */
  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * Set pending image from URL with validation.
   */
  async setImageFromUrl(url: string): Promise<boolean> {
    try {
      const img = await this.validateAndLoadImage(url)
      this.pendingImage = {
        src: url,
        width: img.width,
        height: img.height,
      }
      return true
    } catch (error) {
      this.callbacks.onError({
        code: 'INVALID_URL',
        message: error instanceof Error ? error.message : 'Invalid image URL',
      })
      return false
    }
  }
}

export default ImageTool
