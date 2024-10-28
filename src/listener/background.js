let previousUrl = "";

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {

        const currentUrl = tab.url;

        tryEnableMatchRoom(tabId,currentUrl)

        previousUrl = currentUrl;
    }
});

// В фоновом скрипте
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "popupClosed") {
        chrome.runtime.sendMessage({ action: "popupClosed" });
    }
});

function tryEnableMatchRoom(tabId,url) {
    const regex = /^https:\/\/www\.faceit\.com\/[^\/]+\/cs2\/room\/[0-9a-zA-Z\-]+(\/.*)?$/;
    const match = url.match(regex);
    const module = "matchroom"

    if (match) {
        if (previousUrl === url) {
            sendMessage(tabId, {message: "loadmatch", module: module});
        } else {
            sendMessage(tabId, {message: "reload", module: module});
        }
    } else {
        sendMessage(tabId, {message: "disable", module: module});
    }
}

function sendMessage(tabId, object) {
    chrome.tabs.sendMessage(tabId, object)
}