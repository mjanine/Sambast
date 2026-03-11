var data = [
    { id: 1, name: "Product A", cat: "Category 1", price: 500, desc: "Premium selection product description." },
    { id: 2, name: "Product B", cat: "Category 1", price: 750, desc: "High quality item with best reviews." },
    { id: 3, name: "Product C", cat: "Category 2", price: 1200, desc: "Luxury tier product for specialized use." },
    { id: 4, name: "Product D", cat: "Category 3", price: 300, desc: "Budget friendly option for daily needs." }
];

var currentCheckout = [];
var cartSet = new Set();
var globalQty = 0;
var globalPrice = 0;

function render(list) {
    var grid = document.getElementById('itemGrid');
    grid.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var div = document.createElement('div');
        div.className = "product-card";
        div.id = "p-" + p.id;
        div.innerHTML = `
            <div class="flip-inner">
                <div class="front-face" onclick="toggle(${p.id})">
                    <div class="img-box">image</div>
                    <p class="label-cat">${p.cat}</p>
                    <h2 class="label-name">${p.name}</h2>
                    <div class="input-row" onclick="event.stopPropagation()">
                        <div class="select-box"><select><option>Kilo/Size</option></select></div>
                        <div class="qty-box">
                            <button onclick="qtyChange(${p.id},-1)">-</button>
                            <span id="qval-${p.id}">1</span>
                            <button onclick="qtyChange(${p.id},1)">+</button>
                        </div>
                    </div>
                    <p class="label-price">Product Amount: ${p.price}</p>
                    <div class="btn-row" onclick="event.stopPropagation()">
                        <button class="cart-act" onclick="addCart(${p.id},${p.price})">CART</button>
                        <button class="buy-act" onclick="buyNow(${p.id})">BUY</button>
                    </div>
                </div>
                <div class="back-face" onclick="toggle(${p.id})">
                    <h3>${p.name}</h3>
                    <p style="font-size:12px; margin-top:10px;">Description</p>
                    <p style="font-size:10px; opacity:0.8; margin-top:5px;">${p.desc}</p>
                </div>
            </div>`;
        grid.appendChild(div);
    }
}

function toggle(id) { 
    document.getElementById("p-" + id).classList.toggle('is-flipped'); 
}

function qtyChange(id, d) {
    var el = document.getElementById("qval-" + id);
    var v = parseInt(el.innerText) + d;
    if (v >= 1) el.innerText = v;
}

function addCart(id, pr) {
    var q = parseInt(document.getElementById("qval-" + id).innerText);
    var product = data.find(p => p.id === id);
    
    cartSet.add(id);
    globalQty += q;
    globalPrice += (pr * q); 

    // FIXED: Show bottom bar when items are added
    var bottomBar = document.querySelector('.bottom-bar');
    if (bottomBar) {
        bottomBar.style.display = 'flex';
    }
    
    document.getElementById('cartCount').innerText = cartSet.size;
    
    var btnQtyEl = document.getElementById('btnQty');
    if (btnQtyEl) btnQtyEl.innerText = globalQty;
    
    var subTotalEl = document.getElementById('displaySubtotal') || document.getElementById('subTotal');
    if (subTotalEl) {
        subTotalEl.innerText = globalPrice === 0 ? "0000" : globalPrice;
    }

    var existingInCheckout = currentCheckout.find(item => item.id === id);
    if(existingInCheckout) {
        existingInCheckout.qty += q;
    } else {
        currentCheckout.push({
            id: product.id,
            name: product.name,
            price: product.price,
            qty: q
        });
    }

    var cart = JSON.parse(localStorage.getItem('cart')) || [];
    var existingInCart = cart.find(item => item.id === id);
    if(existingInCart) {
        existingInCart.qty += q;
    } else {
        cart.push({ id: product.id, name: product.name, price: product.price, qty: q });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    
    alert(product.name + " added to cart!");
}

function buyNow(id) {
    var q = parseInt(document.getElementById("qval-" + id).innerText);
    var product = data.find(p => p.id === id);
    
    var directItem = [{
        id: product.id,
        name: product.name,
        price: product.price,
        qty: q
    }];
    
    localStorage.setItem('checkoutItems', JSON.stringify(directItem));
    window.location.href = 'checkout.html';
}

function handleCheckout() {
    if (currentCheckout.length === 0) {
        alert("Please add items to cart first!");
        return;
    }

    localStorage.setItem('checkoutItems', JSON.stringify(currentCheckout));
    window.location.href = 'checkout.html';
}

function filterFn(cat, btn) {
    var btns = document.querySelectorAll('.cat-pill');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    var filtered = (cat === 'All') ? data : data.filter(x => x.cat === cat);
    render(filtered);
}

function searchFn() {
    var s = document.getElementById('productSearch').value.toLowerCase();
    var results = data.filter(x => x.name.toLowerCase().includes(s));
    render(results);
}

function closeStatusModal() {
    document.getElementById('statusModal').style.display = 'none';
    window.history.replaceState({}, document.title, window.location.pathname);
}

document.addEventListener('DOMContentLoaded', () => {
    render(data);

    const checkoutBtn = document.querySelector('.checkout-trigger');
    if (checkoutBtn) {
        checkoutBtn.onclick = handleCheckout;
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showStatus') === 'true') {
        const modal = document.getElementById('statusModal');
        if (modal) modal.style.display = 'flex';
    }
});
