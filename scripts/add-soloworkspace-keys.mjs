import fs from 'node:fs'
import path from 'node:path'

const ukPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'uk.json')
const ukData = JSON.parse(fs.readFileSync(ukPath, 'utf-8'))

// Створити soloWorkspace namespace на верхньому рівні
ukData.soloWorkspace = {
  "toolbar": {
    "sections": {
      "draw": "Малювання",
      "shapes": "Фігури",
      "text": "Текст",
      "style": "Стиль",
      "actions": "Дії"
    },
    "tools": {
      "pen": "Перо",
      "highlighter": "Маркер",
      "eraser": "Гумка",
      "line": "Лінія",
      "arrow": "Стрілка",
      "rectangle": "Прямокутник",
      "circle": "Коло",
      "text": "Текст",
      "note": "Нотатка",
      "select": "Вибір"
    },
    "shortcuts": {
      "pen": "P",
      "highlighter": "H",
      "eraser": "E",
      "line": "L",
      "arrow": "A",
      "rectangle": "R",
      "circle": "C",
      "text": "T",
      "note": "N",
      "select": "V"
    },
    "arrow": {
      "styles": {
        "end": "Стрілка в кінці",
        "start": "Стрілка на початку",
        "both": "Стрілки з обох боків"
      },
      "headSize": "Розмір голівки"
    },
    "actions": {
      "undo": "Скасувати",
      "redo": "Повторити",
      "clear": "Очистити"
    }
  },
  "header": {
    "save": "Зберегти",
    "exit": "Вийти",
    "backToList": "Назад до списку",
    "undo": "Скасувати (Ctrl+Z)",
    "redo": "Повторити (Ctrl+Y)",
    "clear": "Очистити сторінку",
    "exportPDF": "Експорт в PDF",
    "importPDF": "Імпорт PDF"
  },
  "status": {
    "saving": "Збереження...",
    "saved": "Збережено {time}",
    "unsavedChanges": "Незбережені зміни",
    "justNow": "щойно"
  },
  "footer": {
    "previousPage": "Попередня сторінка",
    "nextPage": "Наступна сторінка",
    "addPage": "Додати сторінку",
    "currentPage": "Поточна сторінка",
    "zoomOut": "Зменшити (-)",
    "zoomIn": "Збільшити (+)",
    "zoomLevel": "Рівень масштабу",
    "fullscreen": "Повноекранний режим (F11)"
  },
  "alerts": {
    "pdfExportSuccess": "PDF успішно експортовано",
    "pdfExportError": "Не вдалося експортувати PDF. Спробуйте ще раз.",
    "pdfImportSuccess": "PDF успішно імпортовано! Додано {count} сторінок.",
    "pdfImportError": "Не вдалося імпортувати PDF. Спробуйте ще раз.",
    "invalidFileType": "Невірний тип файлу. Виберіть PDF файл."
  }
}

fs.writeFileSync(ukPath, JSON.stringify(ukData, null, 2) + '\n', 'utf-8')

console.log('✓ Added soloWorkspace namespace with all 56 keys')
