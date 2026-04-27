let editMode = false;
let allSelected = false;

function canonicalizeUnitValue(unitValue) {
    const raw = String(unitValue || '').trim().toLowerCase();
    if (!raw) return '1 pc';
    if (['pc', 'pcs', 'piece', 'pieces'].includes(raw)) return '1 pc';
    return String(unitValue || '').trim();
}

let cart = (JSON.parse(localStorage.getItem('cart')) || []).map(item => {
    if (!item) return item;
    return {
        ...item,
        unit: canonicalizeUnitValue(item.unit),
        selected: !!item.selected
    };
});

let selectedItems = new Set();

function rebuildSelectedItems() {
    selectedItems = new Set();
    cart.forEach(item => {
        if (item && item.selected) {
            selectedItems.add(item.product_id + "_" + item.unit);
        }
    });
}

function persistCartState() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

rebuildSelectedItems();
persistCartState();

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

function normalizeDiscounts(discounts) {
    if (!Array.isArray(discounts)) return [];
    return discounts.map(entry => ({
        unit: String(entry && entry.unit ? entry.unit : "").trim(),
        type: String(entry && entry.type ? entry.type : "").trim().toLowerCase(),
        value: Number(entry && entry.value ? entry.value : 0)
    })).filter(entry => entry.unit && (entry.type === "percentage" || entry.type === "fixed") && Number.isFinite(entry.value) && entry.value > 0);
}

function getDiscountAmountPerUnit(item, unitValue, multiplierValue) {
    const base = parseFloat(item.basePrice ?? item.price ?? 0);
    const multiplier = Number.isFinite(Number(multiplierValue)) ? Number(multiplierValue) : 1;
    const originalUnitPrice = Math.max(0, base * multiplier);
    const unitKey = String(unitValue || "").trim().toLowerCase().replace(/\s+/g, "");
    const discounts = normalizeDiscounts(item.discounts);
    const discount = discounts.find(entry => String(entry.unit || "").trim().toLowerCase().replace(/\s+/g, "") === unitKey);
    if (!discount) return 0;

    if (discount.type === "percentage") {
        return Math.max(0, Math.min(originalUnitPrice, originalUnitPrice * (discount.value / 100)));
    }

    return Math.max(0, Math.min(originalUnitPrice, discount.value));
}

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
    const discountPerUnit = getDiscountAmountPerUnit(item, item.unit, multiplier);
    item.discountAmountPerUnit = discountPerUnit;
    const total = Math.max(0, (base * multiplier) - discountPerUnit) * item.qty;

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

    persistCartState();

    renderCart();
    calculateTotal();
    syncSelectAllCheckbox(); // 🔥 ADD THIS
}



function updateQty(index, delta) {
    if (!cart[index]) return;

    cart[index].qty = (cart[index].qty || 1) + delta;

    if (cart[index].qty < 1) {
        const removedId = cart[index].product_id + "_" + cart[index].unit;
        cart.splice(index, 1);
        selectedItems.delete(removedId);
    }

    persistCartState();

    renderCart();
    calculateTotal();
    syncSelectAllCheckbox(); // 🔥 ADD THIS
}

function toggleSelectAll(checkbox) {
    selectedItems.clear();

    if (checkbox.checked) {
        cart.forEach(item => {
            if (!item) return;
            item.selected = true;
            selectedItems.add(item.product_id + "_" + item.unit);
        });
    } else {
        cart.forEach(item => {
            if (!item) return;
            item.selected = false;
        });
    }

    persistCartState();
    renderCart();
    calculateTotal();
    syncSelectAllCheckbox();
}



function toggleSelect(index) {
    const id = cart[index].product_id + "_" + cart[index].unit;

    if (selectedItems.has(id)) {
        selectedItems.delete(id);
        cart[index].selected = false;
    } else {
        selectedItems.add(id);
        cart[index].selected = true;
    }

    persistCartState();
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
        const discountPerUnit = getDiscountAmountPerUnit(item, item.unit, multiplier);
        item.discountAmountPerUnit = discountPerUnit;

        total += Math.max(0, (base * multiplier) - discountPerUnit) * qty;
    });

    document.getElementById('displaySubtotal').innerText =
        total > 0 ? total.toFixed(2) : "0.00";

    const totalDiscount = cart.reduce((sum, item) => {
        const qty = parseInt(item.qty ?? 0);
        const discountPerUnit = getDiscountAmountPerUnit(item, item.unit, item.multiplier);
        return sum + (Math.max(0, discountPerUnit) * qty);
    }, 0);
    document.getElementById('displayDiscount').innerText = totalDiscount.toFixed(2);
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
    localStorage.setItem('checkoutSelectedIds', JSON.stringify(Array.from(selectedItems)));
    window.location.href = '/checkout';

});


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
function updateUnit(index) {
    const select = document.querySelectorAll('.size-dropdown')[index];
    const option = select.options[select.selectedIndex];

    const newUnit = canonicalizeUnitValue(option.value);
    const newMultiplier = getOptionMultiplier(option);

    const currentItem = cart[index];

    const oldId = currentItem.product_id + "_" + currentItem.unit;
    const wasSelected = !!currentItem.selected;

    currentItem.unit = newUnit;
    currentItem.multiplier = newMultiplier;
    currentItem.discountAmountPerUnit = getDiscountAmountPerUnit(currentItem, newUnit, newMultiplier);

    const newId = currentItem.product_id + "_" + newUnit;

    // 🔥 FIX: update selection key
    if (selectedItems.has(oldId)) {
        selectedItems.delete(oldId);
    }

    // merge duplicates
    const duplicateIndex = cart.findIndex((item, i) =>
        i !== index &&
        item.product_id === currentItem.product_id &&
        item.unit === newUnit
    );

    if (duplicateIndex !== -1) {
        const duplicateItem = cart[duplicateIndex];
        const duplicateId = duplicateItem.product_id + "_" + duplicateItem.unit;
        const mergedSelected = wasSelected || !!duplicateItem.selected;

        cart[duplicateIndex].qty += currentItem.qty;
        cart[duplicateIndex].selected = mergedSelected;
        cart.splice(index, 1);

        selectedItems.delete(duplicateId);
        if (mergedSelected) {
            selectedItems.add(duplicateId);
        }
    }

    if (duplicateIndex === -1) {
        currentItem.selected = wasSelected;
        if (wasSelected) {
            selectedItems.add(newId);
        }
    }

    persistCartState();

    renderCart();
    calculateTotal();
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
    cart.forEach(item => {
        if (!item) return;
        item.selected = true;
        selectedItems.add(item.product_id + "_" + item.unit);
    });
    persistCartState();
    renderCart();
    calculateTotal();
}


function deselectAllItems() {
    selectedItems.clear();
    cart.forEach(item => {
        if (!item) return;
        item.selected = false;
    });
    persistCartState();
    renderCart();
    calculateTotal();
}

/* =========================
   REMOVE SELECTED (SAFE FIX)
========================= */

function removeSelected() {
    if (selectedItems.size === 0) return;

    cart = cart.filter(item => !selectedItems.has(item.product_id + "_" + item.unit));

    cart = cart.map(item => ({
        ...item,
        selected: false
    }));

    selectedItems.clear();
    persistCartState();

    renderCart();
    calculateTotal();
}

