#!/usr/bin/env python3
"""BusterBuild Pulse Tiles static catalogue updater.

V3 deliberately avoids the WooCommerce JSON API because Pulse sometimes returns
HTML/challenge pages to GitHub Actions. It crawls the public category pages,
retries dropped connections, caches product details, checkpoints after every
category, and never throws away previously synced categories because of one
temporary outage.
"""
from __future__ import annotations

import json
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.exceptions import RequestException

BUSTERBUILD_PULSE_SYNC_VERSION = "2026-10-01-v4-fast-batched"

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "pulse-tile-catalogue.json"
CACHE = ROOT / "data" / "pulse-product-cache.json"
BASE = "https://pulsetiles.co.za"
TIMEOUT = 50
MAX_ATTEMPTS = 6
PRODUCT_WORKERS = 4
PRODUCT_BATCH_SIZE = 16

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
]

CATEGORIES = {
    "ceramic-tiles": {"title": "Ceramic Tiles", "url": BASE + "/product-category/tiles/ceramic-tiles/"},
    "porcelain-tiles": {"title": "Porcelain Tiles", "url": BASE + "/product-category/tiles/porcelain-tiles/"},
    "hardbody-tiles": {"title": "Hardbody Tiles", "url": BASE + "/product-category/combo-deals/hardbody-tiles/"},
    "natural-stone-cladding": {"title": "Natural Stone Cladding", "url": BASE + "/product-category/tiles/natural-stone-cladding/"},
    "mosaics": {"title": "Mosaic Tiles", "url": BASE + "/product-category/tiles/mosaics/"},
    "decor-tiles": {"title": "Decor Tiles", "url": BASE + "/product-category/tiles/decor-tiles/"},
    "laminate-flooring": {"title": "Laminate Flooring", "url": BASE + "/product-category/laminate-flooring/"},
    "all-floor-tiles": {"title": "All Floor Tiles", "url": BASE + "/product-category/all-floor-tiles/"},
    "all-wall-tiles": {"title": "All Wall Tiles", "url": BASE + "/product-category/tiles/all-wall-tiles/"},
    "all-indoor-tiles": {"title": "All Indoor Tiles", "url": BASE + "/product-category/all-indoor-tiles/"},
    "all-outdoor-tiles": {"title": "All Outdoor Tiles", "url": BASE + "/product-category/all-outdoor-tiles/"},
    "large-format-tiles": {"title": "Large Format Tiles", "url": BASE + "/product-category/tiles/large-format-tiles/"},
    "wood-look-tiles": {"title": "Woodlook Tiles", "url": BASE + "/product-category/tiles/wood-look-tiles/"},
    "marble-look-tiles": {"title": "Marble Look Tiles", "url": BASE + "/product-category/marble-look-tiles/"},
    "subway-tiles": {"title": "Subway Tiles", "url": BASE + "/product-category/tiles/subway-tiles/"},
    "slip-resistant-tiles": {"title": "Slip Resistant Tiles", "url": BASE + "/product-category/tiles/slip-resistant-tiles/"},
    "cladding-look-tiles": {"title": "Cladding Look Tiles", "url": BASE + "/product-category/cladding-look-tiles/"},
    "tile-adhesives": {"title": "Tile Adhesives", "url": BASE + "/product-category/tile-adhesives/"},
    "tile-grout": {"title": "Tile Grout", "url": BASE + "/product-category/tile-grout/"},
    "bonds-key-coats": {"title": "Tile Bonds & Key Coats", "url": BASE + "/product-category/bonds-key-coats/"},
    "tile-edges-trims": {"title": "Tile Edges & Trims", "url": BASE + "/product-category/tile-edges-trims/"},
    "tile-cleaners": {"title": "Tile Cleaners", "url": BASE + "/product-category/tile-cleaners/"},
    "tile-spacers-tools": {"title": "Tile Spacers & Tools", "url": BASE + "/product-category/tile-spacers-tools/"},
}

ALIASES = {
    "woodlook-tiles": "wood-look-tiles",
    "tile-bonds-key-coats": "bonds-key-coats",
    "mosaic-tiles": "mosaics",
    "natural-cladding": "natural-stone-cladding",
}


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", BeautifulSoup(value, "html.parser").get_text(" ", strip=True)).strip()


def load_json(path: Path, default):
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"WARN could not read {path}: {exc}", file=sys.stderr)
    return default


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "en-ZA,en;q=0.9",
        "Referer": BASE + "/tiles/",
        "Connection": "close",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    })
    return s


