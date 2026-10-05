import { firebaseConfig, salesAppConfig } from './firebase-config.js?v=20261002-publicqr1';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, deleteUser, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
let quoteHistory = loadQuoteHistory();
let currentQuoteNumber = '';
let currentQuoteSavedId = '';
let smartMeasureState={productKey:'',area:0,boxes:0,cover:0,total:0,baseArea:0,wastePct:0,layout:'straight'};
const CURRENT_APP_VERSION='2.0.8';
let catalogueUpdatedAt=null;
let cloudQuotes=[];
let cloudCustomers=[];
let quoteCloudBusy=false;
let favourites=loadLocalSet('busterbuildFavourites');
let recentProducts=loadLocalArray('busterbuildRecentProducts');
let compareKeys=[];
let projectRooms=loadLocalArray('busterbuildProjectRooms');
let comboBuilderItems=[];
let installHelpOpen=false;
let sessionHeartbeat=null;

const routeParams = new URLSearchParams(window.location.search);
const publicProductCode = (routeParams.get('product') || routeParams.get('code') || '').trim();
const publicProductMode = Boolean(publicProductCode);

function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2300); }

function loadLocalArray(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}

function closeBusterWelcome(){
  const splash=document.getElementById('buster-welcome');
  if(!splash)return;
  splash.classList.add('leave');
  setTimeout(()=>splash.remove(),650);
}

function startBusterWelcome(){
  const params=new URLSearchParams(location.search);
  // Customer QR scans should open the product immediately.
  if(params.get('product')||params.get('code')){
    const splash=document.getElementById('buster-welcome');
    if(splash)splash.remove();
    return;
  }

  const splash=document.getElementById('buster-welcome');
  if(!splash)return;

  // Safety timeout: never allow the welcome screen to block the app.
  const safety=setTimeout(()=>closeBusterWelcome(),5000);

  window.addEventListener('load',()=>{
    setTimeout(()=>{
      clearTimeout(safety);
      closeBusterWelcome();
    },2900);
  },{once:true});
}

startBusterWelcome();
function saveLocalArray(key,value){localStorage.setItem(key,JSON.stringify(value))}
function loadLocalSet(key){return new Set(loadLocalArray(key))}
function saveLocalSet(key,set){saveLocalArray(key,[...set])}
function normalPhone(v=''){return String(v).replace(/\D/g,'')}
function productKey(p){return String(p?._code||p?.id||p?._name||'').toLowerCase()}
function currentUserName(){return $('account-name')?.textContent||auth?.currentUser?.displayName||'BusterBuild Sales'}
function downloadTextFile(name,text,type='text/plain;charset=utf-8'){
  const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)
}
function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function csvDownload(name,rows){
  downloadTextFile(name,rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8')
}
function daysSince(value){const d=new Date(value||0);return Number.isNaN(d.getTime())?0:Math.floor((Date.now()-d.getTime())/86400000)}
function addRecentProduct(p){
  const key=productKey(p);if(!key)return;
  recentProducts=[key,...recentProducts.filter(x=>x!==key)].slice(0,12);
  saveLocalArray('busterbuildRecentProducts',recentProducts);
  renderRecentProducts();
}
function toggleFavourite(p){
  const key=productKey(p);if(!key)return;
  if(favourites.has(key))favourites.delete(key);else favourites.add(key);
  saveLocalSet('busterbuildFavourites',favourites);render();renderRecentProducts();toast(favourites.has(key)?'Added to favourites':'Removed from favourites');
}
function isFavourite(p){return favourites.has(productKey(p))}
function getProductByKey(key){return products.find(p=>productKey(p)===String(key||'').toLowerCase())}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}

function setNetworkState(){
  const online=navigator.onLine;
  const el=$('network-status');
  if(el){
    el.className='system-pill '+(online?'online':'offline');
    el.innerHTML=`<i class="fa-solid ${online?'fa-wifi':'fa-triangle-exclamation'}"></i><span>${online?'Online':'Offline'}</span>`;
  }
  if(!online)setCloudState('offline','Offline — quotes save on device');
  else if(!quoteCloudBusy)setCloudState('ready','Cloud ready');
}
function setCloudState(state,text){
  const el=$('cloud-status');
  if(!el)return;
  el.className='system-pill cloud '+state;
  const icon=state==='syncing'?'fa-arrows-rotate fa-spin':state==='error'?'fa-cloud-exclamation':state==='offline'?'fa-cloud-arrow-down':'fa-cloud-check';
  el.innerHTML=`<i class="fa-solid ${icon}"></i><span>${esc(text||'Cloud ready')}</span>`;
}
function formatSystemDate(value){
  if(!value)return 'Waiting for catalogue';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return 'Catalogue loaded';
  return d.toLocaleString('en-ZA',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function updateCatalogueTimestamp(values=[]){
  const dates=values.map(v=>new Date(v)).filter(d=>!Number.isNaN(d.getTime()));
  if(!dates.length)return;
  catalogueUpdatedAt=new Date(Math.max(...dates.map(d=>d.getTime())));
  const el=$('catalogue-updated');
  if(el)el.textContent=formatSystemDate(catalogueUpdatedAt);
}
async function checkAppVersion(){
  try{
    const r=await fetch('./app-version.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)return;
    const remote=await r.json();
    const version=String(remote.version||'').trim();
    const current=$('app-version');
    const menu=$('menu-version');
    if(current)current.textContent='v'+CURRENT_APP_VERSION;
    if(menu)menu.textContent='Version '+CURRENT_APP_VERSION;
    if(version && version!==CURRENT_APP_VERSION){
      const banner=$('app-update-banner');
      if(banner){
        $('available-version').textContent='v'+version;
        banner.hidden=false;
      }
    }
  }catch{}
}
async function forceAppUpdate(){
  const btn=$('update-now-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Updating…';}
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.update().catch(()=>{})));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
  }catch{}
  window.location.reload();
}
function initProfessionalStatus(){
  setNetworkState();
  window.addEventListener('online',async()=>{setNetworkState();await syncPendingQuotes();await loadCloudQuotes();});
  window.addEventListener('offline',setNetworkState);
  $('update-now-btn')?.addEventListener('click',forceAppUpdate);
  $('app-version') && ($('app-version').textContent='v'+CURRENT_APP_VERSION);
  $('menu-version') && ($('menu-version').textContent='Version '+CURRENT_APP_VERSION);
  checkAppVersion();
  setInterval(checkAppVersion,10*60*1000);
}
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
  renderQuoteHistory();
  loadCatalogue();
  setNetworkState();
}

if ('serviceWorker' in navigator) window.addEventListener('load',async()=>{
  try{
    let refreshing=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(refreshing)return;
      refreshing=true;
      window.location.reload();
    });
    const reg=await navigator.serviceWorker.register('./sw.js?v=20261005-signingate1',{updateViaCache:'none'});
    await reg.update();
  }catch(e){console.warn('Service worker update skipped',e);}
});
window.addEventListener('beforeinstallprompt', e=>{e.preventDefault();installPrompt=e;$('install-btn').hidden=false;});
window.addEventListener('appinstalled',()=>{$('install-btn').hidden=true;installPrompt=null;toast('BusterBuild Sales installed');});
async function openInstallExperience(){
  if(isStandalone()){toast('BusterBuild Sales is already installed');return;}
  if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install-btn').hidden=true;return;}
  $('install-modal').classList.add('open');
}
$('install-btn').addEventListener('click',openInstallExperience);
$('menu-install-btn')?.addEventListener('click',()=>{$('account-menu').hidden=true;openInstallExperience();});
qsa('[data-close-install]').forEach(b=>b.addEventListener('click',()=>$('install-modal').classList.remove('open')));

async function startPublicProductMode(){
  document.documentElement.classList.add('public-product-route');
  $('login-screen').hidden=true;
  $('app-shell').hidden=true;
  $('account-menu').hidden=true;
  try{
    await loadCatalogue();
  }catch(err){
    showPublicProductError('Product information could not be loaded. Please ask a BusterBuild salesperson for assistance.');
  }
}
function showPublicProductError(message){
  const box=$('public-product-loading');
  if(!box)return;
  document.documentElement.classList.remove('public-product-loaded');
  box.innerHTML=`<div class="public-loading-card"><img src="icons/icon-192.png" alt="BusterBuild"><strong>Product not found</strong><span>${esc(message)}</span></div>`;
}

async function initAuth(){
  $('firebase-setup').hidden=cfgReady;
  if(!cfgReady){
    $('firebase-setup').hidden=false;
    $('login-form').addEventListener('submit',e=>e.preventDefault());
    showLogin();
    return;
  }

  $('firebase-setup').hidden=true;
  firebaseApp=initializeApp(firebaseConfig);
  auth=getAuth(firebaseApp);
  db=getFirestore(firebaseApp);

  // Staff must sign in again when a NEW app/browser session starts.
  // A simple page refresh during the same session does not log them out.
  try{
    await setPersistence(auth,browserSessionPersistence);
  }catch(err){
    console.warn('Could not set session-only Firebase persistence',err);
  }

  const rememberedEmail=localStorage.getItem('busterbuildLastLoginEmail')||'';
  if(rememberedEmail && $('login-email')) $('login-email').value=rememberedEmail;

  $('login-form').addEventListener('submit', async e=>{
    e.preventDefault();
    $('login-error').textContent='';

    const email=$('login-email').value.trim().toLowerCase();
    const password=$('login-password').value;
    const btn=qs('button[type="submit"]',$('login-form'));

    btn.disabled=true;
    btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';

    // Set this before signIn so the auth observer knows this login was
    // deliberately performed in the CURRENT app session.
    sessionStorage.setItem('busterbuildStaffSignedIn','1');

    try{
      await signInWithEmailAndPassword(auth,email,password);
      localStorage.setItem('busterbuildLastLoginEmail',email);
    }catch(err){
      sessionStorage.removeItem('busterbuildStaffSignedIn');
      console.error('Firebase sign-in error:', err);
      $('login-error').textContent=authMessage(err);
    }finally{
      btn.disabled=false;
      btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign in';
    }
  });

  onAuthStateChanged(auth,async user=>{
    if(!user){
      currentAccess=null;
      showLogin();
      return;
    }

    // Firebase may restore a previous login. For staff security, do not
    // automatically enter the Sales App in a fresh app session.
    if(sessionStorage.getItem('busterbuildStaffSignedIn')!=='1'){
      try{await signOut(auth)}catch{}
      currentAccess=null;
      showLogin();
      if($('login-status-note')){
        $('login-status-note').innerHTML='<i class="fa-solid fa-shield-halved"></i><span>Your account is registered. Please sign in to start this sales session.</span>';
      }
      return;
    }

    try{
      currentAccess=await resolveAccess(user);

      if(!currentAccess.allowed){
        const reason=currentAccess.reason||'';
        $('login-error').textContent=reason==='no-profile-or-invite'
          ?'Your login is valid, but Sales Access has not been approved yet. Ask the administrator to add or repair your account.'
          :'This Sales App access is disabled. Please contact the administrator.';
        sessionStorage.removeItem('busterbuildStaffSignedIn');
        await signOut(auth);
        return;
      }

      const display=currentAccess.name||user.displayName||user.email?.split('@')[0]||'Sales';
      $('account-name').textContent=display.replace(/[._-]+/g,' ');
      $('account-email').textContent=user.email||'';
      $('menu-email').textContent=user.email||'';

      if($('quote-salesperson-preview')){
        $('quote-salesperson-preview').textContent=$('account-name').textContent;
      }

      const admin=currentAccess.role==='admin';
      $('manage-sales-btn').hidden=!admin;
      $('menu-role').textContent=admin?'Sales App Administrator':'Tiles & Sanitary Ware Sales';

      showApp();
      await registerSession();
      await Promise.all([loadCloudQuotes(),loadCustomers()]);
      renderMyDashboard();

      if(admin){
        loadSalesTeam();
        renderAdminDashboard(cloudQuotes);
      }

    }catch(err){
      console.error(err);
      $('login-error').textContent='Account access could not be verified. Check Firebase/Firestore setup.';
      sessionStorage.removeItem('busterbuildStaffSignedIn');
      await signOut(auth);
    }
  });

  $('logout-btn').addEventListener('click',async()=>{
    sessionStorage.removeItem('busterbuildStaffSignedIn');
    currentAccess=null;
    if($('login-password')) $('login-password').value='';
    await signOut(auth);
  });

  $('forgot-password-btn')?.addEventListener('click',async()=>{
    const email=$('login-email').value.trim().toLowerCase();

    if(!email){
      $('login-error').textContent='Enter your email address first, then press Forgot password.';
      $('login-email').focus();
      return;
    }

    const btn=$('forgot-password-btn');
    const old=btn.innerHTML;
    btn.disabled=true;
    btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Sending…';

    try{
      await sendPasswordResetEmail(auth,email);
      $('login-error').textContent='';
      $('login-status-note').innerHTML='<i class="fa-solid fa-envelope-circle-check"></i><span>Password reset email sent to '+esc(email)+'.</span>';
    }catch(err){
      console.error(err);
      $('login-error').textContent='Could not send password reset: '+authMessage(err);
    }finally{
      btn.disabled=false;
      btn.innerHTML=old;
    }
  });

  $('toggle-login-password')?.addEventListener('click',()=>{
    const input=$('login-password');
    const showing=input.type==='text';
    input.type=showing?'password':'text';
    $('toggle-login-password').innerHTML=showing
      ?'<i class="fa-regular fa-eye"></i>'
      :'<i class="fa-regular fa-eye-slash"></i>';
  });
}
async function resolveAccess(user){
  const adminEmail=String(salesAppConfig.adminEmail||'').trim().toLowerCase();
  const email=String(user.email||'').trim().toLowerCase();

  if(adminEmail && !adminEmail.includes('REPLACE_') && email===adminEmail){
    return {allowed:true,role:'admin',name:user.displayName||'Administrator',active:true};
  }

  // Normal linked profile.
  const profileRef=doc(db,'salesUsers',user.uid);
  const profileSnap=await getDoc(profileRef);
  if(profileSnap.exists()){
    const profile=profileSnap.data()||{};
    const allowed=profile.active!==false
      && profile.role==='sales'
      && profile.department==='tiles-sanitary';
    return {...profile,allowed};
  }

  // Repair path for an Authentication user created during an earlier failed attempt.
  // Only an email explicitly approved by the administrator can self-link.
  const inviteRef=doc(db,'salesInvites',email);
  const inviteSnap=await getDoc(inviteRef);

  if(!inviteSnap.exists()) return {allowed:false,reason:'no-profile-or-invite'};

  const invite=inviteSnap.data()||{};
  const approved=invite.active!==false
    && invite.role==='sales'
    && invite.department==='tiles-sanitary';

  if(!approved) return {...invite,allowed:false,reason:'invite-disabled'};

  const profile={
    name:invite.name||user.displayName||email.split('@')[0],
    email,
    role:'sales',
    department:'tiles-sanitary',
    active:true,
    invitedBy:invite.createdBy||'',
    invitedByEmail:invite.createdByEmail||'',
    linkedAt:new Date().toISOString()
  };

  // Link the signed-in Firebase UID to the administrator-approved invitation.
  await setDoc(profileRef,{
    ...profile,
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  },{merge:true});

  await setDoc(inviteRef,{
    uid:user.uid,
    linked:true,
    linkedAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  },{merge:true});

  return {...profile,allowed:true,repaired:true};
}

