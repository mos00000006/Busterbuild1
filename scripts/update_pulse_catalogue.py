#!/usr/bin/env python3
"""Build a static Pulse Tiles catalogue for BusterBuild GitHub Pages.

The generated JSON is served locally by GitHub Pages. The browser does not call
Pulse's API, so there are no PHP/CORS problems on GitHub Pages.
"""
from __future__ import annotations

import html
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "pulse-tile-catalogue.json"
BASE = "https://pulsetiles.co.za"
API = BASE + "/wp-json/wc/store/v1"
UA = "Mozilla/5.0 (compatible; BusterBuildCatalogue/1.0; +https://mos00000006.github.io/Busterbuild1/)"
TIMEOUT = 35

CATEGORIES = {
    "ceramic-tiles": {"title": "Ceramic Tiles", "slug": "ceramic-tiles", "url": BASE + "/product-category/tiles/ceramic-tiles/"},
    "porcelain-tiles": {"title": "Porcelain Tiles", "slug": "porcelain-tiles", "url": BASE + "/product-category/tiles/porcelain-tiles/"},
    "hardbody-tiles": {"title": "Hardbody Tiles", "slug": "hardbody-tiles", "url": BASE + "/product-category/combo-deals/hardbody-tiles/"},
    "natural-stone-cladding": {"title": "Natural Stone Cladding", "slug": "natural-stone-cladding", "url": BASE + "/product-category/tiles/natural-stone-cladding/"},
    "mosaics": {"title": "Mosaic Tiles", "slug": "mosaics", "url": BASE + "/product-category/tiles/mosaics/"},
    "decor-tiles": {"title": "Decor Tiles", "slug": "decor-tiles", "url": BASE + "/product-category/tiles/decor-tiles/"},
    "laminate-flooring": {"title": "Laminate Flooring", "slug": "laminate-flooring", "url": BASE + "/product-category/laminate-flooring/"},
    "all-floor-tiles": {"title": "All Floor Tiles", "slug": "all-floor-tiles", "url": BASE + "/product-category/all-floor-tiles/"},
    "all-wall-tiles": {"title": "All Wall Tiles", "slug": "all-wall-tiles", "url": BASE + "/product-category/tiles/all-wall-tiles/"},
    "all-indoor-tiles": {"title": "All Indoor Tiles", "slug": "all-indoor-tiles", "url": BASE + "/product-category/all-indoor-tiles/"},
    "all-outdoor-tiles": {"title": "All Outdoor Tiles", "slug": "all-outdoor-tiles", "url": BASE + "/product-category/all-outdoor-tiles/"},
    "large-format-tiles": {"title": "Large Format Tiles", "slug": "large-format-tiles", "url": BASE + "/product-category/tiles/large-format-tiles/"},
    "wood-look-tiles": {"title": "Woodlook Tiles", "slug": "wood-look-tiles", "url": BASE + "/product-category/tiles/wood-look-tiles/"},
    "marble-look-tiles": {"title": "Marble Look Tiles", "slug": "marble-look-tiles", "url": BASE + "/product-category/marble-look-tiles/"},
    "subway-tiles": {"title": "Subway Tiles", "slug": "subway-tiles", "url": BASE + "/product-category/tiles/subway-tiles/"},
    "slip-resistant-tiles": {"title": "Slip Resistant Tiles", "slug": "slip-resistant-tiles", "url": BASE + "/product-category/tiles/slip-resistant-tiles/"},
    "cladding-look-tiles": {"title": "Cladding Look Tiles", "slug": "cladding-look-tiles", "url": BASE + "/product-category/cladding-look-tiles/"},
    "tile-adhesives": {"title": "Tile Adhesives", "slug": "tile-adhesives", "url": BASE + "/product-category/tile-adhesives/"},
    "tile-grout": {"title": "Tile Grout", "slug": "tile-grout", "url": BASE + "/product-category/tile-grout/"},
    "bonds-key-coats": {"title": "Tile Bonds & Key Coats", "slug": "bonds-key-coats", "url": BASE + "/product-category/bonds-key-coats/"},
    "tile-edges-trims": {"title": "Tile Edges & Trims", "slug": "tile-edges-trims", "url": BASE + "/product-category/tile-edges-trims/"},
    "tile-cleaners": {"title": "Tile Cleaners", "slug": "tile-cleaners", "url": BASE + "/product-category/tile-cleaners/"},
    "tile-spacers-tools": {"title": "Tile Spacers & Tools", "slug": "tile-spacers-tools", "url": BASE + "/product-category/tile-spacers-tools/"},
}

