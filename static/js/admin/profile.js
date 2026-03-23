// --- ELEMENT SELECTION ---
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");
const editIcon = document.querySelector(".edit-icon");
const emailSpan = document.getElementById("adminEmail");

// --- SIDEBAR TOGGLE LOGIC ---
if (menuBtn && sidebar && overlay) {
    menuBtn.onclick = () => {
        sidebar.classList.add("open");
        overlay.classList.add("show");
    };
}

if (closeBtn && sidebar && overlay) {
    closeBtn.onclick = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
    };
}

if (overlay && sidebar) {
    overlay.onclick = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
    };
}

// --- PROFILE EDIT LOGIC ---
if (editIcon && emailSpan) {
    editIcon.addEventListener("click", function() {
        const currentEmail = emailSpan.innerText;
        const newEmail = prompt("Enter new email:", currentEmail);
        
        if (newEmail && newEmail !== currentEmail) {
            emailSpan.innerText = newEmail;
            // Note: This only changes the UI. 
            // Database sync will require a POST fetch later.
            console.log("Email updated locally to: " + newEmail);
        }
    });
}