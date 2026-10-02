import i18n from '@/i18n'
import { documentFromSource, renderDocument, verifyDocument } from './contract.mjs'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'

const RENDER_FAILED: Record<string, string> = {
  uk: 'Математичний запис не вдалося відобразити.',
  en: 'The math could not be displayed.',
  ru: 'Математическую запись не удалось отобразить.',
}

function legacy(source: string, formula: boolean): string {
  return renderTextWithLatex(formula ? `$$${source}$$` : source)
}

/**
 * Б-141. Поле з документом нового матеріалу Інтегралика — строгий рендер без старих ремонтів;
 * старі поля (без документа) не мігруємо — рендер як був.
 */
export function renderMathField(data: any, key: string, source: string, formula = false): string {
  const contract = data?.math_content
  if (!contract || !Object.prototype.hasOwnProperty.call(contract.fields || {}, key)) {
    return legacy(source, formula)
  }
  const original = data[key] ?? source
  const saved = contract.fields[key]
  if (saved?.source !== original) {
    // Учитель змінив поле вручну — це вже його текст, а не матеріал Інтегралика. Валідний —
    // строгий рендер; ні — як решта його карток: видно текст і червону помилку, а не порожнечу.
    try {
      return renderDocument(documentFromSource(source, formula), source, formula)
    } catch {
      return legacy(source, formula)
    }
  }
  try {
    if (contract.version !== 1) throw new Error('Невідома версія математичного матеріалу')
    // Показ збереженого — без правил вставки: що прийняли вчора, показуємо й сьогодні.
    const current = verifyDocument(saved, original, formula, '', false)
    // Атрибуція може бути винесена в окремий footer. Збережене поле не змінюємо.
    const doc = source === original ? current : documentFromSource(source, formula, '', false)
    return renderDocument(doc, source, formula)
  } catch (error) {
    // Незмінений матеріал Інтегралика не збігся зі своїм документом — підробка або чужа версія.
    console.error('[math-content] відображення відхилено', error)
    return `<span role="status">${RENDER_FAILED[i18n.global.locale.value] ?? RENDER_FAILED.uk}</span>`
  }
}
