let editMode = false;
let allSelected = false;

let cart = JSON.parse(localStorage.getItem('cart')) || [];
let selectedItems = new Set();

function resolveCartImage(item) {
    const rawImage = item?.image || item?.image_filename || item?.img || '';
    if (!rawImage) return '/static/img/no-image.svg';

    const image = String(rawImage).trim();
    if (!image) return '/static/img/no-image.svg';

    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
        return image;
    }

    return '/product-image/' + encodeURIComponent(image);
}

async function hydrateMissingCartImages() {
    const needsHydration = cart.some(item => item && item.product_id && !(item.image || item.image_filename || item.img));
    if (!needsHydration) return;

    try {
        const response = await fetch('/products');
        if (!response.ok) return;

        const products = await response.json();
        const imageById = new Map((products || []).map(p => [p.product_id, p.image_filename]));

        let changed = false;
        cart = cart.map(item => {
            if (!item || !item.product_id) return item;
            if (item.image || item.image_filename || item.img) return item;

            const filename = imageById.get(item.product_id);
            if (!filename) return item;

            changed = true;
            return {
                ...item,
                image: filename,
                image_filename: filename
            };
        });

        if (changed) {
            localStorage.setItem('cart', JSON.stringify(cart));
        }
    } catch (_) {
        // Keep cart functional even if hydration request fails.
    }
}

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

    const imageSrc = resolveCartImage(item);

    card.innerHTML = `
        <input type="checkbox" class="item-checkbox"
            onchange="toggleSelect(${index})"
            ${selectedItems.has(item.product_id + "_" + item.unit) ? 'checked' : ''}>

        <img class="item-img" src="${imageSrc}" alt="${item.name}" onerror="this.onerror=null;this.src='/static/img/no-image.svg';">

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

    <input 
        type="number"
        class="qty-input"
        value="${item.qty}"
        min="1"
        onchange="setQty(${index}, this.value)"
    >

    <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
</div>

        </div>
    `;

    listContainer.appendChild(card);
});
    calculateTotal();
}
function setQty(index, value) {
    let qty = parseInt(value);

    if (isNaN(qty) || qty < 1) qty = 1;

    cart[index].qty = qty;

    localStorage.setItem('cart', JSON.stringify(cart));

    renderCart();
    calculateTotal();
    syncSelectAllCheckbox(); // 🔥 ADD THIS
}



function updateQty(index, delta) {
    if (!cart[index]) return;

    cart[index].qty = (cart[index].qty || 1) + delta;

    if (cart[index].qty < 1) {
        cart.splice(index, 1);
        selectedItems.clear();
    }

    localStorage.setItem('cart', JSON.stringify(cart));

    renderCart();
    calculateTotal();
    syncSelectAllCheckbox(); // 🔥 ADD THIS
}

function toggleSelectAll(checkbox) {
    selectedItems.clear();

    if (checkbox.checked) {
        cart.forEach(item => {
            selectedItems.add(item.product_id + "_" + item.unit);
        });
    }

    renderCart();
    calculateTotal();
    syncSelectAllCheckbox();
}



function toggleSelect(index) {
    const id = cart[index].product_id + "_" + cart[index].unit;

    if (selectedItems.has(id)) {
        selectedItems.delete(id);
    } else {
        selectedItems.add(id);
    }

    calculateTotal();
    syncSelectAllCheckbox(); // 🔥 ADD THIS
}



function calculateTotal() {
    let total = 0;
    const footer = document.querySelector('.cart-footer');

    if (selectedItems.size > 0) {
        footer.style.display = 'flex';
    } else {
        footer.style.display = 'none';
    }

    selectedItems.forEach(id => {
        const item = cart.find(p => (p.product_id + "_" + p.unit) === id);
        if (!item) return;

        const base = parseFloat(item.basePrice ?? item.price ?? 0);
        const qty = parseInt(item.qty ?? 0);
        const multiplier = parseFloat(item.multiplier ?? 1);

        total += base * qty * multiplier;
    });

    document.getElementById('displaySubtotal').innerText =
        total > 0 ? total.toFixed(2) : "0.00";

    document.getElementById('displayDiscount').innerText = "0000";
    document.getElementById('selectedCount').innerText = selectedItems.size;
    syncSelectAllCheckbox();

}

