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
const removeImageFlag = document.getElementById("removeImageFlag");
const stockInput = document.getElementById("formStock");
const stockModeSelect = document.getElementById("formStockMode");
const formCategory = document.getElementById("formCategory");
const categoryQuickList = document.getElementById("categoryQuickList");
const formUnitOptionsJson = document.getElementById("formUnitOptionsJson");
const categoryBuilderModal = document.getElementById("categoryBuilderModal");
const categoryNameInput = document.getElementById("categoryNameInput");
const categoryQtyInput = document.getElementById("categoryQtyInput");
const categoryUnitInput = document.getElementById("categoryUnitInput");
const addCategoryOptionBtn = document.getElementById("addCategoryOptionBtn");
const categoryOptionList = document.getElementById("categoryOptionList");
const saveCategoryBuilderBtn = document.getElementById("saveCategoryBuilderBtn");
const cancelCategoryBuilderBtn = document.getElementById("cancelCategoryBuilderBtn");
const closeCategoryBuilderModal = document.getElementById("closeCategoryBuilderModal");
const editCategoryModal = document.getElementById("editCategoryModal");
const closeEditCategoryModal = document.getElementById("closeEditCategoryModal");
const cancelEditCategoryBtn = document.getElementById("cancelEditCategoryBtn");
const saveEditCategoryBtn = document.getElementById("saveEditCategoryBtn");
const editCategoryNameInput = document.getElementById("editCategoryNameInput");
const editCategoryQtyInput = document.getElementById("editCategoryQtyInput");
const editCategoryUnitInput = document.getElementById("editCategoryUnitInput");
const editCategoryAddOptionBtn = document.getElementById("editCategoryAddOptionBtn");
const editCategoryOptionList = document.getElementById("editCategoryOptionList");

const searchInput = document.getElementById("inventorySearch");
const inventoryContainer = document.getElementById("inventoryContainer");
const inventoryCards = Array.from(document.querySelectorAll(".inventory-card"));
const inventoryCategoryFilter = document.getElementById("inventoryCategoryFilter");

const CATEGORY_STORAGE_KEY = "inventory_category_state_v1";
const categoryOptionsByName = {};
let currentBuilderOptions = [];
let currentEditOptions = [];
let editingCategoryName = "";
let activeInventoryCategory = "all";

function getCardName(card) {
    return String(card.getAttribute("data-pname") || card.getAttribute("data-name") || "").trim();
}

function getCardCategory(card) {
    return String(card.getAttribute("data-pcat") || "").trim();
}

function getNumericMultiplier(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 1;
}

function syncProductUnitOptionsField() {
    if (!formUnitOptionsJson || !formCategory) return;

    const categoryName = String(formCategory.value || "").trim();
    const options = Array.isArray(categoryOptionsByName[categoryName]) ? categoryOptionsByName[categoryName] : [];

    formUnitOptionsJson.value = JSON.stringify(options.map(entry => ({
        quantity: String(entry && entry.quantity ? entry.quantity : "").trim(),
        unit: String(entry && entry.unit ? entry.unit : "").trim(),
        multiplier: getNumericMultiplier(entry && entry.multiplier != null ? entry.multiplier : entry && entry.quantity),
        label: `${String(entry && entry.quantity ? entry.quantity : "").trim()} ${String(entry && entry.unit ? entry.unit : "").trim()}`.trim(),
        value: `${String(entry && entry.quantity ? entry.quantity : "").trim()} ${String(entry && entry.unit ? entry.unit : "").trim()}`.trim()
    })));
}

function getInventoryCategories() {
    const categoryMap = new Map();
    inventoryCards.forEach(card => {
        const category = getCardCategory(card);
        if (!category) return;
        const existingKey = Array.from(categoryMap.keys()).find(key => key.toLowerCase() === category.toLowerCase());
        if (!existingKey) {
            categoryMap.set(category, category);
        }
    });

    return Array.from(categoryMap.values()).sort((a, b) => {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
}

function renderInventoryCategoryFilters() {
    if (!inventoryCategoryFilter) return;
    inventoryCategoryFilter.innerHTML = "";

    const categories = ["All", ...getInventoryCategories()];

    categories.forEach(category => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "inventory-filter-chip";
        chip.textContent = category;

        const chipKey = category.toLowerCase();
        if (chipKey === activeInventoryCategory.toLowerCase()) {
            chip.classList.add("active");
        }

        chip.addEventListener("click", function() {
            activeInventoryCategory = chipKey;
            renderInventoryCategoryFilters();
            applyInventoryFilters();
        });

        inventoryCategoryFilter.appendChild(chip);
    });
}

function applyInventoryFilters() {
    if (!inventoryContainer) return;

    const searchQuery = String(searchInput ? searchInput.value : "").trim().toLowerCase();
    const activeCategoryKey = String(activeInventoryCategory || "all").toLowerCase();

    const sortedCards = inventoryCards.slice().sort((a, b) => {
        return getCardName(a).localeCompare(getCardName(b), undefined, { sensitivity: "base" });
    });

    sortedCards.forEach(card => {
        const productName = getCardName(card).toLowerCase();
        const productCategory = getCardCategory(card).toLowerCase();
        const categoryMatches = activeCategoryKey === "all" || productCategory === activeCategoryKey;
        const searchMatches = !searchQuery || productName.includes(searchQuery);
        const visible = categoryMatches && searchMatches;

        card.style.display = visible ? "block" : "none";
        inventoryContainer.appendChild(card);
    });
}

function getCategoryStateEntries() {
    return Object.keys(categoryOptionsByName).map(name => ({
        name,
        options: Array.isArray(categoryOptionsByName[name]) ? categoryOptionsByName[name] : []
    }));
}

function saveCategoryState() {
    try {
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(getCategoryStateEntries()));
    } catch (error) {
        console.error("Unable to save category state", error);
    }
}

