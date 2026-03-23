/**
 * Sambast Analytics System
 * Handles sidebar logic and dynamic data fetching for the Dashboard
 */

document.addEventListener('DOMContentLoaded', function () {
    // --- 1. SIDEBAR & UI LOGIC ---
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");
    const closeBtn = document.getElementById("closeBtn");
    const overlay = document.getElementById("overlay");

    if (menuBtn && sidebar && closeBtn && overlay) {
        menuBtn.onclick = () => {
            sidebar.classList.add("open");
            overlay.classList.add("show");
        };

        closeBtn.onclick = () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("show");
        };

        overlay.onclick = () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("show");
        };
    }

    // --- 2. DATA FETCHING LOGIC ---
    fetch('/admin/analytics-data')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            console.log("Analytics Engine Received:", data);

            // Update Total Revenue
            const revElem = document.getElementById('total-revenue');
            if (revElem) {
                revElem.innerText = `₱${data.summary.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            }

            // Update Total Orders
            const orderElem = document.getElementById('total-orders');
            if (orderElem) {
                orderElem.innerText = data.summary.orders;
            }

            // Update Status Summary Text
            const statusSummary = document.getElementById('status-summary');
            if (statusSummary) {
                const text = data.status_data.map(s => `${s.count} ${s.status.toLowerCase()}`).join(' - ');
                statusSummary.innerText = text || "No orders recorded";
            }

            // Update Average Order Value
            const avgElem = document.getElementById('avg-order-value');
            if (avgElem) {
                const avg = data.summary.orders > 0 ? (data.summary.revenue / data.summary.orders) : 0;
                avgElem.innerText = `₱${Math.round(avg).toLocaleString()}`;
            }

            // --- 3. CHART & LEGEND LOGIC ---
            if (data.top_products && data.top_products.length > 0) {
                initTopProductsChart(data.top_products);
                updateLegend(data.top_products);
            } else {
                console.warn("No top products data found for chart.");
                const legendList = document.getElementById('products-legend');
                if (legendList) legendList.innerHTML = "<li>No sales data yet</li>";
            }
        })
        .catch(error => {
            console.error('Analytics Error:', error);
            const statusSummary = document.getElementById('status-summary');
            if (statusSummary) statusSummary.innerText = "Error loading data.";
        });
});

/**
 * Renders the Chart.js Pie/Doughnut Chart
 */
function initTopProductsChart(products) {
    const canvas = document.getElementById('topProductsChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Create the chart
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: products.map(p => p.name),
            datasets: [{
                data: products.map(p => p.total_sold),
                backgroundColor: [
                    '#a6171c', // Sambast Red
                    '#1A323E', // Dark Blue
                    '#d6d0c5', // Tan
                    '#888888', // Grey
                    '#000000'  // Black
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // We use our own custom HTML legend
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: ${context.raw} sold`;
                        }
                    }
                }
            },
            cutout: '70%' // Makes it a doughnut
        }
    });
}

/**
 * Updates the custom HTML legend next to the chart
 */
function updateLegend(products) {
    const legendList = document.getElementById('products-legend');
    if (!legendList) return;

    legendList.innerHTML = products.map((p, index) => {
        const colors = ['#a6171c', '#1A323E', '#d6d0c5', '#888888', '#000000'];
        return `
            <li>
                <span class="dot" style="background-color: ${colors[index]}"></span>
                ${p.name} <strong>(${p.total_sold})</strong>
            </li>
        `;
    }).join('');
}