ALIASES = {
    "woodlook-tiles": "wood-look-tiles",
    "tile-bonds-key-coats": "bonds-key-coats",
    "mosaic-tiles": "mosaics",
    "natural-cladding": "natural-stone-cladding",
}

sess = requests.Session()
sess.headers.update({"User-Agent": UA, "Accept": "application/json,text/html;q=0.9,*/*;q=0.8"})


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    soup = BeautifulSoup(value, "html.parser")
    return re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()


def get_json(url: str, params=None):
    r = sess.get(url, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def api_categories():
    rows = []
    for page in range(1, 30):
        data = get_json(API + "/products/categories", {"per_page": 100, "page": page})
        if not isinstance(data, list) or not data:
            break
        rows.extend(data)
        if len(data) < 100:
            break
    return rows


def api_products_for_category(category_id: int):
    rows = []
    for page in range(1, 30):
        data = get_json(API + "/products", {
            "category": category_id,
            "per_page": 100,
            "page": page,
            "orderby": "title",
            "order": "asc",
        })
        if not isinstance(data, list) or not data:
            break
        rows.extend(data)
        if len(data) < 100:
            break
    return rows


def price_info(p: dict):
    pr = p.get("prices") or {}
    minor = int(pr.get("currency_minor_unit") or 2)
    div = 10 ** minor
    def dec(x):
        try:
            return float(x) / div
        except Exception:
            return None
    current = dec(pr.get("price"))
    regular = dec(pr.get("regular_price"))
    sale = dec(pr.get("sale_price"))
    rng = pr.get("price_range") or {}
    low = dec(rng.get("min_amount")) if rng else None
    high = dec(rng.get("max_amount")) if rng else None
    is_from = low is not None and high is not None and abs(low-high) > 1e-9
    if is_from and low is not None:
        current = low
    return {"current": current, "regular": regular, "sale": sale, "from": is_from, "currency": pr.get("currency_code") or "ZAR"}


def attribute_pairs(p: dict):
    out = []
    for a in p.get("attributes") or []:
        vals = []
        for t in a.get("terms") or []:
            if isinstance(t, dict):
                v = t.get("name") or t.get("slug")
                if v:
                    vals.append(str(v))
        for v in a.get("options") or []:
            if v and str(v) not in vals:
                vals.append(str(v))
        if vals:
            out.append({"name": clean_text(a.get("name")) or "Specification", "value": ", ".join(vals)})
    return out


def factual_description(name: str, attrs: list[dict], source_short: str = "") -> str:
    # Prefer a compact factual description assembled from product attributes.
    wanted = []
    for a in attrs:
        k = a["name"].lower()
        if any(token in k for token in ["tile size", "size", "finish", "material", "colour", "color", "sold", "square meters", "quantity per box"]):
            wanted.append(f"{a['name']}: {a['value']}")
        if len(wanted) >= 3:
            break
    if wanted:
        return ". ".join(wanted) + "."
    # Short one-line source text is used only when it is genuinely brief.
    s = clean_text(source_short)
    if s and len(s.split()) <= 12 and len(s) <= 100:
        return s
    return f"{name}. See product details for available specifications."


def normalize_api_product(p: dict, category_keys: list[str]):
    images = p.get("images") or []
    img = ""
    if images:
        img = images[0].get("src") or images[0].get("thumbnail") or ""
    attrs = attribute_pairs(p)
    return {
        "id": str(p.get("id") or p.get("slug") or p.get("sku") or p.get("name")),
        "name": clean_text(p.get("name")) or "Tile product",
        "code": clean_text(p.get("sku")) or "—",
        "price": price_info(p),
        "description": factual_description(clean_text(p.get("name")) or "Tile product", attrs, p.get("short_description") or ""),
        "image": img,
        "attributes": attrs,
        "categories": sorted(set(category_keys)),
    }


def build_via_api():
    cats = api_categories()
    slug_to_cat = {str(c.get("slug") or "").lower(): c for c in cats}
    category_products: dict[str, list[str]] = {}
    products_by_id: dict[str, dict] = {}
    memberships: dict[str, set[str]] = {}

    for key, cfg in CATEGORIES.items():
        c = slug_to_cat.get(cfg["slug"].lower())
        if not c:
            # try exact display-name match as a fallback
            c = next((x for x in cats if clean_text(x.get("name")).lower() == cfg["title"].lower()), None)
        if not c:
            print(f"WARN API category not found: {key}", file=sys.stderr)
            category_products[key] = []
            continue
        rows = api_products_for_category(int(c["id"]))
        ids = []
        for p in rows:
            pid = str(p.get("id") or p.get("slug") or p.get("sku") or p.get("name"))
            ids.append(pid)
            memberships.setdefault(pid, set()).add(key)
            products_by_id[pid] = p
        category_products[key] = ids
        print(f"API {key}: {len(ids)} products")

    if sum(len(v) for v in category_products.values()) < 20:
        raise RuntimeError("API returned too few products")

    normalized = []
    for pid, p in products_by_id.items():
        normalized.append(normalize_api_product(p, sorted(memberships.get(pid, set()))))
    normalized.sort(key=lambda x: x["name"].lower())
    return normalized, category_products, "woocommerce-store-api"


def html_get(url: str) -> BeautifulSoup:
    r = sess.get(url, timeout=TIMEOUT)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")


def html_category_urls(url: str):
    found = []
    seen = set()
    for page in range(1, 40):
        page_url = url if page == 1 else (url + ("&" if "?" in url else "?") + f"product-page={page}")
        soup = html_get(page_url)
        urls = []
        for a in soup.select('a[href*="/product/"]'):
            href = a.get("href")
            if href and "/product/" in href and href not in seen:
                seen.add(href)
                urls.append(href)
        # Keep only genuine product URLs, not unrelated menus or search links.
        urls = [u for u in urls if re.search(r"/product/[^/?#]+/?(?:$|[?#])", u)]
        if not urls:
            break
        found.extend(urls)
        # Detect last page from pagination if possible.
        next_link = soup.select_one("a.next.page-numbers")
        if not next_link:
            break
        time.sleep(0.12)
    return found


def html_product(url: str):
    soup = html_get(url)
    h1 = soup.select_one("h1.product_title") or soup.find("h1")
    name = clean_text(h1.get_text(" ", strip=True) if h1 else "")
    sku_el = soup.select_one(".sku")
    code = clean_text(sku_el.get_text(" ", strip=True) if sku_el else "") or "—"
    price_el = soup.select_one(".summary .price") or soup.select_one("p.price") or soup.select_one(".price")
    price_text = clean_text(price_el.get_text(" ", strip=True) if price_el else "")
    nums = [float(x.replace(",", "")) for x in re.findall(r"R\s*([0-9][0-9,]*(?:\.\d{1,2})?)", price_text, re.I)]
    current = nums[-1] if nums else None
    regular = nums[0] if len(nums) > 1 else current
    sale = current if len(nums) > 1 and regular and current and current < regular else None
    from_flag = "from" in price_text.lower()
    short_el = soup.select_one(".woocommerce-product-details__short-description")
    short = clean_text(short_el.get_text(" ", strip=True) if short_el else "")
    og = soup.find("meta", attrs={"property": "og:image"})
    image = og.get("content") if og else ""
    attrs = []
    for tr in soup.select("table.woocommerce-product-attributes tr"):
        k = tr.select_one("th")
        v = tr.select_one("td")
        if k and v:
            kk = clean_text(k.get_text(" ", strip=True))
            vv = clean_text(v.get_text(" ", strip=True))
            if kk and vv:
                attrs.append({"name": kk, "value": vv})
    # Fallback for simple Additional information tables.
    if not attrs:
        for tr in soup.select("table.shop_attributes tr"):
            k = tr.select_one("th"); v = tr.select_one("td")
            if k and v:
                kk = clean_text(k.get_text(" ", strip=True)); vv = clean_text(v.get_text(" ", strip=True))
                if kk and vv: attrs.append({"name": kk, "value": vv})
    pid = re.sub(r"[^a-z0-9]+", "-", (code if code != "—" else name).lower()).strip("-") or url.rstrip("/").split("/")[-1]
    return {
        "id": pid,
        "name": name or url.rstrip("/").split("/")[-1].replace("-", " ").title(),
        "code": code,
        "price": {"current": current, "regular": regular, "sale": sale, "from": from_flag, "currency": "ZAR"},
        "description": factual_description(name or "Tile product", attrs, short),
        "image": image,
        "attributes": attrs,
        "categories": [],
    }


def build_via_html():
    category_product_urls = {}
    all_urls = []
    for key, cfg in CATEGORIES.items():
        urls = html_category_urls(cfg["url"])
        category_product_urls[key] = urls
        all_urls.extend(urls)
        print(f"HTML {key}: {len(urls)} products")
    unique_urls = list(dict.fromkeys(all_urls))
    if len(unique_urls) < 20:
        raise RuntimeError("HTML crawl returned too few products")
    url_to_product = {}
    for i, url in enumerate(unique_urls, 1):
        try:
            url_to_product[url] = html_product(url)
        except Exception as exc:
            print(f"WARN product failed {url}: {exc}", file=sys.stderr)
            continue
        if i % 20 == 0:
            print(f"Fetched {i}/{len(unique_urls)} product pages")
        time.sleep(0.08)
    category_products = {}
    membership = {}
    for key, urls in category_product_urls.items():
        ids = []
        for url in urls:
            p = url_to_product.get(url)
            if p:
                ids.append(p["id"])
                membership.setdefault(p["id"], set()).add(key)
        category_products[key] = list(dict.fromkeys(ids))
    products = []
    seen = set()
    for p in url_to_product.values():
        if p["id"] in seen:
            continue
        seen.add(p["id"])
        p["categories"] = sorted(membership.get(p["id"], set()))
        products.append(p)
    products.sort(key=lambda x: x["name"].lower())
    return products, category_products, "html-crawl"


def write_output(products, category_products, source_mode):
    category_meta = {}
    for key, cfg in CATEGORIES.items():
        category_meta[key] = {
            "title": cfg["title"],
            "count": len(category_products.get(key, [])),
            "product_ids": category_products.get(key, []),
        }
    # "all" is all actual tile/flooring products; exclude installation essentials.
    type_keys = ["ceramic-tiles","porcelain-tiles","hardbody-tiles","natural-stone-cladding","mosaics","decor-tiles","laminate-flooring"]
    all_ids = []
    for k in type_keys:
        all_ids.extend(category_products.get(k, []))
    category_meta["all"] = {"title": "All Tiles", "count": len(set(all_ids)), "product_ids": list(dict.fromkeys(all_ids))}
    for alias, target in ALIASES.items():
        if target in category_meta:
            category_meta[alias] = dict(category_meta[target])
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_mode": source_mode,
        "source_site": "Pulse Tiles",
        "categories": category_meta,
        "products": products,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} with {len(products)} unique products")


def main():
    try:
        products, category_products, source_mode = build_via_api()
    except Exception as api_exc:
        print(f"API method failed: {api_exc}. Falling back to HTML crawl.", file=sys.stderr)
        products, category_products, source_mode = build_via_html()
    if len(products) < 20:
        raise SystemExit("Catalogue build aborted: fewer than 20 products found")
    write_output(products, category_products, source_mode)


if __name__ == "__main__":
    main()