function loadCategoryState() {
    try {
        const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;

        return parsed
            .map(entry => {
                const name = String(entry && entry.name ? entry.name : "").trim();
                const options = Array.isArray(entry && entry.options)
                    ? entry.options
                        .map(optionEntry => ({
                            quantity: String(optionEntry && optionEntry.quantity ? optionEntry.quantity : "").trim(),
                            unit: String(optionEntry && optionEntry.unit ? optionEntry.unit : "").trim(),
                            multiplier: getNumericMultiplier(optionEntry && optionEntry.multiplier != null ? optionEntry.multiplier : optionEntry && optionEntry.quantity)
                        }))
                        .filter(optionEntry => optionEntry.quantity && optionEntry.unit)
                    : [];

                return { name, options };
            })
            .filter(entry => entry.name);
    } catch (error) {
        console.error("Unable to load category state", error);
        return null;
    }
}

function hydrateCategoryMap(entries) {
    Object.keys(categoryOptionsByName).forEach(name => delete categoryOptionsByName[name]);
    entries.forEach(entry => {
        categoryOptionsByName[entry.name] = Array.isArray(entry.options) ? entry.options.slice() : [];
    });
}

function renderCategorySelect(preferredValue) {
    if (!formCategory) return;

    const addNewOption = formCategory.querySelector('option[value="__add_new__"]');
    formCategory.innerHTML = "";

    Object.keys(categoryOptionsByName).forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        formCategory.appendChild(option);
    });

    if (addNewOption) {
        formCategory.appendChild(addNewOption);
    } else {
        const dynamicAddOption = document.createElement("option");
        dynamicAddOption.value = "__add_new__";
        dynamicAddOption.textContent = "+ Add New Category";
        formCategory.appendChild(dynamicAddOption);
    }

    if (preferredValue && categoryOptionsByName[preferredValue]) {
        formCategory.value = preferredValue;
        return;
    }

    const firstReal = Array.from(formCategory.options).find(opt => opt.value !== "__add_new__");
    if (firstReal) {
        formCategory.value = firstReal.value;
    } else {
        formCategory.value = "__add_new__";
    }
}

function hideCategoryBuilder() {
    if (categoryBuilderModal) categoryBuilderModal.style.display = "none";
    if (categoryNameInput) categoryNameInput.value = "";
    if (categoryQtyInput) categoryQtyInput.value = "";
    currentBuilderOptions = [];
    renderCategoryOptionList();
}

function showCategoryBuilder() {
    if (categoryBuilderModal) categoryBuilderModal.style.display = "block";
    if (categoryNameInput) categoryNameInput.focus();
}

function ensureCategoryOption(categoryName) {
    if (!formCategory) return;

    const normalized = String(categoryName || "").trim();
    if (!normalized) return;

    const existingName = Object.keys(categoryOptionsByName).find(name => name.toLowerCase() === normalized.toLowerCase());
    if (existingName) {
        renderCategorySelect(existingName);
    } else {
        categoryOptionsByName[normalized] = [];
        renderCategorySelect(normalized);
        saveCategoryState();
    }

    renderCategoryQuickList();
}

function removeCategoryOption(categoryName) {
    if (!formCategory) return;
    const normalized = String(categoryName || "").trim();
    if (!normalized) return;

    const matchedName = Object.keys(categoryOptionsByName).find(name => name.toLowerCase() === normalized.toLowerCase());
    if (!matchedName) return;

    const previousSelected = formCategory.value;
    delete categoryOptionsByName[matchedName];
    renderCategorySelect(previousSelected === matchedName ? "" : previousSelected);
    saveCategoryState();

    if (editingCategoryName && editingCategoryName.toLowerCase() === matchedName.toLowerCase()) {
        closeCategoryEditModal();
    }

    renderCategoryQuickList();
}