def wait_seconds(attempt: int) -> float:
    return min(45.0, 1.5 * (1.7 ** attempt)) + random.uniform(0.5, 2.0)


def fetch_html(url: str, max_attempts: int = MAX_ATTEMPTS) -> BeautifulSoup:
    last = None
    for attempt in range(max_attempts):
        s = make_session()
        try:
            r = s.get(
                url,
                timeout=TIMEOUT,
                allow_redirects=True,
                headers={"Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"},
            )
            if r.status_code in (403, 408, 425, 429, 500, 502, 503, 504):
                raise RuntimeError(f"HTTP {r.status_code}")
            r.raise_for_status()
            text = r.text
            if len(text) < 500:
                raise RuntimeError(f"response unexpectedly short ({len(text)} chars)")
            return BeautifulSoup(text, "html.parser")
        except (RequestException, RuntimeError) as exc:
            last = exc
            if attempt == max_attempts - 1:
                break
            delay = wait_seconds(attempt)
            print(f"WARN fetch {attempt+1}/{max_attempts} failed for {url}: {exc}; retrying in {delay:.1f}s", file=sys.stderr)
            time.sleep(delay)
        finally:
            s.close()
    raise RuntimeError(f"failed after {max_attempts} attempts: {url}: {last}")


def product_url_ok(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.netloc.endswith("pulsetiles.co.za") and re.search(r"^/product/[^/?#]+/?$", p.path) is not None
    except Exception:
        return False


def category_product_urls(base_url: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for page in range(1, 50):
        page_url = base_url if page == 1 else base_url + ("&" if "?" in base_url else "?") + f"product-page={page}"
        soup = fetch_html(page_url)
        page_urls: list[str] = []
        for a in soup.select('a[href*="/product/"]'):
            href = a.get("href")
            if not href:
                continue
            href = urljoin(BASE, href).split("#", 1)[0].split("?", 1)[0]
            if product_url_ok(href) and href not in seen:
                seen.add(href)
                page_urls.append(href)
        if not page_urls:
            break
        found.extend(page_urls)
        next_link = soup.select_one("a.next.page-numbers")
        if not next_link:
            break
        time.sleep(random.uniform(1.2, 2.2))
    return found



def busterbuild_price_99(value):
    """Keep the Pulse rand amount but enforce BusterBuild's .99 price ending."""
    if value is None or isinstance(value, bool):
        return value
    try:
        number = float(value)
    except (TypeError, ValueError):
        return value
    return round(int(number // 1) + 0.99, 2)


def normalise_busterbuild_product_price(product: dict) -> dict:
    """Apply .99 to current, regular and sale prices, including cached products."""
    out = dict(product)
    price = out.get("price")
    if isinstance(price, dict):
        price = dict(price)
        for key in ("current", "regular", "sale"):
            if price.get(key) is not None:
                price[key] = busterbuild_price_99(price[key])
        out["price"] = price
    return out

def parse_price(text: str) -> dict:
    txt = clean_text(text)
    nums = [float(x.replace(",", "")) for x in re.findall(r"R\s*([0-9][0-9,]*(?:\.\d{1,2})?)", txt, re.I)]
    current = busterbuild_price_99(nums[-1]) if nums else None
    regular = busterbuild_price_99(nums[0]) if len(nums) > 1 else current
    sale = current if len(nums) > 1 and regular and current and current < regular else None
    return {
        "current": current,
        "regular": regular,
        "sale": sale,
        "from": "from" in txt.lower(),
        "currency": "ZAR",
    }


def factual_description(name: str, attrs: list[dict], short: str) -> str:
    # Keep this as factual catalogue copy rather than reproducing long source prose.
    facts = []
    wanted = ("tile size", "size", "finish", "material", "colour", "color", "sold", "quantity per box", "square meters", "application")
    for a in attrs:
        if any(k in a["name"].lower() for k in wanted):
            facts.append(f"{a['name']}: {a['value']}")
        if len(facts) >= 4:
            break
    if facts:
        return ". ".join(facts) + "."
    short_clean = clean_text(short)
    if short_clean and len(short_clean.split()) <= 12 and len(short_clean) <= 100:
        return short_clean
    return f"{name}. See available product specifications."


def parse_product(url: str) -> dict:
    soup = fetch_html(url, max_attempts=4)
    h1 = soup.select_one("h1.product_title") or soup.find("h1")
    name = clean_text(h1.get_text(" ", strip=True) if h1 else "") or url.rstrip("/").split("/")[-1].replace("-", " ").title()

    sku_el = soup.select_one(".sku")
    code = clean_text(sku_el.get_text(" ", strip=True) if sku_el else "") or "—"

    price_el = soup.select_one(".summary .price") or soup.select_one("p.price") or soup.select_one(".price")
    price = parse_price(price_el.get_text(" ", strip=True) if price_el else "")

    short_el = soup.select_one(".woocommerce-product-details__short-description")
    short = clean_text(short_el.get_text(" ", strip=True) if short_el else "")

    image = ""
    og = soup.find("meta", attrs={"property": "og:image"})
    if og and og.get("content"):
        image = str(og.get("content"))
    if not image:
        img = soup.select_one(".woocommerce-product-gallery img")
        if img:
            image = img.get("data-large_image") or img.get("src") or ""

    attrs: list[dict] = []
    for tr in soup.select("table.woocommerce-product-attributes tr, table.shop_attributes tr"):
        k = tr.select_one("th")
        v = tr.select_one("td")
        if not (k and v):
            continue
        kk = clean_text(k.get_text(" ", strip=True))
        vv = clean_text(v.get_text(" ", strip=True))
        if kk and vv and not any(x["name"] == kk and x["value"] == vv for x in attrs):
            attrs.append({"name": kk, "value": vv})

    slug = urlparse(url).path.rstrip("/").split("/")[-1]
    return {
        "id": slug,
        "source_url": url,
        "name": name,
        "code": code,
        "price": price,
        "description": factual_description(name, attrs, short),
        "image": image,
        "attributes": attrs,
        "categories": [],
    }


def merge_product(existing: dict | None, incoming: dict, category: str) -> dict:
    if existing:
        out = dict(existing)
        for field in ("source_url", "name", "code", "price", "description", "image", "attributes"):
            if incoming.get(field):
                out[field] = incoming[field]
    else:
        out = dict(incoming)
    out["categories"] = sorted(set(out.get("categories") or []) | {category})
    return out


def previous_maps(previous: dict):
    by_id = {}
    by_url = {}
    for p in previous.get("products", []) if isinstance(previous, dict) else []:
        pid = str(p.get("id") or "")
        if pid:
            by_id[pid] = p
        u = p.get("source_url")
        if u:
            by_url[str(u)] = p
    return by_id, by_url


def write_payload(products_by_id: dict[str, dict], category_products: dict[str, list[str]], failed_categories: list[str], *, checkpoint: bool):
    category_meta = {}
    for key, cfg in CATEGORIES.items():
        ids = list(dict.fromkeys(str(x) for x in category_products.get(key, [])))
        category_meta[key] = {"title": cfg["title"], "count": len(ids), "product_ids": ids}

    all_ids = []
    for key in ("ceramic-tiles", "porcelain-tiles", "hardbody-tiles", "natural-stone-cladding", "mosaics", "decor-tiles", "laminate-flooring"):
        all_ids.extend(category_products.get(key, []))
    all_ids = list(dict.fromkeys(str(x) for x in all_ids))
    category_meta["all"] = {"title": "All Tiles", "count": len(all_ids), "product_ids": all_ids}

    for alias, target in ALIASES.items():
        if target in category_meta:
            category_meta[alias] = dict(category_meta[target])

    products = [normalise_busterbuild_product_price(p) for p in products_by_id.values()]
    products.sort(key=lambda x: (x.get("name") or "").lower())
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "updater_version": BUSTERBUILD_PULSE_SYNC_VERSION,
        "source_mode": "html-static-cache",
        "source_site": "Pulse Tiles",
        "sync_complete": not failed_categories,
        "failed_categories": failed_categories,
        "categories": category_meta,
        "products": products,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if checkpoint:
        print(f"Checkpoint: {len(products)} products written")
    return payload


def main() -> None:
    print(f"BUSTERBUILD_PULSE_SYNC_VERSION={BUSTERBUILD_PULSE_SYNC_VERSION}")
    print("Mode: FAST batched HTML-only crawl (4 concurrent product requests; WooCommerce JSON API disabled)")

    previous = load_json(OUT, {})
    prev_by_id, prev_by_url = previous_maps(previous)
    prev_categories = previous.get("categories", {}) if isinstance(previous, dict) else {}

    cache = load_json(CACHE, {})
    if not isinstance(cache, dict):
        cache = {}
    # Seed the cache from the last successful catalogue too.
    for url, p in prev_by_url.items():
        cache.setdefault(url, p)

    products_by_id: dict[str, dict] = dict(prev_by_id)
    category_products: dict[str, list[str]] = {}
    failed_categories: list[str] = []
    details_fetched = 0

    for idx, (key, cfg) in enumerate(CATEGORIES.items(), 1):
        print(f"\n[{idx}/{len(CATEGORIES)}] {key}")
        try:
            urls = category_product_urls(cfg["url"])
            if not urls:
                raise RuntimeError("no product URLs found")
            print(f"HTML {key}: {len(urls)} product URLs")
        except Exception as exc:
            print(f"WARN category listing failed for {key}: {exc}", file=sys.stderr)
            old = prev_categories.get(key) or {}
            old_ids = [str(x) for x in old.get("product_ids", [])]
            category_products[key] = old_ids
            if old_ids:
                print(f"Using previous {key}: {len(old_ids)} products")
            else:
                failed_categories.append(key)
            write_payload(products_by_id, category_products, failed_categories, checkpoint=True)
            continue

        ids: list[str] = []
        detail_failures = 0

        # Reuse cached products immediately and fetch only unseen product pages.
        uncached = [u for u in urls if not cache.get(u)]
        if uncached:
            print(f"  Need details for {len(uncached)} new product pages; using {PRODUCT_WORKERS} workers")

        for batch_start in range(0, len(uncached), PRODUCT_BATCH_SIZE):
            batch = uncached[batch_start:batch_start + PRODUCT_BATCH_SIZE]
            with ThreadPoolExecutor(max_workers=PRODUCT_WORKERS) as pool:
                future_map = {pool.submit(parse_product, url): url for url in batch}
                for future in as_completed(future_map):
                    url = future_map[future]
                    try:
                        p = future.result()
                        cache[url] = p
                        details_fetched += 1
                    except Exception as exc:
                        detail_failures += 1
                        old = prev_by_url.get(url)
                        if old:
                            cache[url] = old
                            print(f"WARN using previous product data for {url}: {exc}", file=sys.stderr)
                        else:
                            print(f"WARN product detail skipped {url}: {exc}", file=sys.stderr)

            done = min(batch_start + len(batch), len(uncached))
            print(f"  {key}: fetched {done}/{len(uncached)} new detail pages")
            # Short polite pause between batches; much quicker than V3's per-product delay.
            if done < len(uncached):
                time.sleep(random.uniform(1.0, 2.0))

        # Merge cached/new details into this category in the original catalogue order.
        for i, url in enumerate(urls, 1):
            p = cache.get(url) or prev_by_url.get(url)
            if not p:
                continue
            pid = str(p.get("id") or urlparse(url).path.rstrip("/").split("/")[-1])
            p = dict(p)
            p["id"] = pid
            p["source_url"] = url
            products_by_id[pid] = merge_product(products_by_id.get(pid), p, key)
            ids.append(pid)
            if i % 40 == 0:
                print(f"  {key}: {i}/{len(urls)} merged")

        if ids:
            category_products[key] = list(dict.fromkeys(ids))
            if detail_failures:
                print(f"Completed {key} with {detail_failures} product-detail warnings")
        else:
            old = prev_categories.get(key) or {}
            old_ids = [str(x) for x in old.get("product_ids", [])]
            category_products[key] = old_ids
            if not old_ids:
                failed_categories.append(key)

        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
        write_payload(products_by_id, category_products, failed_categories, checkpoint=True)
        time.sleep(random.uniform(0.4, 0.9))

    payload = write_payload(products_by_id, category_products, failed_categories, checkpoint=False)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    count = len(payload["products"])
    print(f"\nFINAL: wrote {count} unique products")
    print("Failed categories:", failed_categories)
    if count < 20:
        raise SystemExit("Catalogue build aborted: fewer than 20 products available")
    print("Catalogue sync completed" + (" with warnings" if failed_categories else " successfully"))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Last-resort protection: do not destroy a previously generated catalogue.
        print(f"FATAL updater exception caught: {exc}", file=sys.stderr)
        previous = load_json(OUT, {})
        if isinstance(previous, dict) and len(previous.get("products", [])) >= 20:
            print("Previous catalogue is still usable; exiting successfully so GitHub Pages stays live.", file=sys.stderr)
            sys.exit(0)
        raise