async function registerSession(){
  if(!db||!auth?.currentUser)return;
  const u=auth.currentUser;
  const payload={
    uid:u.uid,email:u.email||'',name:currentUserName(),role:currentAccess?.role||'sales',
    lastLogin:new Date().toISOString(),lastActive:new Date().toISOString(),
    userAgent:navigator.userAgent,platform:navigator.platform||'',standalone:isStandalone()
  };
  try{
    await setDoc(doc(db,'sessions',u.uid),payload,{merge:true});
    if(currentAccess?.role==='sales'){
      await updateDoc(doc(db,'salesUsers',u.uid),{
        lastLogin:payload.lastLogin,
        lastActive:payload.lastActive,
        lastDevice:payload.platform||'Mobile/Web'
      }).catch(()=>{});
      const email=String(u.email||'').trim().toLowerCase();
      if(email)await setDoc(doc(db,'salesInvites',email),{
        uid:u.uid,
        linked:true,
        lastLogin:payload.lastLogin,
        lastActive:payload.lastActive,
        lastDevice:payload.platform||'Mobile/Web',
        updatedAt:serverTimestamp()
      },{merge:true}).catch(()=>{});
    }
  }catch{}
  clearInterval(sessionHeartbeat);
  sessionHeartbeat=setInterval(touchSession,5*60*1000);
}
async function touchSession(){
  if(!db||!auth?.currentUser||!navigator.onLine)return;
  const stamp=new Date().toISOString();
  try{
    await updateDoc(doc(db,'sessions',auth.currentUser.uid),{lastActive:stamp,standalone:isStandalone()});
    if(currentAccess?.role==='sales'){
      await updateDoc(doc(db,'salesUsers',auth.currentUser.uid),{lastActive:stamp}).catch(()=>{});
    }
  }catch{}
}
async function logAudit(action,details={}){
  if(!db||!auth?.currentUser||!navigator.onLine)return;
  const id=`${Date.now()}_${auth.currentUser.uid}_${Math.random().toString(36).slice(2,7)}`;
  try{
    await setDoc(doc(db,'auditLogs',id),{
      action,details,ownerUid:auth.currentUser.uid,ownerEmail:auth.currentUser.email||'',salesperson:currentUserName(),
      createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()
    });
  }catch{}
}

