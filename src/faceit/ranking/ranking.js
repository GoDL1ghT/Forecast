const gameLevelRanges = {
    cs2: [
        {min: 1, max: 500},         // Level 1
        {min: 501, max: 750},       // Level 2
        {min: 751, max: 900},       // Level 3
        {min: 901, max: 1050},      // Level 4
        {min: 1051, max: 1200},     // Level 5
        {min: 1201, max: 1350},     // Level 6
        {min: 1351, max: 1530},     // Level 7
        {min: 1531, max: 1750},     // Level 8
        {min: 1751, max: 2000},     // Level 9
        {min: 2001, max: 2250},     // Level 10
        {min: 2251, max: 2500},     // Level 11
        {min: 2501, max: 2750},     // Level 12
        {min: 2751, max: 3000},     // Level 13
        {min: 3001, max: 3250},     // Level 14
        {min: 3251, max: 3500},     // Level 15
        {min: 3501, max: 3750},     // Level 16
        {min: 3751, max: 4000},     // Level 17
        {min: 4001, max: 4250},     // Level 18
        {min: 4251, max: 4500},     // Level 19
        {min: 4501, max: Infinity}  // Level 20
    ],
    csgo: [
        {min: 1, max: 800},         // Level 1
        {min: 801, max: 950},       // Level 2
        {min: 951, max: 1100},      // Level 3
        {min: 1101, max: 1250},     // Level 4
        {min: 1251, max: 1400},     // Level 5
        {min: 1401, max: 1550},     // Level 6
        {min: 1551, max: 1700},     // Level 7
        {min: 1701, max: 1850},     // Level 8
        {min: 1851, max: 2000},     // Level 9
        {min: 2001, max: 2250},     // Level 10
        {min: 2251, max: 2500},     // Level 11
        {min: 2501, max: 2750},     // Level 12
        {min: 2751, max: 3000},     // Level 13
        {min: 3001, max: 3250},     // Level 14
        {min: 3251, max: 3500},     // Level 15
        {min: 3501, max: 3750},     // Level 16
        {min: 3751, max: 4000},     // Level 17
        {min: 4001, max: 4250},     // Level 18
        {min: 4251, max: 4500},     // Level 19
        {min: 4501, max: Infinity}  // Level 20
    ]
};

function insertAllLevelsToTable(currentLevel) {
    levelIcons.forEach((icon, level) => {
        const node = document.getElementById(`level-node-${level}`);
        const span = node.getElementsByTagName("span")[0];
        icon.appendToAndHide(span)
        if (level === currentLevel) {
            let svgNode = icon.cloneNode(true)
            let svgSpan = svgNode.getElementsByTagName("span")[0];
            svgSpan.style.width = "36px";
            svgSpan.style.height = "36px";
            svgNode.appendToAndHide(document.getElementById("current-level").getElementsByTagName("span")[0])
        }
    })
}

const rankingModule = new Module("ranking", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("eloranking");
    if (!enabled) return;

    doAfterStatisticNodeAppear(async (node) => {
        let newNode = getHtmlResource("src/visual/tables/level-progress-table.html").cloneNode(true)
        newNode.appendToAndHide(node)
        await insertAllStatisticToNewTable();
    })
})

