document.addEventListener('DOMContentLoaded', () => {
    const listContainer    = document.getElementById('checkoutList');
    const finalTotalDisplay = document.getElementById('finalTotal');
    const orderNumDisplay  = document.getElementById('tempOrderNo');

    if (orderNumDisplay) orderNumDisplay.innerText = "Generating...";

    let checkoutItems = JSON.parse(localStorage.getItem('checkoutItems')) || [];
    let currentTotal = 0;

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

    const renderCheckout = async () => {
        await hydrateMissingCheckoutImages();

        if (checkoutItems.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">No items selected.</p>';
        } else {
            listContainer.innerHTML = '';
            currentTotal = 0;
            checkoutItems.forEach(item => {
                const base = parseFloat(item.basePrice ?? item.price ?? 0);
                const multiplier = parseFloat(item.multiplier ?? 1);
                const qty = parseInt(item.qty ?? 1);

                const itemTotal = base * multiplier * qty;
                currentTotal += itemTotal;

                const imgSrc = resolveItemImage(item);
                const div = document.createElement('div');
                div.className = 'checkout-item';
                div.innerHTML = `
                    <div class="checkout-img"><img src="${imgSrc}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" onerror="this.onerror=null;this.src='/static/img/no-image.svg';"></div>
                    <div class="item-details">
                        <h2 class="item-name">${item.name}</h2>
                        <div class="tag-row">
                            <span class="mini-tag">Qty: ${item.qty}</span>
                            <span class="mini-tag">${item.unit}</span>
                        </div>
                        <p class="item-amount">Product Amount: ₱${itemTotal}</p>
                    </div>
                `;
                listContainer.appendChild(div);
            });
        }

        if (finalTotalDisplay) finalTotalDisplay.innerText = currentTotal.toFixed(2);
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
    unit: item.unit ?? "1 pc"
})),
    payment_method: paymentMethod
})
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Save for progress page
                    localStorage.setItem('lastOrderItems', JSON.stringify(checkoutItems));
                    localStorage.setItem('lastOrderTotal', currentTotal);
                    localStorage.setItem('lastOrderNo', data.order_no);

                    // Clean up cart
                    localStorage.removeItem('checkoutItems');
                    localStorage.removeItem('cart');

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
