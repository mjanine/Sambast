document.addEventListener("DOMContentLoaded", () => {
    const orderNoFromPage = document.body ? document.body.dataset.orderNo : "";
    const orderNoFromStorage = localStorage.getItem("lastOrderNo");
    let activeOrderNo = (orderNoFromPage || orderNoFromStorage || "").trim();

    const orderNoText = document.getElementById("orderNo");
    const cancelBtn = document.getElementById("cancelBtn");
    const statusText = document.getElementById("cancelStatusText");
    const reason = document.getElementById("cancelReason");

    const setStatusMessage = (message, canCancel) => {
        if (statusText) {
            statusText.innerText = message;
        }
        if (cancelBtn) {
            cancelBtn.disabled = !canCancel;
        }
    };

    const updateOrderNoUI = () => {
        if (orderNoText) {
            orderNoText.innerText = activeOrderNo || "No order found";
        }
    };

    const updateUIForStatus = (status) => {
        const normalized = (status || "").toLowerCase();
        if (normalized === "pending") {
            setStatusMessage("You can cancel this order because it is still pending.", true);
        } else if (normalized === "cancelled") {
            setStatusMessage("This order has already been cancelled.", false);
        } else if (normalized === "completed") {
            setStatusMessage("This order has already been completed.", false);
        } else if (normalized === "ready") {
            setStatusMessage("This order is ready for pick-up and cannot be cancelled.", false);
        } else {
            setStatusMessage("This order cannot be cancelled anymore.", false);
        }
    };

    const fetchLatestOrderNo = async () => {
        if (activeOrderNo) {
            return true;
        }

        try {
            const res = await fetch("/orders/latest/status");
            if (!res.ok) {
                return false;
            }
            const data = await res.json();
            activeOrderNo = (data.order_no || "").trim();
            if (activeOrderNo) {
                localStorage.setItem("lastOrderNo", activeOrderNo);
                updateOrderNoUI();
                updateUIForStatus(data.status);
            }
            return Boolean(activeOrderNo);
        } catch (error) {
            return false;
        }
    };

    const fetchOrderStatus = async () => {
        if (!activeOrderNo) {
            setStatusMessage("No order found. Please place an order first.", false);
            return;
        }

        try {
            const res = await fetch(`/orders/${activeOrderNo}/status`);
            if (!res.ok) {
                setStatusMessage("Order not found. Please check your order number.", false);
                return;
            }
            const data = await res.json();
            updateUIForStatus(data.status);
        } catch (error) {
            setStatusMessage("Unable to check order status right now.", false);
        }
    };

    updateOrderNoUI();
    fetchLatestOrderNo().then((resolved) => {
        if (resolved) {
            fetchOrderStatus();
        } else {
            setStatusMessage("No order found. Please place an order first.", false);
        }
    });

    if (cancelBtn) {
        cancelBtn.addEventListener("click", async () => {
            if (!reason || !reason.value) {
                alert("Please select a reason");
                return;
            }

            if (!activeOrderNo) {
                alert("No order found to cancel");
                return;
            }

            cancelBtn.disabled = true;

            try {
                const res = await fetch(`/orders/${activeOrderNo}/cancel`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ reason: reason.value })
                });
                const data = await res.json();

                if (!res.ok) {
                    const message = data.error || "Unable to cancel order.";
                    setStatusMessage(message, false);
                    cancelBtn.disabled = false;
                    return;
                }

                localStorage.setItem("lastOrderStatus", "Cancelled");
                localStorage.setItem("hasActiveOrder", "false");
                localStorage.setItem("lastOrderNo", activeOrderNo);
                window.location.href = "/order-progress";
            } catch (error) {
                setStatusMessage("Unable to cancel order right now.", false);
                cancelBtn.disabled = false;
            }
        });
    }
});