async function insertAllStatisticToNewTable() {
    let gameType = extractGameType()
    let playerNickName = extractPlayerNick();
    let playerStatistic = await getPlayerStatsByNickName(playerNickName);
    let gameStats = playerStatistic["games"][gameType];
    let elo = parseInt(gameStats["faceit_elo"], 10);
    let [currentLevel, progressBarPercentage] = getBarProgress(elo, gameType);

    insertAllLevelsToTable(currentLevel)

    document.getElementById("current-elo").innerText = `${elo}`
    let levelRanges = gameLevelRanges[gameType];
    document.getElementById("elo-need-to-reach").innerText = `${currentLevel === levelRanges.length ? "" : levelRanges[currentLevel].min - elo}`
    document.getElementById("elo-need-to-reach-text").innerText = `${currentLevel === levelRanges.length ? "You reached max level!" : `Points needed to reach level ${currentLevel + 1}`}`

    for (let level = 1; level <= levelRanges.length; level++) {
        const levelNode = document.getElementById(`level-node-${level}`);
        const progressBar = document.getElementById(`progress-bar-${level}`);
        let levelMinEloTextNode = levelNode.querySelector(`[class="level-value"]`)
        const {min, max} = levelRanges[level - 1]
        levelMinEloTextNode.innerText = min
        if (currentLevel > level) {
            levelNode.style.opacity = "1";
            progressBar.style.width = "100%"
        } else if (currentLevel === levelRanges.length) {
            levelNode.style.opacity = "1";
            progressBar.style.width = "100%";
            document.getElementById("progress-bar-20").style.background = "rgb(255, 85, 0)";
        } else if (currentLevel === level && elo >= min && elo <= max) {
            levelNode.style.opacity = "1";
            progressBar.style.width = `${progressBarPercentage}%`;
        } else {
            levelNode.style.opacity = "0.5";
            progressBar.style.width = "0%";
        }
    }
}

function getBarProgress(elo, gameType) {
    let currentLevel = -1;
    let currentRange = {};
    let levelRanges = gameLevelRanges[gameType]

    for (let i = 0; i < levelRanges.length; i++) {
        if (elo >= levelRanges[i].min && elo <= levelRanges[i].max) {
            currentLevel = i + 1;
            currentRange = levelRanges[i];
            break;
        }
    }

    let nextLevel = currentLevel < levelRanges.length ? levelRanges[currentLevel] : null;
    let progressPercentage;
    if (nextLevel) {
        const currentMin = currentRange.min;
        const currentMax = currentRange.max;
        progressPercentage = (elo - currentMin) / (currentMax - currentMin) * 100;
    } else {
        progressPercentage = 100;
    }
    return [currentLevel, progressPercentage];
}


function doAfterStatisticNodeAppear(callback) {
    if (document.getElementById("forecast-statistic-table")) return

    let element = document.evaluate(
        "//*[contains(text(), 'Level Progress')]",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    ).singleNodeValue?.parentElement.parentElement
    if (element) callback(element)
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("forecast-statistic-table")
        let removed = !!document.getElementById("hided-enchancer-table")

        function removeRepeekNodeIfExist(node) {
            if (removed) return;
            if (node.nodeType === Node.ELEMENT_NODE) {
                let parent = node?.parentElement?.parentElement
                if (node.innerText === "LEVEL PROGRESS" && !parent.getAttribute("hided") && parent.id !== "forecast-statistic-table") {
                    hideNode(parent)
                    parent.id = "hided-enchancer-table"
                    removed = true
                    return;
                }
                node.childNodes.forEach(removeRepeekNodeIfExist);
            }
        }

        function checkNodeAndChildren(node) {
            if (found) return;
            if (node.nodeType === Node.ELEMENT_NODE) {
                let targetNode = document.getElementById("content-grid-element-3")
                if (targetNode) {
                    let newNode = document.createElement("div")
                    rankingModule.doAfter(() => targetNode.querySelector('[class*="styles__StatsSection"]'), () => {
                        if (!!document.getElementById("forecast-statistic-table")) return
                        targetNode.children[0].insertAdjacentElement("afterend", newNode)
                        callback(newNode);
                    })
                    found = true;
                    return;
                }
                node.childNodes.forEach(checkNodeAndChildren);
            }
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (found) break;
                    checkNodeAndChildren(node);
                }
            }
            if (found) break;
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (removed) break;
                    removeRepeekNodeIfExist(node);
                }
            }
            if (removed) break;
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    rankingModule.registerObserver("stats-node-observer", observer);
}

moduleListener(rankingModule);