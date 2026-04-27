const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

const summaryElement = document.getElementById("ai-summary-text");
const generateBtn = document.getElementById("generate-insights-btn");
const aiInsightsContainer = document.getElementById("aiInsightsContainer");

const summaryCacheKey = "cached_business_summary";
const summaryV2CacheKey = "cached_business_summary_v2";

let topProductsChartInstance = null;
const aiChartInstances = [];

const MAX_CHART_POINTS = 24;
const MAX_TABLE_ROWS = 40;

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

function toCurrency(value) {
    const numeric = Number(value || 0);
    return `₱${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function clearNode(node) {
    if (!node) return;
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function setSummaryText(text) {
    if (!summaryElement) return;
    summaryElement.innerText = text || "Insights unavailable at the moment.";
}

function destroyAiCharts() {
    while (aiChartInstances.length > 0) {
        const chart = aiChartInstances.pop();
        try {
            chart.destroy();
        } catch (_) {
            // Ignore chart destruction failures.
        }
    }
}

function normalizeVisualInsight(rawInsight, idKey) {
    if (!rawInsight || typeof rawInsight !== "object") return null;

    const id = String(rawInsight[idKey] || "").trim();
    const insight = String(rawInsight.insight || rawInsight.interpretation || "").trim();
    const action = String(rawInsight.action || "").trim();

    if (!id || !insight) return null;
    return { id, insight, action };
}

function buildVisualInsightMap(rawInsights, idKey) {
    const insights = Array.isArray(rawInsights) ? rawInsights : [];
    const insightMap = new Map();

    insights.forEach(raw => {
        const normalized = normalizeVisualInsight(raw, idKey);
        if (!normalized) return;
        insightMap.set(normalized.id, normalized);
    });

    return insightMap;
}

function renderVisualInsight(insight, parentContainer) {
    if (!parentContainer || !insight) return;

    const insightBox = document.createElement("div");
    insightBox.className = "ai-visual-insight";

    const insightText = document.createElement("p");
    insightText.className = "ai-visual-insight-text";
    insightText.textContent = insight.insight;
    insightBox.appendChild(insightText);

    if (insight.action) {
        const actionText = document.createElement("p");
        actionText.className = "ai-visual-action-text";
        actionText.textContent = `Action: ${insight.action}`;
        insightBox.appendChild(actionText);
    }

    parentContainer.appendChild(insightBox);
}

function normalizeChartSpec(rawSpec) {
    if (!rawSpec || typeof rawSpec !== "object") return null;

    const id = String(rawSpec.id || "").trim();
    const title = String(rawSpec.title || "").trim();
    const type = String(rawSpec.type || "bar").trim().toLowerCase();
    const labels = Array.isArray(rawSpec.labels) ? rawSpec.labels.map(label => String(label)) : [];
    const datasetsRaw = Array.isArray(rawSpec.datasets) ? rawSpec.datasets : [];
    const cappedLabels = labels.slice(0, MAX_CHART_POINTS);

    const datasets = datasetsRaw
        .filter(dataset => dataset && typeof dataset === "object")
        .map(dataset => {
            const label = String(dataset.label || "Series").trim();
            const data = Array.isArray(dataset.data)
                ? dataset.data.map(item => Number(item || 0))
                : [];
            return {
                label,
                data: data.slice(0, MAX_CHART_POINTS),
                backgroundColor: dataset.backgroundColor || "#a6171c",
                borderColor: dataset.borderColor || dataset.backgroundColor || "#a6171c"
            };
        });

    if (!id || !title || cappedLabels.length === 0 || datasets.length === 0) return null;

    return {
        id,
        title,
        type,
        labels: cappedLabels,
        datasets,
        meta: rawSpec.meta && typeof rawSpec.meta === "object" ? rawSpec.meta : {}
    };
}

function renderChartSection(spec, parentContainer, insightMap = null) {
    if (!parentContainer) return;

    const normalized = normalizeChartSpec(spec);
    if (!normalized) return;

    const chartCard = document.createElement("div");
    chartCard.className = "card ai-chart-card";

    const title = document.createElement("div");
    title.className = "small-title";
    title.textContent = normalized.title;
    chartCard.appendChild(title);

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "ai-chart-canvas-wrap";
    chartCard.appendChild(canvasWrap);

    const canvas = document.createElement("canvas");
    canvas.id = `ai-chart-${normalized.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    canvasWrap.appendChild(canvas);

    parentContainer.appendChild(chartCard);

    const chartType = ["line", "bar", "doughnut", "pie"].includes(normalized.type)
        ? normalized.type
        : "bar";

    const chartConfig = {
        type: chartType,
        data: {
            labels: normalized.labels,
            datasets: normalized.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true,
                    position: "bottom"
                }
            }
        }
    };

    if (chartType === "bar" && normalized.meta && normalized.meta.index_axis === "y") {
        chartConfig.options.indexAxis = "y";
    }

    if (chartType === "line" || chartType === "bar") {
        const yPrefix = normalized.meta && normalized.meta.y_prefix
            ? String(normalized.meta.y_prefix)
            : "";
        chartConfig.options.scales = {
            x: {
                ticks: {
                    autoSkip: true,
                    maxTicksLimit: 12
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    callback: value => `${yPrefix}${Number(value).toLocaleString()}`
                }
            }
        };
    }

    const chartInstance = new Chart(canvas, chartConfig);
    aiChartInstances.push(chartInstance);

    const visualInsight = insightMap instanceof Map
        ? insightMap.get(normalized.id)
        : null;
    renderVisualInsight(visualInsight, chartCard);
}

