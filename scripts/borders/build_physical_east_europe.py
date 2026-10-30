"""Збирач фізичної основи історичної карти `east_europe` (закон §9 v1.78, ТЗ TZ_HISTORICAL_BORDERS_MAP_2026-10-30 §8).

Вхід — тека з файлами Natural Earth 1:10 млн (public domain, https://www.naturalearthdata.com/), закріплена ревізія
`nvkelso/natural-earth-vector@ca96624a`: `land.geojson` (ne_10m_land), `rivers.geojson` (ne_10m_rivers_lake_centerlines),
`lakes.geojson` (ne_10m_lakes), `cities.geojson` (ne_10m_populated_places). Вихід:
`src/modules/winterboard/board/data/physical_east_europe_ne10m.json`.

    python -I scripts/borders/build_physical_east_europe.py <тека_natural_earth> <out.json>

Основа сучасна: водосховища (Lake з `dam_name`, Reservoir) вилучено — їх у XVII ст. не було; русло річки через них
лишається лінією «Lake Centerline». Міста — орієнтири, що існували в 1648–1687 (назви — як у тогочасних текстах,
де відрізняються). Обрізано до регіону ±10° (при нахилі камера бачить далі за регіон) і спрощено (0,005°).
Версія — відбиток вмісту; нова версія → новий рядок у `board/historicalBasemap.ts`. Лише читання джерел, без AI.
"""
import hashlib
import json
import math
import os
import sys

SRC, OUT = sys.argv[1:3]
BASEMAP = 'east_europe'
REGION = (14.0, 41.0, 46.0, 58.5)
MARGIN = 10.0
BOX = (REGION[0] - MARGIN, REGION[1] - MARGIN, REGION[2] + MARGIN, REGION[3] + MARGIN)
TOL = 0.005
ND = 3   # знаків після коми (≈100 м)

# Назви головних річок (у джерелі українських немає); інші річки — без підпису
RIVERS = {
    'Dnieper': ('Дніпро', 'Dnieper'), 'Dniester': ('Дністер', 'Dniester'), 'Danube': ('Дунай', 'Danube'),
    'Vistula': ('Вісла', 'Vistula'), 'Don': ('Дон', 'Don'), 'Volga': ('Волга', 'Volga'), 'Neman': ('Німан', 'Neman'),
    'Pripyat': ('Прип’ять', 'Pripyat'), 'Desna': ('Десна', 'Desna'), 'Daugava': ('Західна Двіна', 'Daugava'),
    'Southern Bug': ('Південний Буг', 'Southern Bug'), 'Bug': ('Західний Буг', 'Bug'), 'Prut': ('Прут', 'Prut'),
    'Oka': ('Ока', 'Oka'), 'Severskiy Donets': ('Сіверський Донець', 'Seversky Donets'),
    'Seversky Donets': ('Сіверський Донець', 'Seversky Donets'), 'Oder': ('Одра', 'Oder'), 'Dvina': ('Західна Двіна', 'Daugava'),
}
# Міста-орієнтири: назва Natural Earth → (укр., англ., велике). Лише ті, що існували в 1648–1687.
CITIES = {
    'Kyiv': ('Київ', 'Kyiv', True), 'Lviv': ('Львів', 'Lviv', True), 'Warsaw': ('Варшава', 'Warsaw', True),
    'Vilnius': ('Вільно', 'Vilnius', True), 'Moscow': ('Москва', 'Moscow', True), 'Istanbul': ('Стамбул', 'Istanbul', True),
    'Vienna': ('Відень', 'Vienna', True), 'Stockholm': ('Стокгольм', 'Stockholm', True),
    'Kraków': ('Краків', 'Kraków', False), 'Krakow': ('Краків', 'Kraków', False), 'Smolensk': ('Смоленськ', 'Smolensk', False),
    'Minsk': ('Мінськ', 'Minsk', False), 'Gdansk': ('Гданськ', 'Gdańsk', False), 'Riga': ('Рига', 'Riga', False),
    'Lublin': ('Люблін', 'Lublin', False), 'Brest': ('Берестя', 'Brest', False), 'Grodno': ('Гродно', 'Grodno', False), 'Hrodna': ('Гродно', 'Grodno', False),
    'Chernivtsi': ('Чернівці', 'Chernivtsi', False), 'Ternopil': ('Тернопіль', 'Ternopil', False),
    'Lutsk': ('Луцьк', 'Lutsk', False), 'Zhytomyr': ('Житомир', 'Zhytomyr', False), 'Vinnytsya': ('Вінниця', 'Vinnytsia', False),
    'Poltava': ('Полтава', 'Poltava', False), 'Chernihiv': ('Чернігів', 'Chernihiv', False),
    'Cherkasy': ('Черкаси', 'Cherkasy', False), 'Bila Tserkva': ('Біла Церква', 'Bila Tserkva', False),
    'Kamyanets-Podilskyy': ('Кам’янець-Подільський', 'Kamianets-Podilskyi', False),
    'Kamianets-Podilskyi': ('Кам’янець-Подільський', 'Kamianets-Podilskyi', False),
    'Uman': ('Умань', 'Uman', False), 'Suceava': ('Сучава', 'Suceava', False), 'Iasi': ('Ясси', 'Iasi', False),
    'Bucharest': ('Бухарест', 'Bucharest', False), 'Sofia': ('Софія', 'Sofia', False),
}
SEAS = [
    {'name_uk': 'Чорне море', 'name_en': 'Black Sea', 'lon': 33.0, 'lat': 43.1},
    {'name_uk': 'Азовське море', 'name_en': 'Sea of Azov', 'lon': 36.6, 'lat': 46.15},
    {'name_uk': 'Балтійське море', 'name_en': 'Baltic Sea', 'lon': 19.4, 'lat': 56.6},
]


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


