import { firebaseConfig, salesAppConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const $ = (id) => document.getElementById(id);
const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const money = (n) => 'R' + Number(n || 0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});
const clean = (v='') => String(v).replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#215;|&times;/gi,'×').replace(/\s+/g,' ').trim();
const esc = (s='') => String(s).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const cfgReady = !Object.values(firebaseConfig).some(v => String(v).includes('PASTE_'));

let auth = null;
let products = [];
let filtered = [];
let currentFilter = 'all';
let selectedProduct = null;
let scanner = null;
let scannerRunning = false;
let installPrompt = null;
let toastTimer = null;
let cart = loadCart();

function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2300); }
function showLogin(){ $('login-screen').hidden=false; $('app-shell').hidden=true; }
function showApp(){ $('login-screen').hidden=true; $('app-shell').hidden=false; updateCartUI(); loadCatalogue(); }

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
window.addEventListener('beforeinstallprompt', e=>{e.preventDefault();installPrompt=e;$('install-btn').hidden=false;});
window.addEventListener('appinstalled',()=>{$('install-btn').hidden=true;installPrompt=null;toast('BusterBuild Sales installed');});
$('install-btn').addEventListener('click', async()=>{
  if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install-btn').hidden=true;return;}
  const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(isiOS?'On iPhone: Share → Add to Home Screen':'Use your browser menu → Install app / Add to Home Screen');
});

