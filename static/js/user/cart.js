let cart = JSON.parse(localStorage.getItem('cart')) || [];
let selectedItems = new Set();

function renderCart() {
    const listContainer = document.getElementById('cartList');
    listContainer.innerHTML = '';

    if (cart.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; margin-top:50px; color:#666;">Your cart is empty.</p>';
        calculateTotal(); 
        return;
    }

    cart.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'cart-item-card';
        card.innerHTML = `
            <input type="checkbox" class="item-checkbox" onchange="toggleSelect(${index})" ${selectedItems.has(index) ? 'checked' : ''}>
            <div class="item-img-placeholder">image</div>
            <div class="item-details">
                <h2 class="item-name">${item.name}</h2>
                <select class="size-dropdown"><option>kilos/size</option></select>
                <p class="item-price">Product Amount: ${item.price}</p>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty(${index}, -1)">-</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });
    calculateTotal();
}

function updateQty(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty < 1) {
        cart.splice(index, 1);
        selectedItems.delete(index);
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
}

function toggleSelect(index) {
    if (selectedItems.has(index)) {
        selectedItems.delete(index);
    } else {
        selectedItems.add(index);
    }
    calculateTotal();
}

function calculateTotal() {
    let total = 0;
    const footer = document.querySelector('.cart-footer');

    // Toggle footer visibility based on selection
    if (selectedItems.size > 0) {
        footer.style.display = 'flex';
    } else {
        footer.style.display = 'none';
    }

    selectedItems.forEach(index => {
        if (cart[index]) {
            total += (cart[index].price * cart[index].qty);
        }
    });
    
    document.getElementById('displaySubtotal').innerText = total === 0 ? "0000" : total;
    document.getElementById('displayDiscount').innerText = "0000"; 
    document.getElementById('selectedCount').innerText = selectedItems.size;
}

document.addEventListener('DOMContentLoaded', renderCart);

document.querySelector('.checkout-btn').addEventListener('click', () => {
    const selectedData = cart.filter((item, index) => selectedItems.has(index));
    if (selectedData.length === 0) {
        alert("Please select at least one item to checkout.");
        return;
    }
    localStorage.setItem('checkoutItems', JSON.stringify(selectedData));
    window.location.href = 'checkout.html';
});
