// Public, read-only BusterBuild prices. All price writes still require a Hub manager.
export const HUB_PRICE_URL = 'https://maliks-group-hub.moyanamoses006.workers.dev/api/public-price-tags/prices';
const key = value => String(value || '').trim().toLowerCase();
export function validHubPrices(payload) {
  if (payload?.brand !== 'busterbuild' || !Array.isArray(payload.prices)) throw new Error('Invalid Hub price response');
  const map = new Map();
  for (const row of payload.prices) {
    if (!key(row.code) || !Number.isSafeInteger(row.price_cents) || row.price_cents <= 0 || !['EA','M2','BOX'].includes(row.unit)) throw new Error('Invalid product price');
    if ((row.is_tile === 1 || row.is_tile === true) && (!(row.coverage_per_box > 0) || !['M2','BOX'].includes(row.unit))) throw new Error('Invalid tile price');
    if (!map.has(key(row.code))) map.set(key(row.code), row);
  }
  return map;
}
export function applyHubPrices(products, prices) {
  let changed = false;
  for (const product of products) {
    if (!product._hubOriginal) product._hubOriginal = { price: product._price, sqm: product._sqm, pieces: product._tilesPerBox, unit: product._hubUnit };
    const row = prices.get(key(product._code));
    const old = `${product._price}|${product._sqm}|${product._tilesPerBox}|${product._hubUnit}`;
    const original = product._hubOriginal;
    product._price = row ? row.price_cents / 100 : original.price;
    product._hubUnit = row?.unit;
    product._sqm = row?.is_tile ? Number(row.coverage_per_box) : original.sqm;
    product._tilesPerBox = row?.is_tile ? Number(row.pieces_per_box || 0) : original.pieces;
    changed ||= old !== `${product._price}|${product._sqm}|${product._tilesPerBox}|${product._hubUnit}`;
  }
  return changed;
}
export function hubPriceSuffix(product, html = false) {
  const label = product._hubUnit === 'BOX' ? 'per box' : product._hubUnit === 'M2' ? 'per m²' : '';
  return label ? (html ? `<small>${label}</small>` : (product._hubUnit === 'BOX' ? '/box' : '/m²')) : '';
}
export function hubMeasureCost(product, area, boxes) {
  return Number(((product._hubUnit === 'BOX' ? boxes : area) * product._price).toFixed(2));
}
export function createHubPriceSync({getProducts, onChange, onStatus, fetcher = fetch}) {
  let pending; let lastSuccess = 0; let latest;
  async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetcher(HUB_PRICE_URL, {cache:'no-store', credentials:'omit', signal:AbortSignal.timeout(10000)});
        if (!response.ok) throw new Error('Price feed unavailable');
        latest = validHubPrices(await response.json());
        const changed = applyHubPrices(getProducts(), latest);
        lastSuccess = Date.now(); onStatus?.('Hub prices updated', false);
        if (changed) onChange?.();
        return true;
      } catch {
        onStatus?.('Live price updates unavailable. Check current prices with your manager before quoting.', true);
        return false;
      } finally { pending = null; }
    })();
    return pending;
  }
  return { refresh, applyLatest() { return latest ? applyHubPrices(getProducts(), latest) : false; }, get lastSuccess() { return lastSuccess; } };
}
export function refreshHubCart(cart, products) {
  const byCode = new Map(products.filter(p=>p._hubUnit).map(p=>[key(p._code),p]));
  return cart.map(item=>{
    const product=byCode.get(key(item.code));
    if(!product || item.customCombo)return item;
    const box=product._hubUnit==='BOX';
    let qty=item.qty;
    if(item.smartMeasure)qty=box?item.smartBoxes:item.smartArea;
    else if(box&&item.perSqm)qty=Math.ceil(item.qty/product._sqm);
    else if(product._hubUnit==='M2'&&item.hubUnit==='BOX')qty=item.qty*product._sqm;
    const next={...item,price:product._price,qty,perSqm:product._hubUnit==='M2',hubUnit:product._hubUnit,sqm:product._sqm};
    if(item.smartMeasure)next.fixedTotal=Number((qty*product._price).toFixed(2));
    return next;
  });
}
