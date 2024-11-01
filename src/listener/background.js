let previousUrl = null;
let resourcesIsLoaded = false

let registeredBGListeners = []

function registerListener(key, callback) {
    if (registeredBGListeners.includes(key)) return
    registeredBGListeners.push(key)
    callback()
}

registerListener("tab-listener", () => {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url) {
            const currentUrl = tab.url;

            sendMessage(tabId, {message: "load", module: "resources"});

            waitForResourcesToLoad().then(() => {
                tryEnableEloBarModule(tabId, currentUrl)
                tryEnableMatchRoomModule(tabId, currentUrl);
                tryEnableMatchHistoryModule(tabId, currentUrl);
                tryEnableRankingModule(tabId, currentUrl);

                previousUrl = currentUrl;
            });
        }
    })
})

registerListener("resource-listener", () => {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message === "resourcesLoaded") {
            resourcesIsLoaded = true
        }
    });
})


function tryEnableMatchRoomModule(tabId, url) {
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

function tryEnableEloBarModule(tabId, url) {
    const regex = /^https:\/\/www\.faceit\.com\/.*$/;
    const match = url.match(regex);
    const module = "elobar"

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

function tryEnableMatchHistoryModule(tabId, url) {
    const regex = /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats(\/.*)?$/;
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

function tryEnableRankingModule(tabId, url) {
    const regex = /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats(\/.*)?$/;
    const match = url.match(regex);
    const module = "ranking"

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

function waitForResourcesToLoad() {
    return new Promise(resolve => {
        if (resourcesIsLoaded) {
            resolve();
        } else {
            const interval = setInterval(() => {
                if (resourcesIsLoaded) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        }
    });
}