function syncSelectAllCheckbox() {
    const checkbox = document.getElementById('selectAllCheckbox');
    if (!checkbox) return;

    if (cart.length === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
        return;
    }

    const selectedCount = cart.filter(item =>
        selectedItems.has(item.product_id + "_" + item.unit)
    ).length;

    if (selectedCount === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } 
    else if (selectedCount === cart.length) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
    } 
    else {
        // 🔥 partial selection state (VERY IMPORTANT UX)
        checkbox.checked = false;
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    await hydrateMissingCartImages();
    renderCart();
});

document.querySelector('.checkout-btn').addEventListener('click', () => {
    const selectedData = cart.filter(item =>
        selectedItems.has(item.product_id + "_" + item.unit)
    );

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
function updateUnit(index) {
    const select = document.querySelectorAll('.size-dropdown')[index];
    const option = select.options[select.selectedIndex];

    const newUnit = option.value;
    const newMultiplier = parseFloat(option.dataset.multiplier || 1);

    const currentItem = cart[index];

    const oldId = currentItem.product_id + "_" + currentItem.unit;

    currentItem.unit = newUnit;
    currentItem.multiplier = newMultiplier;

    const newId = currentItem.product_id + "_" + newUnit;

    // 🔥 FIX: update selection key
    if (selectedItems.has(oldId)) {
        selectedItems.delete(oldId);
        selectedItems.add(newId);
    }

    // merge duplicates
    const duplicateIndex = cart.findIndex((item, i) =>
        i !== index &&
        item.product_id === currentItem.product_id &&
        item.unit === newUnit
    );

    if (duplicateIndex !== -1) {
        cart[duplicateIndex].qty += currentItem.qty;
        cart.splice(index, 1);

        selectedItems.clear(); // safer reset after merge
    }

    localStorage.setItem('cart', JSON.stringify(cart));

    renderCart();
    calculateTotal();
}


function toggleEditMode() {
    editMode = !editMode;

    const editBtn = document.getElementById("editBtn");
    const normalFooter = document.getElementById("normalFooter");
    const checkoutBtn = document.getElementById("checkoutBtn");
    const editFooter = document.getElementById("editFooter");
    const footer = document.querySelector(".cart-footer");

    if (editMode) {
        editBtn.innerText = "Done";

        normalFooter.style.display = "none";
        checkoutBtn.style.display = "none";
        editFooter.style.display = "flex";

        footer.classList.add("edit-mode");
    } else {
        editBtn.innerText = "Edit";

        normalFooter.style.display = "flex";
        checkoutBtn.style.display = "block";
        editFooter.style.display = "none";

        footer.classList.remove("edit-mode");

        selectedItems.clear();
        renderCart();
        calculateTotal();
    }
}
/* =========================
   EDIT MODE SYSTEM (SAFE)
========================= */

function toggleEditMode() {
    editMode = !editMode;

    const editFooter = document.getElementById('editFooter');
    const normalFooter = document.getElementById('normalFooter');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const footer = document.querySelector('.cart-footer');
    const editBtn = document.getElementById('editBtn');

    if (!editFooter || !normalFooter || !checkoutBtn) return;

    if (editMode) {
        editFooter.style.display = 'flex';
        normalFooter.style.display = 'none';
        checkoutBtn.style.display = 'none';
        footer.classList.add('edit-mode');
        editBtn.innerText = "Done";
    } else {
        editFooter.style.display = 'none';
        normalFooter.style.display = 'flex';
        checkoutBtn.style.display = 'inline-block';
        footer.classList.remove('edit-mode');
        editBtn.innerText = "Edit";
    }
}

/* =========================
   SELECT ALL / NONE
========================= */

function selectAllItems() {
    selectedItems.clear();
    cart.forEach(item => selectedItems.add(item.product_id + "_" + item.unit));
    renderCart();
    calculateTotal();
}


function deselectAllItems() {
    selectedItems.clear();
    renderCart();
    calculateTotal();
}

/* =========================
   REMOVE SELECTED (SAFE FIX)
========================= */

function removeSelected() {
    if (selectedItems.size === 0) return;

    cart = cart.filter(item => !selectedItems.has(item.product_id + "_" + item.unit));

    selectedItems.clear();
    localStorage.setItem('cart', JSON.stringify(cart));

    renderCart();
    calculateTotal();
}

