function searchProducts() {
    const input = document.getElementById("search-input");
    if (!input) return;
    const value = input.value.toLowerCase().trim();
    if (!value) return;

    const pages = [
        { terms: ["paint"], page: "paint.html" },
        { terms: ["cement"], page: "cement.html" },
        { terms: ["tools", "tool"], page: "tools.html" },
        { terms: ["plumbing", "plumber"], page: "plumbing.html" },
        { terms: ["electrical", "electric"], page: "electrical.html" },
        { terms: ["tiles", "tile", "sanitary", "bathroom"], page: "tile & sanitary ware.html" },
        { terms: ["power tools", "powertools"], page: "powertools.html" },
        { terms: ["building materials", "building material"], page: "building materials.html" },
        { terms: ["specials", "special"], page: "specials.html" },
        { terms: ["products", "product"], page: "products.html" },
        { terms: ["about"], page: "about.html" },
        { terms: ["contact"], page: "contact.html" }
    ];

    const match = pages.find(item => item.terms.some(term => value.includes(term)));
    if (match) {
        window.location.href = match.page;
        return;
    }

    const cards = document.querySelectorAll(".product-card");
    if (cards.length) {
        cards.forEach(card => {
            const name = card.querySelector("h3")?.textContent.toLowerCase() || "";
            card.style.display = name.includes(value) ? "" : "none";
        });
    }
}
