chrome.runtime.onInstalled.addListener(() => {
    console.log('Faceit Stats Extension установлен!');
});
console.log("Background script is running.");

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log("Tab updated with URL:", tab.url); // Логируем URL вкладки
        const regex = /^https:\/\/www\.faceit\.com\/ru\/cs2\/room\/[0-9a-zA-Z\-]+$/; // Регулярное выражение для проверки URL
        const match = tab.url.match(regex);
        if (match) {
            chrome.tabs.sendMessage(tabId, {message: "loadmatch-8642"});
        }
    }
});