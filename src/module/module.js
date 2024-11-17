class Module {
    constructor(name, loadAction, unloadAction = () => {
    }) {
        this.name = name
        this.loadAction = loadAction;
        this.unloadAction = unloadAction;
        this.isLoaded = false;
        this.processedNodes = [];
        this.nodesToRemove = [];
        this.tasks = [];
        this.tabId = 0
        this.observerTasks = []
        this.observer = null
    }

    async #load() {
        if (this.isLoaded) return
        println(`Module ${this.name} is loading`);
        this.registerObserver();
        await this.loadAction();
        this.isLoaded = true
        println(`Module ${this.name} is successfully loaded`);
    }

    async #reload() {
        println(`Module ${this.name} is reloading`);
        await this.unloadAction();
        this.#releaseCaches();
        this.isLoaded = false
        this.registerObserver();
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
        this.observerTasks.length = 0
        if (this.observer) {
            this.observer.disconnect()
        }

        this.processedNodes.forEach((node) => {
            node.removeAttribute('data-processed')
        });
        this.processedNodes.length = 0;

        this.nodesToRemove.forEach((node) => {
            node.remove()
        })
        this.nodesToRemove.length = 0

        this.tasks.forEach((task) => {
            clearInterval(task)
        })
        this.tasks.length = 0
    }

    processedNode(node) {
        this.processedNodes.push(node)
        node.setAttribute('data-processed', 'true')
    }


    removalNode(node) {
        this.nodesToRemove.push(node)
    }

    doAfter(conditionFn, callback, interval = 50) {
        const task = this.every(interval, async () => {
            let conditionResult = conditionFn()
            if (conditionResult) {
                task()
                await callback(conditionResult);
            }
        })

        return () => task();
    }

    every(period, callback) {
        const task = setInterval(callback, period)
        this.tasks.push(task)
        return () => clearInterval(task)
    }

    observe(task) {
        this.observerTasks.push(task)
    }

    registerObserver() {
        this.observer = new MutationObserver(mutationsList => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        this.observerTasks.forEach(async (task) => {
                            await task(node)
                        })
                    }
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    async doAfterNodeAppear(selector, callback) {
        let element = document.querySelector(selector);
        if (element) await callback(element)
        this.observe(async () => {
            let element = document.querySelector(selector);
            if (element) await callback(element);
        });
    }

    async doAfterAllNodeAppear(selector, callback) {
        let elements = document.querySelectorAll(selector);
        if (elements.length !== 0) for (const element of elements) {
            await callback(element);
        }
        this.observe(async () => {
            let elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (element) await callback(element);
            }
        });
    }

    async doAfterAllNodeAppearPack(selector, callback) {
        let elements = document.querySelectorAll(selector);
        if (elements.length !== 0) await callback(elements)
        this.observe(async () => {
            let elements = document.querySelectorAll(selector);
            if (elements.length !== 0) await callback(elements);
        });
    }

    async produceOf(action) {
        switch (action) {
            case "load":
                await this.#load();
                break;
            case "reload":
                await this.#reload();
                break;
            case "unload":
                await this.#unload();
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