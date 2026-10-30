"""Збирач фізичної основи історичної карти на весь світ (власник 30.10 — універсальність): шматки 30° × 30°.

Вхід — тека Natural Earth 1:10 млн (`land`, `rivers`, `lakes`, `cities` .geojson, ревізія як у
`build_physical_east_europe.py`). Вихід — `public/maps/physical/<версія>/<шматок>.json` + `index.json`.
Шматок: суша (обрізана до клітинки, без обвідки — шви по краях клітинок не малюються), річки й озера (без
сучасних водосховищ), міста. **Міста — лише з роком заснування у Вікіданих** (`P571`): карта показує місто лише з
року, коли воно вже існувало (Одеса не з'явиться на карті 1648 р.); назва — укр. з Вікіданих.

    python -X utf8 -I scripts/borders/build_physical_world.py <тека_natural_earth> <тека_виходу>
"""
import hashlib
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

SRC, OUT = sys.argv[1:3]
TILE = 30
TOL = 0.006
ND = 3
CITY_RANK = 4
RIVERS = {
    'Dnieper': 'Дніпро', 'Dniester': 'Дністер', 'Danube': 'Дунай', 'Vistula': 'Вісла', 'Don': 'Дон', 'Volga': 'Волга',
    'Neman': 'Німан', 'Pripyat': 'Прип’ять', 'Desna': 'Десна', 'Daugava': 'Західна Двіна', 'Southern Bug': 'Південний Буг',
    'Bug': 'Західний Буг', 'Prut': 'Прут', 'Oka': 'Ока', 'Severskiy Donets': 'Сіверський Донець', 'Oder': 'Одра',
    'Elbe': 'Ельба', 'Rhine': 'Рейн', 'Rhône': 'Рона', 'Rhone': 'Рона', 'Seine': 'Сена', 'Loire': 'Луара', 'Po': 'По',
    'Thames': 'Темза', 'Ebro': 'Ебро', 'Tagus': 'Тахо', 'Weser': 'Везер', 'Main': 'Майн', 'Kama': 'Кама',
    'Ural': 'Урал', 'Ob': 'Об', 'Yenisey': 'Єнісей', 'Lena': 'Лена', 'Amur': 'Амур', 'Nile': 'Ніл',
    'Euphrates': 'Євфрат', 'Tigris': 'Тигр', 'Indus': 'Інд', 'Ganges': 'Ганг', 'Yangtze': 'Янцзи',
    'Huang He': 'Хуанхе', 'Mississippi': 'Міссісіпі', 'Missouri': 'Міссурі', 'Ohio': 'Огайо', 'Hudson': 'Гудзон',
    'St. Lawrence': 'Святого Лаврентія', 'Amazon': 'Амазонка', 'Congo': 'Конго', 'Niger': 'Нігер',
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


def rnd(pts):
    out = []
    for x, y in pts:
        p = [round(x, ND), round(y, ND)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def clip_ring(r, box):
    x0, y0, x1, y1 = box

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


def clip_line(line, box):
    x0, y0, x1, y1 = box
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


def area(r):
    return 0.5 * sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))


def bbox_of(coords):
    xs = [p[0] for p in coords]; ys = [p[1] for p in coords]
    return min(xs), min(ys), max(xs), max(ys)


