document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('verifyOtpForm');
    if (!form) {
        return;
    }

    const inputs = Array.from(form.querySelectorAll('.otp-container input'));
    const otpHiddenInput = document.getElementById('otp-input');
    const resendBtn = document.getElementById('resendOtpBtn');
    const errorNode = document.getElementById('otpErrorMessage');

    const otpLength = parseInt(form.dataset.otpLength || String(inputs.length), 10);
    let secondsLeft = parseInt((resendBtn && resendBtn.dataset.secondsLeft) || '0', 10);
    let countdownInterval = null;

    const setError = (message) => {
        if (errorNode) {
            errorNode.textContent = message || '';
        }
    };

    const updateResendButtonLabel = () => {
        if (!resendBtn) {
            return;
        }

        if (secondsLeft > 0) {
            resendBtn.disabled = true;
            resendBtn.textContent = `Resend in ${secondsLeft}s`;
        } else {
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend Code';
        }
    };

    const startCooldown = (duration) => {
        secondsLeft = Math.max(0, duration);
        updateResendButtonLabel();

        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        if (secondsLeft > 0) {
            countdownInterval = setInterval(() => {
                secondsLeft -= 1;
                if (secondsLeft <= 0) {
                    secondsLeft = 0;
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
                updateResendButtonLabel();
            }, 1000);
        }
    };

    inputs.forEach((input, index) => {
        input.addEventListener('input', (event) => {
            const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 1);
            event.target.value = digitsOnly;

            if (digitsOnly && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Backspace' && !event.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        input.addEventListener('paste', (event) => {
            event.preventDefault();
            const pasted = (event.clipboardData || window.clipboardData).getData('text') || '';
            const digits = pasted.replace(/\D/g, '').slice(0, inputs.length);

            digits.split('').forEach((digit, idx) => {
                if (inputs[idx]) {
                    inputs[idx].value = digit;
                }
            });

            const nextIndex = Math.min(digits.length, inputs.length - 1);
            if (inputs[nextIndex]) {
                inputs[nextIndex].focus();
            }
        });
    });

    form.addEventListener('submit', (event) => {
        setError('');
        const otpValue = inputs.map((input) => input.value).join('');

        if (!new RegExp(`^\\d{${otpLength}}$`).test(otpValue)) {
            event.preventDefault();
            setError(`Please enter all ${otpLength} digits.`);
            return;
        }

        if (otpHiddenInput) {
            otpHiddenInput.value = otpValue;
        }
    });

    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            if (secondsLeft > 0) {
                return;
            }

            setError('');
            resendBtn.disabled = true;
            resendBtn.textContent = 'Sending...';

            try {
                const response = await fetch('/verify-otp/resend', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (!response.ok) {
                    if (response.status === 429 && data.retry_after) {
                        startCooldown(parseInt(data.retry_after, 10));
                    } else {
                        updateResendButtonLabel();
                    }
                    setError(data.error || 'Unable to resend code right now.');
                    return;
                }

                startCooldown(60);
                setError(data.message || 'A new verification code was sent to your email.');
            } catch (error) {
                console.error('Resend OTP error:', error);
                updateResendButtonLabel();
                setError('Network error while resending code. Please try again.');
            }
        });
    }

    updateResendButtonLabel();
    if (secondsLeft > 0) {
        startCooldown(secondsLeft);
    }
});