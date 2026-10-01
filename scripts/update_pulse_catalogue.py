#!/usr/bin/env python3
"""Build a static Pulse Tiles catalogue for the BusterBuild GitHub Pages site.

This version is intentionally defensive because the Pulse site occasionally
returns non-JSON responses or closes connections when many requests arrive from
GitHub Actions. It retries with backoff, falls back category-by-category, and
preserves data from the previous successful sync if one category is temporarily
unavailable.
"""
from __future__ import annotations

import json
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from requests import Response
from requests.exceptions import RequestException

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "pulse-tile-catalogue.json"
BASE = "https://pulsetiles.co.za"
API = BASE + "/wp-json/wc/store/v1"
TIMEOUT = 45
MAX_ATTEMPTS = 7
JSON_ATTEMPTS = 5

# A normal browser UA is less likely to be rate-limited than a bot-style UA.
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/153.0.0.0 Safari/537.36"
)

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

# Reverse lookup lets an API product contribute to all matching category groups,
# not only the category query that happened to return it.
SLUG_TO_KEY = {cfg["slug"].lower(): key for key, cfg in CATEGORIES.items()}


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Accept-Language": "en-ZA,en;q=0.9",
        "Referer": BASE + "/tiles/",
        # Avoid reusing a server-side connection that Pulse may have already closed.
        "Connection": "close",
        "Cache-Control": "no-cache",
    })
    return s


sess = make_session()


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    soup = BeautifulSoup(value, "html.parser")
    return re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()


def backoff(attempt: int) -> float:
    # 1.2, 2.1, 3.8, 7.1 ... capped, plus jitter.
    return min(25.0, 1.1 * (1.8 ** attempt)) + random.uniform(0.2, 1.2)


def reset_session() -> None:
    global sess
    try:
        sess.close()
    except Exception:
        pass
    sess = make_session()


def request_with_retry(url: str, *, params=None, accept: str = "text/html") -> Response:
    last_exc: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            headers = {"Accept": accept}
            r = sess.get(url, params=params, timeout=TIMEOUT, headers=headers, allow_redirects=True)
            # 403/429 are commonly temporary anti-bot/rate-limit responses here.
            if r.status_code in (403, 408, 425, 429, 500, 502, 503, 504):
                raise RuntimeError(f"HTTP {r.status_code}")
            r.raise_for_status()
            if not r.content:
                raise RuntimeError("empty response")
            return r
        except (RequestException, RuntimeError) as exc:
            last_exc = exc
            if attempt >= MAX_ATTEMPTS - 1:
                break
            wait = backoff(attempt)
            print(
                f"WARN request failed ({attempt + 1}/{MAX_ATTEMPTS}) {url}: {exc}; retrying in {wait:.1f}s",
                file=sys.stderr,
            )
            reset_session()
            time.sleep(wait)
    raise RuntimeError(f"Request failed after {MAX_ATTEMPTS} attempts: {url}: {last_exc}")


def get_json(url: str, params=None):
    # Network errors are already retried by request_with_retry(). Only retry here
    # when Pulse answers HTTP 200 with HTML/a challenge page instead of JSON.
    last_exc: Exception | None = None
    for attempt in range(JSON_ATTEMPTS):
        r = request_with_retry(url, params=params, accept="application/json,text/plain;q=0.9,*/*;q=0.8")
        try:
            text = r.text.lstrip("\ufeff\n\r\t ")
            if not text.startswith(("[", "{")):
                sample = re.sub(r"\s+", " ", text[:140])
                raise ValueError(f"non-JSON response: {sample!r}")
            return json.loads(text)
        except (ValueError, json.JSONDecodeError) as exc:
            last_exc = exc
            if attempt >= JSON_ATTEMPTS - 1:
                break
            wait = backoff(attempt)
            print(
                f"WARN JSON parse failed ({attempt + 1}/{JSON_ATTEMPTS}) {url}: {exc}; retrying in {wait:.1f}s",
                file=sys.stderr,
            )
            reset_session()
            time.sleep(wait)
    raise RuntimeError(f"JSON parse failed after {JSON_ATTEMPTS} attempts: {url}: {last_exc}")


