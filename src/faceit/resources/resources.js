const levelIcons = new Map()
const htmls = new Map()
let isResourcesLoaded = false

const resourcesModule = new Module("resources", async () => {
    const enabled = await isExtensionEnabled();
    if (!enabled) return;
    if (isResourcesLoaded) return
    await loadAllHTMLs();
    await loadLevelIcons();
    isResourcesLoaded = true
})

async function loadAllHTMLs() {
    const promises = [];
    const urls = [
        "src/visual/tables/level-progress-table.html",
        "src/visual/tables/team.html",
        "src/visual/tables/player.html",
        "src/visual/tables/matchscore.html",
        "src/visual/tables/elo-progress-bar.html",
        "src/visual/tables/elo-progress-bar-master.html",
        ...Array.from({length: 20}, (_, i) => `src/visual/tables/levels/level${i + 1}.html`)
    ];

    urls.forEach(url => {
        promises.push(
            getHTMLCodeFromFile(url).then(html => {
                htmls.set(url, html);
            })
        );
    });

    await Promise.all(promises);
}

function getHtmlResource(path) {
    return htmls.get(path)
}

async function loadLevelIcons() {
    if (levelIcons.size === 20) return
    for (let level = 1; level <= 20; level++) {
        let lvlResource = getHtmlResource(`src/visual/tables/levels/level${level}.html`)
        levelIcons.set(level, lvlResource);
    }
}

async function getHTMLCodeFromFile(filePath) {
    const response = await fetch(chrome.runtime.getURL(filePath));
    if (!response.ok) {
        error(`HTTP error! Status: ${response.status}`);
        return null;
    }

    const htmlContent = await response.text();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    return tempDiv
}

moduleListener(resourcesModule)