#!/usr/bin/env python3
"""Build a static BusterBuild combo-deals catalogue from Pulse Tiles public category pages.

The generated JSON is consumed only by the BusterBuild GitHub Pages site. The
updater uses HTML pages (not the WooCommerce API), retries transient failures,
keeps a cache of product details, and checkpoints after each category so one
remote failure does not wipe a previously usable catalogue.
"""
from __future__ import annotations

import json
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.exceptions import RequestException

BUSTERBUILD_COMBO_SYNC_VERSION = "2026-10-01-v1-combo-html-checkpoint"
COMBO_DETAIL_PARSER_VERSION = "2026-10-01-combo-includes-v3"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "pulse-combo-catalogue.json"
CACHE = ROOT / "data" / "pulse-combo-product-cache.json"
BASE = "https://pulsetiles.co.za"
TIMEOUT = 50
MAX_ATTEMPTS = 10

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
]

CATEGORIES = {
    "porcelain-tile-combos": {"title": "Porcelain Tile Combos", "group": "Tile Combo Deals", "url": BASE + "/product-category/combo-deals/porcelain-tile-combos/"},
    "ceramic-tile-combos": {"title": "Ceramic Tile Combos", "group": "Tile Combo Deals", "url": BASE + "/product-category/combo-deals/ceramic-tile-combos/"},
    "hardbody-tile-combos": {"title": "Hardbody Tile Combos", "group": "Tile Combo Deals", "url": BASE + "/product-category/combo-deals/hardbody-tile-combos-combo-deals/"},
    "wall-tile-combos": {"title": "Wall Tile Combos", "group": "Tile Combo Deals", "url": BASE + "/product-category/combo-deals/wall-tile-combos-combo-deals/"},
    "mosaic-combos": {"title": "Mosaic Combos", "group": "Decor Combo Deals", "url": BASE + "/product-category/combo-deals/mosaic-combos/"},
    "cladding-combos": {"title": "Cladding Combos", "group": "Decor Combo Deals", "url": BASE + "/product-category/combo-deals/cladding-combos/"},
    "wall-panel-combos": {"title": "Wall Panel Combos", "group": "Decor Combo Deals", "url": BASE + "/product-category/combo-deals/wall-panel-combos/"},
    "shower-combos": {"title": "Shower Combos", "group": "Bathroom Combos", "url": BASE + "/product-category/combo-deals/shower-combos/"},
    "toilet-combos": {"title": "Toilet Combos", "group": "Bathroom Combos", "url": BASE + "/product-category/combo-deals/toilet-combo-deals/"},
    "basin-mixer-combos": {"title": "Basin & Mixer Combos", "group": "Bathroom Combos", "url": BASE + "/product-category/combo-deals/basin-mixer-combos/"},
    "bath-combos": {"title": "Bath Combos", "group": "Bathroom Combos", "url": BASE + "/product-category/combo-deals/bath-combos/"},
}

ALIASES = {
    "toilet-combo-deals": "toilet-combos",
    "basin-combos": "basin-mixer-combos",
    "porcelain-combos": "porcelain-tile-combos",
    "ceramic-combos": "ceramic-tile-combos",
    "hardbody-combos": "hardbody-tile-combos",
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
        "Referer": BASE + "/combo-deals-category-page/",
        "Connection": "close",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    })
    return s


def wait_seconds(attempt: int) -> float:
    return min(45.0, 1.5 * (1.7 ** attempt)) + random.uniform(0.5, 2.0)


def fetch_html(url: str) -> BeautifulSoup:
    last = None
    for attempt in range(MAX_ATTEMPTS):
        s = make_session()
        try:
            r = s.get(url, timeout=TIMEOUT, allow_redirects=True,
                      headers={"Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"})
            if r.status_code in (403, 408, 425, 429, 500, 502, 503, 504):
                raise RuntimeError(f"HTTP {r.status_code}")
            r.raise_for_status()
            text = r.text
            if len(text) < 500:
                raise RuntimeError(f"response unexpectedly short ({len(text)} chars)")
            return BeautifulSoup(text, "html.parser")
        except (RequestException, RuntimeError) as exc:
            last = exc
            if attempt == MAX_ATTEMPTS - 1:
                break
            delay = wait_seconds(attempt)
            print(f"WARN fetch {attempt+1}/{MAX_ATTEMPTS} failed for {url}: {exc}; retrying in {delay:.1f}s", file=sys.stderr)
            time.sleep(delay)
        finally:
            s.close()
    raise RuntimeError(f"failed after {MAX_ATTEMPTS} attempts: {url}: {last}")


