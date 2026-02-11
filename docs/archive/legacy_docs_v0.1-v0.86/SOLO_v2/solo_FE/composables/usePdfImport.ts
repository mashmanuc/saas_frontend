import { ref, shallowRef } from 'vue'
import { soloApi } from '../api/soloApi'
import type { PageState, AssetLayer } from '../types/solo'

// PDF.js types
interface PDFDocumentProxy {
  numPages: number
  getPage(pageNumber: number): Promise<PDFPageProxy>
  destroy(): void
}

interface PDFPageProxy {
  getViewport(params: { scale: number }): PDFPageViewport
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: PDFPageViewport }): { promise: Promise<void> }
}

interface PDFPageViewport {
  width: number
  height: number
}

export interface PdfImportProgress {
  status: 'idle' | 'loading' | 'rendering' | 'uploading' | 'complete' | 'error'
  currentPage: number
  totalPages: number
  message: string
  error?: string
}

export interface PdfImportResult {
  pages: PageState[]
  assets: AssetLayer[]
}

export interface UsePdfImportOptions {
  sessionId: string
  maxFileSizeMB?: number
  renderScale?: number
  imageQuality?: number
  createPagesForEach?: boolean
}

// Dynamic import for PDF.js (will be loaded when needed)
let pdfjsLib: any = null

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib

  // Dynamic import pdfjs-dist
  const pdfjs = await import('pdfjs-dist')

  // Set worker source (use CDN for simplicity)
  const pdfjsVersion = '4.0.379'
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`

  pdfjsLib = pdfjs
  return pdfjsLib
}

export function usePdfImport(options: UsePdfImportOptions) {
  const {
    sessionId,
    maxFileSizeMB = 10,
    renderScale = 2, // 2x for good quality
    imageQuality = 0.92,
    createPagesForEach = true,
  } = options

  // State
  const progress = ref<PdfImportProgress>({
    status: 'idle',
    currentPage: 0,
    totalPages: 0,
    message: '',
  })

  const isProcessing = ref(false)
  const pdfDocument = shallowRef<PDFDocumentProxy | null>(null)

  // Validate file
  function validateFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: 'File must be a PDF' }
    }

    // Check file size
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > maxFileSizeMB) {
      return { valid: false, error: `File size (${sizeMB.toFixed(1)}MB) exceeds limit (${maxFileSizeMB}MB)` }
    }

    return { valid: true }
  }

  // Render PDF page to canvas
  async function renderPageToCanvas(page: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: context,
      viewport,
    }).promise

    return canvas
  }

  // Convert canvas to PNG blob
  function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to convert canvas to blob'))
          }
        },
        'image/png',
        quality
      )
    })
  }

  // Upload image blob using presigned URL
  async function uploadImage(blob: Blob, pageIndex: number): Promise<string> {
    // Get presigned URL
    const presignResp = await soloApi.presignUpload({
      session_id: sessionId,
      content_type: 'image/png',
      size_bytes: blob.size,
      ext: 'png',
    })

    // Upload to presigned URL
    const response = await fetch(presignResp.upload_url, {
      method: presignResp.method,
      headers: presignResp.headers,
      body: blob,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    return presignResp.cdn_url
  }

  // Generate unique ID
  function generateId(): string {
    return `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Main import function
  async function importPdf(file: File): Promise<PdfImportResult> {
    // Validate
    const validation = validateFile(file)
    if (!validation.valid) {
      progress.value = {
        status: 'error',
        currentPage: 0,
        totalPages: 0,
        message: validation.error || 'Invalid file',
        error: validation.error,
      }
      throw new Error(validation.error)
    }

    isProcessing.value = true
    const result: PdfImportResult = { pages: [], assets: [] }

    try {
      // Load PDF.js
      progress.value = {
        status: 'loading',
        currentPage: 0,
        totalPages: 0,
        message: 'Loading PDF library...',
      }

      const pdfjs = await loadPdfJs()

      // Load PDF document
      progress.value.message = 'Opening PDF...'

      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
      const pdf: PDFDocumentProxy = await loadingTask.promise

      pdfDocument.value = pdf
      const numPages = pdf.numPages

      progress.value = {
        status: 'rendering',
        currentPage: 0,
        totalPages: numPages,
        message: `Processing ${numPages} page(s)...`,
      }

      // Process each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        progress.value = {
          status: 'rendering',
          currentPage: pageNum,
          totalPages: numPages,
          message: `Rendering page ${pageNum} of ${numPages}...`,
        }

        // Get page
        const page = await pdf.getPage(pageNum)

        // Render to canvas
        const canvas = await renderPageToCanvas(page, renderScale)

        // Convert to blob
        const blob = await canvasToBlob(canvas, imageQuality)

        // Upload
        progress.value = {
          status: 'uploading',
          currentPage: pageNum,
          totalPages: numPages,
          message: `Uploading page ${pageNum} of ${numPages}...`,
        }

        const cdnUrl = await uploadImage(blob, pageNum - 1)

        // Create asset layer
        const viewport = page.getViewport({ scale: 1 })
        const asset: AssetLayer = {
          id: generateId(),
          type: 'image',
          src: cdnUrl,
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
          rotation: 0,
          locked: true,
          zIndex: 0,
        }

        result.assets.push(asset)

        // Create page if needed
        if (createPagesForEach) {
          const pageName = numPages > 1
            ? `${file.name.replace('.pdf', '')} - Page ${pageNum}`
            : file.name.replace('.pdf', '')

          const pageState: PageState = {
            id: generateId(),
            name: pageName,
            strokes: [],
            shapes: [],
            texts: [],
            // Background as image
            background: {
              type: 'color',
              color: '#ffffff',
            },
          }

          // Add asset reference to page (stored in assets array)
          result.pages.push(pageState)
        }

        // Clean up canvas
        canvas.width = 0
        canvas.height = 0
      }

      // Cleanup
      pdf.destroy()
      pdfDocument.value = null

      progress.value = {
        status: 'complete',
        currentPage: numPages,
        totalPages: numPages,
        message: `Successfully imported ${numPages} page(s)`,
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      progress.value = {
        status: 'error',
        currentPage: progress.value.currentPage,
        totalPages: progress.value.totalPages,
        message: `Error: ${errorMessage}`,
        error: errorMessage,
      }

      // Cleanup on error
      if (pdfDocument.value) {
        pdfDocument.value.destroy()
        pdfDocument.value = null
      }

      throw error
    } finally {
      isProcessing.value = false
    }
  }

  // Cancel import
  function cancelImport(): void {
    if (pdfDocument.value) {
      pdfDocument.value.destroy()
      pdfDocument.value = null
    }

    isProcessing.value = false
    progress.value = {
      status: 'idle',
      currentPage: 0,
      totalPages: 0,
      message: 'Cancelled',
    }
  }

  // Reset state
  function reset(): void {
    isProcessing.value = false
    progress.value = {
      status: 'idle',
      currentPage: 0,
      totalPages: 0,
      message: '',
    }
  }

  return {
    // State
    progress,
    isProcessing,

    // Methods
    importPdf,
    validateFile,
    cancelImport,
    reset,
  }
}

export default usePdfImport
