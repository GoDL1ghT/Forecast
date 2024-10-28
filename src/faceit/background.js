chrome.runtime.onInstalled.addListener(() => {
    console.log('Faceit Stats Extension установлен!');
});
console.log("Background script is running.");

let previousUrl = "";

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {

        const currentUrl = tab.url;

        const regex = /^https:\/\/www\.faceit\.com\/[^\/]+\/cs2\/room\/[0-9a-zA-Z\-]+(\/.*)?$/;
        const match = currentUrl.match(regex);

        if (match) {
            if (previousUrl === currentUrl) {
                chrome.tabs.sendMessage(tabId, {message: "loadmatch", url: currentUrl });
            } else {
                chrome.tabs.sendMessage(tabId, {message: "reload", url: currentUrl });
            }
        } else {
            chrome.tabs.sendMessage(tabId, {message: "disable"});
        }

        previousUrl = currentUrl;
    }
});