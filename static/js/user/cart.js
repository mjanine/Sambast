let cart = JSON.parse(localStorage.getItem('cart')) || [];
let selectedItems = new Set();

function renderCart() {
    const listContainer = document.getElementById('cartList');
    listContainer.innerHTML = '';

    if (cart.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; margin-top:50px; color:#666;">Your cart is empty.</p>';
        calculateTotal(); 
        return;
    }

    cart.forEach((item, index) => {

    const base = item.basePrice ?? item.price;
    const multiplier = item.multiplier ?? 1;
    const total = base * multiplier * item.qty;

    const card = document.createElement('div');
    card.className = 'cart-item-card';

    card.innerHTML = `
        <input type="checkbox" class="item-checkbox"
            onchange="toggleSelect(${index})"
            ${selectedItems.has(index) ? 'checked' : ''}>

        <div class="item-img-placeholder">image</div>

        <div class="item-details">
            <h2 class="item-name">${item.name}</h2>

            <select class="size-dropdown"
                onchange="updateUnit(${index}, this.value)">
                ${(getUnitOptions(item) || [{label:"1 pc", value:"1 pc", multiplier:1}]).map(u => `
                    <option 
                        value="${u.value}" 
                        data-multiplier="${u.multiplier}"
                        ${item.unit === u.value ? 'selected' : ''}>
                        ${u.label}
                    </option>
                `).join('')}
            </select>

            <p class="item-price">
                Product Amount: ₱${total.toFixed(2)}
            </p>

            <div class="qty-controls">
                <button class="qty-btn" onclick="updateQty(${index}, -1)">-</button>
                <span>${item.qty}</span>
                <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
            </div>
        </div>
    `;

    listContainer.appendChild(card);
});
    calculateTotal();
}

function updateQty(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty < 1) {
        cart.splice(index, 1);
        selectedItems.delete(index);
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
}

function toggleSelect(index) {
    if (selectedItems.has(index)) {
        selectedItems.delete(index);
    } else {
        selectedItems.add(index);
    }
    calculateTotal();
}

function calculateTotal() {
    let total = 0;
    const footer = document.querySelector('.cart-footer');

    // Toggle footer visibility based on selection
    if (selectedItems.size > 0) {
        footer.style.display = 'flex';
    } else {
        footer.style.display = 'none';
    }

    selectedItems.forEach(index => {
    if (cart[index]) {

        const base = parseFloat(cart[index].basePrice ?? cart[index].price ?? 0);
        const qty = parseInt(cart[index].qty ?? 0);
        const multiplier = parseFloat(cart[index].multiplier ?? 1);

        total += base * qty * multiplier;
    }
});
    
    document.getElementById('displaySubtotal').innerText =
    total > 0 ? total.toFixed(2) : "0.00";
    document.getElementById('displayDiscount').innerText = "0000"; 
    document.getElementById('selectedCount').innerText = selectedItems.size;
}

document.addEventListener('DOMContentLoaded', renderCart);

document.querySelector('.checkout-btn').addEventListener('click', () => {
    const selectedData = cart.filter((item, index) => selectedItems.has(index));
    if (selectedData.length === 0) {
        alert("Please select at least one item to checkout.");
        return;
    }
    localStorage.setItem('checkoutItems', JSON.stringify(selectedData));
    window.location.href = '/checkout';
});
function getUnitOptions(product) {
    if (!product) return [{ label: "1 pc", value: "1 pc", multiplier: 1 }];

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
    if (isPetFeed || isPoultry || isRabbitFeed || isBirdFeed) {
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
function updateUnit(index) {
    const select = document.querySelectorAll('.size-dropdown')[index];
    const option = select.options[select.selectedIndex];

    cart[index].unit = option.value;
    cart[index].multiplier = parseFloat(option.dataset.multiplier || 1);

    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart(); // 🔥 re-render so everything recalculates properly
}
function updateSubtotal() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    let qty = 0;
    let total = 0;

    cart.forEach(item => {
        const base = parseFloat(item.basePrice ?? item.price ?? 0);
        const mult = parseFloat(item.multiplier ?? 1);
        const q = parseInt(item.qty ?? 1);

        qty += q;
        total += base * mult * q;
    });

    document.getElementById('subTotal').innerText = total.toFixed(2);
    document.getElementById('btnQty').innerText = qty;

    document.querySelector('.bottom-bar').style.display =
        cart.length > 0 ? 'flex' : 'none';
}