const newLevelsModule = new Module("levels", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("eloranking");
    if (!enabled) return;

    doAfterSelfNickNodeAppear(async (nick) => {
        doAfterStatisticBarNodeAppear(nick, async (node) => {
            let newTable = getHtmlResource("src/visual/tables/elo-progress-bar.html").cloneNode(true)
            newTable.appendToAndHide(node)
            await insertStatsToEloBar(nick)
        })
    })


    doAfterWidgetEloNodeAppear(async (node) => {
        let nodeToRemove = node.parentNode.parentNode
        nodeToRemove.parentNode.id = "edited-widget"
        hideNode(nodeToRemove)
    })

    const defineUrlType = (url) => {
        switch (true) {
            case /^https:\/\/www\.faceit\.com\/\w+\/matchmaking$/.test(url):
                return "lobby";
            case /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)(\/.*)?$/.test(url):
                return "profile";
            case /^https:\/\/www\.faceit\.com\/\w+\/cs2\/room\/[\w\-]+(\/.*)?$/.test(url):
                return "matchroom";
        }
    };

    let lobbyType = defineUrlType(window.location.href)

    if (lobbyType !== "profile") {
        doAfterNickNameNodeAppear(lobbyType, async (nickNode) => {
            let nick = nickNode.innerText
            let playerStatistic = await getPlayerStatsByNickName(nick);
            let {gameStats, gameType} = getStatistic(playerStatistic)
            if (!gameStats) return
            let elo = parseInt(gameStats["faceit_elo"], 10);
            let [currentLevel, _] = getBarProgress(elo, gameType);
            let newIcon = levelIcons.get(currentLevel).cloneNode(true)
            if (lobbyType === "lobby") handlePartyLobby(nickNode, nick, newIcon)
            else handleMatchRoomLobby(nickNode, nick)
        })
    } else {
        doAfterMainLevelAppear(async (node) => {
            let nick = extractPlayerNick()
            let playerStatistic = await getPlayerStatsByNickName(nick);
            let {gameStats, gameType} = getStatistic(playerStatistic)
            if (!gameStats) return
            if (document.getElementById("new-elo-level-icon")) return
            let isTopIcon = node.getElementsByTagName("i").length > 0
            if (!gameStats) return
            let elo = parseInt(gameStats["faceit_elo"], 10);
            let [currentLevel, _] = getBarProgress(elo, gameType);
            let icon = levelIcons.get(currentLevel).cloneNode(true).cloneNode(true).childNodes[0]
            icon.id = "new-elo-level-icon"
            newLevelsModule.removalNode(icon);
            if (isTopIcon) {
                node.appendChild(icon)
            } else {
                doAfter(() => !!node.getElementsByTagName("svg")[0], () => {
                    let oldIcon = node.getElementsByTagName("svg")[0]
                    icon.appendToAndHide(oldIcon)
                })
            }
        })
    }

    doAfterNickNameCardNodeAppear(async (node) => {
        let innerNode = node.querySelector('[class*="Tag__Container-"]')
        doAfter(() => innerNode.childNodes && innerNode.childNodes.length > 1, () => {
            let eloText = innerNode.querySelector('[class*="Text-sc"]').firstChild.firstElementChild.innerText
            let elo = parseInt(eloText.replace(/\s/g, ''), 10)
            let oldIcon = innerNode.childNodes[0]
            let [currentLevel, _] = getBarProgress(elo, "cs2");
            let newIcon = levelIcons.get(currentLevel).cloneNode(true)
            newIcon.firstElementChild.appendToAndHide(oldIcon)
        })
    })

    doAfterSearchPlayerNodeAppear(async (node) => {
        doAfter(() => node.childNodes && node.childNodes.length > 2, async () => {
            let currentNode = node.childNodes[1];
            for (let i = 0; i < 7; i++) {
                currentNode = currentNode.firstElementChild;
                if (currentNode.tagName === "SPAN" && i === 0) break
            }
            let nick = currentNode?.innerText;
            doAfter(() => !!node.childNodes[2].firstElementChild.childNodes[1], async () => {
                let oldIcon = node.childNodes[2].firstElementChild.childNodes[1]
                let playerStatistic = await getPlayerStatsByNickName(nick);
                let {gameStats, gameType} = getStatistic(playerStatistic)
                if (!gameStats) return
                let elo = parseInt(gameStats["faceit_elo"], 10);
                let [currentLevel, _] = getBarProgress(elo, gameType);
                let icon = levelIcons.get(currentLevel).cloneNode(true).childNodes[0]
                icon.appendToAndHide(oldIcon)
            })
        })
    })
})

