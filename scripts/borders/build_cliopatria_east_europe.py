"""Збирач набору кордонів для `map_card` (ТЗ saas_docs/plans/TZ_HISTORICAL_BORDERS_MAP_2026-10-30.md §3.1).

Вхід: архів Cliopatria `cliopatria.geojson.zip` (Seshat Global History Databank, CC BY 4.0,
https://github.com/Seshat-Global-History-Databank/cliopatria). Вихід:
`src/modules/winterboard/board/data/borders_cliopatria_east_europe_1648_1687.json`.

    python -I scripts/borders/build_cliopatria_east_europe.py <cliopatria.geojson.zip> <out.json>

Версія (`v1-…`) — відбиток вмісту; нова версія → новий файл і рядок у `board/historicalBorders.ts`
(`BORDER_DATASETS`), старий файл лишається для старих дошок і Replay. Лише читання джерела, без AI.
"""
import hashlib
import json
import math
import sys
import zipfile

ZIP, OUT = sys.argv[1:3]
DATASET = 'cliopatria-east-europe-1648-1687'
REGION = (14.0, 41.0, 46.0, 58.5)
Y0, Y1 = 1648, 1687
TOL = 0.015
# Обріз ±10° довкола регіону: при нахилі камери (закон §9 v1.78) видно далі за регіон, обріз ±3° давав прямі краї
MARGIN = 10.0
STATES = {   # англійська назва джерела → (стабільний id сутності, укр. назва)
    'Polish-Lithuanian Commonwealth': ('commonwealth', 'Річ Посполита'),
    'Tsardom of Russia': ('muscovy', 'Московське царство'),
    'Ottoman Empire': ('ottoman', 'Османська імперія'),
    'Crimean Khanate': ('crimea', 'Кримське ханство'),
    'Zaporozhian Cossacks': ('zaporozhian_cossacks', 'Запорозькі козаки'),
    'Principality of Moldavia': ('moldavia', 'Молдавське князівство'),
    'Principality of Wallachia': ('wallachia', 'Валахія'),
    'Principality of Transylvania': ('transylvania', 'Трансильванія'),
    'Habsburg Monarchy': ('habsburg', 'Габсбурзька монархія'),
    'Swedish Empire': ('sweden', 'Шведська імперія'),
    'Brandenburg-Prussia': ('brandenburg_prussia', 'Бранденбург-Пруссія'),
}


def dp(pts, tol):
    if len(pts) < 5:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy)
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm if norm > 1e-12 else math.hypot(px - ax, py - ay)
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def near(ring, m=3.0):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return not (max(xs) < REGION[0] - m or min(xs) > REGION[2] + m or max(ys) < REGION[1] - m or min(ys) > REGION[3] + m)


def area(r):
    return 0.5 * sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))


def clip(r, x0, y0, x1, y1):
    def cut(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            cur, prev = pts[i], pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
        return out
    ix = lambda x: (lambda p, q: (x, p[1] + (q[1] - p[1]) * (x - p[0]) / ((q[0] - p[0]) or 1e-12)))
    iy = lambda y: (lambda p, q: (p[0] + (q[0] - p[0]) * (y - p[1]) / ((q[1] - p[1]) or 1e-12), y))
    pts = r[:-1]
    for inside, inter in ((lambda p: p[0] >= x0, ix(x0)), (lambda p: p[0] <= x1, ix(x1)),
                          (lambda p: p[1] >= y0, iy(y0)), (lambda p: p[1] <= y1, iy(y1))):
        if not pts:
            break
        pts = cut(pts, inside, inter)
    return pts + pts[:1] if pts else []


def centroid(r):
    a = area(r)
    if abs(a) < 1e-9:
        return None
    k = lambda i: r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    cx = sum((r[i][0] + r[i + 1][0]) * k(i) for i in range(len(r) - 1)) / (6 * a)
    cy = sum((r[i][1] + r[i + 1][1]) * k(i) for i in range(len(r) - 1)) / (6 * a)
    return [round(cx, 2), round(cy, 2)]


with zipfile.ZipFile(ZIP) as z:
    name = [n for n in z.namelist() if n.endswith('.geojson')][0]
    raw = z.read(name)
source_sha = hashlib.sha256(raw).hexdigest()
feats = json.loads(raw)['features']

states = []
for f in feats:
    p = f['properties']
    if p.get('Name') not in STATES or not f.get('geometry'):
        continue
    fy, ty = p['FromYear'], p['ToYear']
    if ty < Y0 or fy > Y1:
        continue
    eid, uk = STATES[p['Name']]
    geom = f['geometry']
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    out_polys, best_a, label = [], 0.0, None
    for poly in polys:
        if not near(poly[0]):
            continue
        rings = []
        for ring in poly:
            # обрізати до регіону із запасом MARGIN — далі камера не заходить (лінії обрізу поза видом)
            cut = clip([(x, y) for x, y in ring], REGION[0] - MARGIN, REGION[1] - MARGIN, REGION[2] + MARGIN, REGION[3] + MARGIN)
            if len(cut) < 4:
                continue
            s = dp(cut, TOL)
            if len(s) >= 4:
                rings.append([[round(x, 3), round(y, 3)] for x, y in s])
        if not rings:
            continue
        out_polys.append(rings)
        c = clip([tuple(pt) for pt in rings[0]], REGION[0] + 0.6, REGION[1] + 0.4, REGION[2] - 0.6, REGION[3] - 0.4)
        a = abs(area(c)) if len(c) > 3 else 0.0
        if a > best_a:
            best_a, label = a, centroid(c)
    if not out_polys:
        continue
    states.append({'id': f'{eid}:{fy}-{ty}', 'entity': eid, 'name_uk': uk, 'name_en': p['Name'],
                   'from': fy, 'to': ty, 'label': label if best_a > 0.6 else None,
                   'wikidata': p.get('Wikidata') or None, 'polygons': out_polys})
states.sort(key=lambda s: (s['entity'], s['from']))
changes = sorted({max(s['from'], Y0) for s in states})
body = {'states': states}
version = 'v1-' + hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()[:10]
meta = {
    'dataset': DATASET, 'version': version, 'region': list(REGION), 'years': [Y0, Y1], 'change_years': changes,
    'source': {'title': 'Cliopatria (Seshat Global History Databank)',
               'url': 'https://github.com/Seshat-Global-History-Databank/cliopatria',
               'paper': 'https://doi.org/10.1038/s41597-025-04516-9',
               'license': 'CC BY 4.0', 'license_url': 'https://creativecommons.org/licenses/by/4.0/',
               'sha256': source_sha},
    'changes_by_m4sh': 'відібрано 11 держав Східної Європи за 1648–1687; межі обрізано до регіону (±10°) і спрощено (0,015°); '
                       'назви перекладено; точки підписів пораховано',
    'years_inclusive': True,
    'verified_by_historian': False,
}
out = {'meta': meta, **body}
open(OUT, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
size = len(json.dumps(out, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
print(f'version={version} states={len(states)} changes={changes} size={size // 1024}KB')