function normalizeTableBlock(rawBlock) {
    if (!rawBlock || typeof rawBlock !== "object") return null;

    const id = String(rawBlock.id || "").trim();
    const title = String(rawBlock.title || "").trim();
    const columns = Array.isArray(rawBlock.columns)
        ? rawBlock.columns.map(column => String(column || "").trim()).filter(Boolean)
        : [];
    const rowsRaw = Array.isArray(rawBlock.rows) ? rawBlock.rows : [];
    const rows = rowsRaw
        .filter(row => Array.isArray(row))
        .map(row => row.map(cell => String(cell ?? "")))
        .slice(0, MAX_TABLE_ROWS);

    if (!id || !title || columns.length === 0) return null;
    return { id, title, columns, rows };
}

function renderTableBlock(block, parentContainer, insightMap = null) {
    if (!parentContainer) return;

    const normalized = normalizeTableBlock(block);
    if (!normalized) return;

    const tableCard = document.createElement("div");
    tableCard.className = "card ai-table-card";

    const title = document.createElement("div");
    title.className = "small-title";
    title.textContent = normalized.title;
    tableCard.appendChild(title);

    if (normalized.rows.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "ai-empty-text";
        emptyMessage.textContent = "No data available for this section.";
        tableCard.appendChild(emptyMessage);
        const visualInsight = insightMap instanceof Map
            ? insightMap.get(normalized.id)
            : null;
        renderVisualInsight(visualInsight, tableCard);
        parentContainer.appendChild(tableCard);
        return;
    }

    const tableWrapper = document.createElement("div");
    tableWrapper.className = "ai-table-wrapper";

    const table = document.createElement("table");
    table.className = "ai-data-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    normalized.columns.forEach(column => {
        const th = document.createElement("th");
        th.textContent = column;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    normalized.rows.forEach(row => {
        const tr = document.createElement("tr");
        row.forEach(cell => {
            const td = document.createElement("td");
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    tableCard.appendChild(tableWrapper);

    const visualInsight = insightMap instanceof Map
        ? insightMap.get(normalized.id)
        : null;
    renderVisualInsight(visualInsight, tableCard);

    parentContainer.appendChild(tableCard);
}

function normalizePriorityRecommendation(rawRecommendation) {
    if (!rawRecommendation || typeof rawRecommendation !== "object") return null;

    const text = String(rawRecommendation.text || "").trim();
    if (!text) return null;

    const normalizedPriority = String(rawRecommendation.priority || "medium")
        .trim()
        .toLowerCase();
    const priority = ["high", "medium", "low"].includes(normalizedPriority)
        ? normalizedPriority
        : "medium";

    const relatedIds = Array.isArray(rawRecommendation.related_ids)
        ? rawRecommendation.related_ids
            .map(id => String(id || "").trim())
            .filter(Boolean)
        : [];

    return { text, priority, relatedIds };
}

function renderPriorityRecommendations(recommendations, parentContainer, labelLookup = null) {
    if (!parentContainer) return [];

    const normalized = Array.isArray(recommendations)
        ? recommendations
            .map(entry => normalizePriorityRecommendation(entry))
            .filter(Boolean)
        : [];

    if (normalized.length === 0) return [];

    const recoCard = document.createElement("div");
    recoCard.className = "card ai-priority-recommendations-card";

    const title = document.createElement("div");
    title.className = "small-title";
    title.textContent = "Priority Recommendations";
    recoCard.appendChild(title);

    const list = document.createElement("ul");
    list.className = "ai-priority-list";

    normalized.forEach(entry => {
        const item = document.createElement("li");
        item.className = "ai-priority-item";

        const topRow = document.createElement("div");
        topRow.className = "ai-priority-item-top";

        const badge = document.createElement("span");
        badge.className = `ai-priority-badge ai-priority-${entry.priority}`;
        badge.textContent = entry.priority;
        topRow.appendChild(badge);

        const text = document.createElement("p");
        text.className = "ai-priority-text";
        text.textContent = entry.text;
        topRow.appendChild(text);

        item.appendChild(topRow);

        if (entry.relatedIds.length > 0) {
            const relatedWrap = document.createElement("div");
            relatedWrap.className = "ai-related-tags";

            entry.relatedIds.forEach(relatedId => {
                const chip = document.createElement("span");
                chip.className = "ai-related-chip";
                const label = labelLookup instanceof Map
                    ? labelLookup.get(relatedId)
                    : null;
                chip.textContent = label || relatedId;
                relatedWrap.appendChild(chip);
            });

            item.appendChild(relatedWrap);
        }

        list.appendChild(item);
    });

    recoCard.appendChild(list);
    parentContainer.appendChild(recoCard);

    return normalized.map(item => item.text.toLowerCase());
}

function renderRecommendations(recommendations, parentContainer) {
    if (!parentContainer) return;

    const recoList = Array.isArray(recommendations)
        ? recommendations.map(item => String(item || "").trim()).filter(Boolean)
        : [];

    if (recoList.length === 0) return;

    const recoCard = document.createElement("div");
    recoCard.className = "card ai-recommendations-card";

    const title = document.createElement("div");
    title.className = "small-title";
    title.textContent = "Recommendations";
    recoCard.appendChild(title);

    const ul = document.createElement("ul");
    ul.className = "ai-recommendations-list";

    recoList.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
    });

    recoCard.appendChild(ul);
    parentContainer.appendChild(recoCard);
}

function renderAiInsightsBlock(analyticsPayload, source) {
    if (!aiInsightsContainer) return;

    destroyAiCharts();
    clearNode(aiInsightsContainer);

    if (!analyticsPayload || typeof analyticsPayload !== "object") return;

    const block = document.createElement("div");
    block.className = "card ai-insight-block";

    const header = document.createElement("div");
    header.className = "ai-insight-header";

    const heading = document.createElement("h3");
    heading.textContent = analyticsPayload.headline || "AI Analytics Overview";
    header.appendChild(heading);

    if (source) {
        const sourceBadge = document.createElement("span");
        sourceBadge.className = "ai-source-badge";
        sourceBadge.textContent = String(source).replaceAll("_", " ");
        header.appendChild(sourceBadge);
    }

    block.appendChild(header);

    const summary = document.createElement("p");
    summary.className = "ai-summary-text";
    summary.textContent = analyticsPayload.summary || "No interpretation available.";
    block.appendChild(summary);

    const chartInsightMap = buildVisualInsightMap(analyticsPayload.chart_insights, "chart_id");
    const tableInsightMap = buildVisualInsightMap(analyticsPayload.table_insights, "table_id");

    const chartTitleLookup = new Map();
    const chartSpecs = Array.isArray(analyticsPayload.chart_specs) ? analyticsPayload.chart_specs : [];
    chartSpecs.forEach(spec => {
        const id = String(spec && spec.id ? spec.id : "").trim();
        const title = String(spec && spec.title ? spec.title : "").trim();
        if (id && title) chartTitleLookup.set(id, title);
    });

    const tableTitleLookup = new Map();
    const tableBlocks = Array.isArray(analyticsPayload.table_blocks) ? analyticsPayload.table_blocks : [];
    tableBlocks.forEach(table => {
        const id = String(table && table.id ? table.id : "").trim();
        const title = String(table && table.title ? table.title : "").trim();
        if (id && title) tableTitleLookup.set(id, title);
    });

    const relatedLookup = new Map([...chartTitleLookup, ...tableTitleLookup]);

    const chartGrid = document.createElement("div");
    chartGrid.className = "ai-chart-grid";
    chartSpecs.forEach(spec => renderChartSection(spec, chartGrid, chartInsightMap));
    if (chartGrid.children.length > 0) {
        block.appendChild(chartGrid);
    }

    const tableGrid = document.createElement("div");
    tableGrid.className = "ai-table-grid";
    tableBlocks.forEach(table => renderTableBlock(table, tableGrid, tableInsightMap));
    if (tableGrid.children.length > 0) {
        block.appendChild(tableGrid);
    }

    const priorityTextSet = new Set(renderPriorityRecommendations(
        analyticsPayload.priority_recommendations,
        block,
        relatedLookup
    ));

    const recommendations = Array.isArray(analyticsPayload.recommendations)
        ? analyticsPayload.recommendations
            .map(item => String(item || "").trim())
            .filter(Boolean)
        : [];

    const additionalRecommendations = recommendations.filter(item => !priorityTextSet.has(item.toLowerCase()));

    renderRecommendations(additionalRecommendations, block);

    aiInsightsContainer.appendChild(block);
}

function renderLowStockList(stats) {
    const lowStockList = document.getElementById("low-stock-list");
    if (!lowStockList) return;

    clearNode(lowStockList);
    const tiers = stats && stats.low_stock_tiers ? stats.low_stock_tiers : null;

    const addListItem = text => {
        const li = document.createElement("li");
        li.textContent = text;
        lowStockList.appendChild(li);
    };

    if (tiers) {
        (tiers.critical || []).forEach(item => addListItem(`CRITICAL: ${item.name} (${item.stock} left)`));
        (tiers.warning || []).forEach(item => addListItem(`WARNING: ${item.name} (${item.stock} left)`));
        (tiers.watch || []).forEach(item => addListItem(`WATCH: ${item.name} (${item.stock} left)`));
    } else if (Array.isArray(stats.low_stock) && stats.low_stock.length > 0) {
        stats.low_stock.forEach(item => addListItem(`LOW STOCK: ${item}`));
    }

    if (!lowStockList.firstChild) {
        addListItem("All items well-stocked.");
    }
}

async function loadStats() {
    try {
        const statsResponse = await fetch("/api/admin/stats");
        if (!statsResponse.ok) throw new Error("Stats fetch failed");

        const stats = await statsResponse.json();

        const totalRevenueEl = document.getElementById("total-revenue");
        const totalOrdersEl = document.getElementById("total-orders");
        const activeOrdersEl = document.getElementById("active-orders");
        const avgOrderValueEl = document.getElementById("avg-order-value");
        const statusSummary = document.getElementById("status-summary");

        if (totalRevenueEl) totalRevenueEl.innerText = stats.revenue || toCurrency(0);
        if (totalOrdersEl) totalOrdersEl.innerText = stats.order_count ?? 0;
        if (activeOrdersEl) activeOrdersEl.innerText = stats.active_order_count ?? 0;
        if (avgOrderValueEl) avgOrderValueEl.innerText = stats.avg_value || toCurrency(0);
        if (statusSummary) statusSummary.innerText = `${stats.active_order_count ?? 0} active orders in system.`;

        renderLowStockList(stats);
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
    }
}

async function loadTopProductsChart() {
    try {
        const topProductsResponse = await fetch("/api/admin/top-products");
        if (!topProductsResponse.ok) throw new Error("Top products fetch failed");

        const topProductsData = await topProductsResponse.json();
        const ctx = document.getElementById("topProductsChart");
        if (!ctx) return;

        if (topProductsChartInstance) {
            topProductsChartInstance.destroy();
            topProductsChartInstance = null;
        }

        const labels = Array.isArray(topProductsData) ? topProductsData.map(item => item.name) : [];
        const values = Array.isArray(topProductsData) ? topProductsData.map(item => Number(item.count || 0)) : [];

        if (labels.length === 0) return;

        topProductsChartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Quantity Sold",
                    data: values,
                    backgroundColor: "#a6171c",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true
                    },
                    y: {
                        ticks: {
                            callback: function(value) {
                                const label = this.getLabelForValue(value);
                                if (typeof label === 'string' && label.length > 12) {
                                    return label.substring(0, 12) + '...';
                                }
                                return label;
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    } catch (error) {
        console.error("Top Products Chart Error:", error);
    }
}

async function loadLegacySummaryOnly() {
    const response = await fetch("/api/admin/business-summary");
    if (!response.ok) throw new Error("Legacy summary fetch failed");

    const data = await response.json();
    const summaryText = data.summary || data.text || data.message || "Insights loaded.";
    setSummaryText(summaryText);
    if (data.source === "ai") {
        sessionStorage.setItem(summaryCacheKey, summaryText);
        sessionStorage.setItem("ai_business_summary", summaryText);
    }
}

async function generateStructuredInsights() {
    const response = await fetch("/api/admin/business-summary-v2");
    if (!response.ok) throw new Error("Structured insights fetch failed");

    const payload = await response.json();
    const analytics = payload && payload.analytics ? payload.analytics : null;
    if (!analytics || typeof analytics !== "object") {
        throw new Error("Invalid structured analytics payload");
    }

    setSummaryText(analytics.summary || "Insights loaded.");
    renderAiInsightsBlock(analytics, payload.source || "ai");

    if (payload.source === "ai") {
        sessionStorage.setItem(summaryV2CacheKey, JSON.stringify(payload));
        sessionStorage.setItem(summaryCacheKey, analytics.summary || "Insights loaded.");
        sessionStorage.setItem("ai_business_summary", analytics.summary || "Insights loaded.");
    }
}

function restoreCachedInsights() {
    const cachedV2 = sessionStorage.getItem(summaryV2CacheKey);
    if (cachedV2) {
        try {
            const payload = JSON.parse(cachedV2);
            const analytics = payload && payload.analytics ? payload.analytics : null;
            if (analytics && typeof analytics === "object") {
                setSummaryText(analytics.summary || "Insights loaded.");
                renderAiInsightsBlock(analytics, payload.source || "cache");
                return;
            }
        } catch (_) {
            // Ignore bad cache parse and continue with legacy cache.
        }
    }

    const cachedSummary = sessionStorage.getItem(summaryCacheKey) || sessionStorage.getItem("ai_business_summary");
    if (cachedSummary) {
        setSummaryText(cachedSummary);
    }
}

// --- DASHBOARD DATA LOADING ---
document.addEventListener("DOMContentLoaded", async () => {
    restoreCachedInsights();

    await loadStats();
    await loadTopProductsChart();

    if (generateBtn && generateBtn.dataset.listenerBound !== "true") {
        generateBtn.dataset.listenerBound = "true";

        generateBtn.addEventListener("click", async () => {
            const originalBtnText = generateBtn.innerText;
            generateBtn.disabled = true;
            generateBtn.innerText = "Loading...";
            setSummaryText("Generating insights...");

            try {
                await generateStructuredInsights();
            } catch (error) {
                console.error("Structured AI Insights Error:", error);
                try {
                    await loadLegacySummaryOnly();
                } catch (legacyError) {
                    console.error("Legacy AI Insights Error:", legacyError);
                    setSummaryText("Insights unavailable at the moment.");
                }
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerText = originalBtnText;
            }
        });
    }
});