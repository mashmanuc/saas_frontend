// Phase 35: Built-in fonts — NO Google Fonts API, NO dynamic loading
export const AVAILABLE_FONTS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Comic Sans', value: '"Comic Sans MS", cursive' },
] as const

export type FontOption = typeof AVAILABLE_FONTS[number]

export const DEFAULT_FONT_FAMILY = 'Inter, sans-serif'
export const DEFAULT_FONT_WEIGHT = 400
export const DEFAULT_FONT_STYLE = 'normal'
export const DEFAULT_TEXT_ALIGN = 'left'
