chrome.runtime.onInstalled.addListener(() => {
    console.log('Faceit Stats Extension установлен!');
});
console.log("Background script is running.");

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const regex = /^https:\/\/www\.faceit\.com\/ru\/cs2\/room\/[0-9a-zA-Z\-]+(\/.*)?$/;
        const match = tab.url.match(regex);
        if (match) {
            chrome.tabs.sendMessage(tabId, {message: "loadmatch"});
        } else {
            chrome.tabs.sendMessage(tabId, {message: "disable"});
        }
    }
});