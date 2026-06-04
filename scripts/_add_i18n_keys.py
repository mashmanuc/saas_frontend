"""One-off script: add winterboard.nmt3d + winterboard.quadratic to uk.json and en.json."""
import json

NEW_UK = {
    "nmt3d": {
        "trayHeader":  "Стереометрія НМТ",
        "loading":     "завантаження…",
        "trayHint":    "Перетягни на дошку або натисни +",
        "addToBoard":  "Додати «{name}» на дошку",
        "paramsLabel": "Параметри",
        "viewLabel":   "Вигляд",
        "resetView":   "Скинути вигляд",
        "autoOrbit":   "↻ авто-обертання",
        "auxLabel":    "Доп. побудови",
        "unfold":      "▦ розгортка",
        "view3d":      "3D вигляд",
        "viewIso":     "Ізометрія",
        "viewFront":   "Спереду",
        "viewSide":    "Збоку",
        "viewTop":     "Зверху",
        "viewBottom":  "Знизу",
    },
    "quadratic": {
        "trayHeader":        "Квадратне рівняння",
        "trayTitle":         "ax²+bx+c — дискримінант і корені",
        "traySublabel":      "D · корені · парабола",
        "addToBoard":        "Додати «Квадратне рівняння» на дошку",
        "signLabel":         "Знак",
        "presetsLabel":      "Приклади",
        "coefficientsLabel": "Коефіцієнти",
        "discriminantLabel": "Дискримінант",
        "displayLabel":      "Відображення",
        "noRoots":           "коренів немає",
        "vertex":            "вершина",
        "solutionLabel":     "Розв’язок",
        "noSolution":        "∅ (немає розв’язків)",
        "allNumbers":        "x ∈ ℝ (усі числа)",
        "allReal":           "x ∈ ℝ",
    },
}

NEW_EN = {
    "nmt3d": {
        "trayHeader":  "NMT 3D Solids",
        "loading":     "Loading…",
        "trayHint":    "Drag onto the board or press +",
        "addToBoard":  "Add «{name}» to board",
        "paramsLabel": "Parameters",
        "viewLabel":   "View",
        "resetView":   "Reset view",
        "autoOrbit":   "↻ auto-orbit",
        "auxLabel":    "Extra constructions",
        "unfold":      "▦ Unfold",
        "view3d":      "3D view",
        "viewIso":     "Isometric",
        "viewFront":   "Front",
        "viewSide":    "Side",
        "viewTop":     "Top",
        "viewBottom":  "Bottom",
    },
    "quadratic": {
        "trayHeader":        "Quadratic Equation",
        "trayTitle":         "ax²+bx+c — discriminant & roots",
        "traySublabel":      "D · roots · parabola",
        "addToBoard":        "Add Quadratic Equation to board",
        "signLabel":         "Sign",
        "presetsLabel":      "Examples",
        "coefficientsLabel": "Coefficients",
        "discriminantLabel": "Discriminant",
        "displayLabel":      "Display",
        "noRoots":           "no roots",
        "vertex":            "vertex",
        "solutionLabel":     "Solution",
        "noSolution":        "∅ (no solutions)",
        "allNumbers":        "x ∈ ℝ (all numbers)",
        "allReal":           "x ∈ ℝ",
    },
}

for fname, NEW in [
    ("src/i18n/locales/uk.json", NEW_UK),
    ("src/i18n/locales/en.json", NEW_EN),
]:
    with open(fname, encoding="utf-8") as f:
        d = json.load(f)
    for key, val in NEW.items():
        d["winterboard"][key] = val
    with open(fname, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    print(f"Updated {fname}")

print("Done.")
