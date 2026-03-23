const inputs = document.querySelectorAll('.pin-container input');
const form   = document.getElementById('verifyPinForm');

// Auto-advance / backspace navigation
inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            inputs[index - 1].focus();
        }
    });
});

// Before submitting, collect digits into the hidden <input name="pin">
form.addEventListener('submit', (e) => {
    let pin = '';
    inputs.forEach(input => pin += input.value);

    if (pin.length !== 4) {
        e.preventDefault();
        alert('Please enter all 4 digits.');
        return;
    }

    document.getElementById('pinValue').value = pin;
    // Form submits normally to POST /verify-pin
    // Server compares against session['pending_pin_hash']
});