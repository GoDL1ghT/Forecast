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
    const settings = await chrome.storage.sync.get(['isEnabled', 'sliderValue', 'advmatchhist', 'neweloranks', 'exmatchinfo', 'matchroom', 'eloranking', 'matchhistory']);
    const rangeSlider = document.getElementById('rangeSlider');
    const sliderValueDisplay = document.getElementById('sliderValue');

    const toggleExtension = document.getElementById('toggleExtension');
    if (toggleExtension) {
        toggleExtension.checked = settings.isEnabled !== undefined ? settings.isEnabled : true;
    }

    const toggleMatchRoom = document.getElementById('matchroom');
    if (toggleMatchRoom) {
        toggleMatchRoom.checked = settings.matchroom !== undefined ? settings.matchroom : true;
    }

    const toggleEloRanking = document.getElementById('eloranking');
    if (toggleEloRanking) {
        toggleEloRanking.checked = settings.eloranking !== undefined ? settings.eloranking : true;
    }

    const toggleAdvancedMatchHistory = document.getElementById('matchhistory');
    if (toggleAdvancedMatchHistory) {
        toggleAdvancedMatchHistory.checked = settings.matchhistory !== undefined ? settings.matchhistory : true;
    }

    if (rangeSlider && sliderValueDisplay) {
        const sliderValue = settings.sliderValue !== undefined ? settings.sliderValue : 20;
        rangeSlider.value = sliderValue;
        sliderValueDisplay.textContent = sliderValue;
    }
}

async function saveSettings() {
    const isEnabled = document.getElementById('toggleExtension').checked;
    const sliderValue = parseInt(document.getElementById('rangeSlider').value, 10);
    const matchroom = document.getElementById('matchroom').checked;
    const eloranking = document.getElementById('eloranking').checked;
    const matchhistory = document.getElementById('matchhistory').checked;

    await chrome.storage.sync.set({isEnabled, sliderValue, matchroom, eloranking, matchhistory});
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
    await popupLoad();

    const toggleExtension = document.getElementById('toggleExtension');
    if (toggleExtension) {
        toggleExtension.addEventListener('change', async function () {
            const isEnabled = this.checked;
            await chrome.storage.sync.set({isEnabled});
        });
    }

    const matchroom = document.getElementById('matchroom');
    if (matchroom) {
        matchroom.addEventListener('change', async function () {
            const matchroom = this.checked;
            await chrome.storage.sync.set({matchroom});
        });
    }

    const eloranking = document.getElementById('eloranking');
    if (eloranking) {
        eloranking.addEventListener('change', async function () {
            const eloranking = this.checked;
            await chrome.storage.sync.set({eloranking});
        });
    }

    const matchhistory = document.getElementById('matchhistory');
    if (matchhistory) {
        matchhistory.addEventListener('change', async function () {
            const matchhistory = this.checked;
            await chrome.storage.sync.set({matchhistory});
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
