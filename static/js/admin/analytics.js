const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

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

if (overlay) {
    overlay.onclick = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
    }
}

// --- DASHBOARD DATA LOADING ---
document.addEventListener("DOMContentLoaded", async () => {
    
    // 1. AI EXECUTIVE SUMMARY LOGIC
    const summaryElement = document.getElementById("ai-summary-text");
    if (summaryElement) {
        const cachedSummary = sessionStorage.getItem("ai_business_summary");
        if (cachedSummary) {
            summaryElement.innerText = cachedSummary;
        } else {
            try {
                const response = await fetch("/api/admin/business-summary");
                if (response.ok) {
                    const data = await response.json();
                    const summaryText = data.summary || data.text || data.message || "Insights loaded.";
                    summaryElement.innerText = summaryText;
                    sessionStorage.setItem("ai_business_summary", summaryText);
                } else {
                    summaryElement.innerText = "Insights unavailable at the moment.";
                }
            } catch (error) {
                summaryElement.innerText = "Insights unavailable.";
            }
        }
    }

    // 2. HARD STATS LOGIC (Revenue, Orders, etc.)
    try {
        const statsResponse = await fetch("/api/admin/stats");
        if (!statsResponse.ok) throw new Error("Stats fetch failed");
        
        const stats = await statsResponse.json();

        // Inject the numbers into the HTML IDs
        if (document.getElementById("total-revenue")) 
            document.getElementById("total-revenue").innerText = stats.revenue;
        
        if (document.getElementById("total-orders")) 
            document.getElementById("total-orders").innerText = stats.order_count;
        
        if (document.getElementById("avg-order-value")) 
            document.getElementById("avg-order-value").innerText = stats.avg_value;

        // Update the status summary text
        const statusSummary = document.getElementById("status-summary");
        if (statusSummary) {
            statusSummary.innerText = `${stats.order_count} active orders in system.`;
        }

        // Update Low Stock List
        const lowStockList = document.getElementById("low-stock-list");
        if (lowStockList) {
            if (stats.low_stock && stats.low_stock.length > 0) {
                lowStockList.innerHTML = stats.low_stock.map(item => `<li>⚠️ ${item}</li>`).join('');
            } else {
                lowStockList.innerHTML = "<li>✅ All items well-stocked.</li>";
            }
        }

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
    }
});