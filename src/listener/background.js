let previousUrl = null;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const currentUrl = tab.url;

        tryEnableMatchRoomModule(tabId,currentUrl)
        tryEnableMatchHistoryModule(tabId,currentUrl)

        previousUrl = currentUrl;
    }
});

function tryEnableMatchRoomModule(tabId,url) {
    const regex = /^https:\/\/www\.faceit\.com\/[^\/]+\/cs2\/room\/[0-9a-zA-Z\-]+(\/.*)?$/;
    const match = url.match(regex);
    const module = "matchroom"

    if (match) {
        if (previousUrl && previousUrl !== url) {
            sendMessage(tabId, {message: "reload", module: module});
        } else {
            sendMessage(tabId, {message: "load", module: module});
        }
    } else {
        sendMessage(tabId, {message: "unload", module: module});
    }
}

function tryEnableMatchHistoryModule(tabId,url) {
    const regex = /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)(\/.*)?$/;
    const match = url.match(regex);
    const module = "matchhistory"

    if (match) {
        if (previousUrl && previousUrl !== url) {
            sendMessage(tabId, {message: "reload", module: module});
        } else {
            sendMessage(tabId, {message: "load", module: module});
        }
    } else {
        sendMessage(tabId, {message: "unload", module: module});
    }
}

function sendMessage(tabId, object) {
    chrome.tabs.sendMessage(tabId, object)
}