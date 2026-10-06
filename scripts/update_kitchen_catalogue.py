#!/usr/bin/env python3
"""BusterBuild Pulse Kitchens catalogue updater.

Source:
https://pulsetiles.co.za/kitchens/

The kitchen page includes product groups such as Kitchen Sinks,
Kitchen Sink Taps, Kitchen Sink Fittings and kitchen tile categories.

Kitchen tile categories are intentionally excluded from this feed because the
BusterBuild Sales App already receives tiles from pulse-tile-catalogue.json.
This prevents duplicate tile cards and preserves Smart Measure tile logic.
"""
from __future__ import annotations

import json
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.exceptions import RequestException

BUSTERBUILD_KITCHEN_SYNC_VERSION = "2026-10-06-v1-pulse-kitchens"

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "pulse-kitchen-catalogue.json"
CACHE = ROOT / "data" / "pulse-kitchen-product-cache.json"

BASE = "https://pulsetiles.co.za"
LANDING = BASE + "/kitchens/"
TIMEOUT = 50
MAX_ATTEMPTS = 6
PRODUCT_WORKERS = 4
PRODUCT_BATCH_SIZE = 16

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
]

GROUP_TITLES = {
    "sinks": "Kitchen Sinks",
    "taps": "Kitchen Sink Taps",
    "fittings": "Kitchen Sink Fittings",
}

# Exact known Pulse category paths are included as a safety fallback.
FALLBACK_CATEGORIES = [
    ("Kitchen Sinks", "kitchen-sinks", "sinks"),
    ("Kitchen Sink Taps", "kitchen-sink-taps", "taps"),
    ("Kitchen Sink Fittings", "kitchen-sink-fittings", "fittings"),
]


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
        "Referer": LANDING,
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


def canonical_category_url(url: str) -> str:
    p = urlparse(urljoin(BASE, url))
    path = p.path
    if "/product-category/" not in path:
        return ""
    if not path.endswith("/"):
        path += "/"
    return f"{p.scheme or 'https'}://{p.netloc or 'pulsetiles.co.za'}{path}"


def category_slug(url: str) -> str:
    p = urlparse(url)
    parts = [x for x in p.path.strip("/").split("/") if x]
    return parts[-1] if parts else ""


def classify_category(title: str, slug: str) -> str | None:
    text = f"{title} {slug.replace('-', ' ')}".lower()

    # Tiles already belong to pulse-tile-catalogue.json.
    if "tile" in text or "mosaic" in text:
        return None

    if any(x in text for x in ("sink fitting", "sink waste", "waste fitting")):
        return "fittings"
    if any(x in text for x in ("sink tap", "sink mixer", "kitchen tap", "kitchen mixer")):
        return "taps"
    if "sink" in text:
        return "sinks"
    return None


def discover_categories() -> dict[str, dict]:
    found: dict[str, dict] = {}
    try:
        soup = fetch_html(LANDING)
        for a in soup.select('a[href*="/product-category/"]'):
            href = canonical_category_url(a.get("href") or "")
            if not href:
                continue
            slug = category_slug(href)
            title = clean_text(a.get_text(" ", strip=True)) or slug.replace("-", " ").title()
            group = classify_category(title, slug)
            if not group:
                continue
            existing = found.get(slug)
            row = {"title": title, "url": href, "group": group}
            if not existing or len(title) < len(existing.get("title", "")):
                found[slug] = row
    except Exception as exc:
        print(f"WARN kitchen landing discovery failed: {exc}", file=sys.stderr)

    # Known Pulse paths protect the job if the landing page design changes.
    for title, slug, group in FALLBACK_CATEGORIES:
        found.setdefault(slug, {
            "title": title,
            "url": f"{BASE}/product-category/{slug}/",
            "group": group,
        })
    return found