function getStatistic(playerStatistic) {
    let gameType = "cs2"
    let gameStats = playerStatistic["games"][gameType]
    if (!gameStats) {
        gameType = "csgo"
        gameStats = playerStatistic["games"][gameType]
    }
    return {gameStats, gameType}
}

function handleMatchRoomLobby(nickNode, nick) {
    let playerCardNodes = nickNode.parentNode.parentNode.parentNode.parentNode.parentNode.children
    doAfter(() => playerCardNodes.length === 3, () => {
        let section = playerCardNodes[playerCardNodes.length - 1].firstChild.childNodes
        doAfter(() => section.length === 3, () => {
            let elo = parseInt(section[1].firstElementChild.firstElementChild.innerText,10)
            let [currentLevel, _] = getBarProgress(elo, "cs2");
            let newIcon = levelIcons.get(currentLevel).cloneNode(true).childNodes[0]
            let oldIcon = section[playerCardNodes.length - 1];
            newIcon.appendToAndHide(oldIcon)
        })
    })
}

function handlePartyLobby(nickNode, nick, newIcon) {
    const mainNode = nickNode.parentNode;
    let parent = mainNode.parentNode;
    let isShortVariant = false
    if (Array.from(parent.classList).some(className => className.includes('PlayerCardListItem__Row-'))) {
        parent = parent.parentNode
        isShortVariant = true
    }

    isShortVariant ? handleShortVariant(parent, nick, newIcon) : handleFullVariant(parent, mainNode, newIcon)
}

function handleFullVariant(node, mainNode, newIcon) {
    const siblings = Array.from(node.children);
    const index = siblings.indexOf(mainNode);
    const eloIconContainer = siblings[index + 1];
    let levelNode = eloIconContainer.children
    doAfter(
        () => levelNode.length === 2,
        () => {
            newIcon.firstChild.appendToAndHide(levelNode[0])
        }
    )
}

function handleShortVariant(node, nick, newIcon) {
    doAfter(
        () => node.children.length === 4,
        async () => {
            const siblings = Array.from(node.children)
            const eloIcon = siblings[3];
            newIcon.firstChild.appendToAndHide(eloIcon)
        })
}

async function insertStatsToEloBar(nick) {
    let gameType = "cs2"
    let playerStatistic = await getPlayerStatsByNickName(nick);
    let gameStats = playerStatistic["games"][gameType];

    document.getElementById("user-url").setAttribute("href", `/${extractLanguage()}/players/${nick}/stats/${gameType}`)

    let elo = parseInt(gameStats["faceit_elo"], 10);
    let [currentLevel, progressBarPercentage] = getBarProgress(elo, gameType);
    let node = document.getElementById("skill-current-level")
    node.innerHTML = levelIcons.get(currentLevel).innerHTML

    let levelRanges = gameLevelRanges[gameType];
    let {min, max} = levelRanges[currentLevel - 1]

    document.getElementById("progress-current-elo").getElementsByTagName("elo")[0].innerText = `${elo}`
    document.getElementById("min-elo-level").innerText = `${min}`
    document.getElementById("max-elo-level").innerText = `${max === Infinity ? '' : max}`

    let isLastLevel = currentLevel === levelRanges.length
    document.getElementById("elo-to-de-or-up-grade").innerText = `${min - elo - 1}/+${isLastLevel ? "∞" : max - elo + 1}`

    const progressBar = document.getElementById(`elo-progress-bar`);
    if (isLastLevel) {
        progressBar.style.width = "100%";
    } else {
        progressBar.style.width = `${progressBarPercentage}%`;
    }
}

