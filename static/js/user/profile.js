document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('editContactBtn');
    const petProfileForm = document.getElementById('petProfileForm');
    const petSelector = document.getElementById('petSelector');
    const addPetBtn = document.getElementById('addPetBtn');

    let pets = [];
    let selectedPetId = null;
let notifTimer;

function showNotification(title, message) {
    const notif = document.getElementById("notification");

    notif.querySelector(".notif-title").innerText = title;
    notif.querySelector(".notif-msg").innerText = message;

    notif.classList.add("show");

    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => {
        hideNotification();
    }, 2500);
}

function hideNotification() {
    const notif = document.getElementById("notification");
    notif.classList.remove("show");
}


    const clearPetForm = () => {
        document.getElementById('petName').value = '';
        document.getElementById('petSpecies').value = '';
        document.getElementById('petBreed').value = '';
        document.getElementById('petAge').value = '';
        document.getElementById('petWeight').value = '';
    };

    const populatePetForm = (pet) => {
        if (!pet) {
            clearPetForm();
            return;
        }

        document.getElementById('petName').value = pet.name || '';
        document.getElementById('petSpecies').value = pet.species || '';
        document.getElementById('petBreed').value = pet.breed || '';
        document.getElementById('petAge').value = pet.age_months || '';
        document.getElementById('petWeight').value = pet.weight_kg || '';
    };

    const renderPetSelector = () => {
        if (!petSelector) {
            return;
        }

        petSelector.innerHTML = '';

        if (pets.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No pets yet';
            petSelector.appendChild(option);
            petSelector.disabled = true;
            selectedPetId = null;
            clearPetForm();
            return;
        }

        petSelector.disabled = false;
        pets.forEach((pet, index) => {
            const option = document.createElement('option');
            option.value = String(pet.id);
            option.textContent = `Pet ${index + 1}${pet.name ? ` - ${pet.name}` : ''}`;
            petSelector.appendChild(option);
        });

        if (selectedPetId !== null && pets.some((pet) => pet.id === selectedPetId)) {
            petSelector.value = String(selectedPetId);
        } else {
            selectedPetId = pets[0].id;
            petSelector.value = String(selectedPetId);
        }

        const currentPet = pets.find((pet) => pet.id === selectedPetId);
        populatePetForm(currentPet);
    };

    const loadPets = async () => {
        try {
            const response = await fetch('/api/user/pet');
            const data = await response.json();

            pets = (data && Array.isArray(data.pets)) ? data.pets : [];
            renderPetSelector();
        } catch (error) {
            console.error('Error fetching pet profiles:', error);
        }
    };

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            // Route through Flask endpoint instead of a file path URL
            window.location.href = '/verify-code';
        });
    }

    if (petSelector) {
        petSelector.addEventListener('change', (event) => {
            const newPetId = parseInt(event.target.value, 10);
            if (!Number.isNaN(newPetId)) {
                selectedPetId = newPetId;
                const currentPet = pets.find((pet) => pet.id === selectedPetId);
                populatePetForm(currentPet);
            }
        });
    }

    if (addPetBtn) {
        addPetBtn.addEventListener('click', () => {
            selectedPetId = null;
            clearPetForm();
            if (petSelector) {
                petSelector.value = '';
            }
        });
    }

    // Handle Pet Profile Form Submission
    if (petProfileForm) {
        petProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(petProfileForm);
            const petData = {
                name: formData.get('name'),
                species: formData.get('species'),
                breed: formData.get('breed'),
                age_months: parseInt(formData.get('age_months')),
                weight_kg: parseFloat(formData.get('weight_kg'))
            };

            if (selectedPetId !== null) {
                petData.pet_id = selectedPetId;
            }

            const submitBtn = petProfileForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/user/pet', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(petData)
                });
                const data = await response.json();

                if (data.success) {
                    if (data.pet_id) {
                        selectedPetId = data.pet_id;
                    }
                    await loadPets();
                    showNotification("Success!", "Pet profile saved successfully!");


                } else {
                    showNotification("Error", data.error || "Failed to save pet profile.");


                }
            } catch (error) {
                console.error('Error saving pet profile:', error);
                showNotification("Error", "An error occurred while saving.");

            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    loadPets();
});
