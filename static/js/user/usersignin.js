document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signInForm');
    const pinInputs = document.querySelectorAll('.pin-container input');

    // ===== PIN AUTO MOVE =====
    pinInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < pinInputs.length - 1) {
                pinInputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                pinInputs[index - 1].focus();
            }
        });
    });

    // ===== FORM SUBMIT =====
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let pin = '';
        pinInputs.forEach(input => pin += input.value);

        const contactNo = document.getElementById('contactNo').value;

        // ===== VALIDATION =====
        if (!/^09\d{9}$/.test(contactNo) || pin.length !== 4) {
            showErrorModal('Please enter your 11-digit contact number (starting with 09) and 4-digit PIN.');
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Signing In...';

        fetch('/sign-in', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contact_no: contactNo,
                pin: pin
            })
        })
        .then(response =>
            response.json().then(data => ({
                ok: response.ok,
                data
            }))
        )
        .then(({ ok, data }) => {

            if (ok) {
                // SUCCESS
                window.location.href = data.redirect_url;
            } else {
                // ERROR FROM BACKEND
                showErrorModal(data.error || 'An unknown error occurred.');
            }

        })
        .catch(err => {
            console.error('Fetch Error:', err);
            showErrorModal('A network error occurred. Please try again.');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'SIGN IN';
        });
    });
});


// ===== ERROR MODAL =====
function showErrorModal(message) {
    const modal = document.getElementById("errorModal");
    const text = document.getElementById("modalErrorText");
    const okBtn = document.getElementById("modalOkBtn");

    text.textContent = message;
    modal.style.display = "flex";

    okBtn.onclick = null;
    modal.onclick = null;

    okBtn.onclick = () => {
        modal.style.display = "none";
    };

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    };
}