function renderCategoryQuickList() {
    if (!categoryQuickList) return;
    categoryQuickList.innerHTML = "";

    Object.keys(categoryOptionsByName).forEach(categoryName => {
        const chip = document.createElement("span");
        chip.className = "category-chip";

        const label = document.createElement("span");
        label.className = "category-chip-label";
        label.textContent = categoryName;

        const actions = document.createElement("span");
        actions.className = "category-chip-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "category-chip-action category-chip-edit";
        editBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
            </svg>
        `;
        editBtn.addEventListener("click", function() {
            openCategoryEditModal(categoryName);
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "category-chip-action category-chip-remove";
        removeBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14H6L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
                <path d="M9 6V4h6v2"></path>
            </svg>
        `;
        removeBtn.addEventListener("click", function() {
            removeCategoryOption(categoryName);
        });

        actions.appendChild(editBtn);
        actions.appendChild(removeBtn);
        chip.appendChild(label);
        chip.appendChild(actions);
        categoryQuickList.appendChild(chip);
    });
}

function formatQuantityValue(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return "";
    if (Number.isInteger(numeric)) return String(numeric);
    return numeric.toFixed(2).replace(/\.?0+$/, "");
}

function renderCategoryOptionList() {
    if (!categoryOptionList) return;
    categoryOptionList.innerHTML = "";

    currentBuilderOptions.forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "category-option-item";

        const text = document.createElement("span");
        text.textContent = `${entry.quantity} ${entry.unit}`;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "category-chip-remove";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", function() {
            currentBuilderOptions.splice(index, 1);
            renderCategoryOptionList();
        });

        row.appendChild(text);
        row.appendChild(removeBtn);
        categoryOptionList.appendChild(row);
    });
}

function renderEditCategoryOptionList() {
    if (!editCategoryOptionList) return;
    editCategoryOptionList.innerHTML = "";

    currentEditOptions.forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "category-option-item";

        const text = document.createElement("span");
        text.textContent = `${entry.quantity} ${entry.unit}`;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "category-chip-action category-chip-remove";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", function() {
            currentEditOptions.splice(index, 1);
            renderEditCategoryOptionList();
        });

        row.appendChild(text);
        row.appendChild(removeBtn);
        editCategoryOptionList.appendChild(row);
    });
}

function openCategoryEditModal(categoryName) {
    if (!editCategoryModal) return;

    const normalized = String(categoryName || "").trim();
    if (!normalized || !categoryOptionsByName[normalized]) return;

    editingCategoryName = normalized;
    currentEditOptions = (categoryOptionsByName[normalized] || []).map(entry => ({
        quantity: entry.quantity,
        unit: entry.unit
    }));

    if (editCategoryNameInput) editCategoryNameInput.value = normalized;
    if (editCategoryQtyInput) editCategoryQtyInput.value = "";
    renderEditCategoryOptionList();

    editCategoryModal.classList.add("show");
    overlay.classList.add("show");

    if (editCategoryNameInput) editCategoryNameInput.focus();
}

function closeCategoryEditModal() {
    if (editCategoryModal) editCategoryModal.classList.remove("show");
    editingCategoryName = "";
    currentEditOptions = [];
    if (editCategoryNameInput) editCategoryNameInput.value = "";
    if (editCategoryQtyInput) editCategoryQtyInput.value = "";
    renderEditCategoryOptionList();
}

function initializeCategoryState() {
    if (!formCategory) return;

    const baseOptions = Array.from(formCategory.options)
        .filter(opt => opt.value !== "__add_new__")
        .map(opt => ({ name: opt.value, options: [] }));

    const storedState = loadCategoryState();
    hydrateCategoryMap(storedState && storedState.length ? storedState : baseOptions);

    renderCategorySelect();
    renderCategoryQuickList();
    syncProductUnitOptionsField();
    saveCategoryState();
}

function syncStockModeWithValue() {
    if (!stockInput || !stockModeSelect) return;
    const stockValue = Number(stockInput.value || 0);
    stockModeSelect.value = stockValue <= 0 ? "no_stock" : "manual";
}

function bindStockControls() {
    if (!stockInput) return;

    stockInput.addEventListener("input", function() {
        const parsed = parseInt(this.value || "0", 10);
        if (Number.isNaN(parsed) || parsed < 0) {
            this.value = "0";
        } else {
            this.value = String(parsed);
        }
        syncStockModeWithValue();
    });

    if (stockModeSelect) {
        stockModeSelect.addEventListener("change", function() {
            if (this.value === "no_stock") {
                stockInput.value = "0";
                stockInput.setAttribute("readonly", "readonly");
            } else {
                stockInput.removeAttribute("readonly");
                if (Number(stockInput.value || 0) < 0) {
                    stockInput.value = "0";
                }
            }
        });
    }

    syncStockModeWithValue();
}

