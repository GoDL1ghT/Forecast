async function getApiKey() {
    const settings = await chrome.storage.sync.get(['apiKey']);
    return settings.apiKey || '';
}

async function isExtensionEnabled() {
    const settings = await chrome.storage.sync.get(['isEnabled']);
    return settings.isEnabled !== undefined ? settings.isEnabled : true;
}