function authMessage(err){
  const c=err?.code||'unknown';
  const m=err?.message||'';
  if(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')) return 'Incorrect email address or password. If this salesperson was repaired from an earlier account, use the password reset email to set a new password first.';
  if(c.includes('too-many-requests')) return `Too many attempts. Please wait and try again. (${c})`;
  if(c.includes('network')) return `Network error. Check the connection. (${c})`;
  if(c.includes('operation-not-allowed')) return `Email/password sign-in is not enabled in Firebase. (${c})`;
  if(c.includes('unauthorized-domain')) return `This GitHub Pages domain is not authorised in Firebase. (${c})`;
  if(c.includes('invalid-api-key')) return `The Firebase API key in firebase-config.js is invalid. (${c})`;
  if(c.includes('configuration-not-found')) return `Firebase Authentication configuration was not found for this project. (${c})`;
  return `Firebase sign-in error: ${c}${m ? ' — '+m.replace(/^Firebase:\s*/,'') : ''}`;
}
if(publicProductMode) startPublicProductMode(); else initAuth();

$('account-btn').addEventListener('click',()=>{$('account-menu').hidden=!$('account-menu').hidden;});
document.addEventListener('click',e=>{if(!$('account-menu').hidden && !e.target.closest('#account-menu') && !e.target.closest('#account-btn'))$('account-menu').hidden=true;});


$('manage-sales-btn').addEventListener('click',async()=>{ $('account-menu').hidden=true; showView('admin'); loadSalesTeam(); await loadCloudQuotes(); renderAdminDashboard(cloudQuotes); });
$('customers-menu-btn')?.addEventListener('click',()=>{$('account-menu').hidden=true;showView('customers')});
$('my-dashboard-menu-btn')?.addEventListener('click',()=>{$('account-menu').hidden=true;showView('my-dashboard')});
$('combo-builder-menu-btn')?.addEventListener('click',()=>{$('account-menu').hidden=true;showView('combo-builder')});
$('help-menu-btn')?.addEventListener('click',()=>{$('account-menu').hidden=true;showView('help')});

$('add-sales-form').addEventListener('submit',createSalesAccount);
async function createSalesAccount(e){
  e.preventDefault();

  if(currentAccess?.role!=='admin'){
    toast('Administrator access required');
    return;
  }

  const name=$('sales-name').value.trim();
  const email=$('sales-email').value.trim().toLowerCase();
  const password=$('sales-password').value;
  const status=$('sales-create-status');
  const btn=$('create-sales-btn');

  status.textContent='';
  status.className='admin-status';

  if(!name||!email||password.length<6){
    status.textContent='Enter a name, valid email and a temporary password of at least 6 characters.';
    status.classList.add('error');
    return;
  }

  btn.disabled=true;
  btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Creating salesperson…';

  const inviteRef=doc(db,'salesInvites',email);
  let secondaryAuth=null;

  try{
    // 1. Approve the email first. This makes existing/partial Firebase Auth accounts repairable.
    await setDoc(inviteRef,{
      name,
      email,
      role:'sales',
      department:'tiles-sanitary',
      active:true,
      linked:false,
      createdBy:auth.currentUser?.uid||'',
      createdByEmail:auth.currentUser?.email||'',
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    },{merge:true});

    // 2. Create the Firebase Authentication login without signing the admin out.
    const secondaryName='salesCreator';
    const existing=getApps().find(x=>x.name===secondaryName);
    const secondary=existing||initializeApp(firebaseConfig,secondaryName);
    secondaryAuth=getAuth(secondary);

    try{
      const cred=await createUserWithEmailAndPassword(secondaryAuth,email,password);
      const createdUser=cred.user;
      await updateProfile(createdUser,{displayName:name});

      // Link immediately for a brand-new user.
      await setDoc(doc(db,'salesUsers',createdUser.uid),{
        name,
        email,
        role:'sales',
        department:'tiles-sanitary',
        active:true,
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp(),
        createdBy:auth.currentUser?.uid||'',
        createdByEmail:auth.currentUser?.email||''
      },{merge:true});

      await setDoc(inviteRef,{
        uid:createdUser.uid,
        linked:true,
        linkedAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      },{merge:true});

      status.innerHTML=`<strong>${name} has been added successfully.</strong><br>
        This is a new Firebase login, so the temporary password you entered is active and can be used to sign in now.`;
      status.classList.add('success');
      toast('Sales account created');

    }catch(authErr){
      const code=String(authErr?.code||'');

      if(code.includes('email-already-in-use')){
        // Firebase cannot overwrite an existing user's password with the temporary
        // password typed in this form. Send a reset link automatically instead.
        let resetSent=false;
        try{
          await sendPasswordResetEmail(auth,email);
          resetSent=true;
        }catch(resetErr){
          console.error('Automatic password reset email failed',resetErr);
        }

        status.innerHTML=resetSent
          ? `<strong>${name}'s existing login has been repaired.</strong><br>
             The temporary password entered here was <strong>not</strong> applied because this email already existed.
             A password reset email has been sent to <strong>${esc(email)}</strong>.
             Ask ${name} to open that email, choose a new password, then sign in.`
          : `<strong>${name}'s existing login has been repaired.</strong><br>
             The temporary password entered here was <strong>not</strong> applied because this email already existed.
             Use the key button next to the salesperson to send a password reset email.`;

        status.classList.add('success');
        toast(resetSent?'Password reset email sent':'Existing login repaired');
      }else{
        // Do not leave an approval behind when Auth creation itself fails.
        try{await deleteDoc(inviteRef)}catch{}
        throw authErr;
      }
    }

    $('add-sales-form').reset();
    await logAudit('sales_access_approved',{name,email});
    await loadSalesTeam();

  }catch(err){
    console.error('Create salesperson failed',err);
    const code=String(err?.code||'');
    const message=String(err?.message||'');

    if(code.includes('permission-denied')){
      status.innerHTML='Firebase is blocking the Sales Access setup. Publish the included <strong>firestore.rules</strong> in Firebase Console → Firestore Database → Rules, then try again.';
    }else if(code.includes('weak-password')){
      status.textContent='Temporary password must be at least 6 characters.';
    }else if(code.includes('invalid-email')){
      status.textContent='Enter a valid email address.';
    }else if(code.includes('network-request-failed')){
      status.textContent='Internet connection failed. Check the connection and try again.';
    }else{
      status.textContent='Could not create salesperson: '+(message||code||'Unknown error');
    }
    status.classList.add('error');

  }finally{
    if(secondaryAuth){
      try{await signOut(secondaryAuth)}catch{}
    }
    btn.disabled=false;
    btn.innerHTML='<i class="fa-solid fa-user-plus"></i> Create Sales Account';
  }
}



async function testSalesUserPermissions(){
  if(currentAccess?.role!=='admin'){
    toast('Administrator access required');
    return;
  }

  const status=$('sales-create-status');
  status.textContent='Testing Firebase Sales Access…';
  status.className='admin-status';

  const email='permission-test@busterbuild.local';
  const inviteRef=doc(db,'salesInvites',email);
  const profileRef=doc(db,'salesUsers','__busterbuild_permission_test__');

  try{
    await setDoc(inviteRef,{
      name:'Permission Test',
      email,
      role:'sales',
      department:'tiles-sanitary',
      active:false,
      createdBy:auth.currentUser?.uid||'',
      createdByEmail:auth.currentUser?.email||'',
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });

    await setDoc(profileRef,{
      name:'Permission Test',
      email,
      role:'sales',
      department:'tiles-sanitary',
      active:false,
      createdBy:auth.currentUser?.uid||'',
      createdAt:serverTimestamp()
    });

    const [a,b]=await Promise.all([getDoc(inviteRef),getDoc(profileRef)]);
    if(!a.exists()||!b.exists())throw new Error('Firebase test records could not be read.');

    await Promise.all([deleteDoc(inviteRef),deleteDoc(profileRef)]);

    status.textContent='Firebase access is correct. Sales logins can be created and repaired.';
    status.classList.add('success');
    toast('Firebase Sales Access OK');

  }catch(err){
    console.error('Firebase Sales Access test failed',err);
    status.innerHTML='Firebase rules are not ready. Publish the included <strong>firestore.rules</strong>, then press Test Firebase Access again.';
    status.classList.add('error');
  }
}
$('test-sales-permissions')?.addEventListener('click',testSalesUserPermissions);

function exportQuotationsCsv(){
  const rows=[['Date','Quote','Status','Customer','WhatsApp','Salesperson','Subtotal','Discount %','Total','Official Reference']];
  cloudQuotes.forEach(q=>rows.push([q.updatedAt||q.date||'',q.number||q.id||'',quoteStatusLabel(q.status||'draft'),q.customer?.name||'',q.customer?.phone||'',q.salesperson||'',q.subtotal??q.total??0,q.discountPct||0,q.total||0,q.officialReference||'']));
  csvDownload(`busterbuild-quotations-${new Date().toISOString().slice(0,10)}.csv`,rows);logAudit('export_quotes_csv',{count:cloudQuotes.length})
}
function exportCustomersCsv(){
  const rows=[['Name','Company','WhatsApp','Email','Salesperson','Updated']];
  cloudCustomers.forEach(c=>rows.push([c.name||'',c.company||'',c.phone||'',c.email||'',c.salesperson||'',c.updatedAt||'']));
  csvDownload(`busterbuild-customers-${new Date().toISOString().slice(0,10)}.csv`,rows);logAudit('export_customers_csv',{count:cloudCustomers.length})
}

function renderAdminDashboard(rows=cloudQuotes){
  if(currentAccess?.role!=='admin')return;
  const quotes=[...(rows||[])].sort((a,b)=>new Date(b.updatedAt||b.date||0)-new Date(a.updatedAt||a.date||0));
  const today=new Date().toDateString();
  const todayQuotes=quotes.filter(q=>new Date(q.updatedAt||q.date||0).toDateString()===today);
  const confirmed=quotes.filter(q=>q.status==='confirmed'),converted=quotes.filter(q=>q.status==='converted');
  const sum=arr=>Number(arr.reduce((s,q)=>s+Number(q.total||0),0).toFixed(2));
  $('dash-today-count').textContent=todayQuotes.length;$('dash-today-value').textContent=money(sum(todayQuotes));$('dash-confirmed-value').textContent=money(sum(confirmed));$('dash-converted-value').textContent=money(sum(converted));

  const byRep=new Map();
  quotes.forEach(q=>{const key=q.salesEmail||q.salesperson||'Unknown';const row=byRep.get(key)||{name:q.salesperson||key,email:q.salesEmail||'',quotes:0,value:0,confirmed:0,converted:0};row.quotes++;row.value+=Number(q.total||0);if(q.status==='confirmed')row.confirmed+=Number(q.total||0);if(q.status==='converted')row.converted+=Number(q.total||0);byRep.set(key,row)});
  const repBody=$('rep-performance-body');
  if(repBody)repBody.innerHTML=[...byRep.values()].sort((a,b)=>b.value-a.value).map(r=>`<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.email)}</small></td><td>${r.quotes}</td><td>${money(r.value)}</td><td>${money(r.confirmed)}</td><td>${money(r.converted)}</td></tr>`).join('')||'<tr><td colspan="5">No quotation activity yet.</td></tr>';

  const list=$('admin-activity-list');if(!list)return;
  if(!quotes.length){list.innerHTML='<div class="team-empty"><i class="fa-solid fa-chart-line"></i><strong>No quotation activity yet</strong><span>Cloud quotations will appear here as the sales team saves them.</span></div>';return}
  list.innerHTML='';
  quotes.slice(0,12).forEach(q=>{const c=q.customer||{};const el=document.createElement('div');el.className='activity-row';el.innerHTML=`<div><strong>${esc(c.name||'Customer')}</strong><span>${esc(q.salesperson||q.salesEmail||'Sales')}</span></div><div class="activity-meta"><span class="quote-status-badge ${quoteStatusClass(q.status||'draft')}">${esc(quoteStatusLabel(q.status||'draft'))}</span><strong>${money(q.total||0)}</strong><small>${new Date(q.updatedAt||q.date||Date.now()).toLocaleString('en-ZA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div>`;list.appendChild(el)})
}
function renderMyDashboard(){
  const view=$('my-dashboard-view');if(!view)return;
  const uid=auth?.currentUser?.uid;
  const rows=quoteHistory.filter(q=>!uid||q.ownerUid===uid);
  const sum=a=>Number(a.reduce((s,q)=>s+Number(q.total||0),0).toFixed(2));
  const today=new Date().toDateString(),todayRows=rows.filter(q=>new Date(q.updatedAt||q.date||0).toDateString()===today);
  $('my-quotes-today').textContent=todayRows.length;$('my-value-today').textContent=money(sum(todayRows));
  $('my-confirmed-value').textContent=money(sum(rows.filter(q=>q.status==='confirmed')));$('my-converted-value').textContent=money(sum(rows.filter(q=>q.status==='converted')));
  const sent=rows.filter(q=>q.status==='sent'),converted=rows.filter(q=>q.status==='converted');
  $('my-conversion-rate').textContent=sent.length?Math.round(converted.length/sent.length*100)+'%':'0%';
  const follow=$('my-followups');if(follow){const due=rows.filter(q=>q.status==='sent'&&daysSince(q.updatedAt||q.date)>=2);follow.innerHTML=due.map(q=>`<button type="button" data-my-follow="${esc(q.id)}"><span>${esc(q.customer?.name||'Customer')}</span><strong>${money(q.total||0)}</strong><small>${daysSince(q.updatedAt||q.date)} days waiting</small></button>`).join('')||'<span class="muted-small">No follow-ups due.</span>';qsa('[data-my-follow]',follow).forEach(b=>b.onclick=()=>{const q=quoteHistory.find(x=>x.id===b.dataset.myFollow);if(q)followUpQuote(q)})}
}
async function loadSalesTeam(){
  if(currentAccess?.role!=='admin'||!db)return;

  const list=$('sales-team-list');
  list.innerHTML='<div class="team-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading sales accounts…</div>';

  try{
    const [profilesSnap,invitesSnap]=await Promise.all([
      getDocs(collection(db,'salesUsers')),
      getDocs(collection(db,'salesInvites'))
    ]);

    const byEmail=new Map();

    invitesSnap.forEach(d=>{
      const row={id:d.id,...d.data(),inviteId:d.id};
      const email=String(row.email||d.id).toLowerCase();
      byEmail.set(email,row);
    });

    profilesSnap.forEach(d=>{
      const p={id:d.id,...d.data(),uid:d.id};
      const email=String(p.email||'').toLowerCase();
      const existing=byEmail.get(email)||{};
      byEmail.set(email,{...existing,...p,uid:d.id,profile:true});
    });

    const rows=[...byEmail.values()].sort((a,b)=>String(a.name||a.email).localeCompare(String(b.name||b.email)));
    $('sales-team-count').textContent=rows.length;

    if(!rows.length){
      list.innerHTML='<div class="team-empty"><i class="fa-solid fa-users"></i><strong>No sales accounts yet</strong><span>Add the first salesperson using the form.</span></div>';
      return;
    }

    list.innerHTML='';

    rows.forEach(row=>{
      const email=String(row.email||row.inviteId||'').toLowerCase();
      const active=row.active!==false;
      const linked=Boolean(row.uid||row.profile||row.linked);
      const last=row.lastActive
        ?new Date(row.lastActive).toLocaleString('en-ZA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
        :'No activity yet';

      const el=document.createElement('div');
      el.className='team-user'+(!active?' inactive':'');

      el.innerHTML=`
        <span class="team-avatar"><i class="fa-solid fa-user"></i></span>
        <div class="team-user-copy">
          <strong>${esc(row.name||'Salesperson')}</strong>
          <span>${esc(email)}</span>
          <small>${active?'ACTIVE':'ACCESS DISABLED'} • ${linked?'LOGIN LINKED':'ACCESS APPROVED — LOGIN WILL LINK ON SIGN-IN'} • LAST: ${esc(last)}</small>
        </div>
        <div class="team-actions">
          <button data-repair type="button" title="Repair sales access"><i class="fa-solid fa-screwdriver-wrench"></i></button>
          <button data-reset type="button" title="Send password reset"><i class="fa-solid fa-key"></i></button>
          <button data-toggle type="button" class="${!active?'enable':''}" title="${!active?'Enable access':'Disable access'}">
            <i class="fa-solid ${!active?'fa-user-check':'fa-user-slash'}"></i>
          </button>
        </div>`;

      qs('[data-repair]',el).onclick=async()=>{
        try{
          await setDoc(doc(db,'salesInvites',email),{
            name:row.name||email.split('@')[0],
            email,
            role:'sales',
            department:'tiles-sanitary',
            active:true,
            createdBy:auth.currentUser?.uid||'',
            createdByEmail:auth.currentUser?.email||'',
            updatedAt:serverTimestamp()
          },{merge:true});
          toast('Sales access repaired — ask them to sign in again');
          loadSalesTeam();
        }catch(err){
          console.error(err);
          toast('Could not repair access');
        }
      };

      qs('[data-reset]',el).onclick=async()=>{
        try{
          await sendPasswordResetEmail(auth,email);
          toast('Password reset email sent — use that link to choose a new password');
        }catch(err){
          console.error(err);
          toast('Could not send password reset');
        }
      };

      qs('[data-toggle]',el).onclick=async()=>{
        const next=!active;
        if(!next&&!confirm(`Disable ${row.name||email}'s sales access?`))return;

        try{
          await setDoc(doc(db,'salesInvites',email),{
            name:row.name||email.split('@')[0],
            email,
            role:'sales',
            department:'tiles-sanitary',
            active:next,
            updatedAt:serverTimestamp()
          },{merge:true});

          if(row.uid){
            await updateDoc(doc(db,'salesUsers',row.uid),{
              active:next,
              updatedAt:serverTimestamp()
            }).catch(()=>{});
          }

          toast(next?'Sales access enabled':'Sales access disabled');
          loadSalesTeam();
        }catch(err){
          console.error(err);
          toast('Could not update salesperson access');
        }
      };

      list.appendChild(el);
    });

  }catch(err){
    console.error('Load sales accounts failed',err);
    list.innerHTML='<div class="team-empty error"><i class="fa-solid fa-triangle-exclamation"></i><strong>Could not load sales accounts</strong><span>Publish the included Firestore rules, then reload this screen.</span></div>';
  }
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
    updateCatalogueTimestamp([
      tiles.status==='fulfilled'?tiles.value.generated_at:null,
      combos.status==='fulfilled'?combos.value.generated_at:null,
      sanitary.status==='fulfilled'?sanitary.value.generated_at:null
    ]);
    products=[...tileRows.map(p=>normalise(p,'tile')),...sanitaryRows.map(p=>normalise(p,'sanitary')),...comboRows.map(p=>normalise(p,'combo'))];
    const byKey=new Map(); products.forEach(p=>byKey.set((p._type+'|'+(p._code||p.id||p._name)).toLowerCase(),p)); products=[...byKey.values()];
    $('tile-count').textContent=products.filter(p=>p._type==='tile').length;
    $('sanitary-count').textContent=products.filter(p=>p._type==='sanitary').length;
    $('combo-count').textContent=products.filter(p=>p._type==='combo').length;
    $('catalogue-status').style.display='none';
    render();
    handleProductQuery();
  }catch(err){
    $('catalogue-status').innerHTML='<i class="fa-solid fa-triangle-exclamation"></i><strong> Catalogue could not load.</strong><br><button id="retry-catalogue" class="secondary-btn compact" type="button"><i class="fa-solid fa-rotate"></i> Retry catalogue</button>';
    $('retry-catalogue')?.addEventListener('click',()=>{products=[];loadCatalogue();});
  }
}
function render(){
  const term=$('product-search').value.trim().toLowerCase();
  filtered=products.filter(p=>{
    const filterOk=currentFilter==='all'||p._type===currentFilter||(currentFilter==='favourites'&&isFavourite(p));
    return filterOk&&(!term||p._name.toLowerCase().includes(term)||p._code.toLowerCase().includes(term));
  });
  const grid=$('product-grid'); grid.innerHTML='';
  if(!filtered.length){ grid.innerHTML='<div class="status-card" style="grid-column:1/-1">No matching products found.</div>'; return; }
  const frag=document.createDocumentFragment();
  filtered.forEach(p=>{
    const key=productKey(p);
    const card=document.createElement('article'); card.className='product-card';
    card.innerHTML=`<div class="product-image">
      <button class="fav-btn ${isFavourite(p)?'active':''}" type="button" title="Favourite"><i class="${isFavourite(p)?'fa-solid':'fa-regular'} fa-star"></i></button>
      <label class="compare-check"><input type="checkbox" ${compareKeys.includes(key)?'checked':''}><span>Compare</span></label>
      <img loading="lazy" referrerpolicy="no-referrer" src="${esc(p._image)}" alt="${esc(p._name)}" onerror="this.onerror=null;this.src='../pictures/tiles and sanitary hero.jpeg'">
    </div><div class="product-card-body"><span class="product-kind">${typeLabel(p._type)}</span><h3>${esc(p._name)}</h3><span class="card-code">CODE: ${esc(p._code||'—')}</span><div class="card-price">${money(p._price)}${isPerSqm(p)?'<small>per m²</small>':''}</div><button class="view-btn" type="button"><i class="fa-regular fa-eye"></i> View Details</button></div>`;
    qs('.view-btn',card).onclick=()=>openProduct(p);
    qs('.fav-btn',card).onclick=e=>{e.stopPropagation();toggleFavourite(p)};
    qs('.compare-check input',card).onchange=e=>toggleCompare(key,e.target.checked);
    frag.appendChild(card);
  }); grid.appendChild(frag);
  updateCompareTray();
}
function renderRecentProducts(){
  const wrap=$('recent-products');if(!wrap)return;
  const rows=recentProducts.map(getProductByKey).filter(Boolean).slice(0,8);
  wrap.hidden=!rows.length;
  const scroller=$('recent-products-list');if(!scroller)return;
  scroller.innerHTML=rows.map(p=>`<button class="recent-product" type="button" data-key="${esc(productKey(p))}"><img src="${esc(p._image)}" alt=""><span>${esc(p._name)}</span><strong>${money(p._price)}</strong></button>`).join('');
  qsa('[data-key]',scroller).forEach(b=>b.onclick=()=>{const p=getProductByKey(b.dataset.key);if(p)openProduct(p)});
}
function toggleCompare(key,checked){
  if(checked){
    if(compareKeys.length>=3){toast('Compare up to 3 products');render();return}
    if(!compareKeys.includes(key))compareKeys.push(key);
  }else compareKeys=compareKeys.filter(x=>x!==key);
  updateCompareTray();
}
function updateCompareTray(){
  const tray=$('compare-tray');if(!tray)return;
  tray.hidden=compareKeys.length<2;
  $('compare-count').textContent=compareKeys.length;
}
function openComparison(){
  const rows=compareKeys.map(getProductByKey).filter(Boolean);
  if(rows.length<2){toast('Select at least 2 products');return}
  const body=$('compare-table-body');
  body.innerHTML=rows.map(p=>`<article class="compare-card">
    <img src="${esc(p._image)}" alt="">
    <span>${typeLabel(p._type)}</span><h3>${esc(p._name)}</h3><small>${esc(p._code||'—')}</small>
    <strong>${money(p._price)}${isPerSqm(p)?'/m²':''}</strong>
    <dl><div><dt>m² / box</dt><dd>${p._sqm?formatNumber(p._sqm):'—'}</dd></div><div><dt>Tiles / box</dt><dd>${p._tilesPerBox||'—'}</dd></div></dl>
    <button class="primary-btn compact" type="button" data-compare-open="${esc(productKey(p))}">View product</button>
  </article>`).join('');
  qsa('[data-compare-open]',body).forEach(b=>b.onclick=()=>{closeComparison();const p=getProductByKey(b.dataset.compareOpen);if(p)openProduct(p)});
  $('compare-modal').classList.add('open');
}
function closeComparison(){$('compare-modal').classList.remove('open')}

function typeLabel(t){return t==='tile'?'TILE':t==='combo'?'COMBO DEAL':'SANITARY WARE';}
$('product-search').addEventListener('input',render);
qsa('.filter-chip').forEach(b=>b.addEventListener('click',()=>{qsa('.filter-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentFilter=b.dataset.filter;render();}));

function openProduct(p){
  selectedProduct=p;
  addRecentProduct(p);
  $('product-type').textContent=typeLabel(p._type);
  $('product-title').textContent=p._name;
  $('product-code').textContent='Code: '+(p._code||'—');
  $('product-image').src=p._image;
  $('product-image').alt=p._name;
  $('product-price').innerHTML=money(p._price)+(isPerSqm(p)?'<small>per m²</small>':'');
  $('product-description').textContent=p._description||defaultDescription(p._type);
  renderSpecs(p);

  const measure=$('smart-measure');
  measure.hidden=!(p._type==='tile'&&p._sqm>0);
  $('room-length').value='';
  $('room-width').value='';
  if($('room-name'))$('room-name').value='';
  if($('tile-layout'))$('tile-layout').value='straight';
  if($('waste-allowance'))$('waste-allowance').value='5';
  resetMeasure();
  renderProjectRooms();
  $('box-note').textContent=p._sqm?`${p._tilesPerBox?formatNumber(p._tilesPerBox)+' tiles per box • ':''}${formatNumber(p._sqm)} m² per box. Calculator rounds up to full boxes.`:'';

  const buyPanel=qs('.buy-panel');
  const useQtyButton=$('use-boxes');
  const closeButton=qs('.sheet-close');

  const qtyBlock=qs('.qty-block');
  if(buyPanel)buyPanel.classList.remove('smart-active');
  if(qtyBlock)qtyBlock.hidden=false;

  if(publicProductMode){
    // Customer QR view: product information + Smart Measure only.
    if(buyPanel) buyPanel.hidden=true;
    if($('public-product-actions'))$('public-product-actions').hidden=false;
    if(useQtyButton) useQtyButton.hidden=true;
    if(closeButton) closeButton.hidden=true;
    document.documentElement.classList.add('public-product-loaded');
  }else{
    if(buyPanel) buyPanel.hidden=false;
    if($('public-product-actions'))$('public-product-actions').hidden=true;
    // Smart Measure now applies the required m² automatically — no second button is needed.
    if(useQtyButton) useQtyButton.hidden=true;
    if(closeButton) closeButton.hidden=false;
    const tileSqmQty=(p._type==='tile'&&isPerSqm(p));
    $('qty-label').textContent=tileSqmQty?'Quantity (m²)':'Quantity';
    $('product-qty').min=tileSqmQty?'0.01':'1';
    $('product-qty').step=tileSqmQty?'0.01':'1';
    $('product-qty').value=1;
    $('add-cart').disabled=!p._price;
    $('add-cart').innerHTML=p._price?'<i class="fa-solid fa-cart-plus"></i><span>Add to Cart</span>':'<span>Price unavailable</span>';
  }

  $('product-modal').classList.add('open');
  $('product-modal').setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}

$('public-share-product')?.addEventListener('click',async()=>{
  if(!selectedProduct)return;const text=`BusterBuild: ${selectedProduct._name}\nCode: ${selectedProduct._code||'—'}\nPrice: ${money(selectedProduct._price)}${isPerSqm(selectedProduct)?'/m²':''}`;
  try{if(navigator.share)await navigator.share({title:selectedProduct._name,text,url:location.href});else{await navigator.clipboard.writeText(text+'\n'+location.href);toast('Product link copied')}}catch{}
});
$('public-copy-code')?.addEventListener('click',async()=>{if(!selectedProduct)return;try{await navigator.clipboard.writeText(selectedProduct._code||selectedProduct._name);toast('Product code copied')}catch{}});

function closeProduct(){
  if(publicProductMode)return;
  $('product-modal').classList.remove('open');
  $('product-modal').setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}
qsa('[data-close-product]').forEach(b=>b.addEventListener('click',closeProduct));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!publicProductMode)closeProduct();});
function defaultDescription(type){return type==='combo'?'Complete BusterBuild combo deal. Review the included items and product specifications below.':type==='sanitary'?'BusterBuild sanitary ware product for bathroom installations and upgrades.':'BusterBuild tile product. Use Smart Measure to calculate the required area and recommended boxes.';}
function renderSpecs(p){
  const specs=[...p._attrs];
  if(p._sqm&&!specs.some(a=>/square/i.test(a.name)))specs.push({name:'Square metres per box',value:formatNumber(p._sqm)+' m²'});
  if(p._tilesPerBox&&!specs.some(a=>/quantity|tiles per/i.test(a.name)))specs.push({name:'Tiles per box',value:formatNumber(p._tilesPerBox)});
  $('product-specs').innerHTML=specs.slice(0,12).map(a=>`<div class="spec"><strong>${esc(a.name)}</strong>${esc(a.value)}</div>`).join('');
}
function formatNumber(n){return Number(n||0).toLocaleString('en-ZA',{maximumFractionDigits:2});}

$('qty-minus').onclick=()=>{
  const tile=selectedProduct&&isPerSqm(selectedProduct);
  const min=tile?0.01:1;
  const cur=Number($('product-qty').value)||min;
  $('product-qty').value=Math.max(min,cur-1).toFixed(tile?2:0);
};
$('qty-plus').onclick=()=>{
  const tile=selectedProduct&&isPerSqm(selectedProduct);
  const cur=Number($('product-qty').value)||(tile?0:1);
  $('product-qty').value=(cur+1).toFixed(tile?2:0);
};

$('add-cart').onclick=()=>{
  if(!selectedProduct)return;
  const tile=isPerSqm(selectedProduct);
  const key=cartKey(selectedProduct);

  // If Smart Measure has a valid result, its m² and estimated total ALWAYS win.
  if(tile&&smartMeasureState.productKey===key&&smartMeasureState.area>0){
    addSmartMeasureToCart(selectedProduct,smartMeasureState);
    toast(`${formatNumber(smartMeasureState.area)} m² added • ${money(smartMeasureState.total)}`);
  }else{
    const qty=Math.max(tile?0.01:1,Number($('product-qty').value)||(tile?1:1));
    addToCart(selectedProduct,qty);
  }
  closeProduct();
};

['room-length','room-width'].forEach(id=>$(id).addEventListener('input',calculateMeasure));
$('tile-layout')?.addEventListener('change',syncWasteFromLayout);
$('waste-allowance')?.addEventListener('change',calculateMeasure);
$('save-room-btn')?.addEventListener('click',saveCurrentRoom);
$('use-project-rooms')?.addEventListener('click',useProjectRooms);

// Kept only for compatibility with the existing HTML; no longer needed by staff.
$('use-boxes').onclick=()=>{};

function resetMeasure(){
  smartMeasureState={productKey:'',area:0,boxes:0,cover:0,total:0};
  $('required-area').textContent='0.00 m²';
  $('boxes-order').textContent='0';
  $('covered-area').textContent='0.00 m²';
  $('measure-total').textContent='R0,00';
  if($('measure-base-note'))$('measure-base-note').textContent='';
  if($('accessory-suggestions'))$('accessory-suggestions').hidden=true;

  const buyPanel=qs('.buy-panel');
  const qtyBlock=qs('.qty-block');
  if(buyPanel)buyPanel.classList.remove('smart-active');
  if(qtyBlock)qtyBlock.hidden=false;

  if(selectedProduct&&!publicProductMode&&$('add-cart')){
    const tileSqmQty=(selectedProduct._type==='tile'&&isPerSqm(selectedProduct));
    $('qty-label').textContent=tileSqmQty?'Quantity (m²)':'Quantity';
    $('product-qty').readOnly=false;
    $('qty-minus').disabled=false;
    $('qty-plus').disabled=false;
    $('add-cart').innerHTML=selectedProduct._price
      ?'<i class="fa-solid fa-cart-plus"></i><span>Add to Cart</span>'
      :'<span>Price unavailable</span>';
  }
}

function layoutWaste(layout){
  return layout==='diagonal'?10:layout==='herringbone'?15:5;
}
function syncWasteFromLayout(){
  const layout=$('tile-layout')?.value||'straight';
  const suggested=layoutWaste(layout);
  if($('waste-allowance'))$('waste-allowance').value=String(suggested);
  calculateMeasure();
}
function calculateMeasure(){
  if(!selectedProduct||!selectedProduct._sqm)return resetMeasure();

  const l=Number($('room-length').value)||0;
  const w=Number($('room-width').value)||0;
  const baseArea=Number((l*w).toFixed(2));
  const layout=$('tile-layout')?.value||'straight';
  const wastePct=Number($('waste-allowance')?.value||0);
  const area=Number((baseArea*(1+wastePct/100)).toFixed(2));

  if(area<=0){
    resetMeasure();
    return;
  }

  const boxes=Math.ceil(area/selectedProduct._sqm);
  const cover=Number((boxes*selectedProduct._sqm).toFixed(2));
  const total=Number((area*selectedProduct._price).toFixed(2));

  smartMeasureState={productKey:cartKey(selectedProduct),baseArea,area,boxes,cover,total,wastePct,layout};

  $('required-area').textContent=area.toFixed(2)+' m²';
  $('boxes-order').textContent=String(boxes);
  $('covered-area').textContent=cover.toFixed(2)+' m²';
  $('measure-total').textContent=money(total);
  $('measure-base-note').textContent=`Room area ${baseArea.toFixed(2)} m² + ${wastePct}% waste • ${layout==='straight'?'Straight lay':layout==='diagonal'?'Diagonal':'Herringbone'}`;

  if(!publicProductMode){
    $('qty-label').textContent='Quantity (m²)';
    $('product-qty').min='0.01';
    $('product-qty').step='0.01';
    $('product-qty').value=area.toFixed(2);
    $('product-qty').readOnly=true;
    $('qty-minus').disabled=true;
    $('qty-plus').disabled=true;
    const buyPanel=qs('.buy-panel');const qtyBlock=qs('.qty-block');
    if(buyPanel)buyPanel.classList.remove('smart-active');
    if(qtyBlock)qtyBlock.hidden=false;
    $('add-cart').innerHTML='<i class="fa-solid fa-cart-plus"></i><span>Add '+area.toFixed(2)+' m² to Cart • '+money(total)+'</span>';
  }
  renderAccessorySuggestions(area);
}
function saveCurrentRoom(){
  if(!selectedProduct||smartMeasureState.area<=0){toast('Enter room measurements first');return}
  const roomName=$('room-name').value.trim()||`Room ${projectRooms.length+1}`;
  const room={
    id:Date.now(),productKey:productKey(selectedProduct),productName:selectedProduct._name,
    roomName,baseArea:smartMeasureState.baseArea,area:smartMeasureState.area,boxes:smartMeasureState.boxes,
    cover:smartMeasureState.cover,total:smartMeasureState.total,wastePct:smartMeasureState.wastePct,layout:smartMeasureState.layout
  };
  projectRooms.push(room);saveLocalArray('busterbuildProjectRooms',projectRooms);renderProjectRooms();toast(roomName+' added to project');
}
function renderProjectRooms(){
  const list=$('project-rooms-list');if(!list)return;
  const key=selectedProduct?productKey(selectedProduct):'';
  const rows=projectRooms.filter(r=>r.productKey===key);
  $('project-room-count').textContent=rows.length;
  if(!rows.length){list.innerHTML='<span class="muted-small">No rooms saved for this tile yet.</span>';return}
  list.innerHTML=rows.map(r=>`<div class="project-room-row"><div><strong>${esc(r.roomName)}</strong><span>${formatNumber(r.area)} m² • ${r.boxes} boxes • ${money(r.total)}</span></div><button type="button" data-room-remove="${r.id}"><i class="fa-solid fa-trash"></i></button></div>`).join('');
  qsa('[data-room-remove]',list).forEach(b=>b.onclick=()=>{projectRooms=projectRooms.filter(r=>String(r.id)!==b.dataset.roomRemove);saveLocalArray('busterbuildProjectRooms',projectRooms);renderProjectRooms()});
  const totalArea=Number(rows.reduce((s,r)=>s+r.area,0).toFixed(2));
  const totalBoxes=rows.reduce((s,r)=>s+r.boxes,0);
  const totalPrice=Number(rows.reduce((s,r)=>s+r.total,0).toFixed(2));
  $('project-room-summary').textContent=`Project rooms: ${formatNumber(totalArea)} m² • ${totalBoxes} boxes • ${money(totalPrice)}`;
}
function useProjectRooms(){
  if(!selectedProduct)return;
  const rows=projectRooms.filter(r=>r.productKey===productKey(selectedProduct));
  if(!rows.length){toast('Save at least one room first');return}
  const area=Number(rows.reduce((s,r)=>s+r.area,0).toFixed(2));
  const baseArea=Number(rows.reduce((s,r)=>s+r.baseArea,0).toFixed(2));
  const boxes=rows.reduce((s,r)=>s+r.boxes,0);
  const cover=Number(rows.reduce((s,r)=>s+r.cover,0).toFixed(2));
  const total=Number(rows.reduce((s,r)=>s+r.total,0).toFixed(2));
  smartMeasureState={productKey:cartKey(selectedProduct),baseArea,area,boxes,cover,total,wastePct:0,layout:'project'};
  $('required-area').textContent=area.toFixed(2)+' m²';$('boxes-order').textContent=boxes;$('covered-area').textContent=cover.toFixed(2)+' m²';$('measure-total').textContent=money(total);
  $('measure-base-note').textContent=`Combined total for ${rows.length} saved room${rows.length===1?'':'s'}`;
  if(!publicProductMode){$('product-qty').value=area.toFixed(2);$('add-cart').innerHTML='<i class="fa-solid fa-cart-plus"></i><span>Add project • '+money(total)+'</span>'}
  renderAccessorySuggestions(area);toast('Project room total applied');
}
function findAccessoryProduct(terms=[]){
  return products.find(p=>terms.some(t=>(p._name+' '+p._code).toLowerCase().includes(t)));
}
function renderAccessorySuggestions(area){
  const box=$('accessory-suggestions');if(!box)return;
  if(!area||!selectedProduct||selectedProduct._type!=='tile'){box.hidden=true;return}
  const rows=[
    {label:'Tile adhesive 20kg',qty:Math.max(1,Math.ceil(area/5)),terms:['adhesive']},
    {label:'Grout 5kg',qty:Math.max(1,Math.ceil(area/20)),terms:['grout']},
    {label:'Spacers',qty:Math.max(1,Math.ceil(area/20)),terms:['spacer']},
    {label:'Tile cleaner',qty:Math.max(1,Math.ceil(area/30)),terms:['cleaner']}
  ];
  box.hidden=false;
  box.innerHTML='<div class="accessory-title"><div><small>PROJECT EXTRAS</small><strong>Suggested accessories</strong><span>Guide only — confirm product suitability with the customer.</span></div></div><div class="accessory-grid">'+rows.map((r,i)=>{
    const p=findAccessoryProduct(r.terms);return `<div class="accessory-item"><div><strong>${esc(r.label)}</strong><span>Suggested qty: ${r.qty}</span></div>${p?`<button type="button" data-accessory="${esc(productKey(p))}" data-accessory-qty="${r.qty}">Add ${money(p._price)}</button>`:'<small>Search catalogue to select</small>'}</div>`
  }).join('')+'</div>';
  qsa('[data-accessory]',box).forEach(b=>b.onclick=()=>{const p=getProductByKey(b.dataset.accessory);if(p)addToCart(p,Number(b.dataset.accessoryQty)||1)});
}

function cartKey(p){return (p._type+'|'+(p._code||p.id||p._name)).toLowerCase();}
function loadCart(){try{return JSON.parse(localStorage.getItem('busterbuildSalesCart')||'[]')}catch{return[]}}
function saveCart(){localStorage.setItem('busterbuildSalesCart',JSON.stringify(cart));updateCartUI();}
function addToCart(p,qty){
  const key=cartKey(p),existing=cart.find(x=>x.key===key);
  if(existing){
    existing.qty+=qty;
    existing.smartMeasure=false;
    delete existing.fixedTotal;
    delete existing.smartArea;
    delete existing.smartBoxes;
    delete existing.smartCover;
  }else{
    cart.push({key,name:p._name,code:p._code,image:p._image,type:p._type,price:p._price,qty,sqm:p._sqm||0,perSqm:isPerSqm(p),smartMeasure:false});
  }
  saveCart();
  toast(`${p._name} added to cart`);
}

function addSmartMeasureToCart(p,measure){
  const key=cartKey(p);
  const item={
    key,
    name:p._name,
    code:p._code,
    image:p._image,
    type:p._type,
    price:Number(p._price||0),                 // selling price per m²
    qty:Number(measure.area.toFixed(2)),       // REQUIRED m² = chargeable quantity
    sqm:p._sqm||0,
    perSqm:true,
    smartMeasure:true,
    smartArea:Number(measure.area.toFixed(2)),
    smartBoxes:Number(measure.boxes||0),       // recommendation only
    smartCover:Number(measure.cover.toFixed(2)),
    fixedTotal:Number(measure.total.toFixed(2))
  };

  // Replace any older version of the same tile in the cart.
  const existingIndex=cart.findIndex(x=>x.key===key);
  if(existingIndex>=0)cart[existingIndex]=item;
  else cart.push(item);

  saveCart();
}

function lineTotal(item){
  if(item.smartMeasure&&Number.isFinite(Number(item.fixedTotal))){
    return Number(Number(item.fixedTotal).toFixed(2));
  }
  return Number((Number(item.price||0)*Number(item.qty||0)).toFixed(2));
}

function updateCartUI(){
  const count=cart.length;
  $('bottom-cart-count').textContent=count;
  $('cart-stat').textContent=count;

  const list=$('cart-list');
  list.innerHTML='';
  $('cart-empty').style.display=cart.length?'none':'grid';
  $('cart-summary').hidden=!cart.length;

  let total=0;

  cart.forEach((item,idx)=>{
    const itemTotal=lineTotal(item);
    total+=itemTotal;

    const row=document.createElement('div');
    row.className='cart-row';

    if(item.smartMeasure){
      row.classList.add('smart-measure-cart-row');
      row.innerHTML=`
        <img src="${esc(item.image)}" alt="">
        <div>
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.code||'')} • Smart Measure</p>
          <small class="smart-cart-math">${formatNumber(item.smartArea)} m² × ${money(item.price)}/m² = ${money(itemTotal)}</small>
          <small class="smart-cart-boxes">${item.smartBoxes} box${item.smartBoxes===1?'':'es'} recommended • covers ${formatNumber(item.smartCover)} m²</small>
        </div>
        <div class="cart-row-total">
          <strong>${money(itemTotal)}</strong>
          <span class="smart-cart-label">M² CALCULATED TOTAL</span>
          <button data-remove class="remove-item" type="button"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }else{
      row.innerHTML=`
        <img src="${esc(item.image)}" alt="">
        <div><h3>${esc(item.name)}</h3><p>${esc(item.code||'')} • ${item.perSqm?'m²':'Qty'}</p></div>
        <div class="cart-row-total">
          <strong>${money(itemTotal)}</strong>
          <div class="mini-qty">
            <button data-minus type="button">−</button>
            <span>${item.perSqm?formatNumber(item.qty):item.qty}</span>
            <button data-plus type="button">+</button>
            <button data-remove class="remove-item" type="button"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;

      qs('[data-minus]',row).onclick=()=>{
        item.qty=Math.max(item.perSqm?0.01:1,Number(item.qty)-1);
        saveCart();
      };
      qs('[data-plus]',row).onclick=()=>{
        item.qty=Number(item.qty)+1;
        saveCart();
      };
    }

    qs('[data-remove]',row).onclick=()=>{
      cart.splice(idx,1);
      saveCart();
    };

    list.appendChild(row);
  });

  $('cart-items-total').textContent=count;
  $('cart-money-total').textContent=money(Number(total.toFixed(2)));
}

function loadQuoteHistory(){try{return JSON.parse(localStorage.getItem('busterbuildQuoteHistory')||'[]')}catch{return[]}}
function saveQuoteHistory(){localStorage.setItem('busterbuildQuoteHistory',JSON.stringify(quoteHistory.slice(0,60)));}
function quoteNumber(){
  const d=new Date(),pad=n=>String(n).padStart(2,'0');
  return `BBQ-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function quoteDate(){return new Date().toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'});}
function quoteSubtotal(){return Number(cart.reduce((sum,item)=>sum+lineTotal(item),0).toFixed(2))}
function quoteDiscountPct(){
  const sel=$('quote-discount')?.value||'0';
  if(sel==='custom')return currentAccess?.role==='admin'?Math.max(0,Math.min(100,Number($('quote-custom-discount')?.value||0))):0;
  return Number(sel)||0;
}
function quoteGrandTotal(){const s=quoteSubtotal(),d=quoteDiscountPct();return Number((s*(1-d/100)).toFixed(2))}
function quoteExpiry(){
  const hours=Number($('quote-validity')?.value||48);return new Date(Date.now()+hours*3600000).toISOString();
}
function updateQuoteFieldVisibility(){
  const custom=$('quote-custom-discount-wrap');
  if(custom)custom.hidden=!($('quote-discount')?.value==='custom'&&currentAccess?.role==='admin');
  const confirm=$('quote-confirmation-fields');
  const st=$('quote-status')?.value||'draft';
  if(confirm)confirm.hidden=!['confirmed','converted'].includes(st);
  const official=$('quote-official-ref-wrap');
  if(official)official.hidden=st!=='converted';
}
function currentCustomer(){return {
  name:$('quote-customer-name').value.trim(),
  phone:$('quote-customer-phone').value.trim(),
  email:$('quote-customer-email').value.trim(),
  company:$('quote-customer-company')?.value.trim()||'',
  project:$('quote-project').value.trim(),
  notes:$('quote-notes').value.trim()
};}
function unitLabel(item){
  if(item.type==='tile'&&item.perSqm)return `${money(item.price)}/m²`;
  return money(item.price);
}
function qtyLabel(item){
  return item.perSqm?`${formatNumber(item.qty)} m²`:String(item.qty);
}
function ensureQuoteNumber(force=false){if(force||!currentQuoteNumber)currentQuoteNumber=quoteNumber();return currentQuoteNumber;}
function renderQuotePreview(){
  ensureQuoteNumber();
  const c=currentCustomer(), total=quoteGrandTotal();
  $('quote-number-preview').textContent='PRODUCT ESTIMATE';
  $('quote-date-preview').textContent=quoteDate();
  $('quote-name-preview').textContent=c.name||'Customer name';
  $('quote-contact-preview').textContent=c.phone?`WhatsApp: ${c.phone}`:'WhatsApp number';
  $('quote-email-preview').textContent=c.email||'';
  $('quote-project-preview').textContent=c.project?`Project: ${c.project}`:'';
  $('quote-salesperson-preview').textContent=$('account-name')?.textContent||'BusterBuild Sales';
  $('quote-total-preview').textContent=money(total);$('quote-preview-total').textContent=money(total);
  const sub=quoteSubtotal(),disc=quoteDiscountPct();
  $('quote-subtotal-preview').textContent=money(sub);
  $('quote-discount-preview').textContent=disc?`-${disc}% (${money(sub-total)})`:'No discount';
  $('quote-expiry-preview').textContent=`Valid ${Number($('quote-validity')?.value||48)} hours`;
  $('quote-items-preview').innerHTML=cart.map(item=>`<tr><td><strong>${esc(item.name)}</strong><small>${item.smartMeasure?`Smart Measure • ${formatNumber(item.smartArea)} m² • ${item.smartBoxes} boxes recommended`:item.type==='tile'&&item.sqm?`${formatNumber(item.sqm)} m²/box`:typeLabel(item.type)}</small></td><td>${esc(item.code||'—')}</td><td>${esc(qtyLabel(item))}</td><td>${esc(unitLabel(item))}</td><td><strong>${money(lineTotal(item))}</strong></td></tr>`).join('')||'<tr><td colspan="5" class="quote-empty-line">No products added yet.</td></tr>';
  $('quote-note-preview').hidden=!c.notes;$('quote-note-preview').textContent=c.notes?`Notes: ${c.notes}`:'';
}
function startQuote(){
  if(!cart.length){toast('Add products to the cart first');showView('catalogue');return;}
  currentQuoteSavedId='';ensureQuoteNumber(true);$('quote-status').value='draft';$('quote-official-ref').value='';$('quote-validity').value='48';$('quote-discount').value='0';$('quote-custom-discount').value='';$('quote-confirmed-by').value='';$('quote-confirmation-date').value='';updateQuoteFieldVisibility();renderQuotePreview();showView('quote');
}
function quoteRecord(){
  const c=currentCustomer();
  const existing=quoteHistory.find(q=>q.id===(currentQuoteSavedId||currentQuoteNumber));
  const now=new Date().toISOString();
  return {
    id:currentQuoteSavedId||currentQuoteNumber,
    number:currentQuoteNumber,
    date:now,
    createdAt:existing?.createdAt||existing?.date||now,
    updatedAt:now,
    customer:c,
    salesperson:$('account-name')?.textContent||'BusterBuild Sales',
    salesEmail:auth?.currentUser?.email||'',
    ownerUid:auth?.currentUser?.uid||existing?.ownerUid||'',
    ownerEmail:auth?.currentUser?.email||existing?.ownerEmail||'',
    status:$('quote-status')?.value||existing?.status||'draft',
    officialReference:$('quote-official-ref')?.value.trim()||'',
    confirmedBy:$('quote-confirmed-by')?.value.trim()||'',
    confirmationDate:$('quote-confirmation-date')?.value||'',
    validityHours:Number($('quote-validity')?.value||48),
    expiresAt:quoteExpiry(),
    discountPct:quoteDiscountPct(),
    subtotal:Number(quoteSubtotal().toFixed(2)),
    items:cart.map(x=>({...x})),
    total:Number(quoteGrandTotal().toFixed(2)),
    cloudSynced:false
  };
}


function customerDocId(phone){
  const digits=normalPhone(phone);return `${auth?.currentUser?.uid||'guest'}_${digits||Date.now()}`;
}
async function saveCurrentCustomer(){
  const c=currentCustomer();if(!c.name||!c.phone||!db||!auth?.currentUser)return null;
  const id=customerDocId(c.phone);
  const record={
    id,name:c.name,phone:c.phone,email:c.email||'',company:$('quote-customer-company')?.value.trim()||'',
    ownerUid:auth.currentUser.uid,ownerEmail:auth.currentUser.email||'',salesperson:currentUserName(),
    updatedAt:new Date().toISOString(),lastProject:c.project||''
  };
  try{await setDoc(doc(db,'customers',id),record,{merge:true});return record}catch{return null}
}
async function loadCustomers(){
  if(!db||!auth?.currentUser)return;
  try{
    let snap=currentAccess?.role==='admin'
      ?await getDocs(collection(db,'customers'))
      :await getDocs(query(collection(db,'customers'),where('ownerUid','==',auth.currentUser.uid)));
    const rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));
    cloudCustomers=rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    renderCustomers();populateCustomerDatalist();
  }catch(err){console.error('Customers',err)}
}
function populateCustomerDatalist(){
  const d=$('customer-suggestions');if(!d)return;
  d.innerHTML=cloudCustomers.map(c=>`<option value="${esc(c.phone)}">${esc(c.name)}${c.company?' • '+esc(c.company):''}</option>`).join('');
}
function findCustomerByPhone(phone){const n=normalPhone(phone);return cloudCustomers.find(c=>normalPhone(c.phone)===n)}
function applyCustomer(c){
  if(!c)return;
  $('quote-customer-name').value=c.name||'';
  $('quote-customer-phone').value=c.phone||'';
  $('quote-customer-email').value=c.email||'';
  $('quote-customer-company').value=c.company||'';
  renderQuotePreview();toast('Customer details loaded');
}
function renderCustomers(){
  const list=$('customers-list');if(!list)return;
  const term=($('customer-search')?.value||'').trim().toLowerCase();
  const rows=cloudCustomers.filter(c=>!term||`${c.name} ${c.phone} ${c.email} ${c.company}`.toLowerCase().includes(term));
  $('customer-count').textContent=cloudCustomers.length;
  if(!rows.length){list.innerHTML='<div class="empty-card"><i class="fa-solid fa-address-book"></i><strong>No customers found</strong><span>Customers are saved when a quotation is saved.</span></div>';return}
  list.innerHTML=rows.map(c=>{
    const quotes=quoteHistory.filter(q=>normalPhone(q.customer?.phone)===normalPhone(c.phone));
    return `<article class="customer-card"><div class="customer-avatar">${esc((c.name||'C')[0].toUpperCase())}</div><div><strong>${esc(c.name||'Customer')}</strong><span>${esc(c.company||'')}</span><span>${esc(c.phone||'')} ${c.email?'• '+esc(c.email):''}</span><small>${quotes.length} estimate${quotes.length===1?'':'s'} • ${money(quotes.reduce((s,q)=>s+Number(q.total||0),0))}</small></div><div><button type="button" data-customer-quote="${esc(c.id)}"><i class="fa-solid fa-file-circle-plus"></i> Quote</button><button type="button" data-customer-wa="${esc(c.phone||'')}"><i class="fa-brands fa-whatsapp"></i></button></div></article>`
  }).join('');
  qsa('[data-customer-quote]',list).forEach(b=>b.onclick=()=>{const c=cloudCustomers.find(x=>x.id===b.dataset.customerQuote);if(c){if(!cart.length){toast('Add products to the cart first');showView('catalogue');return}startQuote();applyCustomer(c)}})
  qsa('[data-customer-wa]',list).forEach(b=>b.onclick=()=>{const n=normaliseWhatsApp(b.dataset.customerWa);if(n)window.open('https://wa.me/'+n,'_blank')})
}
function customerHistoryForCurrent(){
  const phone=normalPhone($('quote-customer-phone').value);return quoteHistory.filter(q=>normalPhone(q.customer?.phone)===phone)
}

function quoteStatusLabel(status){
  return ({
    draft:'Draft',
    sent:'Sent',
    confirmed:'Customer Confirmed',
    converted:'Converted',
    cancelled:'Cancelled'
  })[status]||'Draft';
}
function quoteStatusClass(status){
  return ['draft','sent','confirmed','converted','cancelled'].includes(status)?status:'draft';
}
function upsertLocalQuote(record){
  const idx=quoteHistory.findIndex(q=>q.id===record.id);
  if(idx>=0)quoteHistory[idx]=record;
  else quoteHistory.unshift(record);
  quoteHistory.sort((a,b)=>new Date(b.updatedAt||b.date||0)-new Date(a.updatedAt||a.date||0));
  saveQuoteHistory();
}
async function saveQuoteToCloud(record){
  if(!db||!auth?.currentUser||!navigator.onLine)return false;
  quoteCloudBusy=true;
  setCloudState('syncing','Syncing quotation…');
  try{
    const payload={...record,cloudSynced:true,serverUpdatedAt:serverTimestamp()};
    await setDoc(doc(db,'quotations',record.id),payload,{merge:true});
    record.cloudSynced=true;
    upsertLocalQuote(record);
    setCloudState('ready','Cloud synced');
    return true;
  }catch(err){
    console.error('Cloud quotation save failed',err);
    setCloudState('error','Cloud sync issue');
    return false;
  }finally{
    quoteCloudBusy=false;
  }
}
async function syncPendingQuotes(){
  if(!db||!auth?.currentUser||!navigator.onLine)return;
  const uid=auth.currentUser.uid;
  const pending=quoteHistory.filter(q=>q.ownerUid===uid&&q.cloudSynced===false);
  if(!pending.length)return;
  for(const q of pending)await saveQuoteToCloud(q);
}
async function loadCloudQuotes(){
  if(!db||!auth?.currentUser)return;
  setCloudState('syncing','Loading cloud quotes…');
  try{
    let snap;
    if(currentAccess?.role==='admin'){
      snap=await getDocs(collection(db,'quotations'));
    }else{
      snap=await getDocs(query(collection(db,'quotations'),where('ownerUid','==',auth.currentUser.uid)));
    }
    const rows=[];
    snap.forEach(d=>rows.push({id:d.id,...d.data(),cloudSynced:true}));
    rows.sort((a,b)=>new Date(b.updatedAt||b.date||0)-new Date(a.updatedAt||a.date||0));
    cloudQuotes=rows;

    const localRelevant=currentAccess?.role==='admin'
      ? quoteHistory
      : quoteHistory.filter(q=>!q.ownerUid||q.ownerUid===auth.currentUser.uid);
    const map=new Map();
    localRelevant.forEach(q=>map.set(q.id,q));
    rows.forEach(q=>map.set(q.id,q));
    quoteHistory=[...map.values()].sort((a,b)=>new Date(b.updatedAt||b.date||0)-new Date(a.updatedAt||a.date||0)).slice(0,200);
    saveQuoteHistory();
    renderQuoteHistory();
    if(currentAccess?.role==='admin')renderAdminDashboard(rows);
    setCloudState('ready','Cloud synced');
    await syncPendingQuotes();
  }catch(err){
    console.error('Cloud quotations could not load',err);
    setCloudState(navigator.onLine?'error':'offline',navigator.onLine?'Cloud sync unavailable':'Offline — device history');
    renderQuoteHistory();
  }
}
async function updateQuoteStatus(id,status,officialReference){
  const q=quoteHistory.find(x=>x.id===id);
  if(!q)return;
  q.status=status;
  if(typeof officialReference==='string')q.officialReference=officialReference.trim();
  q.updatedAt=new Date().toISOString();
  q.cloudSynced=false;
  upsertLocalQuote(q);
  renderQuoteHistory();
  if(db&&auth?.currentUser&&navigator.onLine){
    try{
      await updateDoc(doc(db,'quotations',id),{
        status:q.status,
        officialReference:q.officialReference||'',
        updatedAt:q.updatedAt,
        serverUpdatedAt:serverTimestamp()
      });
      q.cloudSynced=true;
      upsertLocalQuote(q);
      setCloudState('ready','Cloud synced');
      await logAudit('quote_status_changed',{quoteId:id,status:q.status,officialReference:q.officialReference||''});
      if(currentAccess?.role==='admin')await loadCloudQuotes();
    }catch(err){
      console.error(err);
      setCloudState('error','Status saved on device');
    }
  }
}
async function deleteSavedQuote(id){
  const q=quoteHistory.find(x=>x.id===id);
  if(!q)return;
  if(!confirm('Delete this saved quotation?'))return;
  if(q.cloudSynced&&db&&navigator.onLine){
    try{await deleteDoc(doc(db,'quotations',id));}
    catch(err){console.error(err);toast('Cloud quotation could not be deleted');return;}
  }
  quoteHistory=quoteHistory.filter(x=>x.id!==id);
  cloudQuotes=cloudQuotes.filter(x=>x.id!==id);
  saveQuoteHistory();
  renderQuoteHistory();
  if(currentAccess?.role==='admin')renderAdminDashboard(cloudQuotes);
  toast('Quotation deleted');
}
async function markCurrentQuoteSent(){
  if(!currentQuoteSavedId)return;
  const q=quoteHistory.find(x=>x.id===currentQuoteSavedId);
  if(q && (q.status==='draft'||!q.status))await updateQuoteStatus(q.id,'sent',q.officialReference||'');
}

function validateQuote(){
  const c=currentCustomer(),status=$('quote-form-status');status.textContent='';status.className='admin-status';
  if(!cart.length){status.textContent='Add at least one product to the cart.';status.classList.add('error');return false;}
  if(!c.name||!c.phone){status.textContent='Customer name and WhatsApp number are required.';status.classList.add('error');return false;}
  return true;
}
$('create-quote').onclick=startQuote;
$('refresh-quote-preview').onclick=renderQuotePreview;
['quote-customer-name','quote-customer-phone','quote-customer-email','quote-customer-company','quote-project','quote-notes','quote-status','quote-official-ref','quote-validity','quote-discount','quote-custom-discount','quote-confirmed-by','quote-confirmation-date'].forEach(id=>$(id)?.addEventListener('input',()=>{renderQuotePreview();updateQuoteFieldVisibility()}));
$('quote-customer-phone')?.addEventListener('blur',()=>{const c=findCustomerByPhone($('quote-customer-phone').value);if(c)applyCustomer(c)});
$('quote-form').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!validateQuote())return;
  renderQuotePreview();

  const record=quoteRecord();
  upsertLocalQuote(record);
  currentQuoteSavedId=record.id;
  renderQuoteHistory();

  const s=$('quote-form-status');
  s.textContent='Quotation saved on this device. Syncing to cloud…';
  s.className='admin-status success';

  await saveCurrentCustomer();
  const cloudOk=await saveQuoteToCloud(record);
  await logAudit('quote_saved',{quoteId:record.id,total:record.total,status:record.status,discountPct:record.discountPct});
  s.textContent=cloudOk
    ?'Quotation saved and synced to the BusterBuild cloud.'
    :'Quotation saved on this device. Cloud sync will retry when online.';

  if(isMobileDevice()){
    const submitBtn=qs('#quote-form button[type="submit"]');
    const oldHtml=submitBtn?.innerHTML||'';
    if(submitBtn){
      submitBtn.disabled=true;
      submitBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i><span>Creating PDF…</span>';
    }
    try{
      const f=await getQuotePdfFile();
      downloadBlob(f,f.name);
      toast(cloudOk?'Saved, synced + PDF downloaded':'Saved + PDF downloaded');
    }catch(err){
      toast('Quotation saved — tap Download PDF if needed');
    }finally{
      if(submitBtn){
        submitBtn.disabled=false;
        submitBtn.innerHTML=oldHtml;
      }
    }
  }else{
    toast(cloudOk?'Quotation saved + synced':'Quotation saved on device');
  }
});
function normaliseWhatsApp(v){let d=String(v||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d='27'+d.slice(1);return d;}
function quoteText(){const c=currentCustomer();return `Hi ${c.name||'there'},\n\nPlease find your BusterBuild product estimate.\nEstimated total: ${money(quoteGrandTotal())}.\n\nPrices are subject to stock availability and final confirmation. Your official quotation/payment document will be completed on the BusterBuild sales system once you confirm.\n\nThank you for choosing BusterBuild.`;}

function roundedRect(ctx,x,y,w,h,r,fill,stroke){
  const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function canvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines=99){
  const words=String(text||'').split(/\s+/).filter(Boolean);let line='',lines=[];
  for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}
  if(line)lines.push(line); if(!lines.length)lines=[''];
  if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(ctx.measureText(last+'…').width>maxWidth&&last.length>1)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}
  lines.forEach((ln,i)=>ctx.fillText(ln,x,y+i*lineHeight)); return lines.length*lineHeight;
}
function loadCanvasImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});}
async function createQuoteCanvas(){
  renderQuotePreview();
  if(document.fonts?.ready)try{await document.fonts.ready;}catch{}
  const c=currentCustomer(), items=cart.slice(), W=1500, rowH=112, headerH=220, customerH=190;
  const notesExtra=c.notes?120:0; const H=Math.max(1050,headerH+customerH+150+items.length*rowH+190+notesExtra+150);
  const scale=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  const canvas=document.createElement('canvas');canvas.width=W*scale;canvas.height=H*scale;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
  const yellow='#e1a100', ink='#111111', muted='#676767', line='#e8e1d5', pale='#fff8e4';

  // Header
  ctx.fillStyle=ink;ctx.fillRect(0,0,W,headerH);ctx.fillStyle=yellow;ctx.fillRect(0,headerH-14,W,14);
  try{const logo=await loadCanvasImage('./icons/icon-192.png');roundedRect(ctx,60,42,126,126,28,'#fff');ctx.save();ctx.beginPath();ctx.roundRect?.(60,42,126,126,28);ctx.clip();ctx.drawImage(logo,60,42,126,126);ctx.restore();}catch{}
  ctx.fillStyle='#fff';ctx.font='900 54px Poppins, Arial, sans-serif';ctx.fillText('BUSTERBUILD',220,98);
  ctx.fillStyle=yellow;ctx.font='800 23px Poppins, Arial, sans-serif';ctx.fillText('TILES & SANITARY WARE',222,140);
  ctx.textAlign='right';ctx.fillStyle=yellow;ctx.font='900 42px Poppins, Arial, sans-serif';ctx.fillText('QUOTATION',W-60,83);
  ctx.fillStyle='#fff';ctx.font='800 24px Poppins, Arial, sans-serif';ctx.fillText('PRODUCT ESTIMATE',W-60,124);
  ctx.fillStyle='#aaa';ctx.font='500 19px Poppins, Arial, sans-serif';ctx.fillText(quoteDate(),W-60,158);ctx.textAlign='left';

  // Customer band
  let y=headerH;ctx.fillStyle=pale;ctx.fillRect(0,y,W,customerH);ctx.fillStyle=yellow;ctx.font='900 18px Poppins, Arial, sans-serif';ctx.fillText('QUOTED FOR',60,y+45);ctx.fillText('SALESPERSON',W/2+50,y+45);
  ctx.fillStyle=ink;ctx.font='900 28px Poppins, Arial, sans-serif';ctx.fillText(c.name||'Customer',60,y+86);ctx.fillText($('account-name')?.textContent||'BusterBuild Sales',W/2+50,y+86);
  ctx.fillStyle=muted;ctx.font='500 19px Poppins, Arial, sans-serif';ctx.fillText(c.phone?`WhatsApp: ${c.phone}`:'',60,y+121);if(c.email)ctx.fillText(c.email,60,y+151);if(c.project)ctx.fillText(`Project: ${c.project}`,W/2+50,y+121);ctx.fillText(auth?.currentUser?.email||'',W/2+50,y+151);
  ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(0,y+customerH);ctx.lineTo(W,y+customerH);ctx.stroke();

  // Table header
  y+=customerH+45;const x0=60;const widths=[620,220,170,190,220];const labels=['ITEM','CODE','QTY','UNIT','TOTAL'];
  ctx.fillStyle=ink;ctx.fillRect(x0,y,W-120,58);ctx.font='800 17px Poppins, Arial, sans-serif';ctx.fillStyle='#fff';let xx=x0;
  labels.forEach((lab,i)=>{ctx.textAlign=i===4?'right':'left';ctx.fillText(lab,xx+(i===4?widths[i]-16:16),y+37);xx+=widths[i];});ctx.textAlign='left';y+=58;

  items.forEach((item)=>{
    xx=x0;ctx.fillStyle='#fff';ctx.fillRect(x0,y,W-120,rowH);ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(x0,y+rowH);ctx.lineTo(W-60,y+rowH);ctx.stroke();
    ctx.fillStyle=ink;ctx.font='800 21px Poppins, Arial, sans-serif';canvasText(ctx,item.name,xx+16,y+34,widths[0]-32,28,2);ctx.fillStyle=muted;ctx.font='500 16px Poppins, Arial, sans-serif';ctx.fillText(item.smartMeasure?`Smart Measure • ${formatNumber(item.smartArea)} m² • ${item.smartBoxes} boxes recommended`:item.type==='tile'&&item.sqm?`${formatNumber(item.sqm)} m² per box`:typeLabel(item.type),xx+16,y+92);xx+=widths[0];
    ctx.fillStyle=muted;ctx.font='700 18px Poppins, Arial, sans-serif';ctx.fillText(item.code||'—',xx+16,y+46);xx+=widths[1];ctx.fillText(qtyLabel(item),xx+16,y+46);xx+=widths[2];ctx.fillText(unitLabel(item),xx+16,y+46);xx+=widths[3];ctx.fillStyle=ink;ctx.font='900 20px Poppins, Arial, sans-serif';ctx.textAlign='right';ctx.fillText(money(lineTotal(item)),xx+widths[4]-16,y+46);ctx.textAlign='left';y+=rowH;
  });

  // Total
  y+=30;roundedRect(ctx,60,y,W-120,102,22,yellow);ctx.fillStyle=ink;ctx.font='900 20px Poppins, Arial, sans-serif';ctx.fillText('QUOTED TOTAL',92,y+59);ctx.textAlign='right';ctx.font='900 44px Poppins, Arial, sans-serif';ctx.fillText(money(quoteGrandTotal()),W-92,y+65);ctx.textAlign='left';y+=132;
  if(c.notes){roundedRect(ctx,60,y,W-120,90,18,'#faf9f6',line);ctx.fillStyle=muted;ctx.font='600 18px Poppins, Arial, sans-serif';canvasText(ctx,`Notes: ${c.notes}`,82,y+34,W-164,26,2);y+=118;}
  ctx.fillStyle=ink;ctx.font='800 18px Poppins, Arial, sans-serif';ctx.fillText('Thank you for choosing BusterBuild.',60,y+35);ctx.fillStyle=muted;ctx.font='500 16px Poppins, Arial, sans-serif';ctx.fillText('Estimate only. Final quotation/payment document will be issued from the BusterBuild sales system.',60,y+66);ctx.textAlign='right';ctx.fillStyle='#9b7900';ctx.font='900 16px Poppins, Arial, sans-serif';ctx.fillText('BUILD WITH CONFIDENCE.',W-60,y+60);ctx.textAlign='left';
  return canvas;
}
async function quoteBlob(){const canvas=await createQuoteCanvas();return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create quotation image')),'image/png',1));}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
function isMobileDevice(){
  const ua=navigator.userAgent||'';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (navigator.maxTouchPoints>1 && /Macintosh/i.test(ua));
}
function quotePdfFileName(){const c=currentCustomer();const base=(c.name||'Customer').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')||'Customer';return `BusterBuild-Product-Estimate-${base}.pdf`;}
async function getQuotePdfFile(){
  if(!validateQuote())throw new Error('Complete customer details');
  ensureQuoteNumber();
  const JSPDF=window.jspdf?.jsPDF;
  if(!JSPDF)throw new Error('PDF generator is still loading. Check the internet connection and try again.');
  const canvas=await createQuoteCanvas();
  const pageW=210,pageH=297;
  const pxPerPage=Math.floor(canvas.width*(pageH/pageW));
  const pdf=new JSPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  let offset=0,page=0;
  while(offset<canvas.height){
    const sliceH=Math.min(pxPerPage,canvas.height-offset);
    const slice=document.createElement('canvas');
    slice.width=canvas.width;slice.height=sliceH;
    const sctx=slice.getContext('2d');sctx.fillStyle='#fff';sctx.fillRect(0,0,slice.width,slice.height);
    sctx.drawImage(canvas,0,offset,canvas.width,sliceH,0,0,canvas.width,sliceH);
    if(page>0)pdf.addPage('a4','portrait');
    const img=slice.toDataURL('image/jpeg',0.92);
    const renderH=(sliceH/canvas.width)*pageW;
    pdf.addImage(img,'JPEG',0,0,pageW,renderH,undefined,'FAST');
    offset+=sliceH;page++;
  }
  const blob=pdf.output('blob');
  return new File([blob],quotePdfFileName(),{type:'application/pdf'});
}
async function withButtonBusy(id,label,fn){const b=$(id);if(!b)return;const old=b.innerHTML;b.disabled=true;b.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i><span>${label}</span>`;try{return await fn();}finally{b.disabled=false;b.innerHTML=old;}}
function canShareFile(file){try{return !!navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}));}catch{return false;}}

