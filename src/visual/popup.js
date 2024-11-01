async function popupLoad() {
    const settings = await chrome.storage.sync.get(['isEnabled']);
    const enabled = settings.isEnabled !== undefined ? settings.isEnabled : true;
    const toggleExtension = document.getElementById('toggleExtension');

    if (toggleExtension) {
        toggleExtension.checked = enabled;
    } else {
        console.error("Toggle switch not found!");
    }

    if (!enabled) {
        document.getElementById("matchStats").innerText = "The extension is disabled!";
    }
}

async function loadSettings() {
    const settings = await chrome.storage.sync.get(['isEnabled', 'sliderValue']);
    const rangeSlider = document.getElementById('rangeSlider');
    const sliderValueDisplay = document.getElementById('sliderValue');

    const toggleExtension = document.getElementById('toggleExtension');
    if (toggleExtension) {
        toggleExtension.checked = settings.isEnabled !== undefined ? settings.isEnabled : true;
    } else {
        console.error("Toggle switch not found during load settings!");
    }

    if (rangeSlider && sliderValueDisplay) {
        const sliderValue = settings.sliderValue !== undefined ? settings.sliderValue : 5;
        rangeSlider.value = sliderValue;
        sliderValueDisplay.textContent = sliderValue
    } else {
        console.error("Range slider not found during load settings!");
    }
}

async function saveSettings() {
    const isEnabled = document.getElementById('toggleExtension').checked;
    const sliderValue = parseInt(document.getElementById('rangeSlider').value, 10);

    await chrome.storage.sync.set({isEnabled, sliderValue});
    console.log("The settings have been saved:", {isEnabled, sliderValue});
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
    await popupLoad();

    const toggleExtension = document.getElementById('toggleExtension');
    if (toggleExtension) {
        toggleExtension.addEventListener('change', async function () {
            const isEnabled = this.checked;
            await chrome.storage.sync.set({isEnabled});
            console.log('Extension enabled:', isEnabled);
        });
    }

    const rangeSlider = document.getElementById('rangeSlider');
    const sliderValueDisplay = document.getElementById('sliderValue');

    if (rangeSlider && sliderValueDisplay) {
        rangeSlider.addEventListener('input', async function () {
            sliderValueDisplay.textContent = this.value;
            await saveSettings();
        });
    }

    const tabButtons = document.querySelectorAll('.tab-button');
    const categories = document.querySelectorAll('.settings-category');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            categories.forEach(category => category.classList.remove('active-category'));

            button.classList.add('active');
            document.getElementById(button.getAttribute('data-tab')).classList.add('active-category');
        });
    });
});