async function initAuth(){
  if(!cfgReady){ $('firebase-setup').hidden=false; $('login-form').addEventListener('submit',e=>e.preventDefault()); showLogin(); return; }
  const app=initializeApp(firebaseConfig); auth=getAuth(app);
  $('login-form').addEventListener('submit', async e=>{
    e.preventDefault(); $('login-error').textContent='';
    const btn=qs('button[type="submit"]',$('login-form')); btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';
    try{ await signInWithEmailAndPassword(auth,$('login-email').value.trim(),$('login-password').value); }
    catch(err){ $('login-error').textContent=authMessage(err); }
    finally{ btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign in'; }
  });
  onAuthStateChanged(auth,user=>{
    if(user){
      $('account-name').textContent=(user.displayName||user.email?.split('@')[0]||'Sales').replace(/[._-]+/g,' ');
      $('account-email').textContent=user.email||''; $('menu-email').textContent=user.email||''; showApp();
    } else showLogin();
  });
  $('logout-btn').addEventListener('click',()=>signOut(auth));
}
function authMessage(err){ const c=err?.code||''; if(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found'))return 'Incorrect email address or password.'; if(c.includes('too-many-requests'))return 'Too many attempts. Please wait and try again.'; if(c.includes('network'))return 'Network error. Check the phone connection.'; return 'Sign-in failed. Check the account and try again.'; }
initAuth();

$('account-btn').addEventListener('click',()=>{$('account-menu').hidden=!$('account-menu').hidden;});
document.addEventListener('click',e=>{if(!$('account-menu').hidden && !e.target.closest('#account-menu') && !e.target.closest('#account-btn'))$('account-menu').hidden=true;});

async function fetchJson(url){ const r=await fetch(url+'?v='+Date.now(),{cache:'no-store'}); if(!r.ok)throw new Error(url+' '+r.status); return r.json(); }
function normalise(p,type){
  const code=clean(p.code||p.sku||p.product_code||'');
  const pr=p.price||{};
  const price=Number(pr.current??pr.sale??pr.regular??p.current_price??p.sale_price??p.regular_price??p.price??0)||0;
  const attrs=normaliseAttrs(p.attributes||p.specifications||[]);
  return {
    ...p,
    _type:type,
    _code:code,
    _name:clean(p.name||p.title||'Product'),
    _price:price,
    _attrs:attrs,
    _image:resolveImage(firstImage(p)),
    _description:clean(p.short_description||p.summary||p.description||''),
    _sqm:sqmPerBox(p,attrs),
    _tilesPerBox:tilesPerBox(p,attrs)
  };
}
function normaliseAttrs(attrs){
  if(!Array.isArray(attrs))return [];
  return attrs.map(a=>({name:clean(a.name||a.label||''),value:clean(a.value??a.option??(Array.isArray(a.options)?a.options.join(', '):''))})).filter(a=>a.name||a.value);
}
function firstImage(p){
  if(typeof p.image==='string')return p.image;
  if(p.image?.src)return p.image.src;
  if(Array.isArray(p.images)&&p.images.length)return p.images[0]?.src||p.images[0]?.thumbnail||p.images[0];
  return '';
}
function resolveImage(src=''){ if(!src)return '../pictures/tiles and sanitary hero.jpeg'; if(/^https?:|^data:/i.test(src))return src; return '../'+src.replace(/^\.\//,'').replace(/^\//,''); }
function attrValue(attrs,re){ const a=attrs.find(x=>re.test(x.name)); return a?.value||''; }
function firstNumber(v){ const m=String(v||'').replace(',','.').match(/\d+(?:\.\d+)?/); return m?Number(m[0]):0; }
function sqmPerBox(p,attrs){ let v=attrValue(attrs,/square\s*(meters?|metres?)\s*per\s*box|m²\s*per\s*box|sqm\s*per\s*box/i); if(!v){ const d=clean(p.description||p.short_description||''); const m=d.match(/(\d+(?:[.,]\d+)?)\s*m(?:²|2)\s*per\s*box/i)||d.match(/square\s*(?:meters?|metres?)\s*per\s*box\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i); if(m)v=m[1]; } return firstNumber(v); }
function tilesPerBox(p,attrs){ let v=attrValue(attrs,/quantity\s*per\s*box|tiles?\s*per\s*box/i); if(!v){ const d=clean(p.description||''); const m=d.match(/quantity\s*per\s*box\s*[:\-]?\s*(\d+)/i)||d.match(/(\d+)\s*tiles?\s*per\s*box/i); if(m)v=m[1]; } return firstNumber(v); }
function isPerSqm(p){ if(p._type!=='tile')return false; const sold=attrValue(p._attrs,/^sold$|unit|selling\s*unit/i); return /m2|m²|sqm|square/i.test(sold)||p._sqm>0; }

async function loadCatalogue(){
  if(products.length){render();return;}
  $('catalogue-status').style.display='block';
  try{
    const [tiles,combos,sanitary]=await Promise.allSettled([
      fetchJson('../data/pulse-tile-catalogue.json'),
      fetchJson('../data/pulse-combo-catalogue.json'),
      fetchJson('./data/sanitary-products.json')
    ]);
    const tileRows=tiles.status==='fulfilled'?(tiles.value.products||[]):[];
    const comboRows=combos.status==='fulfilled'?(combos.value.products||[]):[];
    const sanitaryRows=sanitary.status==='fulfilled'?(sanitary.value.products||[]):[];
    products=[...tileRows.map(p=>normalise(p,'tile')),...sanitaryRows.map(p=>normalise(p,'sanitary')),...comboRows.map(p=>normalise(p,'combo'))];
    const byKey=new Map(); products.forEach(p=>byKey.set((p._type+'|'+(p._code||p.id||p._name)).toLowerCase(),p)); products=[...byKey.values()];
    $('tile-count').textContent=products.filter(p=>p._type==='tile').length;
    $('sanitary-count').textContent=products.filter(p=>p._type==='sanitary').length;
    $('combo-count').textContent=products.filter(p=>p._type==='combo').length;
    $('catalogue-status').style.display='none';
    render();
    handleProductQuery();
  }catch(err){ $('catalogue-status').innerHTML='<i class="fa-solid fa-triangle-exclamation"></i> Catalogue could not load. Check the catalogue data files and internet connection.'; }
}
function render(){
  const term=$('product-search').value.trim().toLowerCase();
  filtered=products.filter(p=>(currentFilter==='all'||p._type===currentFilter)&&(!term||p._name.toLowerCase().includes(term)||p._code.toLowerCase().includes(term)));
  const grid=$('product-grid'); grid.innerHTML='';
  if(!filtered.length){ grid.innerHTML='<div class="status-card" style="grid-column:1/-1">No matching products found.</div>'; return; }
  const frag=document.createDocumentFragment();
  filtered.forEach(p=>{
    const card=document.createElement('article'); card.className='product-card';
    card.innerHTML=`<div class="product-image"><img loading="lazy" referrerpolicy="no-referrer" src="${esc(p._image)}" alt="${esc(p._name)}" onerror="this.onerror=null;this.src='../pictures/tiles and sanitary hero.jpeg'"></div><div class="product-card-body"><span class="product-kind">${typeLabel(p._type)}</span><h3>${esc(p._name)}</h3><span class="card-code">CODE: ${esc(p._code||'—')}</span><div class="card-price">${money(p._price)}${isPerSqm(p)?'<small>per m²</small>':''}</div><button class="view-btn" type="button"><i class="fa-regular fa-eye"></i> View Details</button></div>`;
    qs('.view-btn',card).onclick=()=>openProduct(p); frag.appendChild(card);
  }); grid.appendChild(frag);
}
function typeLabel(t){return t==='tile'?'TILE':t==='combo'?'COMBO DEAL':'SANITARY WARE';}
$('product-search').addEventListener('input',render);
qsa('.filter-chip').forEach(b=>b.addEventListener('click',()=>{qsa('.filter-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentFilter=b.dataset.filter;render();}));

function openProduct(p){
  selectedProduct=p; $('product-type').textContent=typeLabel(p._type); $('product-title').textContent=p._name; $('product-code').textContent='Code: '+(p._code||'—'); $('product-image').src=p._image; $('product-image').alt=p._name;
  $('product-price').innerHTML=money(p._price)+(isPerSqm(p)?'<small>per m²</small>':'');
  $('product-description').textContent=p._description||defaultDescription(p._type);
  renderSpecs(p);
  const measure=$('smart-measure'); measure.hidden=!(p._type==='tile'&&p._sqm>0);
  $('room-length').value='';$('room-width').value=''; resetMeasure();
  $('box-note').textContent=p._sqm?`${p._tilesPerBox?formatNumber(p._tilesPerBox)+' tiles per box • ':''}${formatNumber(p._sqm)} m² per box. Calculator rounds up to full boxes.`:'';
  $('qty-label').textContent=(p._type==='tile'&&p._sqm>0)?'Boxes':'Quantity'; $('product-qty').value=1;
  $('add-cart').disabled=!p._price; $('add-cart').innerHTML=p._price?'<i class="fa-solid fa-cart-plus"></i><span>Add to Cart</span>':'<span>Price unavailable</span>';
  $('product-modal').classList.add('open'); $('product-modal').setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
}
function closeProduct(){ $('product-modal').classList.remove('open'); $('product-modal').setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
qsa('[data-close-product]').forEach(b=>b.addEventListener('click',closeProduct));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProduct();});
function defaultDescription(type){return type==='combo'?'Complete BusterBuild combo deal. Review the included items before adding the package to the customer cart.':type==='sanitary'?'BusterBuild sanitary ware product for bathroom installations and upgrades.':'BusterBuild tile product. Use Smart Measure to calculate the customer’s required boxes.';}
function renderSpecs(p){
  const specs=[...p._attrs];
  if(p._sqm&&!specs.some(a=>/square/i.test(a.name)))specs.push({name:'Square metres per box',value:formatNumber(p._sqm)+' m²'});
  if(p._tilesPerBox&&!specs.some(a=>/quantity|tiles per/i.test(a.name)))specs.push({name:'Tiles per box',value:formatNumber(p._tilesPerBox)});
  $('product-specs').innerHTML=specs.slice(0,12).map(a=>`<div class="spec"><strong>${esc(a.name)}</strong>${esc(a.value)}</div>`).join('');
}
function formatNumber(n){return Number(n||0).toLocaleString('en-ZA',{maximumFractionDigits:2});}

$('qty-minus').onclick=()=>{$('product-qty').value=Math.max(1,(Number($('product-qty').value)||1)-1);};
$('qty-plus').onclick=()=>{$('product-qty').value=(Number($('product-qty').value)||1)+1;};
$('add-cart').onclick=()=>{ if(!selectedProduct)return; addToCart(selectedProduct,Math.max(1,Number($('product-qty').value)||1)); closeProduct(); };
['room-length','room-width'].forEach(id=>$(id).addEventListener('input',calculateMeasure));
$('use-boxes').onclick=()=>{const boxes=Number($('boxes-order').textContent)||0;if(boxes){$('product-qty').value=boxes;toast(boxes+' boxes set as quantity');}};
function resetMeasure(){ $('required-area').textContent='0.00 m²';$('boxes-order').textContent='0';$('covered-area').textContent='0.00 m²';$('measure-total').textContent='R0,00'; }
function calculateMeasure(){
  if(!selectedProduct||!selectedProduct._sqm)return resetMeasure();
  const l=Number($('room-length').value)||0,w=Number($('room-width').value)||0,area=l*w;
  const boxes=area>0?Math.ceil(area/selectedProduct._sqm):0,cover=boxes*selectedProduct._sqm;
  const total=isPerSqm(selectedProduct)?cover*selectedProduct._price:boxes*selectedProduct._price;
  $('required-area').textContent=area.toFixed(2)+' m²';$('boxes-order').textContent=boxes;$('covered-area').textContent=cover.toFixed(2)+' m²';$('measure-total').textContent=money(total);
}

function cartKey(p){return (p._type+'|'+(p._code||p.id||p._name)).toLowerCase();}
function loadCart(){try{return JSON.parse(localStorage.getItem('busterbuildSalesCart')||'[]')}catch{return[]}}
function saveCart(){localStorage.setItem('busterbuildSalesCart',JSON.stringify(cart));updateCartUI();}
function addToCart(p,qty){
  const key=cartKey(p), existing=cart.find(x=>x.key===key); if(existing)existing.qty+=qty; else cart.push({key,name:p._name,code:p._code,image:p._image,type:p._type,price:p._price,qty,sqm:p._sqm||0,perSqm:isPerSqm(p)}); saveCart(); toast(`${p._name} added to cart`);
}
function lineTotal(i){return i.perSqm&&i.sqm?i.price*i.sqm*i.qty:i.price*i.qty;}
function updateCartUI(){
  const count=cart.reduce((s,i)=>s+i.qty,0); $('bottom-cart-count').textContent=count; $('cart-stat').textContent=count;
  const list=$('cart-list'); list.innerHTML=''; $('cart-empty').style.display=cart.length?'none':'grid'; $('cart-summary').hidden=!cart.length;
  let total=0; cart.forEach((item,idx)=>{ total+=lineTotal(item); const row=document.createElement('div'); row.className='cart-row'; row.innerHTML=`<img src="${esc(item.image)}" alt=""><div><h3>${esc(item.name)}</h3><p>${esc(item.code||'')} • ${item.type==='tile'&&item.sqm?'Boxes':'Qty'}</p></div><div class="cart-row-total"><strong>${money(lineTotal(item))}</strong><div class="mini-qty"><button data-minus type="button">−</button><span>${item.qty}</span><button data-plus type="button">+</button><button data-remove class="remove-item" type="button"><i class="fa-solid fa-trash"></i></button></div></div>`; qs('[data-minus]',row).onclick=()=>{item.qty=Math.max(1,item.qty-1);saveCart();}; qs('[data-plus]',row).onclick=()=>{item.qty++;saveCart();}; qs('[data-remove]',row).onclick=()=>{cart.splice(idx,1);saveCart();}; list.appendChild(row); });
  $('cart-items-total').textContent=count; $('cart-money-total').textContent=money(total);
}
$('clear-cart').onclick=()=>{if(confirm('Clear the sales cart?')){cart=[];saveCart();}};

function showView(name){
  qsa('.view').forEach(v=>v.classList.remove('active')); $(name+'-view').classList.add('active'); qsa('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));
  if(name==='cart')updateCartUI(); if(name!=='scan')stopScanner(); window.scrollTo({top:0,behavior:'smooth'});
}
qsa('[data-nav]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.nav)));
qsa('[data-open-scan]').forEach(b=>b.addEventListener('click',()=>showView('scan')));

$('start-camera').onclick=startScanner; $('stop-camera').onclick=stopScanner;
$('manual-find').onclick=()=>findScanned($('manual-code').value);
$('manual-code').addEventListener('keydown',e=>{if(e.key==='Enter')findScanned(e.target.value);});
async function startScanner(){
  if(scannerRunning)return; if(!window.Html5Qrcode){toast('Scanner library did not load');return;}
  $('camera-message').textContent='Starting camera…';
  try{
    scanner=new Html5Qrcode('qr-reader');
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:250},aspectRatio:1.0},decoded=>{findScanned(decoded);stopScanner();},()=>{});
    scannerRunning=true;$('start-camera').hidden=true;$('stop-camera').hidden=false;$('camera-message').textContent='Point the camera at a BusterBuild product QR code.';
  }catch(err){ $('camera-message').textContent='Camera could not start. Allow camera permission or enter the product code below.'; toast('Camera permission is required for scanning'); }
}
async function stopScanner(){ if(scanner&&scannerRunning){try{await scanner.stop();await scanner.clear();}catch{} } scanner=null;scannerRunning=false;$('start-camera').hidden=false;$('stop-camera').hidden=true; }
function extractCode(raw){ const txt=String(raw||'').trim(); try{ const u=new URL(txt); return u.searchParams.get('product')||u.searchParams.get('code')||u.searchParams.get('sku')||txt; }catch{} const m=txt.match(/(?:product|code|sku)[:=]\s*([^|\s]+)/i); return (m?m[1]:txt).trim(); }
function findScanned(raw){
  const code=extractCode(raw).toLowerCase(); if(!code){toast('Enter or scan a product code');return;}
  const p=products.find(x=>x._code.toLowerCase()===code||String(x.id||'').toLowerCase()===code||x._name.toLowerCase()===code);
  if(!p){$('scan-result').hidden=false;$('scan-result').innerHTML='<strong>Product not found</strong><br><small>Scanned: '+esc(extractCode(raw))+'</small>';toast('Product code not found');return;}
  $('scan-result').hidden=false;$('scan-result').innerHTML='<strong><i class="fa-solid fa-circle-check" style="color:#16984f"></i> '+esc(p._name)+'</strong><br><small>Code: '+esc(p._code||'—')+'</small>'; openProduct(p);
}
function handleProductQuery(){ const params=new URLSearchParams(location.search); const code=params.get('product')||params.get('code'); if(code){ const p=products.find(x=>x._code.toLowerCase()===code.toLowerCase()||String(x.id||'').toLowerCase()===code.toLowerCase()); if(p)openProduct(p); } }

updateCartUI();
