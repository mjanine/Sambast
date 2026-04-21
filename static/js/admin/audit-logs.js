const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

menuBtn.onclick = () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
}

closeBtn.onclick = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
}

overlay.onclick = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
}

// ===== AUDIT LOG FILTERING & EXPORT =====

const auditSearch = document.getElementById("auditSearch");
const categoryFilter = document.getElementById("categoryFilter");
const dateFromFilter = document.getElementById("dateFromFilter");
const dateToFilter = document.getElementById("dateToFilter");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const auditContainer = document.getElementById("auditContainer");
const downloadBtn = document.getElementById("downloadBtn");
const downloadModal = document.getElementById("downloadModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const downloadCsvOption = document.getElementById("downloadCsvOption");
const downloadPdfOption = document.getElementById("downloadPdfOption");

// Apply filters when any filter changes
function applyFilters() {
    const searchQuery = auditSearch.value.trim();
    const categoryValue = categoryFilter.value;
    const dateFrom = dateFromFilter.value;
    const dateTo = dateToFilter.value;

    // Build query parameters
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (categoryValue) params.append('category', categoryValue);
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);

    // Fetch filtered logs
    fetch(`/api/admin/audit-logs?${params.toString()}`)
        .then(response => response.json())
        .then(logs => {
            if (logs.length === 0) {
                auditContainer.innerHTML = '<div class="no-logs" style="text-align: center; margin-top: 50px;"><p>No activity records found.</p></div>';
            } else {
                auditContainer.innerHTML = logs.map(log => `
                    <div class="audit-card">
                        <div class="card-header">
                            <strong>${escapeHtml(log.username || 'System')}</strong>
                            <span class="category-tag" data-category="${escapeHtml(log.category)}">${escapeHtml(log.category)}</span>
                            <span class="date">${log.timestamp}</span>
                        </div>
                        <div class="card-body">
                            <div class="action-text">${escapeHtml(log.action_text)}</div>
                        </div>
                    </div>
                `).join('');
            }
        })
        .catch(error => {
            console.error('Error fetching logs:', error);
            auditContainer.innerHTML = '<div class="no-logs" style="text-align: center; margin-top: 50px;"><p>Error loading logs.</p></div>';
        });
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Reset all filters
function resetFilters() {
    auditSearch.value = '';
    categoryFilter.value = '';
    dateFromFilter.value = '';
    dateToFilter.value = '';
    applyFilters();
}

// Get current filter parameters
function getFilterParams() {
    const params = new URLSearchParams();
    if (auditSearch.value.trim()) params.append('search', auditSearch.value.trim());
    if (categoryFilter.value) params.append('category', categoryFilter.value);
    if (dateFromFilter.value) params.append('date_from', dateFromFilter.value);
    if (dateToFilter.value) params.append('date_to', dateToFilter.value);
    return params.toString();
}

// Modal Functions
function openDownloadModal() {
    downloadModal.style.display = 'flex';
}

function closeDownloadModal() {
    downloadModal.style.display = 'none';
}

// Download as CSV
function downloadAsCSV() {
    const params = getFilterParams();
    window.location.href = `/admin/audit/export/csv?${params}`;
    closeDownloadModal();
}

// Download as PDF
function downloadAsPDF() {
    const params = getFilterParams();
    window.location.href = `/admin/audit/export/pdf?${params}`;
    closeDownloadModal();
}

// Close modal when clicking outside
downloadModal.addEventListener('click', (e) => {
    if (e.target === downloadModal) {
        closeDownloadModal();
    }
});

// Event listeners
downloadBtn.addEventListener('click', openDownloadModal);
closeModalBtn.addEventListener('click', closeDownloadModal);
downloadCsvOption.addEventListener('click', downloadAsCSV);
downloadPdfOption.addEventListener('click', downloadAsPDF);

auditSearch.addEventListener('input', applyFilters);
categoryFilter.addEventListener('change', applyFilters);
dateFromFilter.addEventListener('change', applyFilters);
dateToFilter.addEventListener('change', applyFilters);
resetFiltersBtn.addEventListener('click', resetFilters);