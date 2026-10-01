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
    const items = await response.json();
    const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = items.filter(item => words.every(word => (item.name + ' ' + item.page).toLocaleLowerCase().includes(word)));
    count.textContent = matches.length + ' product' + (matches.length === 1 ? '' : 's') + ' found for “' + query + '”. Prices and availability are confirmed by the store.';
    if (!matches.length) { grid.innerHTML = '<div class="cart-empty"><h2>No matches found</h2><p>Try a broader term, or ask us for help.</p><a class="buy-btn" href="contact.html">Contact the store</a></div>'; return; }
    matches.slice(0, 120).forEach(item => {
      const card = document.createElement('article'); card.className = 'product-card';
      const img = document.createElement('img'); img.src = item.image; img.alt = item.name; img.loading = 'lazy'; card.append(img);
      const name = document.createElement('h3'); name.textContent = item.name; card.append(name);
      if (Number.isFinite(item.price)) { const price = document.createElement('p'); price.className = 'price'; price.textContent = 'R' + item.price.toFixed(2); card.append(price); }
      const actions = document.createElement('div'); actions.className = 'result-actions';
      const category = document.createElement('a'); category.className = 'buy-btn secondary'; category.href = item.page; category.textContent = 'View category'; actions.append(category);
      if (Number.isFinite(item.price)) { const add = document.createElement('button'); add.type = 'button'; add.className = 'buy-btn'; add.textContent = 'Add to cart'; add.addEventListener('click', () => addToCart(item.name, item.price)); actions.append(add); }
      card.append(actions); grid.append(card);
    });
  } catch (error) { count.textContent = 'The catalogue could not load. Please browse categories or contact the store.'; }
});
