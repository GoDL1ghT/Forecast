let previousUrl = null;
let resourcesIsLoaded = false

let registeredBGListeners = []

function registerListener(key, callback) {
    if (registeredBGListeners.includes(key)) return
    registeredBGListeners.push(key)
    callback()
}

const modules = [
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats(\/.*)?$/, module: "matchhistory"},
    {regex: /^https:\/\/www\.faceit\.com\/.*$/, module: "levels"},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/cs2\/room\/[0-9a-zA-Z\-]+(\/.*)?$/, module: "matchroom"},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats(\/.*)?$/, module: "ranking"}
]

registerListener("tab-listener", () => {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        console.log(`${changeInfo.status}: ${previousUrl} -> ${tab.url}`)
        if (changeInfo.status === 'complete' && tab.url) {
            const currentUrl = tab.url;
            sendMessage(tabId, {action: "load", module: "resources"});

            waitForResourcesToLoad().then(() => {
                modules.forEach(({regex, module}) => {
                    produceModuleAction(regex, currentUrl, module, tabId)
                })
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

function produceModuleAction(regex, url, module, tabId) {
    const match = url.match(regex);
    let action = match ? (previousUrl && previousUrl !== url ? "reload" : "load") : "unload";
    sendMessage(tabId, {action: action, module: module});
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