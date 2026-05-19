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
    editIcon.addEventListener("click", async function() {
        const currentEmail = emailSpan.innerText;
        const newEmail = prompt("Enter new email:", currentEmail);
        
        if (newEmail && newEmail !== currentEmail) {
            try {
                const response = await fetch("/admin/profile/email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: newEmail })
                });
                const data = await response.json();

                if (!response.ok) {
                    alert(data.error || "Unable to update email.");
                    return;
                }

                emailSpan.innerText = data.email || newEmail;
            } catch (error) {
                alert("Unable to update email right now.");
            }
        }
    });
}