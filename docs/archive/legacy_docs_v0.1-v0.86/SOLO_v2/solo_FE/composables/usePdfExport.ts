import { ref } from 'vue'
import type { PageState } from '../types/solo'

export function usePdfExport() {
  const isExporting = ref(false)
  const progress = ref(0)
  const error = ref<string | null>(null)

  /**
   * Export pages to PDF using jsPDF.
   */
  async function exportToPdf(
    pages: PageState[],
    filename: string = 'board.pdf',
    options: {
      format?: 'a4' | 'letter'
      orientation?: 'portrait' | 'landscape'
      quality?: number
    } = {}
  ): Promise<Blob | null> {
    isExporting.value = true
    progress.value = 0
    error.value = null

    try {
      // Dynamic import jsPDF
      const { jsPDF } = await import('jspdf')

      const {
        format = 'a4',
        orientation = 'landscape',
        quality = 0.95,
      } = options

      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format,
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) {
          pdf.addPage()
        }

        // Render page to canvas
        const canvas = await renderPageToCanvas(pages[i])

        // Add to PDF
        const imgData = canvas.toDataURL('image/jpeg', quality)
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight)

        progress.value = ((i + 1) / pages.length) * 100
      }

      // Save
      pdf.save(filename)

      // Return blob for upload
      return pdf.output('blob')
    } catch (err) {
      console.error('[PdfExport] Failed:', err)
      error.value = 'Failed to export PDF'
      return null
    } finally {
      isExporting.value = false
    }
  }

  /**
   * Render a page state to canvas.
   */
  async function renderPageToCanvas(page: PageState): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 1080

    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw strokes
    for (const stroke of page.strokes || []) {
      if (stroke.points.length < 2) continue

      ctx.save()
      ctx.globalAlpha = stroke.opacity || 1
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }

      ctx.stroke()
      ctx.restore()
    }

    // Draw shapes
    for (const shape of page.shapes || []) {
      ctx.save()
      ctx.strokeStyle = shape.color
      ctx.lineWidth = shape.size

      ctx.beginPath()

      switch (shape.type) {
        case 'line':
          ctx.moveTo(shape.startX, shape.startY)
          ctx.lineTo(shape.endX, shape.endY)
          break
        case 'rectangle':
          ctx.rect(
            shape.startX,
            shape.startY,
            shape.endX - shape.startX,
            shape.endY - shape.startY
          )
          break
        case 'circle': {
          const rx = Math.abs(shape.endX - shape.startX) / 2
          const ry = Math.abs(shape.endY - shape.startY) / 2
          const cx = shape.startX + (shape.endX - shape.startX) / 2
          const cy = shape.startY + (shape.endY - shape.startY) / 2
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
          break
        }
      }

      ctx.stroke()
      ctx.restore()
    }

    // Draw texts
    for (const text of page.texts || []) {
      ctx.save()
      ctx.fillStyle = text.color
      ctx.font = `${text.fontSize}px sans-serif`
      ctx.fillText(text.text, text.x, text.y + text.fontSize)
      ctx.restore()
    }

    return canvas
  }

  return {
    isExporting,
    progress,
    error,
    exportToPdf,
    renderPageToCanvas,
  }
}
