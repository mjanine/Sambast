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
        let itemsHtml = order.items.map(item => `
            <div class="history-item">
                <div class="item-img-placeholder">image</div>
                <div class="item-details">
                    <h2 class="product-name">${item.name}</h2>
                    <p class="amount-label">Price: ₱${item.price_at_time}</p>
                    <p class="qty-summary">Qty: ${item.qty}</p>
                </div>
                <button class="buy-again-btn" onclick='buyAgain(${JSON.stringify(item)})'>BUY AGAIN</button>
            </div>
        `).join('');

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
                <strong>Total: ₱${order.total_price}</strong>
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
        name : item.name,
        price: item.price_at_time,
        qty  : item.qty
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