const elobarmodule = new Module("elobar", async () => {
    const enabled = await isExtensionEnabled();
    if (!enabled) return;
    doAfterPlayerNickNodeAppear(async (nick) => {
        doAfterStatisticBarNodeAppear(nick, async (node) => {
            let newTable = getHtmlResource("src/visual/tables/elo-progress-bar.html").cloneNode(true)
            node.replaceWith(newTable);
            await insertStatsToEloBar(nick)
        })
        doAfterMainLevelAppear(async (node) => {
            console.log(node)
            let oldIcon = node.getElementsByTagName("svg")[0]
            let gameType = "cs2"
            let playerStatistic = await getPlayerStatsByNickName(nick);
            let gameStats = playerStatistic["games"][gameType];
            let elo = parseInt(gameStats["faceit_elo"], 10);
            let [currentLevel, _] = getBarProgress(elo);
            let newIcon = levelIcons.get(currentLevel).cloneNode(true)
            newIcon.id = "new-elo-level-icon"
            oldIcon.replaceWith(newIcon)
        })
    })

    doAfterWidgetEloNodeAppear(async (node)=> {
        node.parentNode.id = "edited-widget"
        // node.remove()
    })


}, async () => {

})

async function insertStatsToEloBar(nick) {
    let gameType = "cs2"
    let playerStatistic = await getPlayerStatsByNickName(nick);
    let gameStats = playerStatistic["games"][gameType];

    document.getElementById("user-url").setAttribute("href",`/${extractLanguage()}/players/${nick}/stats/${gameType}`)

    let elo = parseInt(gameStats["faceit_elo"], 10);
    let [currentLevel, progressBarPercentage] = getBarProgress(elo);
    let node = document.getElementById("skill-current-level")
    node.innerHTML = levelIcons.get(currentLevel).innerHTML

    let {min, max} = levelRanges[currentLevel - 1]

    document.getElementById("progress-current-elo").getElementsByTagName("elo")[0].innerText = `${elo}`
    document.getElementById("min-elo-level").innerText = `${min}`
    document.getElementById("max-elo-level").innerText = `${max}`

    let isLastLevel = currentLevel === levelRanges.length
    document.getElementById("elo-to-de-or-up-grade").innerText = `${min - elo - 1}/+${isLastLevel ? "∞" : max - elo + 1}`

    const progressBar = document.getElementById(`elo-progress-bar`);
    if (isLastLevel) {
        progressBar.style.width = "100%";
    } else {
        progressBar.style.width = `${progressBarPercentage}%`;
    }
}

function doAfterStatisticBarNodeAppear(nick, callback) {
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("statistic-progress-bar");
        const targetHrefPattern = new RegExp(`^/${extractLanguage()}/players/${nick}/stats/`);

        function checkNodeAndChildren(node) {
            if (found) return;

            if (node.nodeType === Node.ELEMENT_NODE) {
                const href = node.getAttribute('href');
                // Проверяем наличие элемента SVG внутри узла
                const hasSvg = node.querySelector('svg');

                if (href && targetHrefPattern.test(href) && hasSvg) {
                    callback(node);
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
            if (found) break; // Если узел найден, прерываем внешний цикл
        }
    });

    // Наблюдаем за изменениями в документе
    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("stats-bar-node-observer", observer); // Регистрация наблюдателя
}

function doAfterPlayerNickNodeAppear(callback) {
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("statistic-progress-bar");

        function checkNodeAndChildren(node) {
            if (found) return;

            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="styles__NicknameText-"]')) {
                    callback(node.innerText)
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
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("nick-node-observer", observer);
}

function doAfterMainLevelAppear(callback) {
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("new-elo-level-icon");
        function checkNodeAndChildren(node) {
            if (found) return;
            if (node.nodeType === Node.ELEMENT_NODE && node.matches('[class*="styles__TitleContainer-"]')) {
                const svgObserver = new MutationObserver(innerMutations => {
                    for (const innerMutation of innerMutations) {
                        if (innerMutation.type === 'childList') {
                            if (node.querySelector('svg')) {
                                callback(node);
                                found = true;
                                svgObserver.disconnect();
                                break;
                            }
                        }
                    }
                });
                svgObserver.observe(node, {
                    childList: true,
                    subtree: true
                });

                return;
            }
            node.childNodes.forEach(checkNodeAndChildren);
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
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("main-level-observer", observer);
}

function doAfterWidgetEloNodeAppear(callback) {
    let nodeCounter = 0
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("edited-widget");

        function checkNodeAndChildren(node) {
            if (found) return;

            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="WidgetTitleWrapper__NewEloWidgetContainer-"]')) {
                    nodeCounter++
                    if (nodeCounter < 2) return;
                    nodeCounter = 0
                    callback(node)
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
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("widget-elo-observer", observer);
}

function doAfterPartyNodeAppear(callback) {
    let nodeCounter = 0
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("edited-widget");

        function checkNodeAndChildren(node) {
            if (found) return;

            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="WidgetTitleWrapper__NewEloWidgetContainer-"]')) {
                    nodeCounter++
                    if (nodeCounter < 2) return;
                    nodeCounter = 0
                    callback(node)
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
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("widget-elo-observer", observer);
}



moduleListener(elobarmodule);