def html_get(url: str) -> BeautifulSoup:
    r = request_with_retry(url, accept="text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
    return BeautifulSoup(r.text, "html.parser")


def api_categories():
    rows = []
    for page in range(1, 30):
        data = get_json(API + "/products/categories", {"per_page": 100, "page": page})
        if not isinstance(data, list) or not data:
            break
        rows.extend(data)
        if len(data) < 100:
            break
        time.sleep(0.35)
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
        time.sleep(0.45)
    return rows


def price_info(p: dict):
    pr = p.get("prices") or {}
    try:
        minor = int(pr.get("currency_minor_unit") or 2)
    except Exception:
        minor = 2
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
    is_from = low is not None and high is not None and abs(low - high) > 1e-9
    if is_from and low is not None:
        current = low
    return {
        "current": current,
        "regular": regular,
        "sale": sale,
        "from": is_from,
        "currency": pr.get("currency_code") or "ZAR",
    }


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
    wanted = []
    for a in attrs:
        k = a["name"].lower()
        if any(token in k for token in [
            "tile size", "size", "finish", "material", "colour", "color",
            "sold", "square meters", "quantity per box", "use", "application",
        ]):
            wanted.append(f"{a['name']}: {a['value']}")
        if len(wanted) >= 4:
            break
    if wanted:
        return ". ".join(wanted) + "."
    s = clean_text(source_short)
    # Keep only a genuinely short source blurb; otherwise use factual neutral copy.
    if s and len(s.split()) <= 12 and len(s) <= 100:
        return s
    return f"{name}. See product details for available specifications."


def product_category_keys(p: dict) -> set[str]:
    keys: set[str] = set()
    for c in p.get("categories") or []:
        if not isinstance(c, dict):
            continue
        slug = str(c.get("slug") or "").lower()
        key = SLUG_TO_KEY.get(slug)
        if key:
            keys.add(key)
    return keys


def normalize_api_product(p: dict, category_keys: list[str]):
    images = p.get("images") or []
    img = ""
    if images:
        img = images[0].get("src") or images[0].get("thumbnail") or ""
    attrs = attribute_pairs(p)
    name = clean_text(p.get("name")) or "Tile product"
    discovered = set(category_keys) | product_category_keys(p)
    return {
        "id": str(p.get("id") or p.get("slug") or p.get("sku") or p.get("name")),
        "name": name,
        "code": clean_text(p.get("sku")) or "—",
        "price": price_info(p),
        "description": factual_description(name, attrs, p.get("short_description") or ""),
        "image": img,
        "attributes": attrs,
        "categories": sorted(discovered),
    }


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
        urls = [u for u in urls if re.search(r"/product/[^/?#]+/?(?:$|[?#])", u)]
        if not urls:
            break
        found.extend(urls)
        next_link = soup.select_one("a.next.page-numbers")
        if not next_link:
            break
        time.sleep(0.7 + random.uniform(0.0, 0.35))
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
    for tr in soup.select("table.woocommerce-product-attributes tr, table.shop_attributes tr"):
        k = tr.select_one("th")
        v = tr.select_one("td")
        if k and v:
            kk = clean_text(k.get_text(" ", strip=True))
            vv = clean_text(v.get_text(" ", strip=True))
            if kk and vv and not any(x["name"] == kk and x["value"] == vv for x in attrs):
                attrs.append({"name": kk, "value": vv})

    # WooCommerce places category slugs on the product page body class.
    category_keys = set()
    body = soup.find("body")
    if body:
        classes = body.get("class") or []
        for cls in classes:
            m = re.match(r"product_cat-(.+)", str(cls))
            if m:
                key = SLUG_TO_KEY.get(m.group(1).lower())
                if key:
                    category_keys.add(key)

    pid = re.sub(r"[^a-z0-9]+", "-", (code if code != "—" else name).lower()).strip("-") or url.rstrip("/").split("/")[-1]
    return {
        "id": pid,
        "name": name or url.rstrip("/").split("/")[-1].replace("-", " ").title(),
        "code": code,
        "price": {"current": current, "regular": regular, "sale": sale, "from": from_flag, "currency": "ZAR"},
        "description": factual_description(name or "Tile product", attrs, short),
        "image": image,
        "attributes": attrs,
        "categories": sorted(category_keys),
    }


def load_previous():
    try:
        if not OUT.exists():
            return None
        data = json.loads(OUT.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("products"), list):
            return data
    except Exception as exc:
        print(f"WARN could not read previous catalogue: {exc}", file=sys.stderr)
    return None


def crawl_category_html(key: str, cfg: dict, product_cache: dict[str, dict]):
    urls = html_category_urls(cfg["url"])
    print(f"HTML {key}: {len(urls)} products")
    products = []
    for i, url in enumerate(urls, 1):
        try:
            if url not in product_cache:
                product_cache[url] = html_product(url)
                time.sleep(0.35 + random.uniform(0.0, 0.25))
            p = dict(product_cache[url])
            p["categories"] = sorted(set(p.get("categories") or []) | {key})
            product_cache[url] = p
            products.append(p)
        except Exception as exc:
            print(f"WARN product failed {url}: {exc}", file=sys.stderr)
        if i % 20 == 0:
            print(f"  HTML details {key}: {i}/{len(urls)}")
    return products


def build_catalogue():
    previous = load_previous()
    previous_products = {str(p.get("id")): p for p in (previous or {}).get("products", []) if p.get("id") is not None}
    previous_categories = (previous or {}).get("categories", {})

    products_by_id: dict[str, dict] = {}
    category_products: dict[str, list[str]] = {}
    failed_categories: list[str] = []
    used_html = False
    product_cache: dict[str, dict] = {}

    try:
        cats = api_categories()
        slug_to_cat = {str(c.get("slug") or "").lower(): c for c in cats}
        if not cats:
            raise RuntimeError("API category list was empty")
        print(f"API category index: {len(cats)} categories")
    except Exception as exc:
        print(f"WARN API category index unavailable: {exc}", file=sys.stderr)
        slug_to_cat = {}

    for idx, (key, cfg) in enumerate(CATEGORIES.items(), 1):
        print(f"\n[{idx}/{len(CATEGORIES)}] Syncing {key} ...")
        rows = None
        try:
            c = slug_to_cat.get(cfg["slug"].lower())
            if not c:
                c = next(
                    (x for x in slug_to_cat.values() if clean_text(x.get("name")).lower() == cfg["title"].lower()),
                    None,
                )
            if not c:
                raise RuntimeError("category not found in API index")
            api_rows = api_products_for_category(int(c["id"]))
            if not api_rows:
                raise RuntimeError("API returned no products")
            rows = [normalize_api_product(p, [key]) for p in api_rows]
            print(f"API {key}: {len(rows)} products")
        except Exception as api_exc:
            print(f"WARN API {key} failed: {api_exc}; trying HTML fallback", file=sys.stderr)
            try:
                rows = crawl_category_html(key, cfg, product_cache)
                used_html = True
                if not rows:
                    raise RuntimeError("HTML returned no products")
            except Exception as html_exc:
                print(f"ERROR {key} could not sync: {html_exc}", file=sys.stderr)
                rows = None

        if rows:
            ids = []
            for p in rows:
                pid = str(p["id"])
                ids.append(pid)
                existing = products_by_id.get(pid)
                if existing:
                    existing["categories"] = sorted(set(existing.get("categories") or []) | set(p.get("categories") or []) | {key})
                    # Prefer non-empty details from the newer row.
                    for field in ("name", "code", "image", "description", "attributes", "price"):
                        if p.get(field):
                            existing[field] = p[field]
                else:
                    p["categories"] = sorted(set(p.get("categories") or []) | {key})
                    products_by_id[pid] = p
            category_products[key] = list(dict.fromkeys(ids))
        else:
            failed_categories.append(key)
            # Keep the last good data for this category if the site is temporarily unavailable.
            old_cat = previous_categories.get(key) or {}
            old_ids = [str(x) for x in old_cat.get("product_ids", [])]
            if old_ids:
                category_products[key] = old_ids
                for pid in old_ids:
                    old = previous_products.get(pid)
                    if old:
                        products_by_id.setdefault(pid, old)
                print(f"Using previous {key}: {len(old_ids)} products")
            else:
                category_products[key] = []

        # Brief spacing between categories reduces throttling from shared GitHub runner IPs.
        time.sleep(0.65 + random.uniform(0.0, 0.45))

    # Merge category memberships already present on products into category lists. This is
    # useful when the product API exposes style/application categories directly.
    for pid, p in list(products_by_id.items()):
        for key in p.get("categories") or []:
            if key in CATEGORIES:
                category_products.setdefault(key, [])
                if pid not in category_products[key]:
                    category_products[key].append(pid)

    products = list(products_by_id.values())
    products.sort(key=lambda x: (x.get("name") or "").lower())
    source_mode = "hybrid-api-html" if used_html else "woocommerce-store-api"
    return products, category_products, source_mode, failed_categories


def write_output(products, category_products, source_mode, failed_categories):
    category_meta = {}
    for key, cfg in CATEGORIES.items():
        ids = list(dict.fromkeys(str(x) for x in category_products.get(key, [])))
        category_meta[key] = {
            "title": cfg["title"],
            "count": len(ids),
            "product_ids": ids,
        }

    type_keys = [
        "ceramic-tiles", "porcelain-tiles", "hardbody-tiles",
        "natural-stone-cladding", "mosaics", "decor-tiles", "laminate-flooring",
    ]
    all_ids = []
    for k in type_keys:
        all_ids.extend(category_products.get(k, []))
    all_ids = list(dict.fromkeys(str(x) for x in all_ids))
    category_meta["all"] = {"title": "All Tiles", "count": len(all_ids), "product_ids": all_ids}

    for alias, target in ALIASES.items():
        if target in category_meta:
            category_meta[alias] = dict(category_meta[target])

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_mode": source_mode,
        "source_site": "Pulse Tiles",
        "sync_complete": not failed_categories,
        "failed_categories": failed_categories,
        "categories": category_meta,
        "products": products,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} with {len(products)} unique products")
    if failed_categories:
        print("WARNING: these categories could not refresh this run: " + ", ".join(failed_categories), file=sys.stderr)


def main():
    products, category_products, source_mode, failed_categories = build_catalogue()
    if len(products) < 20:
        raise SystemExit("Catalogue build aborted: fewer than 20 products found and no usable previous catalogue exists")
    write_output(products, category_products, source_mode, failed_categories)
    # Do not fail the whole GitHub Action for a temporary category outage if useful
    # catalogue data was produced. The next scheduled/manual run can fill any gaps.
    print("Catalogue sync completed" + (" with warnings" if failed_categories else " successfully"))


if __name__ == "__main__":
    main()
