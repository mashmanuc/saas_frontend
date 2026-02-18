# Winterboard v4 — Cross-Browser Testing Checklist

> Phase 7: A7.3 — Final Smoke Test
> Date: 2026-02-18

---

## Desktop Browsers

| Feature | Chrome 120+ | Firefox 121+ | Safari 17+ | Edge 120+ |
|---------|:-----------:|:------------:|:----------:|:---------:|
| Canvas render | ✅ | ✅ | ✅ | ✅ |
| Drawing (pen) | ✅ | ✅ | ✅ | ✅ |
| Drawing (highlighter) | ✅ | ✅ | ✅ | ✅ |
| Shapes (rect/circle/line) | ✅ | ✅ | ✅ | ✅ |
| Text tool | ✅ | ✅ | ✅ | ✅ |
| Eraser | ✅ | ✅ | ✅ | ✅ |
| Undo/Redo | ✅ | ✅ | ✅ | ✅ |
| Zoom (scroll/buttons) | ✅ | ✅ | ✅ | ✅ |
| Pan (drag) | ✅ | ✅ | ✅ | ✅ |
| Multi-page | ✅ | ✅ | ✅ | ✅ |
| PDF import | ✅ | ✅ | ✅ | ✅ |
| Export (JSON/PNG/PDF) | ✅ | ✅ | ✅ | ✅ |
| Share link | ✅ | ✅ | ✅ | ✅ |
| Public view | ✅ | ✅ | ✅ | ✅ |
| Session CRUD | ✅ | ✅ | ✅ | ✅ |
| Keyboard shortcuts | ✅ | ✅ | ✅ | ✅ |
| WebSocket (classroom) | ✅ | ✅ | ✅ | ✅ |
| Pressure sensitivity | ✅ | ✅ | ⚠️¹ | ✅ |
| Palm rejection | ✅ | ✅ | ✅ | ✅ |
| Responsive layout | ✅ | ✅ | ✅ | ✅ |

## Mobile Browsers

| Feature | iOS Safari 17+ | Android Chrome 120+ | Samsung Internet |
|---------|:--------------:|:-------------------:|:----------------:|
| Canvas render | ✅ | ✅ | ✅ |
| Touch drawing | ✅ | ✅ | ✅ |
| Pinch zoom | ✅ | ✅ | ✅ |
| Two-finger pan | ✅ | ✅ | ✅ |
| Toolbar (responsive) | ✅ | ✅ | ✅ |
| Session list | ✅ | ✅ | ✅ |
| PDF import | ✅ | ✅ | ✅ |
| Export | ✅ | ✅ | ✅ |
| Public view | ✅ | ✅ | ✅ |
| Pressure (Apple Pencil) | ✅ | N/A | N/A |
| Pressure (S-Pen) | N/A | ✅ | ✅ |

## Tablet Browsers

| Feature | iPadOS Safari | Android Chrome (tablet) |
|---------|:-------------:|:----------------------:|
| Canvas render | ✅ | ✅ |
| Stylus drawing | ✅ | ✅ |
| Pressure sensitivity | ✅ | ✅ |
| Palm rejection | ✅ | ✅ |
| Split view | ✅ | ✅ |
| Keyboard shortcuts | ✅² | ✅² |

---

## Notes

1. ⚠️ Safari desktop: Pressure sensitivity requires Force Touch trackpad or external tablet. Standard mouse always reports pressure=0.5.
2. External keyboard required for keyboard shortcuts on tablets.

## Known Limitations

- **Safari < 17**: WebSocket reconnection may be slower due to older API support
- **iOS < 16.4**: `PointerEvent.pressure` not fully supported — falls back to default pressure
- **Firefox Android**: Pinch-to-zoom may conflict with browser zoom on some devices — mitigated by `touch-action: none` on canvas
- **Samsung Internet < 23**: Minor CSS grid rendering differences in session list — cosmetic only

## Testing Tools

- Desktop: Manual testing + Cypress E2E (Chrome, Firefox, Edge via `--browser` flag)
- Mobile: Manual testing on physical devices + BrowserStack
- Visual regression: Playwright (Chromium desktop + mobile viewports)
- Accessibility: axe-core via Lighthouse CI
