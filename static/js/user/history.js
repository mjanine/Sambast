var data = [
    { id: 1, name: "Product A", cat: "Category 1", price: 500, desc: "Premium selection product description." },
    { id: 2, name: "Product B", cat: "Category 1", price: 750, desc: "High quality item with best reviews." },
    { id: 3, name: "Product C", cat: "Category 2", price: 1200, desc: "Luxury tier product for specialized use." },
    { id: 4, name: "Product D", cat: "Category 3", price: 300, desc: "Budget friendly option for daily needs." }
];

const historyData = [
    { id: 1, qty: 2, orderNo: "ORD-1001" },
    { id: 2, qty: 1, orderNo: "ORD-1002" },
    { id: 3, qty: 1, orderNo: "ORD-1003" },
    { id: 4, qty: 4, orderNo: "ORD-1004" }
];

function renderHistory() {
    const container = document.getElementById('orderHistoryList');
    if (!container) return;
    container.innerHTML = '';

    historyData.forEach(histItem => {
        const product = data.find(p => p.id === histItem.id);
        
        if (product) {
            const total = product.price * histItem.qty;
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="item-img-placeholder">image</div>
                <div class="order-info">
                    <h2 class="product-name">${product.name}</h2>
                    <p class="kilos-size">Kilos/size</p>
                    <p class="amount-label">Product Amount: ${product.price}</p>
                    <p class="qty-summary">Product qty: ${histItem.qty}</p>
                    <p class="total-amount">Total Amount: ${total}</p>
                    <p class="order-no">Order no: ${histItem.orderNo}</p>
                    <button class="buy-again-btn" onclick="buyAgain(${product.id}, ${histItem.qty})">BUY AGAIN</button>
                </div>
            `;
            container.appendChild(card);
        }
    });
}

function buyAgain(id, qty) {
    const product = data.find(p => p.id === id);
    if (product) {
        const itemToBuy = [{
            id: product.id,
            name: product.name,
            price: product.price,
            qty: qty
        }];
        localStorage.setItem('checkoutItems', JSON.stringify(itemToBuy));
        window.location.href = 'checkout.html';
    }
}

document.addEventListener('DOMContentLoaded', renderHistory);