$('download-quote-image').onclick=()=>withButtonBusy('download-quote-image','Creating PDF…',async()=>{try{const f=await getQuotePdfFile();downloadBlob(f,f.name);toast('PDF estimate downloaded');}catch(e){toast(e.message||'Could not create PDF');}});
$('share-quote-image').onclick=()=>withButtonBusy('share-quote-image','Preparing PDF…',async()=>{try{const f=await getQuotePdfFile();if(canShareFile(f)){await navigator.share({title:'BusterBuild Product Estimate',text:quoteText(),files:[f]});}else{downloadBlob(f,f.name);toast('PDF downloaded — use your device Share option');}}catch(e){if(e?.name!=='AbortError')toast(e.message||'Could not share PDF');}});
function validWhatsAppNumber(phone){return /^\d{10,15}$/.test(String(phone||''));}
function validEmailAddress(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||'').trim());}

$('whatsapp-quote').onclick=()=>withButtonBusy('whatsapp-quote','Opening…',async()=>{
  if(!validateQuote())return;
  const c=currentCustomer();
  const phone=normaliseWhatsApp(c.phone);
  if(!validWhatsAppNumber(phone)){toast('Enter a valid WhatsApp number, including the correct country code.');return;}
  let waWindow=null;
  try{waWindow=window.open('about:blank','_blank');}catch{}
  try{
    const f=await getQuotePdfFile();
    downloadBlob(f,f.name);
    const url=`https://wa.me/${phone}?text=${encodeURIComponent(quoteText())}`;
    if(waWindow && !waWindow.closed){waWindow.location.replace(url);}else{window.location.href=url;}
    toast('PDF downloaded and customer WhatsApp opened. Attach the PDF in the chat.');
    await markCurrentQuoteSent();
  }catch(e){try{if(waWindow && !waWindow.closed)waWindow.close();}catch{} toast(e.message||'Could not open WhatsApp');}
});

