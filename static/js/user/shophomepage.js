var data = [];
var currentCheckout = [];
var recommendationInFlight = false;
var lastRecommendationSignature = null;


function normalizeUnitOptions(options) {
    if (!Array.isArray(options)) return [];

    return options.map(function(option) {
        const label = String(option && option.label ? option.label : (option && option.value ? option.value : "")).trim();
        const value = String(option && option.value ? option.value : label).trim();
        if (!label || !value) return null;

        const quantity = Number(option && option.quantity);
        const multiplierValue = Number(option && option.multiplier);
        const multiplier = Number.isFinite(multiplierValue) ? multiplierValue : (Number.isFinite(quantity) ? quantity : 1);

        return {
            label: label,
            value: value,
            multiplier: multiplier
        };
    }).filter(Boolean);
}

function getOptionMultiplier(option) {
    if (!option) return 1;

    const fromDataset = Number.parseFloat(option.dataset ? option.dataset.multiplier : option.getAttribute && option.getAttribute("data-multiplier"));
    if (Number.isFinite(fromDataset)) return fromDataset;

    const rawText = String(option.label || option.value || option.textContent || "").trim();
    const numericMatch = rawText.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kgs|pc|pcs|piece|pieces|pack|packs|box|boxes|bottle|bottles|pouch|pouches)?\b/i);
    if (numericMatch) {
        return Number.parseFloat(numericMatch[1]);
    }

    return 1;
}

function getUnitOptions(product) {
    if (!product) return [{ label: "1 pc", value: "1 pc", multiplier: 1 }];

    const storedUnitOptions = normalizeUnitOptions(product.unit_options);
    if (storedUnitOptions.length > 0) {
        return storedUnitOptions;
    }

    const name = (product.name || "").toLowerCase();
    const cat = (product.category || "").toLowerCase();

    const isFeedCategory = cat.includes("feeds");

    const isPetFeed =
        isFeedCategory &&
        (name.includes("feed") ||
         name.includes("chicken") ||
         name.includes("dog food") ||
         name.includes("cat food") ||
         name.includes("rabbit feed") ||
         name.includes("bird feed"));

    const isPoultry = name.includes("chicken") || name.includes("chick");
    const isRabbitFeed = name.includes("rabbit");
    const isBirdFeed = name.includes("bird");

    const isSupply =
        cat.includes("supplies") ||
        name.includes("leash") ||
        name.includes("collar") ||
        name.includes("harness") ||
        name.includes("bowl") ||
        name.includes("feeder") ||
        name.includes("cage") ||
        name.includes("toy");

    const isLitter = name.includes("litter");

    const isMedicine =
        cat.includes("medicine") ||
        name.includes("tablet") ||
        name.includes("capsule") ||
        name.includes("vitamin");

    const isLiquid = name.includes("syrup") || name.includes("milk") || name.includes("gel");

    const isWetFood = name.includes("wet") || name.includes("pouch");

    const isPowder = name.includes("powder");

    // 🐔 FEEDS (fraction-based pricing)
    if ((isPetFeed || isPoultry || isRabbitFeed || isBirdFeed) && !name.includes("feeder")) {
        return [
            { label: "1kg", value: "1kg", multiplier: 1 },
            { label: "1/2kg", value: "1/2kg", multiplier: 0.5 },
            { label: "1/4kg", value: "1/4kg", multiplier: 0.25 },
            { label: "1/8kg", value: "1/8kg", multiplier: 0.125 },
            { label: "25kg sack", value: "25kg sack", multiplier: 25 },
            { label: "50kg sack", value: "50kg sack", multiplier: 50 }
        ];
    }

    // 🐱🐶 LITTER (fixed weight packs)
    if (isLitter) {
        return [
            { label: "5kg", value: "5kg", multiplier: 5 },
            { label: "10kg", value: "10kg", multiplier: 10 },
            { label: "20kg", value: "20kg", multiplier: 20 }
        ];
    }

    // 🧰 SUPPLIES (simple per piece)
    if (isSupply) {
        return [
            { label: "1 pc", value: "1 pc", multiplier: 1 },
            { label: "2 pcs", value: "2 pcs", multiplier: 2 },
            { label: "3 pcs", value: "3 pcs", multiplier: 3 }
        ];
    }

    // 💊 MEDICINE (pack-based logic)
    if (isMedicine) {
        return [
            { label: "per tablet", value: "per tablet", multiplier: 1 },
            { label: "per strip", value: "per strip", multiplier: 10 },
            { label: "per box", value: "per box", multiplier: 100 },
            { label: "per bottle", value: "per bottle", multiplier: 1 }
        ];
    }

    // 🧴 LIQUID
    if (isLiquid) {
        return [
            { label: "per bottle", value: "per bottle", multiplier: 1 },
            { label: "per box", value: "per box", multiplier: 12 }
        ];
    }

    // 🍖 WET FOOD
    if (isWetFood) {
        return [
            { label: "per pouch", value: "per pouch", multiplier: 1 },
            { label: "per pack", value: "per pack", multiplier: 6 },
            { label: "3 packs", value: "3 packs", multiplier: 3 },
            { label: "6 packs", value: "6 packs", multiplier: 6 }
        ];
    }

    // 🧂 POWDER
    if (isPowder) {
        return [
            { label: "per pack", value: "per pack", multiplier: 1 },
            { label: "per kilo", value: "per kilo", multiplier: 1 },
            { label: "per box", value: "per box", multiplier: 10 }
        ];
    }

    return [{ label: "1 pc", value: "1 pc", multiplier: 1 }];
}

