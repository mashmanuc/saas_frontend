# Keyboard Shortcuts - Solo Board

> Повний список keyboard shortcuts для Solo Board whiteboard.
> Shortcuts працюють cross-platform (Windows/Linux та macOS).

---

## Platform Note

| Platform | Modifier Key |
|----------|--------------|
| **Windows/Linux** | `Ctrl` |
| **macOS** | `⌘ (Cmd)` |

У документації нижче `Mod` означає `Ctrl` на Windows/Linux або `⌘` на macOS.

---

## Drawing Tools

| Shortcut | Tool | Description |
|----------|------|-------------|
| `P` | Pen | Малювання від руки |
| `H` | Highlighter | Напівпрозорий маркер |
| `E` | Eraser | Гумка для стирання |
| `L` | Line | Пряма лінія |
| `A` | Arrow | Стрілка (з налаштуванням напрямку) |
| `R` | Rectangle | Прямокутник |
| `C` | Circle | Коло |
| `T` | Text | Текстовий елемент |
| `N` | Note | Sticky note (нотатка) |
| `V` | Select | Інструмент вибору (lasso) |

---

## Edit Actions

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Mod + Z` | Undo | Скасувати останню дію |
| `Mod + Shift + Z` | Redo | Повторити скасовану дію |
| `Mod + Y` | Redo | Повторити (альтернатива) |
| `Mod + C` | Copy | Копіювати виділене |
| `Mod + V` | Paste | Вставити |
| `Mod + A` | Select All | Виділити все на сторінці |
| `Delete` / `Backspace` | Delete | Видалити виділені елементи |
| `Escape` | Cancel/Deselect | Скасувати поточну дію / зняти виділення |

---

## View & Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Mod + +` / `Mod + =` | Zoom In | Збільшити масштаб |
| `Mod + -` | Zoom Out | Зменшити масштаб |
| `Mod + 0` | Reset Zoom | Скинути масштаб до 100% |
| `Space` (hold) | Pan Mode | Утримуйте для переміщення полотна |

---

## Quick Reference Card

```
╔═══════════════════════════════════════════════════════════════╗
║                    SOLO BOARD SHORTCUTS                        ║
╠═══════════════════════════════════════════════════════════════╣
║  TOOLS                    │  ACTIONS                           ║
║  P  Pen                   │  Mod+Z  Undo                       ║
║  H  Highlighter           │  Mod+Y  Redo                       ║
║  E  Eraser                │  Mod+C  Copy                       ║
║  L  Line                  │  Mod+V  Paste                      ║
║  A  Arrow                 │  Mod+A  Select All                 ║
║  R  Rectangle             │  Del    Delete                     ║
║  C  Circle                │  Esc    Cancel                     ║
║  T  Text                  │                                    ║
║  N  Note                  │  VIEW                              ║
║  V  Select                │  Mod++  Zoom In                    ║
║                           │  Mod+-  Zoom Out                   ║
║                           │  Mod+0  Reset Zoom                 ║
║                           │  Space  Pan (hold)                 ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Notes

### Disabled During Text Editing
Коли ви редагуєте текст (textarea focused), tool shortcuts (`P`, `H`, `E`, etc.) вимкнені щоб не конфліктувати з набором тексту. Escape працює завжди.

### Browser Conflicts
Деякі shortcuts можуть конфліктувати з browser shortcuts:
- `Mod + W` - закриває tab (не використовується)
- `Mod + T` - новий tab (ми використовуємо просто `T` для Text)
- `Mod + N` - нове вікно (ми використовуємо просто `N` для Note)

### Custom Shortcuts
Поточна версія не підтримує кастомізацію shortcuts. Це може бути додано в майбутніх версіях.

---

## Implementation

Shortcuts реалізовані через Vue composable:
```
solo_FE/composables/useKeyboardShortcuts.ts
```

### Usage in Components

```typescript
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

const { isPanning, MOD_KEY, getToolShortcut } = useKeyboardShortcuts({
  onToolChange: (tool) => setTool(tool),
  onUndo: () => undo(),
  onRedo: () => redo(),
  // ... other handlers
})
```

### Getting Shortcut Display for UI

```typescript
import { getShortcutDisplay, getToolShortcut } from '@/composables/useKeyboardShortcuts'

// For tool shortcuts
getToolShortcut('pen')  // Returns "P"

// For action shortcuts
getShortcutDisplay('undo')  // Returns "⌘Z" on Mac, "Ctrl+Z" on Windows
```

---

## Changelog

- **v0.31** - Initial keyboard shortcuts implementation
  - 10 tool shortcuts
  - 8 action shortcuts
  - 4 view/navigation shortcuts
  - Cross-platform support (Mac + Windows)
  - Disabled during text editing

---

**Останнє оновлення:** 2024-02-03
