async function getApiKey() {
    const settings = await chrome.storage.sync.get(['apiKey']);
    return settings.apiKey || '';
}

async function isExtensionEnabled() {
    const settings = await chrome.storage.sync.get(['isEnabled']);
    return settings.isEnabled !== undefined ? settings.isEnabled : true;
}

async function popupLoad() {
    const enabled = await isExtensionEnabled();
    const toggleExtension = document.getElementById('toggleExtension');

    if (toggleExtension) {
        toggleExtension.checked = enabled;
    } else {
        console.error("Toggle switch not found!");
    }

    if (!enabled) {
        document.getElementById("matchStats").innerText = "Расширение отключено!";
    }
}

async function loadSettings() {
    const settings = await chrome.storage.sync.get(['apiKey', 'isEnabled']);
    const apiKeyInput = document.getElementById('apiKeyInput');

    if (apiKeyInput) {
        apiKeyInput.value = settings.apiKey || '';
    } else {
        console.error("API Key input not found!");
    }

    const toggleExtension = document.getElementById('toggleExtension');
    if (toggleExtension) {
        toggleExtension.checked = settings.isEnabled !== undefined ? settings.isEnabled : true;
    } else {
        console.error("Toggle switch not found during load settings!");
    }
}

async function saveSettings() {
    const apiKey = document.getElementById('apiKeyInput').value;
    const isEnabled = document.getElementById('toggleExtension').checked;

    chrome.storage.sync.set({apiKey, isEnabled}, () => {
        console.log('Настройки сохранены:', {apiKey, isEnabled});
        showSaveMessage();
    });
}

function showSaveMessage() {
    const saveMessage = document.getElementById('saveMessage');
    saveMessage.classList.add('show');

    setTimeout(() => {
        saveMessage.classList.remove('show');
    }, 2000);
}

document.getElementById('saveSettings').addEventListener('click', (event) => {
    saveSettings();
    event.currentTarget.classList.add('active');

    setTimeout(() => {
        event.currentTarget.classList.remove('active');
    }, 200);
});

document.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
    await popupLoad();

    const toggleExtension = document.getElementById('toggleExtension');
    if (toggleExtension) {
        toggleExtension.addEventListener('change', function () {
            const isEnabled = this.checked;
            chrome.storage.sync.set({isEnabled}, () => {
                console.log('Расширение включено:', isEnabled);
            });
        });
    }
});