function bindPreviewControls() {
    if (!preview) return;

    const deleteBtn = preview.querySelector(".image-remove-btn");

    if (deleteBtn) {
        deleteBtn.addEventListener("click", function(event) {
            event.stopPropagation();
            clearImagePreview();
            if (removeImageFlag) removeImageFlag.value = "1";
        });
    }

    if (imageInput) {
        preview.onclick = function() {
            imageInput.click();
        };
    }
}

function clearImagePreview() {
    if (!preview) return;
    preview.innerHTML = `
        <span class="image-placeholder">Click to upload image</span>
        <button type="button" class="image-remove-btn" aria-label="Remove image" style="display:none;">✕</button>
    `;
    if (imageInput) imageInput.value = "";
    bindPreviewControls();
}

function setImagePreview(imageUrl) {
    if (!preview) return;
    preview.innerHTML = `
        <img src="${imageUrl}" alt="Product image preview">
        <button type="button" class="image-remove-btn" aria-label="Remove image">✕</button>
    `;
    bindPreviewControls();
}

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
        clearImagePreview();
        if (removeImageFlag) removeImageFlag.value = "0";
        const stockSelect = document.getElementById("formStock");
        const unitSelect = document.getElementById("formUnit");
        if (stockSelect) stockSelect.value = "0";
        if (stockSelect) stockSelect.removeAttribute("readonly");
        if (stockModeSelect) stockModeSelect.value = "no_stock";
        if (unitSelect) unitSelect.value = "pcs";
        hideCategoryBuilder();
        if (formCategory && formCategory.options.length > 0) {
            formCategory.value = formCategory.options[0].value;
        }
        
        addProductModal.classList.add("show");
        overlay.classList.add("show");
    }
}

// --- MODAL LOGIC (OPEN EDIT) ---
window.openEditModal = function(id, name, price, category, desc, stock, unit, imageFilename) {
    document.getElementById("modalTitle").innerText = "Edit Product";
    productForm.action = `/admin/products/edit/${id}`; // Set to Edit route
    
    // Fill form fields
    document.getElementById("formName").value = name;
    document.getElementById("formPrice").value = price;
    const matchedCategory = Object.keys(categoryOptionsByName).find(name => name.toLowerCase() === String(category || "").toLowerCase());
    if (matchedCategory) {
        formCategory.value = matchedCategory;
    } else if (formCategory) {
        const firstReal = Array.from(formCategory.options).find(opt => opt.value !== "__add_new__");
        if (firstReal) formCategory.value = firstReal.value;
    }
    document.getElementById("formDescription").value = desc;
    const stockSelect = document.getElementById("formStock");
    if (stockSelect) {
        const numericStock = Math.max(0, parseInt(String(stock || "0"), 10) || 0);
        stockSelect.value = String(numericStock);
        if (numericStock === 0) {
            stockSelect.setAttribute("readonly", "readonly");
            if (stockModeSelect) stockModeSelect.value = "no_stock";
        } else {
            stockSelect.removeAttribute("readonly");
            if (stockModeSelect) stockModeSelect.value = "manual";
        }
    }
    const unitSelect = document.getElementById("formUnit");
    if (unitSelect) {
        unitSelect.value = unit || "pcs";
    }

    syncProductUnitOptionsField();

    if (removeImageFlag) removeImageFlag.value = "0";
    if (imageFilename) {
        setImagePreview(`/product-image/${imageFilename}`);
    } else {
        clearImagePreview();
    }

    hideCategoryBuilder();

    addProductModal.classList.add("show");
    overlay.classList.add("show");
}

window.openEditModalFromCard = function(button) {
    const card = button.closest(".inventory-card");
    if (!card) return;

    const id = card.getAttribute("data-id") || "";
    const name = card.getAttribute("data-pname") || "";
    const price = card.getAttribute("data-price") || "";
    const category = card.getAttribute("data-pcat") || "";
    const desc = card.getAttribute("data-desc") || "";
    const stock = card.getAttribute("data-stock") || "";
    const unit = card.getAttribute("data-unit") || "pcs";
    const imageFilename = card.getAttribute("data-image") || "";

    openEditModal(id, name, price, category, desc, stock, unit, imageFilename);
}

// --- CLOSE LOGIC ---
if (closeModal) {
    closeModal.onclick = () => {
        addProductModal.classList.remove("show");
        if (!editCategoryModal || !editCategoryModal.classList.contains("show")) {
            overlay.classList.remove("show");
        }
    }
}

if (closeEditCategoryModal) {
    closeEditCategoryModal.onclick = () => {
        closeCategoryEditModal();
        if (!addProductModal || !addProductModal.classList.contains("show")) {
            overlay.classList.remove("show");
        }
    };
}

if (cancelEditCategoryBtn) {
    cancelEditCategoryBtn.addEventListener("click", function() {
        closeCategoryEditModal();
        if (!addProductModal || !addProductModal.classList.contains("show")) {
            overlay.classList.remove("show");
        }
    });
}

