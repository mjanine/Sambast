document.addEventListener('DOMContentLoaded', () => {
    const itemsContainer = document.getElementById('orderItemsList');
    const totalDisplay = document.getElementById('progressTotal');
    const statusText = document.getElementById('statusText');
    const statusDesc = document.getElementById('statusDesc');
    
    // Fetch order data from storage
    const lastTotal = localStorage.getItem('lastOrderTotal');
    const lastItemsData = localStorage.getItem('lastOrderItems');
    const lastItems = JSON.parse(lastItemsData) || [];

    // Apply Total
    totalDisplay.innerText = lastTotal ? lastTotal : "0000";

    // Dynamic Status Logic
    function checkStatus() {
        const currentStatus = localStorage.getItem('orderStatus') || 'Preparing';
        statusText.innerText = currentStatus;

        if (currentStatus === 'Ready for Pick-up') {
            statusDesc.innerText = "Your order is ready! Please head to the store and show your order number.";
            statusText.style.color = "#28a745"; 
        } else {
            statusDesc.innerText = "Your order is being prepared. We'll notify you when it's ready for pick-up!";
            statusText.style.color = "#000000";
        }
    }

    // Initialize and start polling every 2 seconds
    checkStatus();
    setInterval(checkStatus, 2000);

    // List out items from checkout
    if (lastItems.length > 0) {
        itemsContainer.innerHTML = ''; 
        lastItems.forEach(item => {
            const itemRow = document.createElement('div');
            itemRow.className = 'detail-item';
            itemRow.innerHTML = `
                <span>${item.qty}x ${item.name}</span>
                <strong>${item.price * item.qty}</strong>
            `;
            itemsContainer.appendChild(itemRow);
        });
    }
});