import { firebaseConfig, salesAppConfig } from './firebase-config.js?v=20261001-1650';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const money = (n) => 'R' + Number(n || 0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});
const clean = (v='') => String(v).replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#215;|&times;/gi,'×').replace(/\s+/g,' ').trim();
const esc = (s='') => String(s).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const cfgReady = !Object.values(firebaseConfig).some(v => String(v).includes('PASTE_'));

let auth = null;
let db = null;
let firebaseApp = null;
let currentAccess = null;
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
function showLogin(){
  $('login-screen').hidden=false;
  $('app-shell').hidden=true;
  $('account-menu').hidden=true;
}
function showApp(){
  $('firebase-setup').hidden=true;
  $('login-error').textContent='';
  $('login-screen').hidden=true;
  $('app-shell').hidden=false;
  $('account-menu').hidden=true;
  updateCartUI();
  loadCatalogue();
}

if ('serviceWorker' in navigator) window.addEventListener('load',async()=>{
  try{
    const reg=await navigator.serviceWorker.register('./sw.js?v=20261001-1640',{updateViaCache:'none'});
    await reg.update();
  }catch(e){console.warn('Service worker update skipped',e);}
});
window.addEventListener('beforeinstallprompt', e=>{e.preventDefault();installPrompt=e;$('install-btn').hidden=false;});
window.addEventListener('appinstalled',()=>{$('install-btn').hidden=true;installPrompt=null;toast('BusterBuild Sales installed');});
$('install-btn').addEventListener('click', async()=>{
  if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install-btn').hidden=true;return;}
  const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(isiOS?'On iPhone: Share → Add to Home Screen':'Use your browser menu → Install app / Add to Home Screen');
});

