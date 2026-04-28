document.addEventListener('DOMContentLoaded', () => {
    const listContainer    = document.getElementById('checkoutList');
    const finalTotalDisplay = document.getElementById('finalTotal');
    const orderNumDisplay  = document.getElementById('tempOrderNo');

    if (orderNumDisplay) orderNumDisplay.innerText = "Generating...";

    function canonicalizeUnitValue(unitValue) {
        const raw = String(unitValue || '').trim().toLowerCase();
        if (!raw) return '1 pc';
        if (['pc', 'pcs', 'piece', 'pieces'].includes(raw)) return '1 pc';
        return String(unitValue || '').trim();
    }

    function cartItemId(item) {
        if (!item) return '';
        return String(item.product_id) + "_" + canonicalizeUnitValue(item.unit);
    }

    function removeCheckedItemsFromCart() {
        const storedCart = JSON.parse(localStorage.getItem('cart')) || [];
        const selectedIds = JSON.parse(localStorage.getItem('checkoutSelectedIds')) || [];

        let ids = Array.isArray(selectedIds) ? selectedIds : [];
        if (ids.length === 0) {
            ids = checkoutItems.map(cartItemId).filter(Boolean);
        }

        const idSet = new Set(ids);
        const updatedCart = storedCart.filter(item => !idSet.has(cartItemId(item)));

        localStorage.setItem('cart', JSON.stringify(updatedCart));
        localStorage.removeItem('checkoutSelectedIds');
    }

    let checkoutItems = (JSON.parse(localStorage.getItem('checkoutItems')) || []).map(item => {
        if (!item) return item;
        return {
            ...item,
            unit: canonicalizeUnitValue(item.unit)
        };
    });
    localStorage.setItem('checkoutItems', JSON.stringify(checkoutItems));
    let currentTotal = 0;
    let currentSubtotal = 0;
    let currentDiscount = 0;

    function normalizeUnitOptions(options) {
        if (!Array.isArray(options)) return [];
        return options.map(option => ({
            label: String(option && option.label ? option.label : (option && option.value ? option.value : '')).trim(),
            value: String(option && option.value ? option.value : (option && option.label ? option.label : '')).trim(),
            multiplier: Number(option && option.multiplier ? option.multiplier : 1)
        })).filter(option => option.label && option.value);
    }

    function normalizeUnitKey(unitValue) {
        return String(unitValue || '').trim().toLowerCase().replace(/\s+/g, '');
    }

    function findUnitOption(options, unitValue) {
        const targetKey = normalizeUnitKey(unitValue);
        if (!targetKey) return null;
        return options.find(option => normalizeUnitKey(option.value) === targetKey) || null;
    }

    function renderUnitControl(item, index) {
        const options = normalizeUnitOptions(item && item.unit_options);
        if (!options.length) {
            return `<span class="mini-tag">${item.unit || '1 pc'}</span>`;
        }

        return `
            <select class="mini-tag" style="border:none;" data-checkout-index="${index}" onchange="window.__checkoutChangeUnit(this)">
                ${options.map(option => `
                    <option value="${option.value}" data-multiplier="${option.multiplier}" ${String(item.unit || '').toLowerCase() === String(option.value || '').toLowerCase() ? 'selected' : ''}>
                        ${option.label}
                    </option>
                `).join('')}
            </select>
        `;
    }

    function resolveItemImage(item) {
        const rawImage = item?.image || item?.image_filename || item?.img || '';
        if (!rawImage) return '/static/img/no-image.svg';

        const image = String(rawImage).trim();
        if (!image) return '/static/img/no-image.svg';

        if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
            return image;
        }

        return '/product-image/' + encodeURIComponent(image);
    }

    async function hydrateMissingCheckoutImages() {
        const needsHydration = checkoutItems.some(item => item && item.product_id && !(item.image || item.image_filename || item.img));
        if (!needsHydration) return;

        try {
            const response = await fetch('/products');
            if (!response.ok) return;

            const products = await response.json();
            const imageById = new Map((products || []).map(p => [p.product_id, p.image_filename]));

            let changed = false;
            checkoutItems = checkoutItems.map(item => {
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
                localStorage.setItem('checkoutItems', JSON.stringify(checkoutItems));
            }
        } catch (_) {
            // Keep checkout functional even if hydration request fails.
        }
    }

    async function hydrateCheckoutUnitOptions() {
        const needsHydration = checkoutItems.some(item => item && item.product_id);
        if (!needsHydration) return;

        try {
            const response = await fetch('/products');
            if (!response.ok) return;

            const products = await response.json();
            const productById = new Map((products || []).map(p => [p.product_id, p]));

            let changed = false;
            const nextItems = [];

            checkoutItems.forEach(item => {
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
                    nextItems.push(item);
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

                nextItems.push({
                    ...item,
                    unit: normalizedUnit,
                    multiplier: normalizedMultiplier,
                    unit_options: options
                });
            });

            if (changed) {
                checkoutItems = nextItems;
                localStorage.setItem('checkoutItems', JSON.stringify(checkoutItems));
            }
        } catch (_) {
            // Keep checkout functional even if hydration request fails.
        }
    }

    const renderCheckout = async () => {
        await hydrateMissingCheckoutImages();
        await hydrateCheckoutUnitOptions();

        if (checkoutItems.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">No items selected.</p>';
        } else {
            listContainer.innerHTML = '';
            currentTotal = 0;
            checkoutItems.forEach((item, index) => {
                const base = parseFloat(item.basePrice ?? item.price ?? 0);
                const multiplier = parseFloat(item.multiplier ?? 1);
                const qty = parseInt(item.qty ?? 1);

                const imgSrc = resolveItemImage(item);
                const div = document.createElement('div');
                div.className = 'checkout-item';
                div.innerHTML = `
                    <div class="checkout-img"><img src="${imgSrc}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" onerror="this.onerror=null;this.src='/static/img/no-image.svg';"></div>
                    <div class="item-details">
                        <h2 class="item-name">${item.name}</h2>
                        <div class="tag-row">
                            <span class="mini-tag">Qty: ${item.qty}</span>
                            ${renderUnitControl(item, index)}
                        </div>
                    </div>
                `;
                listContainer.appendChild(div);
            });
        }

        await refreshQuoteAndSummary();
    };

    async function refreshQuoteAndSummary() {
        currentSubtotal = 0;
        currentDiscount = 0;
        currentTotal = 0;

        if (!Array.isArray(checkoutItems) || checkoutItems.length === 0) {
            updateSummary();
            return;
        }

        try {
            const response = await fetch('/orders/quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: checkoutItems })
            });
            const payload = await response.json();
            if (!response.ok || !payload || !payload.summary) {
                throw new Error(payload && payload.error ? payload.error : 'Unable to validate pricing.');
            }

            currentSubtotal = Number(payload.summary.subtotal || 0);
            currentDiscount = Number(payload.summary.discount || 0);
            currentTotal = Number(payload.summary.total || 0);
        } catch (error) {
            currentSubtotal = checkoutItems.reduce((sum, item) => {
                const base = parseFloat(item.basePrice ?? item.price ?? 0);
                const multiplier = parseFloat(item.multiplier ?? 1);
                const qty = parseInt(item.qty ?? 1);
                return sum + (base * multiplier * qty);
            }, 0);
            currentDiscount = 0;
            currentTotal = currentSubtotal;
        }

        updateSummary();
    }

    function updateSummary() {
        const subtotalDisplay = document.getElementById('displaySubtotal');
        const originalDisplay = document.getElementById('displayOriginal');
        const discountDisplay = document.getElementById('displayDiscount');
        const totalDisplay = document.getElementById('displayTotal');

        const originalPrice = currentSubtotal;
        const totalDiscount = currentDiscount;
        const finalTotal = currentTotal;
        
        if (subtotalDisplay) {
            subtotalDisplay.innerText = currentTotal > 0 ? currentTotal.toFixed(2) : "0.00";
        }
        if (originalDisplay) {
            originalDisplay.innerText = originalPrice > 0 ? originalPrice.toFixed(2) : "0.00";
        }
        if (discountDisplay) {
            discountDisplay.innerText = totalDiscount > 0 ? totalDiscount.toFixed(2) : "0.00";
        }
        if (totalDisplay) {
            totalDisplay.innerText = finalTotal > 0 ? finalTotal.toFixed(2) : "0.00";
        }
        
        if (finalTotalDisplay) {
            finalTotalDisplay.innerText = finalTotal > 0 ? finalTotal.toFixed(2) : "0.00";
        }
        
        const subtotalRow = document.getElementById('subtotalRow');
        const originalRow = document.getElementById('originalRow');
        const discountRow = document.getElementById('discountRow');
        const divider = document.getElementById('divider');
        
        if (totalDiscount > 0) {
            if (subtotalRow) subtotalRow.style.display = 'flex';
            if (originalRow) originalRow.style.display = 'flex';
            if (discountRow) discountRow.style.display = 'flex';
            if (divider) divider.style.display = 'block';
        } else {
            if (subtotalRow) subtotalRow.style.display = 'none';
            if (originalRow) originalRow.style.display = 'none';
            if (discountRow) discountRow.style.display = 'none';
            if (divider) divider.style.display = 'none';
        }
    }

    window.__checkoutChangeUnit = function(selectElement) {
        const itemIndex = Number(selectElement.getAttribute('data-checkout-index'));
        if (!Number.isFinite(itemIndex) || !checkoutItems[itemIndex]) return;

        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const selectedUnit = canonicalizeUnitValue(selectedOption.value);
        const selectedMultiplier = Number(selectedOption.getAttribute('data-multiplier') || 1);

        checkoutItems[itemIndex].unit = selectedUnit || checkoutItems[itemIndex].unit;
        checkoutItems[itemIndex].multiplier = Number.isFinite(selectedMultiplier) ? selectedMultiplier : 1;
        localStorage.setItem('checkoutItems', JSON.stringify(checkoutItems));
        refreshQuoteAndSummary();
    };
    renderCheckout();

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
        placeOrderBtn.onclick = () => {
            if (checkoutItems.length === 0) {
                showNotification("Warning", "No items to order");
                return;
            }

            const paymentInput = document.querySelector('input[name="payment_method"]:checked');
            const paymentMethod = paymentInput ? paymentInput.value : 'cash';

            placeOrderBtn.style.pointerEvents = 'none';
            placeOrderBtn.style.opacity = '0.6';
            placeOrderBtn.querySelector('.place-label').innerText = "Placing Order...";

            fetch('/orders', {
                method : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
    items: checkoutItems.map(item => ({
    product_id: item.product_id,
    name: item.name,
    qty: item.qty,

    // 🔥 THIS IS THE FIX
    basePrice: item.basePrice ?? item.price,
    multiplier: item.multiplier ?? 1,
    unit: canonicalizeUnitValue(item.unit) || "1 pc"
})),
    payment_method: paymentMethod
})
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Save for progress page
                    localStorage.setItem('lastOrderItems', JSON.stringify(checkoutItems));
                    localStorage.setItem('lastOrderSubtotal', String(currentSubtotal || 0));
                    localStorage.setItem('lastOrderDiscount', String(currentDiscount || 0));
                    localStorage.setItem('lastOrderTotal', String(currentTotal || 0));
                    localStorage.setItem('lastOrderNo', data.order_no);

                    // Clean up checkout state and remove only selected items from cart
                    localStorage.removeItem('checkoutItems');
                    removeCheckedItemsFromCart();

                    showNotification("Success", "Order placed successfully");
setTimeout(() => {
    window.location.href = '/order-progress';
}, 3000); // 3 seconds delay
                } else {
                    showNotification("Error", data.error || "Failed to place order");
                    placeOrderBtn.style.pointerEvents = 'auto';
                    placeOrderBtn.style.opacity = '1';
                    placeOrderBtn.innerText = "PLACE ORDER";
                }
            })
            .catch(() => {
                showNotification("Error", "Network error. Try again");
                placeOrderBtn.style.pointerEvents = 'auto';
                placeOrderBtn.style.opacity = '1';
                placeOrderBtn.innerText = "PLACE ORDER";
            });
        };
    }
});
let notificationTimeout;

function showNotification(title, message) {
    const notif = document.getElementById('notification');

    document.querySelector('.notif-title').innerText = title;
    document.querySelector('.notif-msg').innerText = message;

    notif.classList.remove('show');
    void notif.offsetHeight;
    notif.classList.add('show');

    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        hideNotification();
    }, 3000);
}

function hideNotification() {
    const notif = document.getElementById('notification');
    notif.classList.remove('show');
}
