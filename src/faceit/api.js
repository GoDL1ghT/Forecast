async function getApiKey() {
    const settings = await chrome.storage.sync.get(['apiKey']);
    return settings.apiKey || '';
}

async function isExtensionEnabled() {
    const settings = await chrome.storage.sync.get(['isEnabled']);
    return settings.isEnabled !== undefined ? settings.isEnabled : true;
}

class LimitedMap extends Map {
    constructor(limit) {
        super();
        this.limit = limit;
    }

    set(key, value) {
        if (this.size >= this.limit) {
            const firstKey = this.keys().next().value;
            this.delete(firstKey);
        }
        super.set(key, value);
        return this;
    }
}