async function initAuth(){
  $('firebase-setup').hidden=cfgReady;
  if(!cfgReady){ $('firebase-setup').hidden=false; $('login-form').addEventListener('submit',e=>e.preventDefault()); showLogin(); return; }
  $('firebase-setup').hidden=true;
  firebaseApp=initializeApp(firebaseConfig); auth=getAuth(firebaseApp); db=getFirestore(firebaseApp);
  $('login-form').addEventListener('submit', async e=>{
    e.preventDefault(); $('login-error').textContent='';
    const btn=qs('button[type="submit"]',$('login-form')); btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';
    try{ await signInWithEmailAndPassword(auth,$('login-email').value.trim(),$('login-password').value); }
    catch(err){ console.error('Firebase sign-in error:', err); $('login-error').textContent=authMessage(err); }
    finally{ btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign in'; }
  });
  onAuthStateChanged(auth,async user=>{
    if(!user){ currentAccess=null; $('login-error').textContent=''; showLogin(); return; }
    try{
      currentAccess=await resolveAccess(user);
      if(!currentAccess.allowed){
        $('login-error').textContent='This account does not have access to the Tiles & Sanitary Ware Sales App.';
        await signOut(auth); return;
      }
      const display=currentAccess.name||user.displayName||user.email?.split('@')[0]||'Sales';
      $('account-name').textContent=display.replace(/[._-]+/g,' ');
      $('account-email').textContent=user.email||''; $('menu-email').textContent=user.email||'';
      const admin=currentAccess.role==='admin';
      $('manage-sales-btn').hidden=!admin;
      $('menu-role').textContent=admin?'Sales App Administrator':'Tiles & Sanitary Ware Sales';
      showApp();
      if(admin) loadSalesTeam();
    }catch(err){
      console.error(err); $('login-error').textContent='Account access could not be verified. Check Firebase/Firestore setup.'; await signOut(auth);
    }
  });
  $('logout-btn').addEventListener('click',()=>signOut(auth));
}
async function resolveAccess(user){
  const adminEmail=String(salesAppConfig.adminEmail||'').trim().toLowerCase();
  if(adminEmail && !adminEmail.includes('REPLACE_') && String(user.email||'').toLowerCase()===adminEmail){
    return {allowed:true,role:'admin',name:user.displayName||'Administrator',active:true};
  }
  const snap=await getDoc(doc(db,'salesUsers',user.uid));
  if(!snap.exists()) return {allowed:false};
  const profile=snap.data()||{};
  const allowed=profile.active!==false && profile.role==='sales' && profile.department==='tiles-sanitary';
  return {...profile,allowed};
}
function authMessage(err){
  const c=err?.code||'unknown';
  const m=err?.message||'';
  if(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')) return `Incorrect email address or password. (${c})`;
  if(c.includes('too-many-requests')) return `Too many attempts. Please wait and try again. (${c})`;
  if(c.includes('network')) return `Network error. Check the connection. (${c})`;
  if(c.includes('operation-not-allowed')) return `Email/password sign-in is not enabled in Firebase. (${c})`;
  if(c.includes('unauthorized-domain')) return `This GitHub Pages domain is not authorised in Firebase. (${c})`;
  if(c.includes('invalid-api-key')) return `The Firebase API key in firebase-config.js is invalid. (${c})`;
  if(c.includes('configuration-not-found')) return `Firebase Authentication configuration was not found for this project. (${c})`;
  return `Firebase sign-in error: ${c}${m ? ' — '+m.replace(/^Firebase:\s*/,'') : ''}`;
}
initAuth();

$('account-btn').addEventListener('click',()=>{$('account-menu').hidden=!$('account-menu').hidden;});
document.addEventListener('click',e=>{if(!$('account-menu').hidden && !e.target.closest('#account-menu') && !e.target.closest('#account-btn'))$('account-menu').hidden=true;});


$('manage-sales-btn').addEventListener('click',()=>{ $('account-menu').hidden=true; showView('admin'); loadSalesTeam(); });
$('add-sales-form').addEventListener('submit',createSalesAccount);
async function createSalesAccount(e){
  e.preventDefault();
  if(currentAccess?.role!=='admin'){toast('Administrator access required');return;}
  const name=$('sales-name').value.trim(), email=$('sales-email').value.trim().toLowerCase(), password=$('sales-password').value;
  const status=$('sales-create-status'), btn=$('create-sales-btn');
  status.textContent=''; status.className='admin-status';
  if(!name||!email||password.length<6){status.textContent='Enter a name, valid email and password of at least 6 characters.';status.classList.add('error');return;}
  btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Creating account…';
  try{
    const secondaryName='salesCreator';
    const existing=getApps().find(x=>x.name===secondaryName);
    const secondary=existing||initializeApp(firebaseConfig,secondaryName);
    const secondaryAuth=getAuth(secondary);
    const cred=await createUserWithEmailAndPassword(secondaryAuth,email,password);
    await updateProfile(cred.user,{displayName:name});
    await setDoc(doc(db,'salesUsers',cred.user.uid),{
      name,email,role:'sales',department:'tiles-sanitary',active:true,
      createdAt:serverTimestamp(),createdBy:auth.currentUser?.uid||'',createdByEmail:auth.currentUser?.email||''
    });
    await signOut(secondaryAuth);
    $('add-sales-form').reset();
    status.textContent=`${name} can now sign in to the Sales App.`;status.classList.add('success');
    toast('Sales account created'); await loadSalesTeam();
  }catch(err){
    console.error(err); const c=err?.code||'';
    status.textContent=c.includes('email-already-in-use')?'That email already has a Firebase account.':c.includes('permission-denied')?'Firestore blocked the change. Publish the supplied firestore.rules with your admin email.':c.includes('weak-password')?'Password must be at least 6 characters.':'Account could not be created: '+(err?.message||'Unknown error');
    status.classList.add('error');
  }finally{btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-user-plus"></i> Create Sales Account';}
}
async function loadSalesTeam(){
  if(currentAccess?.role!=='admin'||!db)return;
  const list=$('sales-team-list'); list.innerHTML='<div class="team-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading sales accounts…</div>';
  try{
    const snap=await getDocs(collection(db,'salesUsers'));
    const rows=[]; snap.forEach(d=>rows.push({id:d.id,...d.data()})); rows.sort((a,b)=>String(a.name||a.email).localeCompare(String(b.name||b.email)));
    $('sales-team-count').textContent=rows.length;
    if(!rows.length){list.innerHTML='<div class="team-empty"><i class="fa-solid fa-users"></i><strong>No sales accounts yet</strong><span>Add the first salesperson using the form.</span></div>';return;}
    list.innerHTML='';
    rows.forEach(row=>{
      const el=document.createElement('div'); el.className='team-user'+(row.active===false?' inactive':'');
      el.innerHTML=`<span class="team-avatar"><i class="fa-solid fa-user"></i></span><div class="team-user-copy"><strong>${esc(row.name||'Salesperson')}</strong><span>${esc(row.email||'')}</span><small>${row.active===false?'ACCESS DISABLED':'ACTIVE • TILES & SANITARY'}</small></div><div class="team-actions"><button data-reset type="button" title="Send password reset"><i class="fa-solid fa-key"></i></button><button data-toggle type="button" class="${row.active===false?'enable':''}" title="${row.active===false?'Enable access':'Disable access'}"><i class="fa-solid ${row.active===false?'fa-user-check':'fa-user-slash'}"></i></button></div>`;
      qs('[data-reset]',el).onclick=async()=>{try{await sendPasswordResetEmail(auth,row.email);toast('Password reset email sent');}catch{toast('Could not send reset email');}};
      qs('[data-toggle]',el).onclick=async()=>{const next=row.active===false; if(!next&&!confirm(`Disable ${row.name||row.email}'s sales access?`))return; try{await updateDoc(doc(db,'salesUsers',row.id),{active:next,updatedAt:serverTimestamp()});toast(next?'Sales access enabled':'Sales access disabled');loadSalesTeam();}catch(err){console.error(err);toast('Could not update access');}};
      list.appendChild(el);
    });
  }catch(err){console.error(err);list.innerHTML='<div class="team-empty error"><i class="fa-solid fa-triangle-exclamation"></i><strong>Could not load sales accounts</strong><span>Check Firestore rules and your admin email.</span></div>';}
}

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