overlay.onclick = () => {
    if (sidebar) sidebar.classList.remove("open");
    if (addProductModal) addProductModal.classList.remove("show");
    closeCategoryEditModal();
    overlay.classList.remove("show");
}

// --- IMAGE PREVIEW ---
if (imageInput && preview) {
    imageInput.addEventListener("change", function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                setImagePreview(e.target.result);
                if (removeImageFlag) removeImageFlag.value = "0";
            }
            reader.readAsDataURL(file);
        }
    });

    bindPreviewControls();
}

bindStockControls();
initializeCategoryState();

if (formCategory) {
    formCategory.addEventListener("change", function() {
        if (this.value === "__add_new__") {
            showCategoryBuilder();
        } else {
            hideCategoryBuilder();
        }

        syncProductUnitOptionsField();
    });
}

if (cancelCategoryBuilderBtn) {
    cancelCategoryBuilderBtn.addEventListener("click", function() {
        hideCategoryBuilder();
        if (formCategory && formCategory.options.length > 0) {
            const firstReal = Array.from(formCategory.options).find(opt => opt.value !== "__add_new__");
            if (firstReal) formCategory.value = firstReal.value;
        }
    });
}

if (closeCategoryBuilderModal) {
    closeCategoryBuilderModal.addEventListener("click", function() {
        hideCategoryBuilder();
        if (formCategory && formCategory.value === "__add_new__") {
            const firstReal = Array.from(formCategory.options).find(opt => opt.value !== "__add_new__");
            if (firstReal) formCategory.value = firstReal.value;
        }
    });
}

if (addCategoryOptionBtn) {
    addCategoryOptionBtn.addEventListener("click", function() {
        const quantity = formatQuantityValue(categoryQtyInput ? categoryQtyInput.value : "");
        const unit = String(categoryUnitInput ? categoryUnitInput.value : "pcs").trim() || "pcs";
        if (!quantity) {
            return;
        }

        const exists = currentBuilderOptions.some(entry => entry.quantity === quantity && entry.unit === unit);
        if (!exists) {
            currentBuilderOptions.push({ quantity, unit, multiplier: getNumericMultiplier(quantity) });
            renderCategoryOptionList();
        }

        if (categoryQtyInput) categoryQtyInput.value = "";
    });
}

if (saveCategoryBuilderBtn) {
    saveCategoryBuilderBtn.addEventListener("click", function() {
        const categoryName = String(categoryNameInput ? categoryNameInput.value : "").trim();
        if (!categoryName) return;

        ensureCategoryOption(categoryName);
        categoryOptionsByName[categoryName] = currentBuilderOptions.slice();
        syncProductUnitOptionsField();
        saveCategoryState();
        renderCategoryQuickList();
        hideCategoryBuilder();
    });
}

if (editCategoryAddOptionBtn) {
    editCategoryAddOptionBtn.addEventListener("click", function() {
        const quantity = formatQuantityValue(editCategoryQtyInput ? editCategoryQtyInput.value : "");
        const unit = String(editCategoryUnitInput ? editCategoryUnitInput.value : "pcs").trim() || "pcs";
        if (!quantity) return;

        const exists = currentEditOptions.some(entry => entry.quantity === quantity && entry.unit === unit);
        if (!exists) {
            currentEditOptions.push({ quantity, unit, multiplier: getNumericMultiplier(quantity) });
            renderEditCategoryOptionList();
        }

        if (editCategoryQtyInput) editCategoryQtyInput.value = "";
    });
}

if (saveEditCategoryBtn) {
    saveEditCategoryBtn.addEventListener("click", function() {
        if (!editingCategoryName) return;

        const newName = String(editCategoryNameInput ? editCategoryNameInput.value : "").trim();
        if (!newName) return;

        const previousSelected = formCategory ? formCategory.value : "";
        const oldName = editingCategoryName;
        const existingKeyMatch = Object.keys(categoryOptionsByName).find(
            name => name.toLowerCase() === newName.toLowerCase() && name.toLowerCase() !== oldName.toLowerCase()
        );
        const targetName = existingKeyMatch || newName;

        delete categoryOptionsByName[oldName];

        const existingAtTarget = Array.isArray(categoryOptionsByName[targetName])
            ? categoryOptionsByName[targetName].slice()
            : [];

        const mergedOptions = existingAtTarget.concat(currentEditOptions).filter((entry, index, arr) => {
            return arr.findIndex(candidate => candidate.quantity === entry.quantity && candidate.unit === entry.unit) === index;
        });

        categoryOptionsByName[targetName] = mergedOptions;

        const preferredValue = previousSelected === oldName ? targetName : previousSelected;
        renderCategorySelect(preferredValue);
        renderCategoryQuickList();
        syncProductUnitOptionsField();
        saveCategoryState();

        closeCategoryEditModal();
        if (!addProductModal || !addProductModal.classList.contains("show")) {
            overlay.classList.remove("show");
        }
    });
}