function doAfterSearchPlayerNodeAppear(callback) {
    const targetHrefPattern = new RegExp(`^/${extractLanguage()}/players\/([a-zA-Z0-9-_]+)$`);

    const observer = new MutationObserver(mutationsList => {

        function checkNodeAndChildren(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.hasAttribute('data-processed')) return;
                const href = node.getAttribute('href');
                let doubleParent = node?.parentElement?.parentElement
                if (!doubleParent) return;
                const hasContainer = doubleParent.matches('[class*="styles__PlayersListContainer-"]') || doubleParent.matches('[class*="styles__SectionContainer"]');

                if (href && targetHrefPattern.test(href) && hasContainer) {
                    newLevelsModule.processedNode(node);
                    callback(node);
                    return;
                }
                node.childNodes.forEach(checkNodeAndChildren);
            }
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    checkNodeAndChildren(node);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    newLevelsModule.registerObserver("find-result-bar-node-observer", observer);
}

function doAfterStatisticBarNodeAppear(nick, callback) {
    if (document.getElementById("statistic-progress-bar")) return
    const targetHrefPattern = new RegExp(`^/${extractLanguage()}/players/${nick}/stats/`);

    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("statistic-progress-bar");

        function checkNodeAndChildren(node) {
            if (found) return;

            if (node.nodeType === Node.ELEMENT_NODE) {
                const href = node.getAttribute('href');
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
            if (found) break;
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    newLevelsModule.registerObserver("stats-bar-node-observer", observer);
}

function doAfterSelfNickNodeAppear(callback) {

    let selfNickNode = document.querySelector('[class*="styles__NicknameText-"]')
    if (selfNickNode) {
        selfNickNode.id = "self-nickname-node"
        callback(selfNickNode.innerText)
    }

    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("self-nickname-node")

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

    newLevelsModule.registerObserver("nick-selfnode-observer", observer);
}

function doAfterMainLevelAppear(callback) {
    let mainLevelNode = document.querySelector('[class*="styles__TitleContainer-"]');
    if (mainLevelNode) {
        callback(mainLevelNode)
        return
    }

    const observer = new MutationObserver(mutationsList => {
        let found = false;

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
            }
            node.childNodes.forEach(checkNodeAndChildren);
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    checkNodeAndChildren(node);
                    if (found) return;
                }
            }
            if (found) return;
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    newLevelsModule.registerObserver("main-level-observer", observer);
}

function doAfterWidgetEloNodeAppear(callback) {
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("edited-widget");

        function checkNodeAndChildren(node) {
            if (found) return;

            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="EloWidget__Holder-"]')) {
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

    newLevelsModule.registerObserver("widget-elo-observer", observer);
}

function doAfterNickNameCardNodeAppear(callback) {
    const observer = new MutationObserver(mutationsList => {

        function checkNodeAndChildren(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="UserStats__StatsContainer-"]') || node.querySelector('[class*="UserStats__StatsContainer-"]')) {
                    callback(node)
                    return;
                }
                node.childNodes.forEach(checkNodeAndChildren);
            }
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    checkNodeAndChildren(node);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    newLevelsModule.registerObserver("nick-cardnode-observer", observer);
}

function doAfterNickNameNodeAppear(lobbyType, callback) {
    if (lobbyType === "profile") {
        let node = document.getElementById("player-profile-nick-node")
        if (node) {
            callback(node)
            return
        }
    }

    const observer = new MutationObserver(mutationsList => {

        function checkNodeAndChildren(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="styles__Nickname-"]') || node.matches('[class*="Nickname__Name-"]')) {
                    if (lobbyType === "profile") node.id = "player-profile-nick-node"
                    callback(node)
                    return;
                }
                node.childNodes.forEach(checkNodeAndChildren);
            }
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    checkNodeAndChildren(node);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    newLevelsModule.registerObserver("nick-node-observer", observer);
}

moduleListener(newLevelsModule);
