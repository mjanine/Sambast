document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createAccountForm');
    const errorDisplay = document.getElementById('errorMessage');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const fullName = document.getElementById('fullName').value;
        const contactNo = document.getElementById('contactNo').value;

        if (!fullName || !contactNo) {
            errorDisplay.textContent = 'Please fill in all fields.';
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';
        errorDisplay.textContent = '';

        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                full_name: fullName,
                contact_no: contactNo
            })
        })
        .then(response => response.json().then(data => ({ ok: response.ok, status: response.status, data })))
        .then(({ ok, status, data }) => {
            if (ok) {
                window.location.href = data.redirect_url;
            } else {
                errorDisplay.textContent = data.error || `An error occurred (Status: ${status})`;
            }
        })
        .catch(err => {
            console.error('Fetch Error:', err);
            errorDisplay.textContent = 'A network error occurred. Please try again.';
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'VERIFY';
        });
    });
});