if (productForm) {
    productForm.addEventListener("submit", function(e) {
        syncProductUnitOptionsField();
        if (formCategory && formCategory.value === "__add_new__") {
            e.preventDefault();
            showCategoryBuilder();
        }
    });
}

// --- INVENTORY FILTER + SORT ---
renderInventoryCategoryFilters();
applyInventoryFilters();

if (searchInput) {
    searchInput.addEventListener("input", function() {
        applyInventoryFilters();
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

// --- DELETE MODAL LOGIC ---
let selectedDeleteForm = null;

function openDeleteModal(button) {
    selectedDeleteForm = button.closest(".delete-form");
    document.getElementById("deleteModal").style.display = "flex";
}

function closeDeleteModal() {
    document.getElementById("deleteModal").style.display = "none";
    selectedDeleteForm = null;
}

const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", function () {
        if (selectedDeleteForm) {
            selectedDeleteForm.submit();
        }
    });
}

// --- AI INVENTORY INSIGHTS + FORECAST (BUTTON-TRIGGERED, JSON RENDERED) ---
let insightsInFlight = false;
let forecastInFlight = false;

function createTextElement(tagName, className, textValue) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = textValue;
    return element;
}

function ensurePdfSpace(doc, currentY, blockHeight) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY + blockHeight > pageHeight - 40) {
        doc.addPage();
        return 40;
    }
    return currentY;
}

function exportAIResultToPdf(title, container) {
    if (!container || !window.jspdf || !window.jspdf.jsPDF) return;

    const jsPDFRef = window.jspdf.jsPDF;
    const pdf = new jsPDFRef({ orientation: "portrait", unit: "pt", format: "a4" });
    const margin = 40;
    const maxWidth = pdf.internal.pageSize.getWidth() - (margin * 2);
    let y = 44;

    pdf.setFontSize(14);
    pdf.text(String(title || "AI Inventory Report"), margin, y);
    y += 18;

    const childNodes = Array.from(container.children);

    childNodes.forEach(node => {
        if (node.matches("h4")) {
            y = ensurePdfSpace(pdf, y, 22);
            pdf.setFontSize(12);
            pdf.text(node.textContent || "", margin, y);
            y += 16;
            return;
        }

        if (node.matches("p")) {
            const textLines = pdf.splitTextToSize(node.textContent || "", maxWidth);
            const height = (textLines.length * 12) + 8;
            y = ensurePdfSpace(pdf, y, height);
            pdf.setFontSize(10);
            pdf.text(textLines, margin, y);
            y += height;
            return;
        }

        if (node.matches("ul")) {
            const bullets = Array.from(node.querySelectorAll("li")).map(li => `- ${li.textContent || ""}`);
            bullets.forEach(bullet => {
                const lines = pdf.splitTextToSize(bullet, maxWidth);
                const height = (lines.length * 12) + 4;
                y = ensurePdfSpace(pdf, y, height);
                pdf.setFontSize(10);
                pdf.text(lines, margin + 4, y);
                y += height;
            });
            y += 2;
            return;
        }

        if (node.classList.contains("ai-table-wrap") && typeof pdf.autoTable === "function") {
            const headerCells = Array.from(node.querySelectorAll(".ai-table-head th"));
            const bodyRows = Array.from(node.querySelectorAll(".ai-table-body tbody tr"));

            const head = headerCells.length > 0
                ? [headerCells.map(th => (th.textContent || "").trim())]
                : [];

            const body = bodyRows.map(tr => {
                return Array.from(tr.querySelectorAll("td")).map(td => (td.textContent || "").trim());
            });

            if (head.length > 0 && body.length > 0) {
                pdf.autoTable({
                    head,
                    body,
                    startY: y,
                    margin: { left: margin, right: margin },
                    styles: { fontSize: 8, cellPadding: 4 },
                    headStyles: { fillColor: [247, 242, 234], textColor: [26, 50, 62] },
                    theme: "grid"
                });
                y = (pdf.lastAutoTable && pdf.lastAutoTable.finalY ? pdf.lastAutoTable.finalY : y) + 12;
            }
        }
    });

    const filename = `${String(title || "ai_inventory_report").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.pdf`;
    pdf.save(filename);
}

function bindAiActionControls(config) {
    const actions = document.getElementById(config.actionsId);
    const minimizeBtn = document.getElementById(config.minimizeBtnId);
    const downloadBtn = document.getElementById(config.downloadBtnId);
    const resultContainer = document.getElementById(config.resultId);

    if (!actions || !minimizeBtn || !downloadBtn || !resultContainer) {
        return {
            show: function() {},
            hide: function() {}
        };
    }

    function setMinimizeIcon(isCollapsed) {
        minimizeBtn.innerHTML = isCollapsed
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"></path></svg>';
    }

    minimizeBtn.addEventListener("click", function() {
        const collapsed = resultContainer.classList.toggle("ai-result-collapsed");
        setMinimizeIcon(collapsed);
    });

    downloadBtn.addEventListener("click", function() {
        exportAIResultToPdf(config.title, resultContainer);
    });

    setMinimizeIcon(false);

    return {
        show: function() {
            actions.style.display = "flex";

            if (resultContainer.classList.contains("ai-result-collapsed")) {
                resultContainer.classList.remove("ai-result-collapsed");
                setMinimizeIcon(false);
            }
        },

        hide: function() {
            actions.style.display = "none";

            if (resultContainer.classList.contains("ai-result-collapsed")) {
                resultContainer.classList.remove("ai-result-collapsed");
                setMinimizeIcon(false);
            }
        }
    };
}

