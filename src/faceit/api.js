async function getApiKey() {
    const settings = await chrome.storage.sync.get(['apiKey']);
    return settings.apiKey || '';
}

async function isExtensionEnabled() {
    const settings = await chrome.storage.sync.get(['isEnabled']);
    return settings.isEnabled !== undefined ? settings.isEnabled : true;
}

function setGradientColor(winrateCell, percent) {
    percent = Math.min(Math.max(percent, 0), 100);
    const ratio = percent / 100;
    const colorRed = "#ff0022";
    const colorYellow = "#fbec1e";
    const colorGreen = "#32d35a";
    let gradientColor;
    if (ratio < 0.5) {
        const t = ratio * 2;
        gradientColor = interpolateColor(colorRed, colorYellow, t);
    } else {
        const t = (ratio - 0.5) * 2;
        gradientColor = interpolateColor(colorYellow, colorGreen, t);
    }
    winrateCell.style.color = gradientColor;
}

function interpolateColor(color1, color2, factor) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * factor).toString(16).padStart(2, '0');
    const g = Math.round(g1 + (g2 - g1) * factor).toString(16).padStart(2, '0');
    const b = Math.round(b1 + (b2 - b1) * factor).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
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