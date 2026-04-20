document.addEventListener("DOMContentLoaded", () => {

    const orderNo = localStorage.getItem("lastOrderNo");
    const status = localStorage.getItem("lastOrderStatus") || "PENDING";

    const orderNoText = document.getElementById("orderNo");
    const cancelBtn = document.getElementById("cancelBtn");
    const statusText = document.getElementById("cancelStatusText");
    const reason = document.getElementById("cancelReason");

    // Show order number
    if (orderNoText) {
        orderNoText.innerText = orderNo || "No order found";
    }

    // CHECK STATUS (frontend only)
    function updateUI() {
        if (status !== "PENDING") {
            cancelBtn.disabled = true;
            statusText.innerText = "This order cannot be cancelled anymore.";
        } else {
            cancelBtn.disabled = false;
            statusText.innerText = "You can cancel this order because it is still pending.";
        }
    }

    updateUI();

    // Cancel action (frontend only simulation)
    cancelBtn.addEventListener("click", () => {

        if (!reason.value) {
            alert("Please select a reason");
            return;
        }

        if (status !== "PENDING") {
            alert("Order can no longer be cancelled");
            return;
        }

        alert("Order cancelled (frontend only)");

        // simulate update
        localStorage.setItem("lastOrderStatus", "CANCELLED");
        localStorage.setItem("hasActiveOrder", "false");

        window.location.href = "/shop";
    });

});