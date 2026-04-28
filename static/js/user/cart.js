window.ShopCore = window.ShopCore || {};

let editMode = false;

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

function getFullProduct(item) {
    const base = item.basePrice ?? item.price ?? 0;

    return {
        name: item.name,
        category: item.category || item.cat || "",
        price: base,
        unit_options: item.unit_options || [],
        discounts: item.discounts || []
    };
}

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

function normalizeUnitKey(unitValue) {
    return String(unitValue || '').trim().toLowerCase().replace(/\s+/g, '');
}

function findUnitOption(options, unitValue) {
    const targetKey = normalizeUnitKey(unitValue);
    if (!targetKey) return null;
    return options.find(option => normalizeUnitKey(option.value) === targetKey) || null;
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

async function hydrateCartUnitOptions() {
    const needsHydration = cart.some(item => item && item.product_id);
    if (!needsHydration) return;

    try {
        const response = await fetch('/products');
        if (!response.ok) return;

        const products = await response.json();
        const productById = new Map((products || []).map(p => [p.product_id, p]));

        let changed = false;
        const nextCart = [];

        cart.forEach(item => {
            if (!item || !item.product_id) return;

            const product = productById.get(item.product_id);
            if (!product) {
                changed = true;
                return;
            }

            const stock = Number(product.stock_status ?? 0);
            if (!Number.isFinite(stock) || stock <= 0) {
                changed = true;
                return;
            }

            const options = normalizeUnitOptions(product.unit_options || product.unitOptions);
            if (!options.length) {
                nextCart.push(item);
                return;
            }

            const matchedOption = findUnitOption(options, item.unit) || options[0];
            const normalizedUnit = canonicalizeUnitValue(matchedOption.value);
            const normalizedMultiplier = Number.isFinite(Number(matchedOption.multiplier)) ? Number(matchedOption.multiplier) : 1;

            if (
                !item.unit_options ||
                normalizeUnitKey(item.unit) !== normalizeUnitKey(normalizedUnit) ||
                Number(item.multiplier) !== normalizedMultiplier
            ) {
                changed = true;
            }

            nextCart.push({
                ...item,
                unit: normalizedUnit,
                multiplier: normalizedMultiplier,
                unit_options: options
            });
        });

        if (changed) {
            cart = nextCart;
            rebuildSelectedItems();
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

    const product = getFullProduct(item);
const base = product.price;
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
    ${(getUnitOptions(getFullProduct(item)) || [{label:"1 pc", value:"1 pc", multiplier:1}]).map(u => `
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
    const id = item.product_id + "_" + item.unit;
    if (!selectedItems.has(id)) return sum;
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
        checkbox.indeterminate = true;
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    await hydrateMissingCartImages();
    await hydrateCartUnitOptions();
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
    if (!product) {
        return [{ label: "1 pc", value: "1 pc", multiplier: 1 }];
    }

    const storedUnitOptions = normalizeUnitOptions(product.unit_options || product.unitOptions);
    if (storedUnitOptions.length > 0) {
        return storedUnitOptions;
    }

    return [{ label: "1 pc", value: "1 pc", multiplier: 1 }];
}
function updateUnit(index, selectedValue) {
    const select = document.querySelectorAll('.size-dropdown')[index];
    if (!select) return;

    const option = Array.from(select.options).find(o => o.value === selectedValue);
    if (!option) return;

    const newUnit = canonicalizeUnitValue(option.value);
    const newMultiplier = getOptionMultiplier(option);

    const currentItem = cart[index];
    if (!currentItem) return;

    const oldId = currentItem.product_id + "_" + currentItem.unit;
    const wasSelected = !!currentItem.selected;

    currentItem.unit = newUnit;
    currentItem.multiplier = newMultiplier;
    currentItem.discountAmountPerUnit = getDiscountAmountPerUnit(currentItem, newUnit, newMultiplier);

    const newId = currentItem.product_id + "_" + newUnit;

    if (selectedItems.has(oldId)) {
        selectedItems.delete(oldId);
    }

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