function render(list) {
    var grid = document.getElementById('itemGrid');
    grid.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var imgSrc = p.image_filename
            ? '/product-image/' + encodeURIComponent(p.image_filename)
            : '/static/img/no-image.svg';
        var div = document.createElement('div');
        div.className = "product-card";
        div.id = "p-" + p.product_id;
        var unitLabel = (p.unit || "pcs").trim();
        var stockValue = Number(p.stock_status || 0);
        var stockLabel = stockValue + " " + unitLabel + (stockValue === 0 ? " (Out of Stock)" : "");
        var initialUnitOptions = getUnitOptions(p);
        var initialMultiplier = initialUnitOptions.length > 0 ? Number(initialUnitOptions[0].multiplier || 1) : 1;
        var initialPrice = Number(p.price || 0) * initialMultiplier;
        div.innerHTML = `
            <div class="flip-inner">
                <div class="front-face" onclick="toggle(${p.product_id})">
                    <div class="img-box"><img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;"></div>
                    <p class="label-cat">${p.category}</p>
                    <h2 class="label-name">${p.name}</h2>
                    <div class="input-row" onclick="event.stopPropagation()">
                        <div class="qty-box">
    <button onclick="qtyChange(${p.product_id},-1)">-</button>

    <input
    type="number"
    id="qval-${p.product_id}"
    value="1"
    min="1"
    onclick="event.stopPropagation()"
    oninput="qtyTyping(${p.product_id})"
    onblur="qtyTyping(${p.product_id})"
>

    <button onclick="qtyChange(${p.product_id},1)">+</button>
</div>


<div class="unit-box">
    <select id="unit-${p.product_id}" class="unit-select"
    onchange="updateCardPrice(${p.product_id})">
        ${(getUnitOptions(p) || ["1 pc"])
            .map(u => `
    <option value="${u.value}" data-multiplier="${u.multiplier}">
        ${u.label}
    </option>
`)
            .join('')}
    </select>
</div>
                    </div>
                    <p class="label-price">₱${initialPrice.toFixed(2)}</p>
                    <p class="label-cat">Stock: ${stockLabel}</p>
                    <div class="btn-row" onclick="event.stopPropagation()">
                        <button class="cart-act" onclick="addCart(${p.product_id},${p.price})">CART</button>
                        <button class="buy-act" onclick="buyNow(${p.product_id})">BUY</button>
                    </div>
                </div>
                <div class="back-face" onclick="toggle(${p.product_id})">
                    <h3>${p.name}</h3>
                    <p style="font-size:12px; margin-top:10px;">Description</p>
                    <p style="font-size:10px; opacity:0.8; margin-top:5px;">${p.description || 'No description available.'}</p>
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

    var current = parseInt(el.value || 1);
    var v = current + d;

    if (v < 1) v = 1;

    el.value = v;

    updateCardPrice(id);
}

function qtyTyping(id) {
    var el = document.getElementById("qval-" + id);

    // allow empty while typing
    if (el.value === "") return;

    // if invalid number
    if (parseInt(el.value) < 1) {
        el.value = 1;
    }

    updateCardPrice(id);
}


function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    // unique product IDs only
    const uniqueIds = new Set(cart.map(item => item.product_id));

    const count = uniqueIds.size;

    const cartCount = document.getElementById('cartCount');
    const btnQty = document.getElementById('btnQty');

    if (cartCount) cartCount.innerText = count;
    if (btnQty) btnQty.innerText = count;
}

function addCart(id, pr) {
    document.querySelector('.bottom-bar').style.display = 'flex';

    var q = parseInt(document.getElementById("qval-" + id).value);

    var unitSelect = document.getElementById("unit-" + id);
    var selectedOption = unitSelect.options[unitSelect.selectedIndex];

    var unit = selectedOption.value;
    var multiplier = getOptionMultiplier(selectedOption);

    var product = data.find(p => p.product_id === id);
    if (!product) return;

    var cart = JSON.parse(localStorage.getItem('cart')) || [];

    var existing = cart.find(item => item.product_id === id && item.unit === unit);

    if (existing) {
        existing.qty += q;
    } else {
        cart.push({
    product_id: product.product_id,
    name: product.name,
    basePrice: pr,
    qty: q,
    unit: unit,
    multiplier: multiplier,
    image: product.image_filename,
    selected: true   // ✅ ADD THIS
});

    }

    // ✅ SAVE FIRST
    localStorage.setItem('cart', JSON.stringify(cart));

    // ✅ THEN UPDATE UI
    updateCartCount();
    updateSubtotal();

    showNotification();
}



function buyNow(id) {
    var q = parseInt(document.getElementById("qval-" + id).value);

    var product = data.find(p => p.product_id === id);

    var unitSelect = document.getElementById("unit-" + id);
    var selectedOption = unitSelect.options[unitSelect.selectedIndex];

    var unit = selectedOption.value;
    var multiplier = getOptionMultiplier(selectedOption);

    var directItem = [{
        product_id: product.product_id,
        name: product.name,
        basePrice: product.price,
        qty: q,
        unit: unit,
        multiplier: multiplier
    }];

    localStorage.setItem('checkoutItems', JSON.stringify(directItem));
    window.location.href = '/checkout';
}

function handleCheckout() {
    var cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        alert("Please add items to cart first!");
        return;
    }
    window.location.href = '/cart';
}

function filterFn(cat, btn) {
    var btns = document.querySelectorAll('.cat-pill');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    var filtered = (cat === 'All') ? data : data.filter(x => x.category === cat);
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

async function fetchRecommendations(cartItems) {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        updateRecommendationStatus("Add items to cart before generating recommendations.");
        return;
    }

    const requestSignature = JSON.stringify(
        cartItems
            .map(item => ({
                product_id: item.product_id,
                qty: item.qty,
                price: item.basePrice * item.multiplier * item.qty
            }))
            .sort((a, b) => Number(a.product_id) - Number(b.product_id))
    );

    if (recommendationInFlight && requestSignature === lastRecommendationSignature) {
        return;
    }

    recommendationInFlight = true;
    lastRecommendationSignature = requestSignature;
    updateRecommendationStatus("Generating recommendations...");

    try {
        const response = await fetch('/api/recommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cart_items: cartItems })
        });

        if (!response.ok) {
            updateRecommendationStatus('Recommendations unavailable right now.');
            return;
        }

        const responsePayload = await response.json();
        const recommendations = Array.isArray(responsePayload)
            ? responsePayload
            : (Array.isArray(responsePayload.products) ? responsePayload.products : []);

        const container = document.getElementById('ai-recommendations-container');
        const grid = document.getElementById('ai-recommendations-grid');

        if (recommendations && recommendations.length > 0) {
            grid.innerHTML = '';
            
            recommendations.forEach(p => {
                // Ensure the product exists in the global 'data' array
                if (!data.find(item => item.product_id === p.product_id)) {
                    data.push(p);
                }

                var imgSrc = p.image_filename
                    ? '/product-image/' + encodeURIComponent(p.image_filename)
                    : '/static/img/no-image.svg';

                const card = document.createElement('div');
                card.className = 'product-card';
                card.id = "p-rec-" + p.product_id;
                card.innerHTML = `
                    <div class="flip-inner">
                        <div class="front-face" onclick="document.getElementById('p-rec-${p.product_id}').classList.toggle('is-flipped')">
                            <div class="img-box">
                                <img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;">
                            </div>
                            <p class="label-cat">AI Suggestion (${p.category})</p>
                            <h2 class="label-name">${p.name}</h2>
                            <div class="input-row" onclick="event.stopPropagation()">
                                <div class="qty-box">
                                    <button onclick="qtyChangeRec(${p.product_id},-1)">-</button>
                                    <span id="qval-rec-${p.product_id}">1</span>
                                    <button onclick="qtyChangeRec(${p.product_id},1)">+</button>
                                </div>
                            </div>
                            <p class="label-price">Product Amount: ₱${p.price}</p>
                            <div class="btn-row" onclick="event.stopPropagation()">
                                <button class="cart-act" onclick="addCartRec(${p.product_id},${p.price})">CART</button>
                                <button class="buy-act" onclick="buyNowRec(${p.product_id})">BUY</button>
                            </div>
                        </div>
                        <div class="back-face" onclick="document.getElementById('p-rec-${p.product_id}').classList.toggle('is-flipped')">
                            <h3>${p.name}</h3>
                            <p style="font-size:12px; margin-top:10px;">Description</p>
                            <p style="font-size:10px; opacity:0.8; margin-top:5px;">${p.description || 'No description available.'}</p>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
            
            container.style.display = 'block';
            updateRecommendationStatus('Recommendations ready.');
        } else {
            if (container) container.style.display = 'none';
            updateRecommendationStatus('No recommendations available for the current cart.');
        }
    } catch (error) {
        updateRecommendationStatus('Recommendations unavailable due to a network error.');
    } finally {
        recommendationInFlight = false;
    }
}