function renderInsightsPayload(container, payload) {
    container.innerHTML = "";

    if (!payload || typeof payload !== "object") {
        container.textContent = "Insights unavailable at the moment.";
        return;
    }

    if (payload.headline) {
        container.appendChild(createTextElement("h4", "ai-block-title", payload.headline));
    }

    if (payload.summary) {
        container.appendChild(createTextElement("p", "ai-block-summary", payload.summary));
    }

    if (Array.isArray(payload.alerts) && payload.alerts.length > 0) {
        const list = document.createElement("ul");
        list.className = "ai-list";

        payload.alerts.forEach(item => {
            const text = item && item.text ? String(item.text).trim() : "";
            if (!text) return;

            const severity = item && item.severity ? String(item.severity).toLowerCase() : "info";
            const normalizedSeverity = ["critical", "warning", "watch", "info"].includes(severity) ? severity : "info";

            const listItem = createTextElement("li", `ai-list-item severity-${normalizedSeverity}`, text);
            list.appendChild(listItem);
        });

        if (list.children.length > 0) {
            container.appendChild(list);
        }
    }
}

function renderForecastPayload(container, payload) {
    container.innerHTML = "";

    if (!payload || typeof payload !== "object") {
        container.textContent = "Forecast unavailable at the moment.";
        return;
    }

    if (payload.headline) {
        container.appendChild(createTextElement("h4", "ai-block-title", payload.headline));
    }

    if (payload.summary) {
        container.appendChild(createTextElement("p", "ai-block-summary", payload.summary));
    }

    if (Array.isArray(payload.critical_alerts) && payload.critical_alerts.length > 0) {
        const criticalLabel = createTextElement("p", "ai-section-label", "Critical Alerts");
        container.appendChild(criticalLabel);

        const criticalList = document.createElement("ul");
        criticalList.className = "ai-list";

        payload.critical_alerts.forEach(textValue => {
            const clean = String(textValue || "").trim();
            if (!clean) return;
            criticalList.appendChild(createTextElement("li", "ai-list-item severity-critical", clean));
        });

        if (criticalList.children.length > 0) {
            container.appendChild(criticalList);
        }
    }

    if (payload.table && Array.isArray(payload.table.rows) && payload.table.rows.length > 0) {
        const tableWrap = document.createElement("div");
        tableWrap.className = "ai-table-wrap";

        const tableHead = document.createElement("table");
        tableHead.className = "ai-table ai-table-head";

        const tableBodyScroll = document.createElement("div");
        tableBodyScroll.className = "ai-table-body-scroll";

        const tableBody = document.createElement("table");
        tableBody.className = "ai-table ai-table-body";

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const columns = Array.isArray(payload.table.columns) && payload.table.columns.length > 0
            ? payload.table.columns
            : ["Product", "Current Stock", "Sold (30d)", "Projected Demand (14d)", "Recommended Reorder", "Urgency", "Notes"];

        const headColGroup = document.createElement("colgroup");
        const bodyColGroup = document.createElement("colgroup");
        columns.forEach(() => {
            const headCol = document.createElement("col");
            headCol.style.width = `${Math.round(100 / columns.length)}%`;
            headColGroup.appendChild(headCol);

            const bodyCol = document.createElement("col");
            bodyCol.style.width = `${Math.round(100 / columns.length)}%`;
            bodyColGroup.appendChild(bodyCol);
        });

        tableHead.appendChild(headColGroup);
        tableBody.appendChild(bodyColGroup);

        columns.forEach(columnTitle => {
            const th = document.createElement("th");
            th.textContent = String(columnTitle);
            headRow.appendChild(th);
        });

        thead.appendChild(headRow);
        tableHead.appendChild(thead);

        const tbody = document.createElement("tbody");
        payload.table.rows.forEach(row => {
            const tr = document.createElement("tr");

            const urgency = row && row.urgency ? String(row.urgency).toLowerCase() : "low";
            if (urgency === "high") tr.classList.add("urgency-high");
            if (urgency === "medium") tr.classList.add("urgency-medium");

            const values = [
                row.product,
                row.current_stock,
                row.sold_last_30_days,
                row.projected_14_day_demand,
                row.recommended_reorder,
                row.urgency,
                row.note
            ];

            values.forEach(value => {
                const td = document.createElement("td");
                td.textContent = value === undefined || value === null ? "" : String(value);
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        tableBody.appendChild(tbody);
        tableBodyScroll.appendChild(tableBody);

        tableWrap.appendChild(tableHead);
        tableWrap.appendChild(tableBodyScroll);
        container.appendChild(tableWrap);
    }

    if (Array.isArray(payload.recommendations) && payload.recommendations.length > 0) {
        const recommendationLabel = createTextElement("p", "ai-section-label", "Action Recommendations");
        container.appendChild(recommendationLabel);

        const recommendationList = document.createElement("ul");
        recommendationList.className = "ai-list";
        payload.recommendations.forEach(textValue => {
            const clean = String(textValue || "").trim();
            if (!clean) return;
            recommendationList.appendChild(createTextElement("li", "ai-list-item", clean));
        });

        if (recommendationList.children.length > 0) {
            container.appendChild(recommendationList);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const insightsBtn = document.getElementById("generate-insights-btn");
    const insightsResult = document.getElementById("insights-result");
    const forecastBtn = document.getElementById("generate-forecast-btn");
    const forecastResult = document.getElementById("forecast-result");
    const insightsControls = bindAiActionControls({
        actionsId: "insights-actions",
        minimizeBtnId: "insights-minimize-btn",
        downloadBtnId: "insights-download-btn",
        resultId: "insights-result",
        title: "AI Inventory Insights"
    });
    const forecastControls = bindAiActionControls({
        actionsId: "forecast-actions",
        minimizeBtnId: "forecast-minimize-btn",
        downloadBtnId: "forecast-download-btn",
        resultId: "forecast-result",
        title: "AI Inventory Forecast and Recommendations"
    });

    const insightsCacheKey = "cached_inventory_insights_json_v1";
    const forecastCacheKey = "cached_inventory_forecast_json_v2";

    if (insightsBtn && insightsResult && insightsBtn.dataset.listenerBound !== "true") {
        insightsBtn.dataset.listenerBound = "true";
        insightsBtn.addEventListener("click", async () => {
            if (insightsInFlight) return;

            const originalText = insightsBtn.textContent;
            insightsInFlight = true;
            insightsBtn.disabled = true;
            insightsBtn.textContent = "Loading...";
            insightsResult.textContent = "Analyzing inventory health...";

            try {
                const cachedRaw = sessionStorage.getItem(insightsCacheKey);
                if (cachedRaw) {
                    const cachedPayload = JSON.parse(cachedRaw);
                    renderInsightsPayload(insightsResult, cachedPayload);
                    if (cachedPayload) insightsControls.show();
                    return;
                }

                const response = await fetch("/api/admin/inventory-insights");
                if (!response.ok) throw new Error("Insights request failed");

                const data = await response.json();
                const payload = data && data.insights ? data.insights : null;

                renderInsightsPayload(insightsResult, payload);
                if (payload) {
                    insightsControls.show();
                } else {
                    insightsControls.hide();
                }
                if (payload) {
                    sessionStorage.setItem(insightsCacheKey, JSON.stringify(payload));
                }
            } catch (error) {
                console.error(error);
                insightsResult.textContent = "Insights unavailable at the moment.";
                insightsControls.hide();
            } finally {
                insightsInFlight = false;
                insightsBtn.disabled = false;
                insightsBtn.textContent = originalText;
            }
        });
    }

    if (forecastBtn && forecastResult && forecastBtn.dataset.listenerBound !== "true") {
        forecastBtn.dataset.listenerBound = "true";
        forecastBtn.addEventListener("click", async () => {
            if (forecastInFlight) return;

            const originalText = forecastBtn.textContent;
            forecastInFlight = true;
            forecastBtn.disabled = true;
            forecastBtn.textContent = "Loading...";
            forecastResult.textContent = "Analyzing inventory and sales velocity...";

            try {
                const cachedRaw = sessionStorage.getItem(forecastCacheKey);
                if (cachedRaw) {
                    const cachedPayload = JSON.parse(cachedRaw);
                    renderForecastPayload(forecastResult, cachedPayload);
                    if (cachedPayload) forecastControls.show();
                    return;
                }

                const response = await fetch("/api/admin/inventory-forecast");
                if (!response.ok) throw new Error("Forecast request failed");

                const data = await response.json();
                const payload = data && data.report ? data.report : null;

                renderForecastPayload(forecastResult, payload);
                if (payload) {
                    forecastControls.show();
                } else {
                    forecastControls.hide();
                }
                if (payload) {
                    sessionStorage.setItem(forecastCacheKey, JSON.stringify(payload));
                }
            } catch (error) {
                console.error(error);
                forecastResult.textContent = "Forecast unavailable at the moment.";
                forecastControls.hide();
            } finally {
                forecastInFlight = false;
                forecastBtn.disabled = false;
                forecastBtn.textContent = originalText;
            }
        });
    }
});