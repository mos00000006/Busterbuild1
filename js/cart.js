// ===========================
// BUSTERBUILD CART
// ===========================

// Load cart
function readStorageArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

let cart = readStorageArray("cart");

// Fix old cart items
cart = cart.filter(item => item && typeof item.name === "string" && Number.isFinite(Number(item.price)) && Number(item.price) >= 0)
    .map(item => ({
        name: item.name.slice(0, 180),
        price: Number(item.price),
        quantity: Math.min(999, Math.max(1, Math.trunc(Number(item.quantity)) || 1))
    }));

localStorage.setItem("cart", JSON.stringify(cart));

// ===========================
// ADD TO CART
// ===========================

function addToCart(name, price){

    price = Number(price);
    if (typeof name !== "string" || !name.trim() || !Number.isFinite(price) || price < 0) return;

    let existing = cart.find(item => item.name === name);

    if(existing){

        existing.quantity = Math.min(999, existing.quantity + 1);

    }else{

        cart.push({
            name:name,
            price:price,
            quantity:1
        });

    }

    localStorage.setItem("cart", JSON.stringify(cart));

    updateCartCount();

    showStoreNotice(name + " added to your enquiry cart");

}

function showStoreNotice(message) {
    let notice = document.getElementById("store-notice");
    if (!notice) {
        notice = document.createElement("div");
        notice.id = "store-notice";
        notice.setAttribute("role", "status");
        document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.classList.add("visible");
    clearTimeout(showStoreNotice.timer);
    showStoreNotice.timer = setTimeout(() => notice.classList.remove("visible"), 3000);
}

// ===========================
// UPDATE CART COUNT
// ===========================

function updateCartCount(){

    let cartCount = document.getElementById("cart-count");

    if(!cartCount) return;

    let total = 0;

    cart.forEach(item=>{

        total += Number(item.quantity);

    });

    cartCount.textContent = total;

}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
}

// ===========================
// DISPLAY CART
// ===========================

function displayCart(){

    const cartItems = document.getElementById("cart-items");
    const cartTotal = document.getElementById("cart-total");

    if(!cartItems || !cartTotal) return;

    cartItems.innerHTML = "";

    if(cart.length === 0){

        cartItems.innerHTML = `
        <div class="cart-empty">
            <h3>Your cart is empty.</h3>
            <p>Add products to start shopping.</p>
        </div>
        `;

        cartTotal.textContent = "Estimated subtotal: R0.00";
        const quoteLink = document.getElementById("request-quote-link");
        if (quoteLink) quoteLink.hidden = true;

        return;

    }

    let total = 0;

    cart.forEach((item,index)=>{

        let lineTotal = item.price * item.quantity;

        total += lineTotal;

        cartItems.innerHTML += `

        <div class="cart-item">

            <div class="cart-item-info">

                <h3>${escapeHtml(item.name)}</h3>

                <p>Price: <strong>R${item.price.toFixed(2)}</strong></p>

                <p>Total: <strong>R${lineTotal.toFixed(2)}</strong></p>

            </div>

            <div class="quantity-controls">

                <button onclick="decreaseQuantity(${index})">−</button>

                <span>${item.quantity}</span>

                <button onclick="increaseQuantity(${index})">+</button>

                <button class="remove-btn" onclick="removeItem(${index})">
                    <i class="fa-solid fa-trash"></i> Remove
                </button>

            </div>

        </div>

        `;

    });

    cartTotal.textContent = "Estimated subtotal: R" + total.toFixed(2);
    const quoteLink = document.getElementById("request-quote-link");
    if (quoteLink) quoteLink.hidden = false;

}
// ===========================
// INCREASE QUANTITY
// ===========================

function increaseQuantity(index){

    if (!cart[index]) return;
    cart[index].quantity = Math.min(999, cart[index].quantity + 1);

    localStorage.setItem("cart", JSON.stringify(cart));

    displayCart();

    updateCartCount();

}

// ===========================
// DECREASE QUANTITY
// ===========================

function decreaseQuantity(index){
    if (!cart[index]) return;

    if(cart[index].quantity > 1){

        cart[index].quantity--;

    }else{

        cart.splice(index,1);

    }

    localStorage.setItem("cart", JSON.stringify(cart));

    displayCart();

    updateCartCount();

}

// ===========================
// REMOVE ITEM
// ===========================

function removeItem(index){
    if (!cart[index]) return;

    cart.splice(index,1);

    localStorage.setItem("cart", JSON.stringify(cart));

    displayCart();

    updateCartCount();

}

// ===========================
// WISHLIST
// ===========================

let wishlist = readStorageArray("wishlist");

function addToWishlist(name){
    if (typeof name !== "string" || !name.trim()) return;

    if(!wishlist.includes(name)){

        wishlist.push(name);

        localStorage.setItem("wishlist", JSON.stringify(wishlist));

        showStoreNotice(name + " saved to your wishlist");

    }else{

        showStoreNotice(name + " is already on your wishlist");

    }

}