function updateRecommendationStatus(message) {
    const statusEl = document.getElementById('recommendations-status');
    if (statusEl) {
        statusEl.innerText = message;
    }
}

function qtyChangeRec(id, d) {
    var el = document.getElementById("qval-rec-" + id);
    var v = parseInt(el.innerText) + d;
    if (v >= 1) el.innerText = v;
}

function addCartRec(id, pr) {
    var q = parseInt(document.getElementById("qval-rec-" + id).innerText);
    var product = data.find(p => p.product_id === id);

    var unit = "1 pc";
    var multiplier = 1;

    updateCartCount();

   

    var bottomBar = document.querySelector('.bottom-bar');
    if (bottomBar) bottomBar.style.display = 'flex';

   

    var btnQtyEl = document.getElementById('btnQty');
    

    var subTotalEl = document.getElementById('displaySubtotal') || document.getElementById('subTotal');
    updateSubtotal();


    var cart = JSON.parse(localStorage.getItem('cart')) || [];
    var existing = cart.find(item => item.product_id === id);
    if (existing) {
        existing.qty += q;
    } else {
        cart.push({
            product_id: product.product_id,
            name: product.name,
            basePrice: pr,
            qty: q,
            unit: unit,
            multiplier: multiplier,
            image: product.image_filename,
            image_filename: product.image_filename
        });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateRecommendationStatus("Cart updated. Click Generate AI Recommendations.");

    alert(product.name + " added to cart!");
}

document.addEventListener('DOMContentLoaded', () => {
    // Fetch products from the real API
    fetch('/products')
        .then(res => res.json())
        .then(products => {
            data = products;
            render(data);
        })
        .catch(() => {
            document.getElementById('itemGrid').innerHTML =
                '<p style="text-align:center; margin-top:40px; color:#666;">Failed to load products.</p>';
        });

    var cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length > 0) {
        updateRecommendationStatus('Cart detected. Click Generate AI Recommendations to load suggestions.');
    } else {
        updateRecommendationStatus('Add items to cart, then click to generate suggestions.');
    }

    const generateRecommendationsBtn = document.getElementById('generate-recommendations-btn');
    if (generateRecommendationsBtn) {
        generateRecommendationsBtn.addEventListener('click', async () => {
            if (recommendationInFlight) return;

            const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
            if (cartItems.length === 0) {
                updateRecommendationStatus('Add items to cart before generating recommendations.');
                return;
            }

            const originalLabel = generateRecommendationsBtn.innerText;
            generateRecommendationsBtn.disabled = true;
            generateRecommendationsBtn.innerText = 'Loading...';

            try {
                await fetchRecommendations(cartItems);
            } finally {
                generateRecommendationsBtn.disabled = false;
                generateRecommendationsBtn.innerText = originalLabel;
            }
        });
    }

    const checkoutBtn = document.querySelector('.bottom-bar .checkout-trigger');
    if (checkoutBtn) checkoutBtn.onclick = handleCheckout;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showStatus') === 'true') {
        const modal = document.getElementById('statusModal');
        if (modal) modal.style.display = 'flex';
    }

    // --- CHAT WIDGET LOGIC ---
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const chatWindow = document.getElementById('chatWindow');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatInput = document.getElementById('chatInput');
    const chatHistory = document.getElementById('chatHistory');

    if (chatToggleBtn && chatWindow) {
        chatToggleBtn.addEventListener('click', () => {
            chatWindow.style.display = 'flex';
            chatToggleBtn.style.display = 'none';
        });

        chatCloseBtn.addEventListener('click', () => {
            chatWindow.style.display = 'none';
            chatToggleBtn.style.display = 'flex';
        });

        const sendMessage = async () => {
            const message = chatInput.value.trim();
            if (!message) return;

            // 1. Lock the UI so they can't spam messages while waiting
            chatInput.disabled = true;
            chatSendBtn.disabled = true;

            // Append user message
            const userMsgDiv = document.createElement('div');
            userMsgDiv.className = 'chat-msg user';
            userMsgDiv.innerText = message;
            chatHistory.appendChild(userMsgDiv);
            
            chatInput.value = '';
            chatHistory.scrollTop = chatHistory.scrollHeight;

            // Append typing indicator
            const typingDiv = document.createElement('div');
            typingDiv.className = 'chat-msg bot typing';
            typingDiv.innerText = 'Typing...';
            chatHistory.appendChild(typingDiv);
            chatHistory.scrollTop = chatHistory.scrollHeight;

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: message })
                });

                const data = await response.json();
                
                // Remove typing indicator
                if(chatHistory.contains(typingDiv)) {
                    chatHistory.removeChild(typingDiv);
                }

                // Append bot response
                const botMsgDiv = document.createElement('div');
                botMsgDiv.className = 'chat-msg bot';
                botMsgDiv.innerText = response.ok && data.response ? data.response : 'Sorry, I am having trouble connecting right now.';
                chatHistory.appendChild(botMsgDiv);
                
            } catch (error) {
                if(chatHistory.contains(typingDiv)) {
                    chatHistory.removeChild(typingDiv);
                }
                const errorMsgDiv = document.createElement('div');
                errorMsgDiv.className = 'chat-msg bot';
                errorMsgDiv.innerText = 'Sorry, there was a network error.';
                chatHistory.appendChild(errorMsgDiv);
            } finally {
                // 2. Unlock the UI after the API finishes (success or fail)
                chatInput.disabled = false;
                chatSendBtn.disabled = false;
                chatInput.focus(); // puts the cursor back in the box
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
        };

        chatSendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});