def product_url_ok(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.netloc.endswith("pulsetiles.co.za") and re.search(r"^/product/[^/?#]+/?$", p.path) is not None
    except Exception:
        return False


def category_product_urls(base_url: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for page in range(1, 30):
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
        if not soup.select_one("a.next.page-numbers"):
            break
        time.sleep(random.uniform(1.1, 2.0))
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
    return {"current": current, "regular": regular, "sale": sale, "from": "from" in txt.lower(), "currency": "ZAR"}


def extract_combo_includes(soup: BeautifulSoup) -> list[str]:
    """Extract the factual "This Combo includes" list from a Pulse product page.

    Pulse currently renders this list in the WooCommerce description area, but
    the exact wrapper can vary. We therefore try the description panel first
    and then fall back to the visible page text between the heading
    "This Combo includes" and the next product-data/reviews section.
    """

    heading_variants = {
        "this combo includes",
        "this combo include",
        "this combo includes the following",
        "combo includes",
    }

    stop_prefixes = (
        "weight",
        "additional information",
        "reviews",
        "be the first to review",
        "related products",
        "you may also like",
    )

    def normalise_lines(lines: list[str]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        started = False
        for raw in lines:
            line = clean_text(raw).strip(" \t\r\n-–—•")
            if not line:
                continue
            low = line.lower().rstrip(":")
            if low in heading_variants:
                started = True
                continue
            if not started:
                continue
            if any(low == x or low.startswith(x + " ") or low.startswith(x + ":") for x in stop_prefixes):
                break
            # Ignore tab labels or boilerplate that can appear inside theme wrappers.
            if low in {"description", "additional information", "reviews (0)"}:
                continue
            if line not in seen:
                seen.add(line)
                out.append(line)
        return out

    # 1) Preferred: the WooCommerce description panel.
    panel = (
        soup.select_one("#tab-description")
        or soup.select_one(".woocommerce-Tabs-panel--description")
        or soup.select_one(".woocommerce-tabs .panel.entry-content")
        or soup.select_one(".woocommerce-tabs")
    )
    if panel:
        work = BeautifulSoup(str(panel), "html.parser")
        for bad in work.select("script, style, noscript"):
            bad.decompose()
        for br in work.find_all("br"):
            br.replace_with("\n")
        for tag in work.find_all(["p", "li", "div", "h2", "h3", "h4", "strong"]):
            tag.append("\n")
        items = normalise_lines(work.get_text("\n", strip=True).splitlines())
        if items:
            return items

    # 2) Robust fallback: scan all visible page text. This handles Pulse theme
    # variations where the description contents are not inside #tab-description.
    work = BeautifulSoup(str(soup), "html.parser")
    for bad in work.select("script, style, noscript, svg"):
        bad.decompose()
    for br in work.find_all("br"):
        br.replace_with("\n")
    page_lines = work.get_text("\n", strip=True).splitlines()
    items = normalise_lines(page_lines)
    if items:
        return items

    # 3) Last fallback: locate a node containing the heading and walk forward
    # through sibling blocks. This catches heavily nested page-builder markup.
    marker = None
    for txt in soup.find_all(string=True):
        if clean_text(str(txt)).lower().rstrip(":") in heading_variants:
            marker = txt
            break
    if marker is not None:
        node = marker.parent
        lines: list[str] = [clean_text(str(marker))]
        # Walk up to a practical content block, then collect following elements.
        for _ in range(4):
            if node and node.parent and node.parent.name not in {"body", "html"}:
                node = node.parent
        sib = node
        steps = 0
        while sib is not None and steps < 30:
            text = clean_text(sib.get_text("\n", strip=True) if hasattr(sib, "get_text") else str(sib))
            if text:
                lines.extend(text.splitlines())
            sib = getattr(sib, "find_next_sibling", lambda: None)()
            steps += 1
        items = normalise_lines(lines)
        if items:
            return items

    return []


def combo_description(name: str, attrs: list[dict], category: str) -> str:
    facts = []
    wanted = ("size", "finish", "colour", "color", "material", "quantity", "square meters", "sold", "pieces", "piece")
    for a in attrs:
        if any(k in a["name"].lower() for k in wanted):
            facts.append(f"{a['name']}: {a['value']}")
        if len(facts) >= 4:
            break
    if facts:
        return ". ".join(facts) + "."
    title = CATEGORIES.get(category, {}).get("title", "Combo Deal")
    return f"{title} package. Review the product image and specifications for the items included in this combo."


def parse_product(url: str, category: str) -> dict:
    soup = fetch_html(url)
    h1 = soup.select_one("h1.product_title") or soup.find("h1")
    name = clean_text(h1.get_text(" ", strip=True) if h1 else "") or url.rstrip("/").split("/")[-1].replace("-", " ").title()

    sku_el = soup.select_one(".sku")
    code = clean_text(sku_el.get_text(" ", strip=True) if sku_el else "") or "—"

    price_el = soup.select_one(".summary .price") or soup.select_one("p.price") or soup.select_one(".price")
    price = parse_price(price_el.get_text(" ", strip=True) if price_el else "")

    image = ""
    og = soup.find("meta", attrs={"property": "og:image"})
    if og and og.get("content"):
        image = str(og.get("content"))
    if not image:
        img = soup.select_one(".woocommerce-product-gallery img")
        if img:
            image = img.get("data-large_image") or img.get("src") or ""

    images: list[str] = []
    for img in soup.select(".woocommerce-product-gallery img"):
        src = img.get("data-large_image") or img.get("data-src") or img.get("src")
        if src and src not in images:
            images.append(str(src))
    if image and image not in images:
        images.insert(0, image)

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

    included_items = extract_combo_includes(soup)

    slug = urlparse(url).path.rstrip("/").split("/")[-1]
    return {
        "id": slug,
        "source_url": url,
        "name": name,
        "code": code,
        "price": price,
        "description": combo_description(name, attrs, category),
        "included_items": included_items,
        "detail_parser_version": COMBO_DETAIL_PARSER_VERSION,
        "image": image,
        "images": images,
        "attributes": attrs,
        "categories": [],
    }


def merge_product(existing: dict | None, incoming: dict, category: str) -> dict:
    out = dict(existing or {})
    for field in ("source_url", "name", "code", "price", "description", "included_items", "detail_parser_version", "image", "images", "attributes"):
        if incoming.get(field):
            out[field] = incoming[field]
    out["id"] = incoming.get("id") or out.get("id")
    out["categories"] = sorted(set(out.get("categories") or []) | {category})
    return out


def previous_maps(previous: dict):
    by_id, by_url = {}, {}
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
    all_ids: list[str] = []
    for key, cfg in CATEGORIES.items():
        ids = list(dict.fromkeys(str(x) for x in category_products.get(key, [])))
        category_meta[key] = {"title": cfg["title"], "group": cfg["group"], "count": len(ids), "product_ids": ids}
        all_ids.extend(ids)
    all_ids = list(dict.fromkeys(all_ids))
    category_meta["all"] = {"title": "All Combo Deals", "group": "All", "count": len(all_ids), "product_ids": all_ids}
    for alias, target in ALIASES.items():
        if target in category_meta:
            category_meta[alias] = dict(category_meta[target])

    products = [normalise_busterbuild_product_price(p) for p in products_by_id.values()]
    products.sort(key=lambda x: (x.get("name") or "").lower())
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "updater_version": BUSTERBUILD_COMBO_SYNC_VERSION,
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
        print(f"Checkpoint: {len(products)} combo products written")
    return payload


def main() -> None:
    print(f"BUSTERBUILD_COMBO_SYNC_VERSION={BUSTERBUILD_COMBO_SYNC_VERSION}")
    print("Mode: HTML-only combo catalogue crawl")
    print(f"Detail parser: {COMBO_DETAIL_PARSER_VERSION} (captures actual This Combo Includes list)")

    previous = load_json(OUT, {})
    prev_by_id, prev_by_url = previous_maps(previous)
    prev_categories = previous.get("categories", {}) if isinstance(previous, dict) else {}
    cache = load_json(CACHE, {})
    if not isinstance(cache, dict):
        cache = {}
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
        for i, url in enumerate(urls, 1):
            p = cache.get(url)
            cache_is_current = bool(
                p
                and p.get("detail_parser_version") == COMBO_DETAIL_PARSER_VERSION
                and isinstance(p.get("included_items"), list)
                and len(p.get("included_items") or []) > 0
            )
            if not cache_is_current:
                try:
                    p = parse_product(url, key)
                    cache[url] = p
                    details_fetched += 1
                    if p.get("included_items"):
                        print(f"    includes captured: {len(p['included_items'])} items")
                    else:
                        print(f"WARN no combo-includes list found for {url}; it will be retried on the next sync", file=sys.stderr)
                    time.sleep(random.uniform(0.75, 1.35))
                    if details_fetched % 30 == 0:
                        pause = random.uniform(7.0, 13.0)
                        print(f"  Cooling down for {pause:.1f}s after {details_fetched} new combo pages")
                        time.sleep(pause)
                except Exception as exc:
                    detail_failures += 1
                    old = prev_by_url.get(url)
                    if old:
                        p = old
                        print(f"WARN using previous product data for {url}: {exc}", file=sys.stderr)
                    else:
                        print(f"WARN product detail skipped {url}: {exc}", file=sys.stderr)
                        continue

            pid = str(p.get("id") or urlparse(url).path.rstrip("/").split("/")[-1])
            p = dict(p)
            p["id"] = pid
            p["source_url"] = url
            products_by_id[pid] = merge_product(products_by_id.get(pid), p, key)
            ids.append(pid)
            if i % 20 == 0:
                print(f"  {key}: {i}/{len(urls)} processed")

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
        time.sleep(random.uniform(1.0, 2.0))

    payload = write_payload(products_by_id, category_products, failed_categories, checkpoint=False)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    count = len(payload["products"])
    print(f"\nFINAL: wrote {count} unique combo products")
    print("Failed categories:", failed_categories)
    if count < 10:
        raise SystemExit("Combo catalogue build aborted: fewer than 10 products available")
    print("Combo catalogue sync completed" + (" with warnings" if failed_categories else " successfully"))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FATAL updater exception caught: {exc}", file=sys.stderr)
        previous = load_json(OUT, {})
        if isinstance(previous, dict) and len(previous.get("products", [])) >= 10:
            print("Previous combo catalogue is still usable; exiting successfully so the live site remains available.", file=sys.stderr)
            sys.exit(0)
        raise
