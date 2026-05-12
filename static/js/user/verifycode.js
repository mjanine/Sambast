document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('verifyOtpForm');
    if (!form) {
        return;
    }

    const inputs = Array.from(
        form.querySelectorAll('.otp-container input, .pin-container input')
    );
    const otpHiddenInput = document.getElementById('otp-input') || document.getElementById('otpValue');
    const resendBtn = document.getElementById('resendOtpBtn');
    const errorNode = document.getElementById('otpErrorMessage');

    const otpLength = parseInt(form.dataset.otpLength || String(inputs.length), 10);
    const sendEndpoint = form.dataset.sendEndpoint || '/verify-otp/start';
    const verifyEndpoint = form.dataset.verifyEndpoint || '/verify-otp';
    const autoSend = form.dataset.autoSend !== 'false';

    let secondsLeft = parseInt((resendBtn && resendBtn.dataset.secondsLeft) || '0', 10);
    let countdownInterval = null;
    let isSending = false;

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
        secondsLeft = Math.max(0, parseInt(duration, 10) || 0);
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

    const sendOtp = async (isResend) => {
        if (isSending) {
            return;
        }

        setError('');
        isSending = true;
        if (resendBtn) {
            resendBtn.disabled = true;
            resendBtn.textContent = 'Sending...';
        }

        try {
            const response = await fetch(sendEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ resend: !!isResend })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (response.status === 429 && data.retry_after) {
                    startCooldown(parseInt(data.retry_after, 10));
                } else {
                    updateResendButtonLabel();
                }
                setError(data.error || 'Unable to send code right now.');
                return;
            }

            startCooldown(data.cooldown_seconds || 30);
            setError(data.message || 'Verification code sent.');
        } catch (error) {
            console.error('Send OTP error:', error);
            updateResendButtonLabel();
            setError('Network error while sending code. Please try again.');
        } finally {
            isSending = false;
            updateResendButtonLabel();
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

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setError('');

        const otpValue = inputs.map((input) => input.value).join('');
        if (!new RegExp(`^\\d{${otpLength}}$`).test(otpValue)) {
            setError(`Please enter all ${otpLength} digits.`);
            return;
        }

        if (otpHiddenInput) {
            otpHiddenInput.value = otpValue;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalLabel = submitButton ? submitButton.textContent : '';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Verifying...';
        }

        try {
            const verifyResponse = await fetch(verifyEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ otp: otpValue })
            });

            const verifyData = await verifyResponse.json().catch(() => ({}));

            if (!verifyResponse.ok) {
                setError(verifyData.error || 'Verification failed. Please try again.');
                return;
            }

            if (verifyData.redirect_url) {
                window.location.href = verifyData.redirect_url;
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error('Verification error:', error);
            setError('Unable to verify the code. Please try again.');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalLabel || 'VERIFY';
            }
        }
    });

    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            if (secondsLeft > 0) {
                return;
            }
            await sendOtp(true);
        });
    }

    updateResendButtonLabel();
    if (secondsLeft > 0) {
        startCooldown(secondsLeft);
    } else if (autoSend) {
        sendOtp(false);
    }
});