$('email-quote').onclick=()=>withButtonBusy('email-quote','Opening…',async()=>{
  if(!validateQuote())return;
  const c=currentCustomer(),email=String(c.email||'').trim();
  if(!email){toast('Enter the customer email address');return;}
  if(!validEmailAddress(email)){toast('Enter a valid customer email address');return;}
  try{
    const f=await getQuotePdfFile();
    downloadBlob(f,f.name);
    const subject='BusterBuild Product Estimate';
    const body=quoteText()+`\n\nThe PDF estimate ${f.name} has been downloaded to this device. Please attach it before sending.`;
    window.location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast(`PDF downloaded and email opened for ${email}`);
    await markCurrentQuoteSent();
  }catch(e){toast(e.message||'Could not open email');}
});

function followUpQuote(q){
  const phone=normaliseWhatsApp(q.customer?.phone||'');if(!phone){toast('Customer WhatsApp number is missing');return}
  const name=q.customer?.name||'there';
  const msg=`Hi ${name}, just following up on your BusterBuild product estimate of ${money(q.total||0)}. Please let us know if you would like us to proceed or if you need any changes. Thank you.`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank');
  logAudit('quote_followup',{quoteId:q.id,phone:q.customer?.phone||''});
}

function renderQuoteHistory(){
  const list=$('quotes-history-list');
  if(!list)return;
  const hero=$('quotes-history-source');
  if(hero)hero.textContent=navigator.onLine?'CLOUD + DEVICE':'DEVICE • OFFLINE';

  if(!quoteHistory.length){
    list.innerHTML='<div class="empty-card"><i class="fa-solid fa-file-circle-plus"></i><strong>No saved quotations yet</strong><span>Create a quotation from the sales cart.</span></div>';
    return;
  }

  list.innerHTML='';
  quoteHistory.forEach((q,idx)=>{
    const c=q.customer||{};
    const status=q.status||'draft';
    const el=document.createElement('article');
    el.className='quote-history-card';
    el.innerHTML=`
      <div class="quote-history-icon"><i class="fa-solid fa-file-lines"></i></div>
      <div class="quote-history-copy">
        <div class="history-topline">
          <small>${esc(q.number||'PRODUCT ESTIMATE')}</small>
          <span class="quote-status-badge ${quoteStatusClass(status)}">${esc(quoteStatusLabel(status))}</span>
        </div>
        <strong>${esc(c.name||'Customer')}</strong>
        <span>${new Date(q.date||q.updatedAt||Date.now()).toLocaleDateString('en-ZA')} • ${esc(c.phone||'No WhatsApp')}</span>
        <span>${esc(q.salesperson||'BusterBuild Sales')}${q.officialReference?' • Ref: '+esc(q.officialReference):''}</span>
      </div>
      <div class="quote-history-money">
        <strong>${money(q.total||0)}</strong>
        <small class="cloud-mark ${q.cloudSynced?'synced':'pending'}"><i class="fa-solid ${q.cloudSynced?'fa-cloud-check':'fa-cloud-arrow-up'}"></i> ${q.cloudSynced?'Synced':'Pending'}</small>
        <div>
          <select data-status aria-label="Quotation status">
            ${['draft','sent','confirmed','converted','cancelled'].map(v=>`<option value="${v}" ${status===v?'selected':''}>${quoteStatusLabel(v)}</option>`).join('')}
          </select>
          ${status==='sent'&&daysSince(q.updatedAt||q.date)>=2?'<button data-followup type="button" class="followup-btn" title="WhatsApp follow-up"><i class="fa-brands fa-whatsapp"></i></button>':''}
          <button data-open type="button" title="Open quotation"><i class="fa-solid fa-eye"></i></button>
          <button data-delete type="button" title="Delete quotation"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;

    qs('[data-open]',el).onclick=()=>openSavedQuote(idx);
    qs('[data-delete]',el).onclick=()=>deleteSavedQuote(q.id);
    qs('[data-followup]',el)?.addEventListener('click',()=>followUpQuote(q));
    qs('[data-status]',el).onchange=e=>updateQuoteStatus(q.id,e.target.value,q.officialReference||'');
    list.appendChild(el);
  });
}
async function openSavedQuote(idx){
  const q=quoteHistory[idx];if(!q)return;
  if(!products.length)await loadCatalogue();
  const changed=[];
  const items=(q.items||[]).map(item=>{
    const p=products.find(x=>String(x._code||'').toLowerCase()===String(item.code||'').toLowerCase());
    if(p&&Number(p._price)!==Number(item.price)){
      changed.push({name:item.name,old:item.price,new:p._price});
      return {...item,_currentPrice:p._price};
    }
    return {...item};
  });
  let finalItems=items;
  if(changed.length){
    const message='Prices have changed for '+changed.length+' item(s):\n\n'+changed.slice(0,6).map(x=>`${x.name}: ${money(x.old)} → ${money(x.new)}`).join('\n')+'\n\nUpdate this estimate to current prices?';
    if(confirm(message)){
      finalItems=items.map(item=>{
        if(item._currentPrice==null)return item;
        const updated={...item,price:Number(item._currentPrice)};delete updated._currentPrice;
        if(updated.smartMeasure&&updated.smartArea)updated.fixedTotal=Number((updated.smartArea*updated.price).toFixed(2));
        return updated;
      });
      toast('Estimate updated to current prices');logAudit('quote_prices_refreshed',{quoteId:q.id,items:changed.length});
    }else finalItems=items.map(({_currentPrice,...item})=>item);
  }
  cart=finalItems;saveCart();
  currentQuoteNumber=q.number||quoteNumber();currentQuoteSavedId=q.id||currentQuoteNumber;
  const c=q.customer||{};
  $('quote-customer-name').value=c.name||'';$('quote-customer-phone').value=c.phone||'';$('quote-customer-email').value=c.email||'';$('quote-customer-company').value=c.company||'';
  $('quote-project').value=c.project||'';$('quote-notes').value=c.notes||'';
  $('quote-status').value=q.status||'draft';$('quote-official-ref').value=q.officialReference||'';
  $('quote-validity').value=String(q.validityHours||48);$('quote-discount').value=q.discountPct?[2,5].includes(Number(q.discountPct))?String(q.discountPct):'custom':'0';
  $('quote-custom-discount').value=q.discountPct&&!([2,5].includes(Number(q.discountPct)))?q.discountPct:'';
  $('quote-confirmed-by').value=q.confirmedBy||'';$('quote-confirmation-date').value=q.confirmationDate||'';
  updateQuoteFieldVisibility();renderQuotePreview();showView('quote');
}
$('new-quote-from-history').onclick=()=>{if(!cart.length){toast('Add products to the cart first');showView('catalogue');return;}currentQuoteSavedId='';ensureQuoteNumber(true);$('quote-form').reset();$('quote-status').value='draft';$('quote-official-ref').value='';renderQuotePreview();showView('quote');};

$('clear-cart').onclick=()=>{if(confirm('Clear the sales cart?')){cart=[];saveCart();}};


function renderComboSearch(){
  const term=($('combo-search')?.value||'').trim().toLowerCase();const box=$('combo-search-results');if(!box)return;
  if(term.length<2){box.innerHTML='<span class="muted-small">Type at least 2 characters to search products.</span>';return}
  const rows=products.filter(p=>p._name.toLowerCase().includes(term)||p._code.toLowerCase().includes(term)).slice(0,12);
  box.innerHTML=rows.map(p=>`<button type="button" data-combo-add="${esc(productKey(p))}"><img src="${esc(p._image)}" alt=""><span><strong>${esc(p._name)}</strong><small>${esc(p._code||'—')}</small></span><b>${money(p._price)}${isPerSqm(p)?'/m²':''}</b></button>`).join('')||'<span class="muted-small">No products found.</span>';
  qsa('[data-combo-add]',box).forEach(b=>b.onclick=()=>{const p=getProductByKey(b.dataset.comboAdd);if(p)addComboBuilderItem(p)})
}
function addComboBuilderItem(p){
  const existing=comboBuilderItems.find(x=>x.key===productKey(p));if(existing)existing.qty++;else comboBuilderItems.push({key:productKey(p),name:p._name,code:p._code,image:p._image,price:p._price,qty:1,perSqm:isPerSqm(p),type:p._type});
  renderComboBuilder()
}
function renderComboBuilder(){
  const list=$('combo-builder-list');if(!list)return;
  list.innerHTML=comboBuilderItems.map((x,i)=>`<div class="combo-line"><img src="${esc(x.image)}"><div><strong>${esc(x.name)}</strong><span>${esc(x.code||'—')} • ${money(x.price)}${x.perSqm?'/m²':''}</span></div><input type="number" min="0.01" step="${x.perSqm?'0.01':'1'}" value="${x.qty}" data-combo-qty="${i}"><button type="button" data-combo-remove="${i}"><i class="fa-solid fa-trash"></i></button></div>`).join('')||'<div class="empty-card compact"><span>Add products to build a custom package.</span></div>';
  qsa('[data-combo-qty]',list).forEach(i=>i.oninput=()=>{comboBuilderItems[Number(i.dataset.comboQty)].qty=Math.max(.01,Number(i.value)||1);renderComboTotal()});
  qsa('[data-combo-remove]',list).forEach(b=>b.onclick=()=>{comboBuilderItems.splice(Number(b.dataset.comboRemove),1);renderComboBuilder()});
  renderComboTotal()
}
function renderComboTotal(){const total=comboBuilderItems.reduce((s,x)=>s+x.price*x.qty,0);$('combo-builder-total').textContent=money(total)}
function addCustomComboToCart(){
  if(!comboBuilderItems.length){toast('Add products to the combo first');return}
  const name=$('combo-name').value.trim()||'BusterBuild Custom Project Combo';
  const total=Number(comboBuilderItems.reduce((s,x)=>s+x.price*x.qty,0).toFixed(2));
  const key='custom-combo-'+Date.now();
  cart.push({key,name,code:'CUSTOM',image:'icons/icon-192.png',type:'combo',price:total,qty:1,sqm:0,perSqm:false,customCombo:true,comboItems:comboBuilderItems.map(x=>({...x}))});
  saveCart();logAudit('custom_combo_added',{name,total,items:comboBuilderItems.length});comboBuilderItems=[];$('combo-name').value='';renderComboBuilder();toast('Custom combo added to cart');showView('cart')
}

function showView(name){
  qsa('.view').forEach(v=>v.classList.remove('active')); $(name+'-view').classList.add('active'); qsa('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));
  if(name==='cart')updateCartUI();
  if(name==='quote')renderQuotePreview();
  if(name==='quotes'){renderQuoteHistory();loadCloudQuotes();}
  if(name==='customers'){loadCustomers();renderCustomers();}
  if(name==='my-dashboard'){renderMyDashboard();}
  if(name==='combo-builder'){renderComboBuilder();renderComboSearch();}
  if(name==='admin'&&currentAccess?.role==='admin'){loadCloudQuotes();loadSalesTeam();loadCustomers();}
  if(name!=='scan')stopScanner();
  window.scrollTo({top:0,behavior:'smooth'});
}
qsa('[data-nav]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.nav)));
qsa('[data-open-scan]').forEach(b=>b.addEventListener('click',()=>showView('scan')));

$('start-camera').onclick=startScanner; $('stop-camera').onclick=stopScanner;
$('manual-find').onclick=()=>findScanned($('manual-code').value);
$('manual-code').addEventListener('keydown',e=>{if(e.key==='Enter')findScanned(e.target.value);});
function renderRecentScans(){
  const el=$('recent-scans');if(!el)return;const scans=loadLocalArray('busterbuildRecentScans').map(x=>({...x,p:getProductByKey(x.key)})).filter(x=>x.p);
  el.innerHTML=scans.map(x=>`<button type="button" data-scan-key="${esc(x.key)}"><span>${esc(x.p._name)}</span><small>${new Date(x.date).toLocaleString('en-ZA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></button>`).join('')||'<span class="muted-small">No recent scans.</span>';
  qsa('[data-scan-key]',el).forEach(b=>b.onclick=()=>{const p=getProductByKey(b.dataset.scanKey);if(p)openProduct(p)})
}
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
  $('scan-result').hidden=false;$('scan-result').innerHTML='<strong><i class="fa-solid fa-circle-check" style="color:#16984f"></i> '+esc(p._name)+'</strong><br><small>Code: '+esc(p._code||'—')+'</small>';
  const scans=loadLocalArray('busterbuildRecentScans');scans.unshift({key:productKey(p),date:new Date().toISOString()});saveLocalArray('busterbuildRecentScans',scans.slice(0,10));renderRecentScans();openProduct(p);
}
function handleProductQuery(){
  const params=new URLSearchParams(location.search);
  const code=(params.get('product')||params.get('code')||'').trim();
  if(!code)return;
  const wanted=code.toLowerCase();
  const p=products.find(x=>
    String(x._code||'').toLowerCase()===wanted ||
    String(x.id||'').toLowerCase()===wanted ||
    String(x._name||'').toLowerCase()===wanted
  );
  if(p){
    openProduct(p);
  }else if(publicProductMode){
    showPublicProductError(`We could not find product ${code}. Please ask a BusterBuild salesperson for assistance.`);
  }
}


$('compare-open')?.addEventListener('click',openComparison);
qsa('[data-close-compare]').forEach(b=>b.addEventListener('click',closeComparison));
$('customer-search')?.addEventListener('input',renderCustomers);
$('combo-search')?.addEventListener('input',renderComboSearch);
$('add-custom-combo')?.addEventListener('click',addCustomComboToCart);
$('export-quotes')?.addEventListener('click',exportQuotationsCsv);
$('export-customers')?.addEventListener('click',exportCustomersCsv);
$('save-room-btn')?.addEventListener('click',saveCurrentRoom);
$('use-project-rooms')?.addEventListener('click',useProjectRooms);
$('quote-discount')?.addEventListener('change',updateQuoteFieldVisibility);
$('quote-status')?.addEventListener('change',updateQuoteFieldVisibility);
$('quote-validity')?.addEventListener('change',renderQuotePreview);

initProfessionalStatus();
updateQuoteFieldVisibility();
updateCartUI();
