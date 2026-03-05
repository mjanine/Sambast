document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('checkoutList');
    const finalTotalDisplay = document.getElementById('finalTotal');
    const orderNumDisplay = document.getElementById('tempOrderNo');

    if (orderNumDisplay) {
        orderNumDisplay.innerText = "00000000";
    }

    const checkoutItemsData = localStorage.getItem('checkoutItems');
    const checkoutItems = JSON.parse(checkoutItemsData) || [];
    let currentTotal = 0;

    if (checkoutItems.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">No items selected.</p>';
    } else {
        listContainer.innerHTML = ''; 
        
        checkoutItems.forEach(item => {
            const itemTotal = item.price * item.qty;
            currentTotal += itemTotal;

            const div = document.createElement('div');
            div.className = 'checkout-item';
            div.innerHTML = `
                <div class="checkout-img">image</div>
                <div class="item-details">
                    <h2 class="item-name">${item.name}</h2>
                    <div class="tag-row">
                        <span class="mini-tag">Kilo/ Size ↕</span>
                        <span class="mini-tag">Qty: — ${item.qty} +</span>
                    </div>
                    <p class="item-amount">Product Amount: ${itemTotal}</p>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }

    if (finalTotalDisplay) {
        finalTotalDisplay.innerText = currentTotal === 0 ? "0000" : currentTotal;
    }

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
        placeOrderBtn.onclick = () => {
            // 1. Capture the data while it still exists
            const totalToSave = finalTotalDisplay.innerText;
            const itemsToSave = localStorage.getItem('checkoutItems');

            // 2. Save for the Progress Page
            localStorage.setItem('lastOrderItems', itemsToSave);
            localStorage.setItem('lastOrderTotal', totalToSave);
            
            // 3. Set initial status for the dynamic progress tracker
            localStorage.setItem('orderStatus', 'Preparing');

            alert("Order Successfully Placed!");
            
            // 4. Clean up and Redirect
            localStorage.removeItem('checkoutItems');
            window.location.href = 'myorderprogress.html';
        };
    }
});