def product_url_ok(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.netloc.endswith("pulsetiles.co.za") and re.search(r"^/product/[^/?#]+/?$", p.path) is not None
    except Exception:
        return False


def busterbuild_price_99(value):
    """Use Pulse's rand value but enforce BusterBuild's .99 selling-price ending."""
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number < 0:
        return number
    return round(int(number // 1) + 0.99, 2)


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


def normalise_busterbuild_product_price(product: dict) -> dict:
    out = dict(product)
    price = out.get("price")
    if isinstance(price, dict):
        price = dict(price)
        for key in ("current", "regular", "sale"):
            if price.get(key) is not None:
                price[key] = busterbuild_price_99(price[key])
        out["price"] = price
    return out


def category_product_rows(base_url: str) -> list[dict]:
    rows: list[dict] = []
    seen: set[str] = set()

    for page in range(1, 40):
        # Pulse currently supports product-page= pagination on category pages.
        page_url = base_url if page == 1 else base_url + ("&" if "?" in base_url else "?") + f"product-page={page}"
        soup = fetch_html(page_url)
        page_rows: list[dict] = []

        for card in soup.select("li.product"):
            a = card.select_one('a[href*="/product/"]')
            if not a:
                continue
            href = urljoin(BASE, a.get("href") or "").split("#", 1)[0].split("?", 1)[0]
            if not product_url_ok(href) or href in seen:
                continue
            seen.add(href)
            price_el = card.select_one(".price")
            page_rows.append({
                "url": href,
                "listing_price": parse_price(price_el.get_text(" ", strip=True) if price_el else ""),
            })

        if not page_rows:
            for a in soup.select('a[href*="/product/"]'):
                href = urljoin(BASE, a.get("href") or "").split("#", 1)[0].split("?", 1)[0]
                if product_url_ok(href) and href not in seen:
                    seen.add(href)
                    page_rows.append({"url": href, "listing_price": {}})

        if not page_rows:
            break

        rows.extend(page_rows)
        if not soup.select_one("a.next.page-numbers"):
            break
        time.sleep(random.uniform(0.9, 1.6))

    return rows


def factual_description(name: str, attrs: list[dict], short: str) -> str:
    facts = []
    wanted = ("size", "colour", "color", "finish", "material", "type", "dimension", "width", "height", "length", "brand")
    for a in attrs:
        if any(k in a["name"].lower() for k in wanted):
            facts.append(f"{a['name']}: {a['value']}")
        if len(facts) >= 4:
            break

    if facts:
        return ". ".join(facts) + "."

    short_clean = clean_text(short)
    if short_clean and len(short_clean.split()) <= 18 and len(short_clean) <= 140:
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
        "kitchen_groups": [],
    }


def merge_product(existing: dict | None, incoming: dict, category: str, group: str) -> dict:
    if existing:
        out = dict(existing)
        for field in ("source_url", "name", "code", "price", "description", "image", "attributes"):
            if incoming.get(field):
                out[field] = incoming[field]
    else:
        out = dict(incoming)

    out["categories"] = sorted(set(out.get("categories") or []) | {category})
    out["kitchen_groups"] = sorted(set(out.get("kitchen_groups") or []) | {group})
    return normalise_busterbuild_product_price(out)


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


def write_payload(categories, products_by_id, category_products, failed_categories, *, checkpoint):
    category_meta = {}
    group_ids = {k: [] for k in GROUP_TITLES}

    for key, cfg in categories.items():
        ids = list(dict.fromkeys(str(x) for x in category_products.get(key, [])))
        category_meta[key] = {
            "title": cfg["title"],
            "group": cfg["group"],
            "count": len(ids),
            "product_ids": ids,
        }
        group_ids.setdefault(cfg["group"], []).extend(ids)

    all_ids = []
    for ids in category_products.values():
        all_ids.extend(ids)
    all_ids = list(dict.fromkeys(str(x) for x in all_ids))

    groups_meta = {}
    for group, title in GROUP_TITLES.items():
        ids = list(dict.fromkeys(str(x) for x in group_ids.get(group, [])))
        groups_meta[group] = {"title": title, "count": len(ids), "product_ids": ids}

    products = [
        normalise_busterbuild_product_price(products_by_id[pid])
        for pid in all_ids
        if pid in products_by_id
    ]
    products.sort(key=lambda x: (x.get("name") or "").lower())

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "updater_version": BUSTERBUILD_KITCHEN_SYNC_VERSION,
        "source_mode": "html-static-cache",
        "source_site": "Pulse Tiles",
        "source_page": LANDING,
        "price_policy": "BusterBuild prices end in .99",
        "tile_categories_excluded": True,
        "sync_complete": not failed_categories,
        "failed_categories": failed_categories,
        "categories": category_meta,
        "groups": groups_meta,
        "products": products,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if checkpoint:
        print(f"Checkpoint: {len(products)} kitchen products written")
    return payload


def main() -> None:
    print(f"BUSTERBUILD_KITCHEN_SYNC_VERSION={BUSTERBUILD_KITCHEN_SYNC_VERSION}")
    print("Source:", LANDING)
    print("Kitchen tiles are intentionally excluded; the existing tile feed already supplies them.")

    categories = discover_categories()
    print(f"Kitchen product categories: {len(categories)}")
    for key, cfg in categories.items():
        print(f"  {cfg['group']:8s} {key}: {cfg['title']}")

    previous = load_json(OUT, {})
    prev_by_id, prev_by_url = previous_maps(previous)
    prev_categories = previous.get("categories", {}) if isinstance(previous, dict) else {}

    cache = load_json(CACHE, {})
    if not isinstance(cache, dict):
        cache = {}
    for url, p in prev_by_url.items():
        cache.setdefault(url, p)

    products_by_id = dict(prev_by_id)
    category_products = {}
    failed_categories = []

    for idx, (key, cfg) in enumerate(categories.items(), 1):
        print(f"\n[{idx}/{len(categories)}] {cfg['title']} ({cfg['group']})")

        try:
            rows = category_product_rows(cfg["url"])
            if not rows:
                raise RuntimeError("no product URLs found")
            print(f"HTML {key}: {len(rows)} product URLs")
        except Exception as exc:
            print(f"WARN category listing failed for {key}: {exc}", file=sys.stderr)
            old = prev_categories.get(key) or {}
            old_ids = [str(x) for x in old.get("product_ids", [])]
            category_products[key] = old_ids
            if old_ids:
                print(f"Using previous {key}: {len(old_ids)} products")
            else:
                failed_categories.append(key)
            write_payload(categories, products_by_id, category_products, failed_categories, checkpoint=True)
            continue

        urls = [r["url"] for r in rows]
        listing_price_by_url = {r["url"]: r.get("listing_price") or {} for r in rows}

        uncached = [u for u in urls if not cache.get(u)]
        if uncached:
            print(f"  Need details for {len(uncached)} new products; using {PRODUCT_WORKERS} workers")

        detail_failures = 0
        for batch_start in range(0, len(uncached), PRODUCT_BATCH_SIZE):
            batch = uncached[batch_start:batch_start + PRODUCT_BATCH_SIZE]
            with ThreadPoolExecutor(max_workers=PRODUCT_WORKERS) as pool:
                future_map = {pool.submit(parse_product, url): url for url in batch}
                for future in as_completed(future_map):
                    url = future_map[future]
                    try:
                        cache[url] = future.result()
                    except Exception as exc:
                        detail_failures += 1
                        old = prev_by_url.get(url)
                        if old:
                            cache[url] = old
                            print(f"WARN using previous product detail for {url}: {exc}", file=sys.stderr)
                        else:
                            print(f"WARN product detail skipped {url}: {exc}", file=sys.stderr)

            done = min(batch_start + len(batch), len(uncached))
            print(f"  {key}: fetched {done}/{len(uncached)} new detail pages")
            if done < len(uncached):
                time.sleep(random.uniform(0.8, 1.5))

        ids = []
        for url in urls:
            p = cache.get(url) or prev_by_url.get(url)
            if not p:
                continue
            p = dict(p)
            listing_price = listing_price_by_url.get(url) or {}
            if listing_price.get("current") is not None:
                p["price"] = listing_price

            pid = str(p.get("id") or urlparse(url).path.rstrip("/").split("/")[-1])
            p["id"] = pid
            p["source_url"] = url
            products_by_id[pid] = merge_product(products_by_id.get(pid), p, key, cfg["group"])
            ids.append(pid)

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
        write_payload(categories, products_by_id, category_products, failed_categories, checkpoint=True)
        time.sleep(random.uniform(0.3, 0.8))

    payload = write_payload(categories, products_by_id, category_products, failed_categories, checkpoint=False)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

    count = len(payload["products"])
    print(f"\nFINAL: wrote {count} unique kitchen products")
    print("Failed categories:", failed_categories)

    if count < 5:
        raise SystemExit("Kitchen catalogue build aborted: fewer than 5 products available")

    print("Kitchen catalogue sync completed" + (" with warnings" if failed_categories else " successfully"))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FATAL updater exception caught: {exc}", file=sys.stderr)
        previous = load_json(OUT, {})
        if isinstance(previous, dict) and len(previous.get("products", [])) >= 5:
            print("Previous kitchen catalogue is still usable; leaving it in place.", file=sys.stderr)
            sys.exit(0)
        raise