def clip_ring(r):
    """Sutherland–Hodgman до BOX; замкнене кільце або []."""
    x0, y0, x1, y1 = BOX

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
    pts = [tuple(p[:2]) for p in r[:-1]]
    for inside, inter in ((lambda p: p[0] >= x0, ix(x0)), (lambda p: p[0] <= x1, ix(x1)),
                          (lambda p: p[1] >= y0, iy(y0)), (lambda p: p[1] <= y1, iy(y1))):
        if not pts:
            break
        pts = cut(pts, inside, inter)
    return pts + pts[:1] if pts else []


def clip_line(line):
    """Лінія → шматки всередині BOX (Liang–Barsky на кожен відрізок)."""
    x0, y0, x1, y1 = BOX
    runs, cur = [], []
    for (ax, ay), (bx, by) in zip(line, line[1:]):
        dx, dy = bx - ax, by - ay
        t0, t1, ok = 0.0, 1.0, True
        for p, q in ((-dx, ax - x0), (dx, x1 - ax), (-dy, ay - y0), (dy, y1 - ay)):
            if abs(p) < 1e-15:
                if q < 0:
                    ok = False
                    break
                continue
            t = q / p
            if p < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
        if not ok or t0 > t1:
            if len(cur) > 1:
                runs.append(cur)
            cur = []
            continue
        s, e = (ax + t0 * dx, ay + t0 * dy), (ax + t1 * dx, ay + t1 * dy)
        if not cur or cur[-1] != s:
            if len(cur) > 1:
                runs.append(cur)
            cur = [s]
        cur.append(e)
        if t1 < 1.0:
            runs.append(cur)
            cur = []
    if len(cur) > 1:
        runs.append(cur)
    return runs


