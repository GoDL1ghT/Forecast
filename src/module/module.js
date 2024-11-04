class Module {
    constructor(name,loadAction,unloadAction = () => {}) {
        this.name = name
        this.loadAction = loadAction;
        this.unloadAction = unloadAction;
        this.isLoaded = false;
        this.processedNodes = [];
        this.nodesToRemove = [];
        this.registeredObservers = new Map();
        this.tabId = 0
    }

    async #load() {
        if (this.isLoaded) return
        println(`Module ${this.name} is loading`);
        await this.loadAction();
        this.isLoaded = true
        println(`Module ${this.name} is successfully loaded`);
    }

    async #reload(){
        println(`Module ${this.name} is reloading`);
        await this.unloadAction();
        this.#releaseCaches();
        this.isLoaded = false
        await this.loadAction();
        this.isLoaded = true
        println(`Module ${this.name} is successfully reloaded`);
    }

    async #unload() {
        if (!this.isLoaded) return
        println(`Module ${this.name} is disabling`);
        await this.unloadAction();
        this.#releaseCaches();
        this.isLoaded = false
        println(`Module ${this.name} is successfully disabled`);
    }

    #releaseCaches() {
        this.processedNodes.forEach((node) => {
            node.removeAttribute('data-processed')
        });
        this.processedNodes.length = 0;

        this.registeredObservers.forEach((observer) => {
            observer.disconnect()
        })
        this.registeredObservers.clear()

        this.nodesToRemove.forEach((node) => {
            node.remove()
        })
        this.nodesToRemove.length = 0
    }

    processedNode(node) {
        this.processedNodes.push(node)
        node.setAttribute('data-processed', 'true')
    }

    registerObserver(key,observer) {
        this.registeredObservers.set(key,observer)
    }

    isObserverRegistered(key) {
        return this.registeredObservers.has(key)
    }

    removalNode(node) {
        this.nodesToRemove.push(node)
    }

    async report(state) {
        await chrome.runtime.sendMessage({module: `${this.tabId}-${this.name}`, state: state})
    }

    async produceOf(action) {
        switch (action) {
            case "load":
                await this.#load();
                await this.report("loaded");
                break;
            case "reload":
                await this.#reload();
                await this.report("loaded");
                break;
            case "unload":
                await this.#unload();
                await this.report("unloaded");
                break;
            default:
                println("Unknown action:", action);
        }
    }
}

function moduleListener(module) {
    chrome.runtime.onMessage.addListener(async (request) => {
        if (request.module !== module.name) return;

        if (request.action) {
            module.tabId = request.tabId
            await module.produceOf(request.action);
        }
    });
}