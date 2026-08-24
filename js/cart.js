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
cart = cart.map(item => ({
    name: item.name,
    price: Number(item.price),
    quantity: Number(item.quantity) || 1
}));

localStorage.setItem("cart", JSON.stringify(cart));

// ===========================
// ADD TO CART
// ===========================

function addToCart(name, price){

    price = Number(price);

    let existing = cart.find(item => item.name === name);

    if(existing){

        existing.quantity++;

    }else{

        cart.push({
            name:name,
            price:price,
            quantity:1
        });

    }

    localStorage.setItem("cart", JSON.stringify(cart));

    updateCartCount();

    alert(name + " added to cart");

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

        cartTotal.innerHTML = "Total: R0.00";

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

    cartTotal.innerHTML = "Total: R" + total.toFixed(2);

}
// ===========================
// INCREASE QUANTITY
// ===========================

function increaseQuantity(index){

    cart[index].quantity++;

    localStorage.setItem("cart", JSON.stringify(cart));

    displayCart();

    updateCartCount();

}

// ===========================
// DECREASE QUANTITY
// ===========================

function decreaseQuantity(index){

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

    if(!wishlist.includes(name)){

        wishlist.push(name);

        localStorage.setItem("wishlist", JSON.stringify(wishlist));

        alert(name + " added to wishlist");

    }else{

        alert(name + " is already in your wishlist");

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

            <h3>${product}</h3>

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

    let delivery = subtotal >= 1000 ? 0 : (subtotal > 0 ? 100 : 0);

    let grandTotal = subtotal + delivery;

    const subtotalEl = document.getElementById("checkout-subtotal");
    const deliveryEl = document.getElementById("checkout-delivery");
    const totalEl = document.getElementById("checkout-total");

    if(subtotalEl) subtotalEl.innerHTML = "R" + subtotal.toFixed(2);

    if(deliveryEl){
        deliveryEl.innerHTML = delivery === 0 ? "FREE" : "R" + delivery.toFixed(2);
    }

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

    if(total > 0 && total < 1000){

        total += 100;

    }

    let paymentTotal = document.getElementById("payment-total");

    if(paymentTotal){

        paymentTotal.innerHTML = "R" + total.toFixed(2);

    }

}
// ===========================
// COMPLETE ORDER
// ===========================

function completeOrder() {
    const form = document.querySelector(".payment-page form");
    if (form && !form.checkValidity()) {
        form.reportValidity();
        return;
    }

    if (!cart.length) {
        alert("Your cart is empty.");
        window.location.href = "cart.html";
        return;
    }

    const customerName = localStorage.getItem("customerName") || "";
    const customerPhone = localStorage.getItem("customerPhone") || "";
    const customerAddress = localStorage.getItem("customerAddress") || "";
    const deliveryMethod = localStorage.getItem("deliveryMethod") || "";

    let subtotal = 0;
    let orderMessage = "New BusterBuild Hardware Order%0A%0A";
    orderMessage += "Customer: " + encodeURIComponent(customerName) + "%0A";
    orderMessage += "Phone: " + encodeURIComponent(customerPhone) + "%0A";
    orderMessage += "Delivery: " + encodeURIComponent(deliveryMethod) + "%0A";

    if (deliveryMethod === "Home Delivery") {
        orderMessage += "Address: " + encodeURIComponent(customerAddress) + "%0A";
    }

    orderMessage += "%0AProducts:%0A";

    cart.forEach(item => {
        const lineTotal = Number(item.price) * Number(item.quantity);
        subtotal += lineTotal;
        orderMessage += encodeURIComponent(item.name) + " x" + item.quantity +
            " - R" + lineTotal.toFixed(2) + "%0A";
    });

    const delivery = subtotal >= 1000 ? 0 : 100;
    const grandTotal = subtotal + delivery;

    orderMessage += "%0ADelivery: " + (delivery === 0 ? "FREE" : "R" + delivery.toFixed(2));
    orderMessage += "%0ATotal: R" + grandTotal.toFixed(2);

    localStorage.setItem("lastOrder", JSON.stringify(cart));
    localStorage.setItem("lastOrderTotal", grandTotal.toFixed(2));
    localStorage.setItem("lastOrderWhatsapp", orderMessage);
    localStorage.removeItem("cart");

    window.location.href = "success.html";
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
function isCustomerLoggedIn(){

    return localStorage.getItem("busterbuildLoggedIn") === "true";

}


// ===========================
// HIDE PRICES FOR GUESTS
// ===========================

function protectPrices(){

    const priceElements = document.querySelectorAll(
        ".price, .special-price, .old-price, .product-price"
    );

    priceElements.forEach(function(priceElement){

        // Save original price only once
        if(!priceElement.dataset.originalPrice){

            priceElement.dataset.originalPrice = priceElement.innerHTML;

        }


        // If customer is NOT logged in
        if(!isCustomerLoggedIn()){

            priceElement.innerHTML = `
                <span class="login-price">
                    <i class="fa-solid fa-eye-slash"></i>
                    <span>Login to view price</span>
                </span>
            `;

        }

        // If customer IS logged in
        else{

            priceElement.innerHTML =
                priceElement.dataset.originalPrice;

        }

    });

}


// ===========================
// RUN PRICE PROTECTION
// ===========================

document.addEventListener("DOMContentLoaded", function(){

    protectPrices();

});
