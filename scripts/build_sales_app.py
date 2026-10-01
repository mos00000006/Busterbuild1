#!/usr/bin/env python3
from __future__ import annotations
import json, os, re
from pathlib import Path
from urllib.parse import quote

from bs4 import BeautifulSoup
import qrcode

ROOT = Path(__file__).resolve().parents[1]
SALES = ROOT / 'sales-app'
QR_DIR = SALES / 'qr'
DATA_DIR = SALES / 'data'
SOURCE_HTML = ROOT / 'tile & sanitary ware.html'
TILE_JSON = ROOT / 'data' / 'pulse-tile-catalogue.json'
COMBO_JSON = ROOT / 'data' / 'pulse-combo-catalogue.json'
BASE_URL = os.getenv('SALES_APP_BASE_URL', 'https://mos00000006.github.io/Busterbuild1/sales-app/').rstrip('/') + '/'


def slug(s: str) -> str:
    s = re.sub(r'[^A-Za-z0-9._-]+', '-', s or '').strip('-')
    return s or 'product'


def load_products(path: Path):
    if not path.exists(): return []
    try:
        obj = json.loads(path.read_text(encoding='utf-8'))
        return obj.get('products', []) if isinstance(obj, dict) else []
    except Exception:
        return []


def code_of(p):
    return str(p.get('code') or p.get('sku') or p.get('product_code') or '').strip()


def name_of(p):
    return re.sub(r'\s+', ' ', BeautifulSoup(str(p.get('name') or p.get('title') or 'Product'), 'html.parser').get_text(' ', strip=True)).strip()


def price_obj(value):
    try: v = float(value or 0)
    except Exception: v = 0.0
    return {'current': v, 'regular': v, 'sale': None, 'from': False}


def parse_embedded_products():
    tiles, sanitary = [], []
    if not SOURCE_HTML.exists(): return tiles, sanitary
    soup = BeautifulSoup(SOURCE_HTML.read_text(encoding='utf-8'), 'html.parser')
    for card in soup.select('.product-card[data-product-category]'):
        cat = card.get('data-product-category', '')
        if cat not in {'tiles', 'bathrooms'}: continue
        name = card.get('data-product-name') or (card.find('h3').get_text(' ', strip=True) if card.find('h3') else '')
        code = card.get('data-product-code') or ''
        image = card.get('data-product-image') or (card.find('img').get('src') if card.find('img') else '')
        row = {
            'id': f"local-{slug(code or name).lower()}", 'name': name, 'code': code,
            'price': price_obj(card.get('data-product-price')),
            'images': [{'src': image}] if image else [], 'attributes': [],
            'description': 'BusterBuild Hardware product.'
        }
        (tiles if cat == 'tiles' else sanitary).append(row)
    return tiles, sanitary


def merge_by_code(primary, fallback):
    out, seen = [], set()
    for p in [*primary, *fallback]:
        key = (code_of(p) or str(p.get('id') or name_of(p))).lower()
        if key in seen: continue
        seen.add(key); out.append(p)
    return out


def make_qr(text: str, out: Path):
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=3)
    qr.add_data(text); qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    img.save(out)


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True); QR_DIR.mkdir(parents=True, exist_ok=True)
    embedded_tiles, sanitary = parse_embedded_products()
    tiles = merge_by_code(load_products(TILE_JSON), embedded_tiles)
    combos = load_products(COMBO_JSON)
    sanitary = merge_by_code([], sanitary)

    (DATA_DIR / 'sanitary-products.json').write_text(json.dumps({'products': sanitary}, indent=2, ensure_ascii=False), encoding='utf-8')

    # Remove only generated png files; preserve index if generation fails later.
    for p in QR_DIR.glob('*.png'):
        p.unlink()

    manifest = []
    all_rows = [('tile', p) for p in tiles] + [('sanitary', p) for p in sanitary] + [('combo', p) for p in combos]
    for typ, p in all_rows:
        code = code_of(p)
        if not code: continue
        filename = slug(code) + '.png'
        url = BASE_URL + '?product=' + quote(code)
        make_qr(url, QR_DIR / filename)
        manifest.append({'type': typ, 'code': code, 'name': name_of(p), 'file': 'qr/' + filename, 'url': url})

    (DATA_DIR / 'qr-manifest.json').write_text(json.dumps({'base_url': BASE_URL, 'count': len(manifest), 'products': manifest}, indent=2, ensure_ascii=False), encoding='utf-8')

    cards = []
    for x in manifest:
        cards.append(f'''<article class="label"><div class="type">{x['type'].upper()}</div><img src="{Path(x['file']).name}" alt="QR"><h2>{html(x['name'])}</h2><strong>{html(x['code'])}</strong></article>''')
    index = f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BusterBuild Product QR Labels</title><style>
    *{{box-sizing:border-box}}body{{font-family:Arial,sans-serif;margin:18px;color:#111}}header{{display:flex;justify-content:space-between;align-items:end;border-bottom:4px solid #e1a100;padding-bottom:12px;margin-bottom:18px}}h1{{margin:0}}header p{{margin:4px 0 0;color:#666}}.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:10mm}}.label{{border:1px solid #bbb;border-radius:10px;padding:10px;text-align:center;break-inside:avoid}}.label img{{width:38mm;height:38mm;object-fit:contain}}.label h2{{font-size:12px;line-height:1.25;margin:5px 0}}.label strong{{font-size:13px}}.type{{display:inline-block;background:#111;color:#e1a100;border-radius:999px;padding:4px 8px;font-size:9px;font-weight:bold;letter-spacing:.08em}}@media print{{body{{margin:8mm}}header{{display:none}}.grid{{gap:5mm}}.label{{border:1px solid #999}}}}@media(max-width:700px){{.grid{{grid-template-columns:repeat(2,1fr)}}}}
    </style></head><body><header><div><h1>BusterBuild QR Labels</h1><p>Tiles, sanitary ware and combo products</p></div><strong>{len(manifest)} labels</strong></header><main class="grid">{''.join(cards)}</main></body></html>'''
    (QR_DIR / 'index.html').write_text(index, encoding='utf-8')
    print(f'Built sales app QR labels: {len(tiles)} tiles, {len(sanitary)} sanitary, {len(combos)} combos; {len(manifest)} QR codes.')


def html(s):
    import html as _h
    return _h.escape(str(s or ''))

if __name__ == '__main__': main()
