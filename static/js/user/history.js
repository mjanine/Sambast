function renderHistory(orders) {
    const container = document.getElementById('orderHistoryList');
    if (!container) return;
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align:center; margin-top:50px; color:#666;">No orders yet.</p>';
        return;
    }

    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'history-card';

        // Create a sub-list for items
        let itemsHtml = order.items.map(item => {

    const base = parseFloat(item.basePrice ?? item.price_at_time ?? item.price ?? 0);
    const multiplier = parseFloat(item.multiplier ?? 1);
    const qty = item.qty ?? 1;

    const itemTotal = (base || 0) * (multiplier || 1) * (qty || 1);

    return `
        <div class="history-item">
            <div class="item-img-placeholder">image</div>

            <div class="item-details">
                <h2 class="product-name">
                    ${item.name} (${item.unit || "1 pc"})
                </h2>

                <p class="amount-label">
                    Price: ₱${itemTotal.toFixed(2)}
                </p>

                <p class="qty-summary">
                    Qty: ${qty}
                </p>
            </div>

            <button class="buy-again-btn"
                onclick='buyAgain(${JSON.stringify(item)})'>
                BUY AGAIN
            </button>
        </div>
    `;
}).join('');

        card.innerHTML = `
            <div class="order-header">
                <h3>Order: ${order.order_no}</h3>
                <span class="order-status">${order.status}</span>
            </div>
            <div class="order-body">
                ${itemsHtml}
            </div>
            <div class="order-footer">
                <span>${new Date(order.created_at).toLocaleString()}</span>
                <strong>
    Total: ₱${
        (order.total_price ??
        order.items.reduce((sum, item) => {
    const base = parseFloat(item.basePrice ?? item.price_at_time ?? item.price ?? 0);
    const multiplier = parseFloat(item.multiplier ?? 1);
    const qty = parseInt(item.qty ?? 1);

    return sum + (base * multiplier * qty);
}, 0)
    ).toFixed(2)}
</strong>
            </div>
        `;
        container.appendChild(card);
    });
}

function buyAgain(item) {

    if (!item.product_id) {
        alert("Cannot re-order this item as its ID is missing.");
        return;
    }

    const itemToBuy = [{
        product_id: item.product_id,
        name: item.name,
        qty: item.qty,

        // FIX: correct pricing + unit preservation
        basePrice: parseFloat(item.basePrice ?? item.price_at_time ?? item.price ?? 0),
        multiplier: item.multiplier ?? 1,
        unit: item.unit ?? "1 pc"
    }];

    localStorage.setItem('checkoutItems', JSON.stringify(itemToBuy));
    window.location.href = '/checkout';
}

document.addEventListener('DOMContentLoaded', () => {
    fetch('/orders/history')
        .then(res => res.json())
        .then(orders => renderHistory(orders))
        .catch(() => {
            const container = document.getElementById('orderHistoryList');
            if (container) container.innerHTML =
                '<p style="text-align:center; margin-top:50px; color:#666;">Failed to load history.</p>';
        });
});