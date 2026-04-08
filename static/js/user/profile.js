document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('editContactBtn');

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            // Redirects to verifycode.html when pencil is clicked
            window.location.href = 'verifycode.html';
        });
    }
});