let moduleStateByTabId = new Map()
let previousUrlsByTabId = new Map()

const stateUnloaded = "unloaded"
const stateLoaded = "loaded"
const stateLoading = "loading"

const modules = [
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats(\/.*)?$/, module: "matchhistory"},
    {regex: /^https:\/\/www\.faceit\.com\/.*$/, module: "levels"},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/cs2\/room\/[0-9a-zA-Z\-]+(\/.*)?$/, module: "matchroom"},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats(\/.*)?$/, module: "ranking"}
]

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const currentUrl = tab.url;
        const previousUrl = previousUrlsByTabId.get(tabId) || "";

        console.log(`Tab updated: ${previousUrl} -> ${currentUrl}, ${tabId}`);
        if (reloadPageIfStatsPage(currentUrl,tab,tabId)) return;
        await loadResourcesIfNeeded(tabId);
        await handleModules(currentUrl, previousUrl, tabId);

        previousUrlsByTabId.set(tabId, currentUrl);
    }

    if (changeInfo.status === 'loading' && tabId) {
        moduleStateByTabId.delete(`${tabId}-resources`)
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    previousUrlsByTabId.delete(tabId)
    moduleStateByTabId.delete(`${tabId}-resources`)
});

chrome.runtime.onMessage.addListener((request) => {
    let moduleStateId = request.module
    let moduleState = request.state
    if (moduleState === stateUnloaded) {
        moduleStateByTabId.delete(moduleStateId)
    } else {
        moduleStateByTabId.set(moduleStateId, moduleState)
    }
});

function reloadPageIfStatsPage(currentUrl, tab, tabId) {
    const lastPart = currentUrl.split('/').pop();
    const prevUrl = previousUrlsByTabId.get(tabId)
    if (!prevUrl) return false
    if (lastPart === 'csgo' && prevUrl.endsWith('cs2') ||
        lastPart === 'cs2' && prevUrl.endsWith('csgo')) {
        chrome.tabs.reload(tabId);
        previousUrlsByTabId.set(tabId, currentUrl);
        return true
    }
    return false
}

async function handleModules(currentUrl, previousUrl, tabId) {
    for (const { regex, module } of modules) {
        let moduleStateId = `${tabId}-${module}`
        let moduleState = moduleStateByTabId.get(moduleStateId)
        if (moduleState === stateLoading) continue
        const action = determineAction(regex, currentUrl, previousUrl);
        if (action) {
            moduleStateByTabId.set(moduleStateId, stateLoading)
            await sendMessage(tabId, { action: action, module: module, tabId: tabId });
        }
    }
}

function determineAction(regex, currentUrl, previousUrl) {
    const currentMatch = currentUrl.match(regex);
    const previousMatch = previousUrl.match(regex);

    if (currentMatch && previousMatch) return "reload";
    if (currentMatch) return "load";
    if (previousMatch) return "unload";
    return null;
}

async function loadResourcesIfNeeded(tabId) {
    if (!moduleStateByTabId.get(`${tabId}-resources`)) {
        await sendMessage(tabId, { action: "load", module: "resources", tabId: tabId });
        await waitForResourcesToLoad(tabId);
    }
}

async function sendMessage(tabId, object) {
    return chrome.tabs.sendMessage(tabId, object);
}

function waitForResourcesToLoad(tabId) {
    return new Promise(resolve => {
        const checkInterval = setInterval(() => {
            if (moduleStateByTabId.get(`${tabId}-resources`)) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 50);
    });
}