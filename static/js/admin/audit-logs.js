const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

// Check if elements exist before adding listeners to avoid console errors
if (menuBtn && sidebar && overlay) {
    menuBtn.onclick = () => {
        sidebar.classList.add("open");
        overlay.classList.add("show");
    }
}

if (closeBtn && sidebar && overlay) {
    closeBtn.onclick = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
    }
}

if (overlay) {
    overlay.onclick = () => {
        if (sidebar) sidebar.classList.remove("open");
        overlay.classList.remove("show");
    }
}