def polygons_of(geom):
    return [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates'] if geom['type'] == 'MultiPolygon' else []


def lines_of(geom):
    return [geom['coordinates']] if geom['type'] == 'LineString' else geom['coordinates'] if geom['type'] == 'MultiLineString' else []


def tiles_for(b):
    for tx in range(int((b[0] + 180) // TILE), int((min(b[2], 179.999) + 180) // TILE) + 1):
        for ty in range(int((b[1] + 90) // TILE), int((min(b[3], 89.999) + 90) // TILE) + 1):
            yield tx, ty


def tile_box(tx, ty):
    return (tx * TILE - 180, ty * TILE - 90, (tx + 1) * TILE - 180, (ty + 1) * TILE - 90)


def read(name):
    raw = open(os.path.join(SRC, f'{name}.geojson'), 'rb').read()
    return json.loads(raw)['features'], hashlib.sha256(raw).hexdigest()


def wikidata(qids):
    """{qid: (укр. назва, рік заснування P571 або None)} пакетами по 50."""
    out = {}
    qids = [q for q in qids if re.fullmatch(r'Q\d+', q or '')]
    for i in range(0, len(qids), 50):
        url = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({
            'action': 'wbgetentities', 'ids': '|'.join(qids[i:i + 50]), 'props': 'labels|claims', 'languages': 'uk',
            'format': 'json'})
        req = urllib.request.Request(url, headers={'User-Agent': 'M4SH-physical-build/1.0 (mashmanuc@gmail.com)'})
        data = json.loads(urllib.request.urlopen(req, timeout=60).read())
        for q, ent in (data.get('entities') or {}).items():
            label = (((ent.get('labels') or {}).get('uk') or {}).get('value') or '')
            year = None
            for st in (ent.get('claims') or {}).get('P571', []):
                t = (((st.get('mainsnak') or {}).get('datavalue') or {}).get('value') or {}).get('time')
                m = re.match(r'([+-]\d+)-', t or '')
                if m:
                    y = int(m.group(1))
                    year = y if year is None else min(year, y)
            out[q] = (label, year)
        time.sleep(0.2)
    return out


tiles: dict[tuple, dict] = {}


def tile(t):
    return tiles.setdefault(t, {'land': [], 'rivers': [], 'lakes': [], 'cities': []})


land_f, land_sha = read('land')
for f in land_f:
    for poly in polygons_of(f['geometry']):
        b = bbox_of(poly[0])
        for t in tiles_for(b):
            box = tile_box(*t)
            rings = []
            for k, ring in enumerate(poly):
                c = clip_ring(ring, box)
                s = rnd(dp(c, TOL)) if len(c) >= 4 else []
                if len(s) >= 4:
                    rings.append(s)
                elif k == 0:
                    break
            if rings and abs(area(rings[0])) >= 0.002:
                tile(t)['land'].append(rings)

rivers_f, rivers_sha = read('rivers')
for f in rivers_f:
    p = f['properties']
    if p.get('featurecla') not in ('River', 'Lake Centerline') or (p.get('scalerank') or 99) > 8:
        continue
    name = RIVERS.get(p.get('name_en') or p.get('name') or '', '')
    for line in lines_of(f['geometry']):
        for t in tiles_for(bbox_of(line)):
            pieces = [rnd(dp(run, TOL)) for run in clip_line(line, tile_box(*t))]
            pieces = [x for x in pieces if len(x) >= 2]
            if pieces:
                tile(t)['rivers'].append({'rank': int(p.get('scalerank') or 8), 'name_uk': name, 'lines': pieces})

lakes_f, lakes_sha = read('lakes')
for f in lakes_f:
    p = f['properties']
    if p.get('featurecla') != 'Lake' or p.get('dam_name') or (p.get('scalerank') or 99) > 8:
        continue
    for poly in polygons_of(f['geometry']):
        for t in tiles_for(bbox_of(poly[0])):
            rings = [s for s in (rnd(dp(clip_ring(r, tile_box(*t)), TOL)) for r in poly) if len(s) >= 4]
            if rings and abs(area(rings[0])) >= 0.004:
                tile(t)['lakes'].append(rings)

cities_f, cities_sha = read('cities')
cand = [f for f in cities_f if (f['properties'].get('SCALERANK') or 99) <= CITY_RANK and f['properties'].get('WIKIDATAID')]
wd = wikidata([f['properties']['WIKIDATAID'] for f in cand])
kept = 0
for f in cand:
    p = f['properties']
    label, founded = wd.get(p['WIKIDATAID'], ('', None))
    if founded is None:
        continue                      # невідомо, коли засноване, — не показуємо (не вигадуємо міста в минулому)
    lon, lat = f['geometry']['coordinates'][:2]
    t = (int((lon + 180) // TILE), int((min(lat, 89.999) + 90) // TILE))
    tile(t)['cities'].append({'name_uk': label or p.get('NAME_UK') or p.get('NAME') or '', 'name_en': p.get('NAME') or '',
                              'lon': round(lon, 3), 'lat': round(lat, 3), 'from': founded,
                              'major': (p.get('SCALERANK') or 9) <= 1})
    kept += 1

bodies = {f'{tx}-{ty}': json.dumps(v, ensure_ascii=False, separators=(',', ':')) for (tx, ty), v in sorted(tiles.items())}
version = 'pw1-' + hashlib.sha256(''.join(bodies.values()).encode()).hexdigest()[:10]
root = os.path.join(OUT, version)
os.makedirs(root, exist_ok=True)
for k, body in bodies.items():
    open(os.path.join(root, f'{k}.json'), 'w', encoding='utf-8').write(body)
meta = {'version': version, 'tile_deg': TILE, 'tiles': sorted(bodies),
        'source': {'title': 'Natural Earth 1:10m', 'url': 'https://www.naturalearthdata.com/', 'license': 'public domain',
                   'sha256': {'land': land_sha, 'rivers': rivers_sha, 'lakes': lakes_sha, 'cities': cities_sha}},
        'cities': 'Natural Earth (scalerank ≤ 4) з роком заснування й укр. назвою з Вікіданих (P571)'}
open(os.path.join(root, 'index.json'), 'w', encoding='utf-8').write(json.dumps(meta, ensure_ascii=False))
sizes = sorted((len(b) for b in bodies.values()), reverse=True)
print(f'version={version} tiles={len(bodies)} total={sum(sizes) // 1024}KB max={sizes[0] // 1024}KB cities={kept}/{len(cand)}')
