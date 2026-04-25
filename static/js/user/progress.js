document.addEventListener('DOMContentLoaded', () => {
    const itemsContainer = document.getElementById('orderItemsList');
    const totalDisplay   = document.getElementById('progressTotal');
    const statusText     = document.getElementById('statusText');
    const statusDesc     = document.getElementById('statusDesc');
    const cancelReasonText = document.getElementById('cancelReasonText');
    const orderNoDisplay = document.getElementById('orderNoDisplay');
    const backToShopBtn  = document.getElementById('backToShopBtn');

    // Load saved data from checkout (stored during the place_order fetch)
    const lastTotal = localStorage.getItem('lastOrderTotal');
    const lastItems = JSON.parse(localStorage.getItem('lastOrderItems')) || [];
    const lastOrderNo = localStorage.getItem('lastOrderNo');

    const lastDiscount = parseFloat(localStorage.getItem('lastOrderDiscount') || 0);
const lastSubtotal = parseFloat(lastTotal || 0);

const finalTotal = lastSubtotal - lastDiscount;

if (totalDisplay) {
    totalDisplay.innerText = `₱${(finalTotal || 0).toFixed(2)}`;
}

const discountRow = document.getElementById('discountRow');
const discountDisplay = document.getElementById('progressDiscount');

if (lastDiscount > 0) {
    if (discountRow) discountRow.style.display = "flex";
    if (discountDisplay) discountDisplay.innerText = (lastDiscount || 0).toFixed(2);
} else {
    if (discountRow) discountRow.style.display = "none";
}

    if (orderNoDisplay && lastOrderNo) orderNoDisplay.innerText = lastOrderNo;

    // Render items list onto the receipt UI
    if (lastItems.length > 0 && itemsContainer) {
        itemsContainer.innerHTML = '';
        lastItems.forEach(item => {

    const base = item.basePrice ?? item.price ?? 0;
    const multiplier = item.multiplier ?? 1;
    const total = base * multiplier * item.qty;

    const row = document.createElement('div');
    row.className = 'detail-item';

    row.innerHTML = `
        <div style="display:flex; flex-direction:column;">
            <span>${item.qty}x ${item.name}</span>
            <span style="font-size:12px; opacity:0.7;">
                Unit: ${item.unit || "1 pc"}
            </span>
        </div>

        <strong>₱${total.toFixed(2)}</strong>
    `;

    itemsContainer.appendChild(row);
});
    }

    // Handle "Back to Shop" navigation (Fixes the 404 error)
    if (backToShopBtn) {
    backToShopBtn.addEventListener('click', () => {
        // clear order session (optional)
        localStorage.removeItem('lastOrderItems');
        localStorage.removeItem('lastOrderTotal');
        localStorage.removeItem('lastOrderDiscount');
        localStorage.removeItem('lastOrderNo');

        window.location.href = '/shop';
    });
}


    /**
     * Updates the UI text and colors based on the current order status
     */
    function updateStatusUI(status, cancellationReason) {
        if (!statusText) return;
        statusText.innerText = status.toUpperCase();

        if (status === 'Ready') {
            statusDesc.innerText = "Your order is ready! Please head to the store and show your order number.";
            statusText.style.color = "#28a745";
            if (cancelReasonText) {
                cancelReasonText.style.display = 'none';
                cancelReasonText.innerText = '';
            }
        } else if (status === 'Completed') {
            statusDesc.innerText = "Order completed. Thank you for your purchase!";
            statusText.style.color = "#28a745";
            if (cancelReasonText) {
                cancelReasonText.style.display = 'none';
                cancelReasonText.innerText = '';
            }
        } else if (status === 'Cancelled') {
            statusDesc.innerText = "Your order has been cancelled. Please contact the shop for assistance.";
            statusText.style.color = "#dc3545";
            if (cancelReasonText) {
                const reasonText = (cancellationReason || '').trim();
                cancelReasonText.innerText = reasonText
                    ? `Reason: ${reasonText}`
                    : 'Reason: No reason provided.';
                cancelReasonText.style.display = 'block';
            }
        } else {
            statusDesc.innerText = "Your order is being prepared. We'll notify you when it's ready for pick-up!";
            statusText.style.color = "#1A323E";
            if (cancelReasonText) {
                cancelReasonText.style.display = 'none';
                cancelReasonText.innerText = '';
            }
        }
    }

    /**
     * Polls the server for the order status of the specific order being viewed
     */
    function pollStatus() {
        // Use the specific order number stored from checkout, not just "latest"
        if (!lastOrderNo) {
            console.log("Status check: No order number in session");
            return;
        }

        fetch(`/orders/${lastOrderNo}/status`)
            .then(res => {
                if (!res.ok) throw new Error('Order not found');
                return res.json();
            })
            .then(data => {
                if (data.status) {
                    updateStatusUI(data.status, data.cancellation_reason);
                }
            })
            .catch(err => {
                console.log("Status check:", err.message);
            });
    }

    // Initial check and then poll every 5 seconds
    pollStatus();
    setInterval(pollStatus, 5000);
});
const helpBtn = document.getElementById("helpBtn");

document.getElementById("helpBtn").addEventListener("click", () => {
    window.location.href = "/cancel-order";
});