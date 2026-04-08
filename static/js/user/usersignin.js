document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signInForm');
    const errorDisplay = document.getElementById('errorMessage'); // Assumes an element with this ID exists
    const pinInputs = document.querySelectorAll('.pin-container input');

    // Auto-advance / backspace navigation for PIN
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

    form.addEventListener('submit', (e) => {
        e.preventDefault(); // Stop default form submission

        let pin = '';
        pinInputs.forEach(input => pin += input.value);
        const contactNo = document.getElementById('contactNo').value; // Assumes an input with this ID exists

        // Basic validation
        if (!contactNo || pin.length !== 4) {
            errorDisplay.textContent = 'Please enter your contact number and 4-digit PIN.';
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Signing In...';
        errorDisplay.textContent = ''; // Clear previous errors

        fetch('/sign-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contact_no: contactNo,
                pin: pin
            })
        })
        .then(response => response.json().then(data => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
            if (ok) {
                // Success
                window.location.href = data.redirect_url;
            } else {
                // Error
                errorDisplay.textContent = data.error || 'An unknown error occurred.';
            }
        })
        .catch(err => {
            console.error('Fetch Error:', err);
            errorDisplay.textContent = 'A network error occurred. Please try again.';
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'SIGN IN';
        });
    });
});