let notificationTimeout;
let remainingTime = 4000;
function loadCartState() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    let totalQty = 0;
    let totalPrice = 0;

    cart.forEach(item => {
        totalQty += parseInt(item.qty || 0);

        const price = parseFloat(item.basePrice || 0);
        const multiplier = parseFloat(item.multiplier || 1);

        totalPrice += price * multiplier * item.qty;
    });

   

    const uniqueIds = new Set(cart.map(item => item.product_id));
const count = uniqueIds.size;

document.getElementById('cartCount').innerText = count;
document.getElementById('btnQty').innerText = count;

    updateSubtotal();


    if (cart.length > 0) {
        document.querySelector('.bottom-bar').style.display = 'flex';
    }
}


function showNotification(msg = "Added to cart!") {
    const notification = document.getElementById('notification');
    if (!notification) return;

    const msgEl = notification.querySelector(".notif-msg");
    if (msgEl) msgEl.innerText = msg;

    notification.classList.remove('show');
    void notification.offsetHeight;
    notification.classList.add('show');

    if (notificationTimeout) clearTimeout(notificationTimeout);

    notificationTimeout = setTimeout(() => {
        hideNotification();
    }, 2000);
}


function hideNotification() {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.classList.remove('show');
}


function adjustChatWidget() {
    const bottomBar = document.querySelector('.bottom-bar');
    const chatBtn = document.querySelector('.chat-widget-toggle');
    const chatWindow = document.querySelector('.chat-widget-window');

    if (!bottomBar || !chatBtn || !chatWindow) return;

    const isVisible = window.getComputedStyle(bottomBar).display !== 'none';

    if (isVisible) {
        chatBtn.style.bottom = '40px';
        chatWindow.style.bottom = '50px';
    } else {
        chatBtn.style.bottom = '20px';
        chatWindow.style.bottom = '30px';
    }
}






