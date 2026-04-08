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

document.addEventListener("DOMContentLoaded", async () => {
    const summaryElement = document.getElementById("ai-summary-text");
    if (!summaryElement) return;

    const cachedSummary = sessionStorage.getItem("ai_business_summary");
    if (cachedSummary) {
        summaryElement.innerText = cachedSummary;
        return;
    }

    try {
        const response = await fetch("/api/admin/business-summary");
        if (!response.ok) throw new Error("Failed to fetch");
        
        const data = await response.json();
        const summaryText = data.summary || data.text || data.message || "Insights loaded."; // Adjust based on expected API response format
        
        summaryElement.innerText = summaryText;
        sessionStorage.setItem("ai_business_summary", summaryText);
    } catch (error) {
        summaryElement.innerText = "Insights unavailable.";
    }
});