function displayWishlist(){

    let wishlistItems = document.getElementById("wishlist-items");

    if(!wishlistItems) return;

    wishlistItems.innerHTML = "";

    if(wishlist.length === 0){

        wishlistItems.innerHTML = `
        <div class="wishlist-box">
            <i class="fa-solid fa-heart"></i>
            <h3>Your Wishlist is Empty</h3>
            <p>Products you save will appear here.</p>
        </div>
        `;

        return;

    }

    wishlist.forEach((product,index)=>{

        wishlistItems.innerHTML += `
        <div class="wishlist-card">

            <i class="fa-solid fa-heart"></i>

            <h3>${escapeHtml(product)}</h3>

            <a class="fallback-link" href="search.html?q=${encodeURIComponent(product)}">Find this product</a>

            <button class="remove-wishlist-btn"
                onclick="removeFromWishlist(${index})">

                <i class="fa-solid fa-trash"></i>

                Remove

            </button>

        </div>
        `;

    });

}

function removeFromWishlist(index){

    wishlist.splice(index,1);

    localStorage.setItem("wishlist", JSON.stringify(wishlist));

    displayWishlist();

}
// ===========================
// LOAD PAGE
// ===========================

document.addEventListener("DOMContentLoaded", function(){

    updateCartCount();

    displayCart();

    displayWishlist();

    displayCheckout();

    loadPaymentTotal();

});

// ===========================
// CHECKOUT PAGE
// ===========================

function displayCheckout(){

    const checkoutItems = document.getElementById("checkout-items");

    if(!checkoutItems) return;

    const enquiryButton = document.querySelector("#enquiry-form button[type=submit]");
    if (enquiryButton) enquiryButton.disabled = cart.length === 0;

    checkoutItems.innerHTML = "";

    let subtotal = 0;

    cart.forEach(function(item){

        let quantity = Number(item.quantity);
        let price = Number(item.price);
        let total = quantity * price;

        subtotal += total;

        checkoutItems.innerHTML += `

        <div class="summary-item">

            <div>

                <h4>${escapeHtml(item.name)}</h4>

                <p>Quantity: ${quantity}</p>

            </div>

            <strong>R${total.toFixed(2)}</strong>

        </div>

        `;

    });

    let grandTotal = subtotal;

    const subtotalEl = document.getElementById("checkout-subtotal");
    const deliveryEl = document.getElementById("checkout-delivery");
    const totalEl = document.getElementById("checkout-total");

    if(subtotalEl) subtotalEl.innerHTML = "R" + subtotal.toFixed(2);

    if(deliveryEl) deliveryEl.textContent = "Confirmed by store";

    if(totalEl){
        totalEl.innerHTML = "R" + grandTotal.toFixed(2);
    }

}

// ===========================
// PAYMENT PAGE
// ===========================

function loadPaymentTotal(){

    let total = 0;

    cart.forEach(function(item){

        total += item.price * item.quantity;

    });


    let paymentTotal = document.getElementById("payment-total");

    if(paymentTotal){

        paymentTotal.innerHTML = "R" + total.toFixed(2);

    }

}
// ===========================
// COMPLETE ORDER
// ===========================

function completeOrder() {
    const form = document.getElementById("enquiry-form");
    if (form && form.elements.address) form.elements.address.setCustomValidity("");
    if (!form || !form.reportValidity()) return false;
    if (!cart.length) { window.location.href = "cart.html"; return false; }
    const data = new FormData(form);
    const method = String(data.get("method") || "");
    const address = String(data.get("address") || "").trim();
    if (method === "Delivery" && !address) {
        const field = form.elements.address;
        field.setCustomValidity("Please enter your delivery address.");
        field.reportValidity();
        return false;
    }
    const lines = [
        "Hello BusterBuild, please confirm this product enquiry:", "",
        "Name: " + data.get("name"), "Phone: " + data.get("phone"),
        "Email: " + (data.get("email") || "Not supplied"),
        "Method: " + method
    ];
    if (address) lines.push("Address: " + address);
    lines.push("", "Products:");
    cart.forEach(item => lines.push(item.name + " × " + item.quantity + " — R" + (item.price * item.quantity).toFixed(2)));
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    lines.push("", "Indicative subtotal: R" + subtotal.toFixed(2));
    lines.push("Please confirm prices, availability, delivery charge and final amount before payment.");
    if (data.get("notes")) lines.push("Notes: " + String(data.get("notes")).trim());
    const url = "https://wa.me/27632513656?text=" + encodeURIComponent(lines.join("\n"));
    const link = document.getElementById("whatsapp-enquiry-link");
    link.href = url;
    link.hidden = false;
    document.getElementById("enquiry-status").textContent = "WhatsApp is opening. Press Send there to submit your enquiry. Your cart remains saved here.";
    window.open(url, "_blank", "noopener,noreferrer");
    return false;
}

// ===========================
// PRODUCT SEARCH
// ===========================

function searchProducts(){

    let input = document.getElementById("search-input");

    if(!input) return;

    let searchValue = input.value.toLowerCase();

    let products = document.querySelectorAll(".product-card");

    products.forEach(function(product){

        let productName = product.querySelector("h3").textContent.toLowerCase();

        if(productName.includes(searchValue)){

            product.style.display = "block";

        }else{

            product.style.display = "none";

        }

    });

}
// ===========================
// BUSTERBUILD PRICE PROTECTION
// ===========================

// Check if customer is logged in
function isCustomerLoggedIn(){ return false; }


// ===========================
// HIDE PRICES FOR GUESTS
// ===========================

function protectPrices() { /* Display catalogue prices. Store confirms current pricing. */ }


// ===========================
// RUN PRICE PROTECTION
// ===========================

document.addEventListener("DOMContentLoaded", function(){

    protectPrices();

});
