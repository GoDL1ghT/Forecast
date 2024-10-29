class Module {
    constructor(name,loadAction,unloadAction) {
        this.name = name
        this.loadAction = loadAction;
        this.unloadAction = unloadAction;
        this.isLoaded = false;
    }

    async load() {
        if (this.isLoaded) return
        println(`Module ${this.name} is loading`);
        await this.loadAction();
        this.isLoaded = true
        println(`Module ${this.name} is successfully loaded`);
    }

    async reload(){
        println(`Module ${this.name} is reloading`);
        await this.unloadAction();
        this.isLoaded = false
        await this.loadAction();
        this.isLoaded = true
        println(`Module ${this.name} is successfully reloaded`);
    }

    async unload() {
        if (!this.isLoaded) return
        println(`Module ${this.name} is disabling`);
        await this.unloadAction();
        this.isLoaded = false
        println(`Module ${this.name} is successfully disabled`);
    }

    async produceOf(action) {
        switch (action) {
            case "load":
                await this.load();
                break;
            case "reload":
                await this.reload();
                break;
            case "unload":
                await this.unload();
                break;
            default:
                println("Unknown action:", action);
        }
    }
}

function moduleListener(module) {
    chrome.runtime.onMessage.addListener((request) => {
        if (request.module !== module.name) return;

        if (request.message) {
            module.produceOf(request.message).then(() => {});
        }
    });
}