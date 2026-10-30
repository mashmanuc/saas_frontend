"""Збирач світового набору кордонів для історичної карти будь-якої теми (власник 30.10: «Мене цікавить
універсальність, а не прив'язка до цієї теми»; вимір — saas_docs/domains/intent/MEASURE_HISTORICAL_MAP_UNIVERSALITY_2026-10-30.md).

Вхід: архів Cliopatria `cliopatria.geojson.zip` (Seshat Global History Databank, CC BY 4.0). Вихід — статичні файли
сайту `public/maps/borders/<версія>/`:
  - `index.json` — покажчик: для кожного стану держави — id, назви (укр. з Вікіданих, англ. з джерела), сутність
    (Вікідані, непрозоро), роки `from`–`to` включно, межі (bbox), шматок, у якому лежить геометрія;
  - `p/<шматок>.json` — геометрія станів: кожен стан — В ОДНОМУ шматку (за клітинкою 30° центру межі й століттям
    початку), без повторів. Карта теми бере з покажчика лише потрібні держави потрібних років і вантажить лише їхні
    шматки (`board/historicalBorders.ts`).

    python -X utf8 -I scripts/borders/build_cliopatria_world.py <cliopatria.geojson.zip> <тека_виходу> [labels.json]

Не беремо: роки до 0 (шкільна програма — від Русі й античності пізніше), об'єднання в дужках («(Holy Roman Empire)»
лежить поверх своїх частин — малюємо частини), стани без геометрії. Спрощення 0,02° (≈2 км), координати — 3 знаки.
`labels.json` — {wikidata: укр. назва}, якщо вже зібрано (інакше збирається з Вікіданих і зберігається поруч).
Версія — відбиток вмісту. Лише читання джерел, без AI.
"""
import hashlib
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
import zipfile

ZIP, OUT = sys.argv[1:3]
LABELS = sys.argv[3] if len(sys.argv) > 3 else os.path.join(OUT, '..', 'cliopatria_uk_labels.json')
TOL = 0.02
ND = 3
TILE = 30
MIN_YEAR = 0


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


def area(r):
    return 0.5 * sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))


def centroid(r):
    a = area(r)
    if abs(a) < 1e-9:
        return None
    k = lambda i: r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    cx = sum((r[i][0] + r[i + 1][0]) * k(i) for i in range(len(r) - 1)) / (6 * a)
    cy = sum((r[i][1] + r[i + 1][1]) * k(i) for i in range(len(r) - 1)) / (6 * a)
    return [round(cx, 2), round(cy, 2)]


def uk_labels(qids):
    """Укр. назви з Вікіданих (пакети по 50). Немає укр. — англ. назва джерела (на картці — як є)."""
    got = {}
    if os.path.exists(LABELS):
        got = json.load(open(LABELS, encoding='utf-8'))
    todo = [q for q in qids if q not in got]
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        url = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({
            'action': 'wbgetentities', 'ids': '|'.join(batch), 'props': 'labels', 'languages': 'uk', 'format': 'json'})
        req = urllib.request.Request(url, headers={'User-Agent': 'M4SH-borders-build/1.0 (mashmanuc@gmail.com)'})
        data = json.loads(urllib.request.urlopen(req, timeout=60).read())
        for q, ent in (data.get('entities') or {}).items():
            got[q] = (((ent.get('labels') or {}).get('uk') or {}).get('value') or '')
        time.sleep(0.2)
    os.makedirs(os.path.dirname(os.path.abspath(LABELS)), exist_ok=True)
    json.dump(got, open(LABELS, 'w', encoding='utf-8'), ensure_ascii=False)
    return got


with zipfile.ZipFile(ZIP) as z:
    name = [n for n in z.namelist() if n.endswith('.geojson')][0]
    raw = z.read(name)
source_sha = hashlib.sha256(raw).hexdigest()
feats = json.loads(raw)['features']
del raw

states, packs = [], {}
for n, f in enumerate(feats):
    p, g = f['properties'], f.get('geometry')
    if not g or p['Name'].startswith('(') or p['ToYear'] < MIN_YEAR:
        continue
    polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    out_polys, best_a, label = [], 0.0, None
    xs, ys = [], []
    for poly in polys:
        rings = []
        for k, ring in enumerate(poly):
            s = rnd(dp([tuple(x[:2]) for x in ring], TOL))
            if len(s) >= 4:
                rings.append(s)
            elif k == 0:
                break
        if not rings:
            continue
        out_polys.append(rings)
        xs += [x for x, _ in rings[0]]
        ys += [y for _, y in rings[0]]
        a = abs(area(rings[0]))
        if a > best_a:
            best_a, label = a, centroid(rings[0])
    if not out_polys:
        continue
    bbox = [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)]
    cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
    fy = max(p['FromYear'], MIN_YEAR)
    pack = f"{int((cx + 180) // TILE)}-{int((cy + 90) // TILE)}-{fy // 100}"
    sid = f"s{n}"
    states.append({'id': sid, 'en': p['Name'], 'wd': p.get('Wikidata') or '', 'from': fy, 'to': p['ToYear'],
                   'bbox': bbox, 'label': label if best_a > 0.3 else None, 'pack': pack})
    packs.setdefault(pack, {})[sid] = out_polys
del feats

labels = uk_labels(sorted({s['wd'] for s in states if s['wd']}))
for s in states:
    s['uk'] = labels.get(s['wd']) or ''

pack_body = {k: json.dumps(v, separators=(',', ':')) for k, v in sorted(packs.items())}
index_body = json.dumps(states, ensure_ascii=False, separators=(',', ':'))
version = 'w1-' + hashlib.sha256((index_body + ''.join(pack_body.values())).encode()).hexdigest()[:10]
root = os.path.join(OUT, version)
os.makedirs(os.path.join(root, 'p'), exist_ok=True)
meta = {
    'dataset': 'cliopatria-world', 'version': version, 'tile_deg': TILE, 'min_year': MIN_YEAR,
    'source': {'title': 'Cliopatria (Seshat Global History Databank)',
               'url': 'https://github.com/Seshat-Global-History-Databank/cliopatria',
               'paper': 'https://doi.org/10.1038/s41597-025-04516-9', 'license': 'CC BY 4.0',
               'license_url': 'https://creativecommons.org/licenses/by/4.0/', 'sha256': source_sha},
    'changes_by_m4sh': 'роки від 0; без об\'єднань у дужках; спрощено 0,02°; укр. назви — з Вікіданих; '
                       'кожен стан — в одному шматку (клітинка 30° × століття)',
    'years_inclusive': True, 'verified_by_historian': False,
}
open(os.path.join(root, 'index.json'), 'w', encoding='utf-8').write(
    json.dumps({'meta': meta, 'states': states}, ensure_ascii=False, separators=(',', ':')))
for k, body in pack_body.items():
    open(os.path.join(root, 'p', f'{k}.json'), 'w', encoding='utf-8').write(body)
sizes = sorted((len(b) for b in pack_body.values()), reverse=True)
print(f'version={version} states={len(states)} packs={len(packs)} index={len(index_body) // 1024}KB '
      f'packs_total={sum(sizes) // 1024}KB max={sizes[0] // 1024}KB median={sizes[len(sizes) // 2] // 1024}KB '
      f'uk_labels={sum(1 for s in states if s["uk"])}/{len(states)}')
