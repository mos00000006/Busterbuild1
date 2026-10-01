(function () {
  function submitSearch(value) {
    const query = String(value || '').trim();
    if (!query) return;
    window.location.href = 'search.html?q=' + encodeURIComponent(query);
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.search').forEach(function (box) {
      const input = box.querySelector('input');
      const button = box.querySelector('button');
      if (!input) return;
      input.setAttribute('aria-label', 'Search products');
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); submitSearch(input.value); }
      });
      if (button) {
        button.type = 'button';
        button.setAttribute('aria-label', 'Search products');
        button.addEventListener('click', function (event) { event.preventDefault(); submitSearch(input.value); });
      }
    });
  });
  window.searchProducts = function () {
    const input = document.querySelector('.search input');
    if (input) submitSearch(input.value);
  };
}());