setInterval(adjustChatWidget, 300);

function openTrackOrders() {
    window.location.href = "/order-progress?active=true";
}
document.addEventListener('DOMContentLoaded', () => {
    loadCartState();
    fetch('/orders/history')
        .then(res => res.json())
        .then(orders => {
            const hasActive = orders.some(o => {
                const status = (o.status || "").toUpperCase();
                return status !== "COMPLETED" &&
                       status !== "CANCELLED" &&
                       status !== "DONE";
            });

            const icon = document.getElementById("trackOrdersIcon");

            if (icon) {
                icon.style.display = hasActive ? "flex" : "none";
            }
        })
        .catch(() => {
            const icon = document.getElementById("trackOrdersIcon");
            if (icon) icon.style.display = "none";
        });
});
function updateCardPrice(productId) {
    const product = data.find(p => p.product_id === productId);
    if (!product) return;

    const qty = parseInt(document.getElementById("qval-" + productId).value);


    const unitSelect = document.getElementById("unit-" + productId);
    const selectedOption = unitSelect.options[unitSelect.selectedIndex];

    const multiplier = getOptionMultiplier(selectedOption);

    const basePrice = parseFloat(product.price);

    const computed = basePrice * multiplier * qty;

    const priceEl = document.querySelector("#p-" + productId + " .label-price");

    if (priceEl) {
        priceEl.innerText = "₱" + computed.toFixed(2);
    }
}
function calculateTotal() {
    const footer = document.querySelector('.cart-footer');
    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    let total = 0;
    let count = 0;

    // if nothing selected, still show footer but show 0
    if (selectedItems.size === 0) {
        footer.style.display = 'flex';
        document.getElementById('displaySubtotal').innerText = "0.00";
        document.getElementById('selectedCount').innerText = "0";
        return;
    }


    footer.style.display = 'flex';

    document.getElementById('displaySubtotal').innerText = total.toFixed(2);
    document.getElementById('selectedCount').innerText = count;
}
function updateSubtotal() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    let totalPrice = 0;

    cart.forEach(item => {
        const price = parseFloat(item.basePrice || 0);
        const multiplier = parseFloat(item.multiplier || 1);
        const qty = parseInt(item.qty || 0);

        totalPrice += price * multiplier * qty;
    });

    const subTotalEl =
        document.getElementById('displaySubtotal') ||
        document.getElementById('subTotal');

    if (subTotalEl) {
        subTotalEl.innerText = totalPrice.toFixed(2);
    }
}
function syncShopWithCart() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    cart.forEach(item => {
        const qtyEl = document.getElementById("qval-" + item.product_id);
        const unitEl = document.getElementById("unit-" + item.product_id);

        if (qtyEl) qtyEl.value = item.qty;

        if (unitEl && item.unit) {
            unitEl.value = item.unit;
        }
    });
}