def rnd(pts):
    out = []
    for x, y in pts:
        p = [round(x, ND), round(y, ND)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def polygons_of(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon':
        return geom['coordinates']
    return []


def lines_of(geom):
    if geom['type'] == 'LineString':
        return [geom['coordinates']]
    if geom['type'] == 'MultiLineString':
        return geom['coordinates']
    return []


def clip_polys(geom, min_area=0.0):
    out = []
    for poly in polygons_of(geom):
        rings = []
        for k, ring in enumerate(poly):
            c = clip_ring(ring)
            if len(c) < 4:
                if k == 0:
                    break
                continue
            s = rnd(dp(c, TOL))
            if len(s) >= 4:
                rings.append(s)
            elif k == 0:
                break
        if rings and abs(area(rings[0])) >= min_area:
            out.append(rings)
    return out


def area(r):
    return 0.5 * sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))


def read(name):
    path = os.path.join(SRC, f'{name}.geojson')
    raw = open(path, 'rb').read()
    return json.loads(raw)['features'], hashlib.sha256(raw).hexdigest()


land_f, land_sha = read('land')
rivers_f, rivers_sha = read('rivers')
lakes_f, lakes_sha = read('lakes')
cities_f, cities_sha = read('cities')

land = [poly for f in land_f for poly in clip_polys(f['geometry'], min_area=0.002)]

rivers = []
for f in rivers_f:
    p = f['properties']
    if p.get('featurecla') not in ('River', 'Lake Centerline') or (p.get('scalerank') or 99) > 9:
        continue
    pieces = [rnd(dp(run, TOL)) for line in lines_of(f['geometry']) for run in clip_line(line)]
    pieces = [x for x in pieces if len(x) >= 2]
    if not pieces:
        continue
    uk, en = RIVERS.get(p.get('name_en') or p.get('name') or '', ('', ''))
    rivers.append({'rank': int(p.get('scalerank') or 9), 'name_uk': uk, 'name_en': en, 'lines': pieces})

lakes = []
for f in lakes_f:
    p = f['properties']
    if p.get('featurecla') != 'Lake' or p.get('dam_name') or (p.get('scalerank') or 99) > 9:
        continue
    polys = clip_polys(f['geometry'], min_area=0.004)
    if polys:
        lakes.append({'polygons': polys})

cities, seen = [], set()
for f in cities_f:
    p = f['properties']
    hit = CITIES.get(p.get('NAME')) or CITIES.get(p.get('NAMEASCII'))
    if not hit or hit[0] in seen:
        continue
    lon, lat = f['geometry']['coordinates'][:2]
    if not (BOX[0] <= lon <= BOX[2] and BOX[1] <= lat <= BOX[3]):
        continue
    seen.add(hit[0])
    cities.append({'name_uk': hit[0], 'name_en': hit[1], 'lon': round(lon, 3), 'lat': round(lat, 3), 'major': hit[2]})
cities.sort(key=lambda c: (not c['major'], c['name_uk']))
missing = sorted({v[0] for v in CITIES.values()} - seen)

body = {'land': land, 'rivers': rivers, 'lakes': lakes, 'cities': cities, 'seas': SEAS}
version = 'v1-' + hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()[:10]
meta = {
    'basemap': BASEMAP, 'version': version, 'region': list(REGION), 'box': list(BOX),
    'source': {'title': 'Natural Earth 1:10m', 'url': 'https://www.naturalearthdata.com/', 'license': 'public domain',
               'revision': 'nvkelso/natural-earth-vector@ca96624a56bd078437bca8184e78163e5039ad19',
               'sha256': {'land': land_sha, 'rivers': rivers_sha, 'lakes': lakes_sha, 'cities': cities_sha}},
    'changes_by_m4sh': 'обрізано до регіону ±10° і спрощено (0,005°); водосховища вилучено; підписано головні річки; '
                       'міста — орієнтири, що існували в 1648–1687; основа сучасна',
}
out = json.dumps({'meta': meta, **body}, ensure_ascii=False, separators=(',', ':'))
open(OUT, 'w', encoding='utf-8').write(out)
print(f'version={version} land={len(land)} rivers={len(rivers)} lakes={len(lakes)} cities={len(cities)} '
      f'size={len(out.encode("utf-8")) // 1024}KB missing={json.dumps(missing)}')
