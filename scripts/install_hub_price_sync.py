#!/usr/bin/env python3
"""Run from the BusterBuild website repository root after copying this patch."""
from pathlib import Path
import re
root=Path.cwd(); folder=root/'sales-app'
if not (folder/'hub-prices.js').exists():
    raise SystemExit('Copy sales-app/hub-prices.js into this website repository first.')
marker='// HUB_PRICE_SYNC_V1'
startup='''
// HUB_PRICE_SYNC_V1
const hubPriceSync = createHubPriceSync({
  getProducts:()=>products,
  onChange:()=>{
    cart=refreshHubCart(cart,products);saveCart();
    render();
    if(selectedProduct){
      $('product-price').innerHTML=money(selectedProduct._price)+salesPriceSuffix(selectedProduct,true);
      if(smartMeasureState.area>0)calculateMeasure();
    }
  },
  onStatus:(message,failed)=>{
    let notice=$('hub-price-status');
    if(!notice){notice=document.createElement('p');notice.id='hub-price-status';notice.setAttribute('role','status');$('catalogue-status')?.after(notice);}
    notice.textContent=message;notice.style.cssText='font-size:12px;padding:8px;border-radius:6px;background:'+(failed?'#fff0cb':'#eef6ee')+';color:#443814';
  }
});
function salesPriceSuffix(product,html=false){
  if(product._hubUnit)return hubPriceSuffix(product,html);
  return isPerSqm(product)?(html?'<small>per m²</small>':'/m²'):'';
}
setInterval(()=>{if(products.length&&!document.hidden)void hubPriceSync.refresh();},60000);
document.addEventListener('visibilitychange',()=>{if(products.length&&!document.hidden)void hubPriceSync.refresh();});
window.addEventListener('online',()=>{if(products.length)void hubPriceSync.refresh();});
'''
changes=[]
installed=0
index_path=folder/'index.html'
if not index_path.exists():raise SystemExit('Cannot find sales-app/index.html in this website repository.')
active_names={Path(src.split('?')[0]).name for src in re.findall(r'<script[^>]+src=["\']([^"\']+)["\']',index_path.read_text())}
for path in folder.glob('app*.js'):
    if path.name not in active_names:continue
    source=path.read_text()
    if 'function normalise(p,type)' not in source or 'async function loadCatalogue()' not in source:continue
    if marker in source:
        installed+=1
        continue
    s=source
    def replace(a,b):
        global s
        if a not in s:raise SystemExit(f'{path}: expected code not found: {a[:70]}. No files written; use your current app source for review.')
        s=s.replace(a,b)
    s="import {createHubPriceSync,hubPriceSuffix,hubMeasureCost,refreshHubCart} from './hub-prices.js?v=20261021-1';\n"+s
    replace('let products = [];','let products = [];\n'+startup)
    replace("    $('tile-count').textContent=products.filter", "    await hubPriceSync.refresh();\n    $('tile-count').textContent=products.filter")
    replace("function isPerSqm(p){", "function isPerSqm(p){ if(p._hubUnit)return p._hubUnit==='M2';")
    replace("isPerSqm(p)?'<small>per m²</small>':''", "salesPriceSuffix(p,true)")
    replace("isPerSqm(p)?'/m²':''", "salesPriceSuffix(p)")
    replace("isPerSqm(selectedProduct)?'/m²':''", "salesPriceSuffix(selectedProduct)")
    replace("const total=Number((area*selectedProduct._price).toFixed(2));", "const total=hubMeasureCost(selectedProduct,area,boxes);")
    replace("if(tile&&smartMeasureState.productKey===key", "if((tile||selectedProduct._hubUnit==='BOX')&&smartMeasureState.productKey===key")
    replace("qty:Number(measure.area.toFixed(2)),", "qty:p._hubUnit==='BOX'?measure.boxes:Number(measure.area.toFixed(2)),")
    replace("perSqm:true,\n    smartMeasure:true,", "perSqm:p._hubUnit!=='BOX',\n    hubUnit:p._hubUnit,\n    smartMeasure:true,")
    replace("$('qty-label').textContent='Quantity (m²)';", "$('qty-label').textContent=selectedProduct._hubUnit==='BOX'?'Quantity (boxes)':'Quantity (m²)';")
    replace("$('product-qty').value=area.toFixed(2);", "$('product-qty').value=selectedProduct._hubUnit==='BOX'?String(boxes):area.toFixed(2);")
    replace("'<i class=\"fa-solid fa-cart-plus\"></i><span>Add '+area.toFixed(2)+' m² to Cart • '+money(total)", "'<i class=\"fa-solid fa-cart-plus\"></i><span>Add '+(selectedProduct._hubUnit==='BOX'?boxes+' boxes':area.toFixed(2)+' m²')+' to Cart • '+money(total)")
    replace("const total=Number(rows.reduce((s,r)=>s+r.total,0).toFixed(2));", "const total=selectedProduct._hubUnit?hubMeasureCost(selectedProduct,area,boxes):Number(rows.reduce((s,r)=>s+r.total,0).toFixed(2));")
    replace("updated.fixedTotal=Number((updated.smartArea*updated.price).toFixed(2))", "updated.fixedTotal=Number(((updated.hubUnit==='BOX'?updated.smartBoxes:updated.smartArea)*updated.price).toFixed(2))")
    replace("perSqm:isPerSqm(p),smartMeasure:false", "perSqm:isPerSqm(p),hubUnit:p._hubUnit,smartMeasure:false")
    changes.append((path,s))
if not changes and not installed:raise SystemExit('The active sales script uses a different structure. Stop and provide the current sales app ZIP so it can be patched without replacing working features.')
if not changes:print('Hub price sync is already installed.')
# Verify the service-worker anchor before changing any sales code.
sw_check=folder/'sw.js'
if changes and sw_check.exists() and '  const path = url.pathname;' not in sw_check.read_text():
    raise SystemExit('Review sw.js before installing: live prices must bypass the offline cache.')
# All validation above completes before writing the first script.
for path,s in changes:path.write_text(s);print('Updated',path)
if changes:
    index=folder/'index.html'
    if index.exists():
        source=index.read_text()
        source=re.sub(r'(src=[\"\'])([^\"\']*app(?:-v[^\"\'?]*)?\.js)(?:\?[^\"\']*)?([\"\'])',r'\1\2?v=20261021-hubprices1\3',source)
        index.write_text(source)
    sw=folder/'sw.js'
    if sw.exists():
        s=sw.read_text();s=re.sub(r"const CACHE = '[^']+';","const CACHE = 'busterbuild-sales-20261021-hubprices1';",s,count=1)
        anchor='  const path = url.pathname;'
        if anchor not in s:raise SystemExit('Review sw.js: live price fetch must bypass the service-worker cache.')
        s=s.replace(anchor,anchor+"\n\n  // Live Hub prices must never use an old service-worker response.\n  if (path === '/api/public-price-tags/prices') { event.respondWith(fetch(request, {cache:'no-store'})); return; }",1)
        sw.write_text(s)
print('Deploy the Hub patch and this sales website. Keep the existing Firebase configuration and login settings.')
