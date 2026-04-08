// --- ELEMENT SELECTION ---
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

const addProductBtn = document.getElementById("addProductBtn");
const addProductModal = document.getElementById("addProductModal");
const closeModal = document.getElementById("closeModal");
const productForm = document.getElementById("productForm");

const imageInput = document.getElementById("productImage");
const preview = document.getElementById("imagePreview");

const searchInput = document.getElementById("inventorySearch");
const inventoryCards = document.querySelectorAll(".inventory-card");

// --- SIDEBAR LOGIC ---
if (menuBtn) {
    menuBtn.onclick = () => {
        sidebar.classList.add("open");
        overlay.classList.add("show");
    }
}

if (closeBtn) {
    closeBtn.onclick = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
    }
}

// --- MODAL LOGIC (OPEN ADD) ---
if (addProductBtn) {
    addProductBtn.onclick = () => {
        document.getElementById("modalTitle").innerText = "Add Product";
        productForm.action = "/admin/products/add"; // Set to Add route
        productForm.reset();
        if (preview) preview.innerHTML = "<span>Upload Image</span>";
        
        addProductModal.classList.add("show");
        overlay.classList.add("show");
    }
}

// --- MODAL LOGIC (OPEN EDIT) ---
window.openEditModal = function(id, name, price, category, desc, stock) {
    document.getElementById("modalTitle").innerText = "Edit Product";
    productForm.action = `/admin/products/edit/${id}`; // Set to Edit route
    
    // Fill form fields
    document.getElementById("formName").value = name;
    document.getElementById("formPrice").value = price;
    document.getElementById("formCategory").value = category;
    document.getElementById("formDescription").value = desc;
    document.getElementById("formStock").value = stock;

    if (preview) preview.innerHTML = "<span>Keep Existing Image</span>";

    addProductModal.classList.add("show");
    overlay.classList.add("show");
}

// --- CLOSE LOGIC ---
if (closeModal) {
    closeModal.onclick = () => {
        addProductModal.classList.remove("show");
        overlay.classList.remove("show");
    }
}

overlay.onclick = () => {
    if (sidebar) sidebar.classList.remove("open");
    if (addProductModal) addProductModal.classList.remove("show");
    overlay.classList.remove("show");
}

// --- IMAGE PREVIEW ---
if (imageInput && preview) {
    imageInput.addEventListener("change", function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;
            }
            reader.readAsDataURL(file);
        }
    });
}

// --- SEARCH FILTER ---
if (searchInput) {
    searchInput.addEventListener("input", function() {
        const query = this.value.toLowerCase();
        inventoryCards.forEach(card => {
            const name = card.getAttribute("data-name");
            card.style.display = name.includes(query) ? "block" : "none";
        });
    });
}
// --- AUDIT SEARCH FILTER ---
const auditSearch = document.getElementById("auditSearch");
const auditCards = document.querySelectorAll(".audit-card");

if (auditSearch) {
    auditSearch.addEventListener("input", function() {
        const query = this.value.toLowerCase();
        auditCards.forEach(card => {
            const text = card.innerText.toLowerCase();
            card.style.display = text.includes(query) ? "block" : "none";
        });
    });
}

// --- AI INVENTORY INSIGHTS ---
document.addEventListener("DOMContentLoaded", () => {
    fetch("/api/admin/inventory-insights")
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch");
            return response.json();
        })
        .then(data => {
            const alertBanner = document.getElementById("ai-inventory-alert");
            const alertBody = alertBanner ? alertBanner.querySelector(".ai-alert-body") : null;
            
            // Assume the text is in data.insights, data.message, or data directly if it's a string
            const warningText = data.insights || data.message || (typeof data === "string" ? data : JSON.stringify(data));

            if (alertBanner && alertBody && warningText) {
                alertBody.textContent = warningText;
                alertBanner.style.display = "block";
            }
        })
        .catch(error => {
            // Catch error silently, leaving the banner hidden (display: none)
        });
});