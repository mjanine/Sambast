document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createAccountForm');
    const emailInput = document.getElementById('email');
    const contactInput = document.getElementById('contactNo');

// allow numbers only + limit to 11 digits
contactInput.addEventListener('input', () => {
    contactInput.value = contactInput.value
        .replace(/\D/g, '')   // remove letters/symbols
        .slice(0, 11);        // max 11 digits
});

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const fullName = document.getElementById('fullName').value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const contactNo = document.getElementById('contactNo').value.trim();

        // EMPTY FIELDS
        if (!fullName || !email || !contactNo) {
            showErrorModal('Please fill in all fields.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showErrorModal('Please enter a valid email address.');
            return;
        }

        if (!/^09\d{9}$/.test(contactNo)) {
            showErrorModal('Contact number must be 11 digits starting with 09.');
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Sending Code...';

        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                full_name: fullName,
                email,
                contact_no: contactNo
            })
        })
        .then(response =>
            response.json().then(data => ({
                ok: response.ok,
                status: response.status,
                data
            }))
        )
        .then(({ ok, status, data }) => {

            if (ok) {
                window.location.href = data.redirect_url;
            } else {
                showErrorModal(data.error || `An error occurred (Status: ${status})`);
            }

        })
        .catch(err => {
            console.error('Fetch Error:', err);
            showErrorModal('A network error occurred. Please try again.');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'VERIFY';
        });
    });
});


// ===== ERROR MODAL FUNCTION =====
function showErrorModal(message) {
    const modal = document.getElementById("errorModal");
    const text = document.getElementById("modalErrorText");
    const okBtn = document.getElementById("modalOkBtn");

    text.textContent = message;
    modal.style.display = "flex";

    // prevent duplicate event stacking
    okBtn.onclick = null;
    modal.onclick = null;

    okBtn.onclick = function () {
        modal.style.display = "none";
    };

    modal.onclick = function (e) {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    };
}
