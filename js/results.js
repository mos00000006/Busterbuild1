const PULSE_TILE_API = 'https://pulsetiles.co.za/wp-json/wc/store/v1';
const PULSE_TILE_TYPE_SLUGS = ['ceramic-tiles','porcelain-tiles','hardbody-tiles','natural-stone-cladding','mosaics','decor-tiles','laminate-flooring'];

function pulseTilePrice(product){
  const p=product && product.prices ? product.prices : {};
  const minor=Number.isFinite(Number(p.currency_minor_unit)) ? Number(p.currency_minor_unit) : 2;
  return Number(p.price || p.sale_price || p.regular_price || 0) / Math.pow(10,minor);
}
async function fetchPulseTileCategory(slug){
  const rows=[];
  for(let page=1;page<=20;page++){
    const response=await fetch(PULSE_TILE_API+'/products?category='+encodeURIComponent(slug)+'&per_page=100&page='+page,{headers:{'Accept':'application/json'}});
    if(!response.ok){ if(response.status===400 && page>1) break; throw Error('remote catalogue unavailable'); }
    const data=await response.json(); if(!Array.isArray(data)||!data.length) break;
    rows.push(...data); if(data.length<100) break;
  }
  return rows;
}
async function fetchPulseTileSearchItems(){
  try{
    const groups=await Promise.all(PULSE_TILE_TYPE_SLUGS.map(fetchPulseTileCategory));
    const map=new Map(); groups.flat().forEach(p=>map.set(p.id,p));
    return [...map.values()].map(p=>({
      name:p.name||'Tile Product',
      code:p.sku||'',
      image:(p.images&&p.images[0]&&(p.images[0].thumbnail||p.images[0].src))||'pictures/tiles and sanitary hero.jpeg',
      page:'tile & sanitary ware.html',
      price:pulseTilePrice(p)
    }));
  }catch(e){ return []; }
}

document.addEventListener('DOMContentLoaded', async function () {
  const query = (new URLSearchParams(location.search).get('q') || '').trim();
  const count = document.getElementById('results-count');
  const grid = document.getElementById('results-grid');
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = query;
  if (!query) { count.textContent = 'Enter a product name to search.'; return; }
  try {
    const response = await fetch('data/catalog.json');
    if (!response.ok) throw Error('catalogue unavailable');
    const localItems = await response.json();
    const tileItems = await fetchPulseTileSearchItems();
    const items=[...localItems,...tileItems];
    const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = items.filter(item => words.every(word => (item.name + ' ' + (item.code||'') + ' ' + item.page).toLocaleLowerCase().includes(word)));
    count.textContent = matches.length + ' product' + (matches.length === 1 ? '' : 's') + ' found for “' + query + '”. Prices and availability are confirmed by the store.';
    if (!matches.length) { grid.innerHTML = '<div class="cart-empty"><h2>No matches found</h2><p>Try a broader term, or ask us for help.</p><a class="buy-btn" href="contact.html">Contact the store</a></div>'; return; }
    matches.slice(0, 160).forEach(item => {
      const card = document.createElement('article'); card.className = 'product-card';
      const img = document.createElement('img'); img.src = item.image; img.alt = item.name; img.loading = 'lazy'; img.referrerPolicy='no-referrer'; card.append(img);
      const name = document.createElement('h3'); name.textContent = item.name; card.append(name);
      if(item.code){ const code=document.createElement('p'); code.className='product-code'; code.textContent='Code: '+item.code; card.append(code); }
      if (Number.isFinite(item.price)) { const price = document.createElement('p'); price.className = 'price'; price.textContent = 'R' + item.price.toFixed(2); card.append(price); }
      const actions = document.createElement('div'); actions.className = 'result-actions';
      const category = document.createElement('a'); category.className = 'buy-btn secondary'; category.href = item.page; category.textContent = 'View category'; actions.append(category);
      if (Number.isFinite(item.price)) { const add = document.createElement('button'); add.type = 'button'; add.className = 'buy-btn'; add.textContent = 'Add to cart'; add.addEventListener('click', () => addToCart(item.name, item.price)); actions.append(add); }
      card.append(actions); grid.append(card);
    });
  } catch (error) { count.textContent = 'The catalogue could not load. Please browse categories or contact the store.'; }
});
