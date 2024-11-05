class PartySlot {
    nick = null

    constructor(slotNode) {
        this.slotNode = slotNode
        this.newIcon = null
        this.isEmpty = true
        this.isShort = null
    }

    isShortStyle() {
        let isShort = this.slotNode?.firstElementChild?.querySelector(`[class*='ButtonBase__Wrapper']`)?.querySelector(`[class*='PlayerCardListItem__Row-']`)
        return !!isShort
    }

    getNickNode(isShort) {
        let node
        if (!isShort) {
            node = this.slotNode?.firstElementChild?.querySelector('[role="button"]')?.children[1]?.children[0]
        } else {
            node = this.slotNode?.firstElementChild?.querySelector('[class*="Nickname__Name"]')
        }
        if (node?.innerText) this.isEmpty = false
        return node
    }

    getLevelNode(isShort) {
        let node
        if (!isShort) {
            node = this.slotNode?.firstElementChild?.querySelector('[role="button"]')?.children[2]
        } else {
            node = this.slotNode?.firstElementChild?.querySelector('[class*="SkillIcon__StyledSvg"]')
        }
        return node
    }

    isNeedRemove() {
        let currentIsShort = this.isShortStyle()
        if (this.isShort === null) this.isShort = currentIsShort

        let isUpdated = false
        if (this.isShort !== currentIsShort) {
            isUpdated = true
            this.isShort = currentIsShort
        }
        let nickNode = this.getNickNode(currentIsShort)
        return nickNode && nickNode.isConnected && !isUpdated
    }

    async updateIcon() {
        let newNick = this.getNickNode(this.isShort)?.innerText
        if (!newNick) return
        if (newNick !== this.nick || !this.newIcon) {
            let levelNode = this.getLevelNode(this.isShort);
            let oldIcon
            let elo
            if (!this.isShort) {
                let textNode = levelNode.querySelector('[class*="styles__EloText"]')
                let eloText = textNode.innerText
                if (!eloText) return;
                elo = parseInt(eloText.replace(/[\s,._]/g, ''), 10)
                oldIcon = levelNode.querySelector('[class*="SkillIcon__StyledSvg"]')
            } else {
                let playerStatistic = await getPlayerStatsByNickName(newNick);
                let {gameStats} = getStatistic(playerStatistic)
                if (!gameStats) return
                elo = parseInt(gameStats["faceit_elo"], 10);
                oldIcon = levelNode
            }
            if (!oldIcon) return;
            let [currentLevel, _] = getBarProgress(elo, "cs2");
            let newIcon = levelIcons.get(currentLevel).cloneNode(true).firstChild
            if (this.newIcon) this.newIcon.remove()
            newIcon.appendToAndHide(oldIcon)
            this.newIcon = newIcon
            this.nick = newNick
        }
    }
}

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
            case /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)(\/.*)?$/.test(url):
                return "profile";
            case /^https:\/\/www\.faceit\.com\/\w+\/cs2\/room\/[\w\-]+(\/.*)?$/.test(url):
                return "matchroom";
        }
    };

    let lobbyType = defineUrlType(window.location.href)
    if (lobbyType === "matchroom") {
        doAfterNickNameNodeAppear(lobbyType, async (nickNode) => {
            handleMatchRoomLobby(nickNode)
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
                newLevelsModule.doAfter(() => !!node.getElementsByTagName("svg")[0], () => {
                    if (document.getElementById("new-elo-level-icon")) return
                    let oldIcon = node.getElementsByTagName("svg")[0]
                    icon.appendToAndHide(oldIcon)
                })
            }
        })
    }

    let partySlots = new Map();

    doAfterMatchroomLobbyAppear(async (node) => {
        newLevelsModule.doAfter(() => {
            let firstChild = node.firstElementChild
            return firstChild && firstChild?.children?.length === 2 && firstChild?.children[1]?.children?.length === 5
        }, async () => {
            let table = Array.from(node.firstElementChild.children)[1]
            newLevelsModule.every(100, async () => {
                if (partySlots.size < 5) {
                    let i = 0
                    Array.from(table.children).forEach((slot) => {
                        if (slot.id !== `party-slot-${i}`) {
                            slot.id = `party-slot-${i}`
                            partySlots.set(`party-slot-${i}`, new PartySlot(slot))
                        }
                        i++
                    })
                }

                for (let j = 0; j < partySlots.size; j++) {
                    let id = `party-slot-${j}`
                    let slot = partySlots.get(id)
                    if (!slot.isNeedRemove() && !slot.isEmpty) {
                        partySlots.delete(id)
                        slot.slotNode.id = ""
                        if (slot.newIcon) slot.newIcon.remove()
                        continue
                    }
                    await slot.updateIcon()
                }
            })
        })
    })

    doAfterNickNameCardNodeAppear(async (node) => {
        let innerNode = node.querySelector('[class*="Tag__Container-"]')
        newLevelsModule.doAfter(() => innerNode.childNodes && innerNode.childNodes.length > 1, () => {
            let eloText = innerNode.querySelector('[class*="Text-sc"]').firstChild.firstElementChild.innerText
            let elo = parseInt(eloText.replace(/[\s,._]/g, ''), 10)
            let oldIcon = innerNode.childNodes[0]
            let [currentLevel, _] = getBarProgress(elo, "cs2");
            let newIcon = levelIcons.get(currentLevel).cloneNode(true)
            newIcon.firstElementChild.appendToAndHide(oldIcon)
        })
    })

    doAfterSearchPlayerNodeAppear(async (node) => {
        newLevelsModule.doAfter(() => node.childNodes && node.childNodes.length > 2, async () => {
            let currentNode = node.childNodes[1];
            for (let i = 0; i < 7; i++) {
                currentNode = currentNode.firstElementChild;
                if (currentNode.tagName === "SPAN" && i === 0) break
            }
            let nick = currentNode?.innerText;
            newLevelsModule.doAfter(() => Array.from(node?.childNodes[2]?.firstElementChild?.childNodes).some(node => node.tagName === "svg"), async () => {
                let oldIcon = Array.from(node.childNodes[2].firstElementChild.childNodes).find(node => node.tagName === "svg")
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

function handleMatchRoomLobby(nickNode) {
    let playerCardNodes = nickNode.parentNode.parentNode.parentNode.parentNode.parentNode.children
    newLevelsModule.doAfter(() => playerCardNodes.length === 3, () => {
        let section = playerCardNodes[playerCardNodes.length - 1].firstChild.childNodes
        newLevelsModule.doAfter(() => section.length === 3, () => {
            let elo = parseInt(section[1].firstElementChild.firstElementChild.innerText, 10)
            let [currentLevel, _] = getBarProgress(elo, "cs2");
            let newIcon = levelIcons.get(currentLevel).cloneNode(true).childNodes[0]
            let oldIcon = section[playerCardNodes.length - 1];
            if (typeof oldIcon.className === "string" && oldIcon.className.includes("BadgeHolder__Holder")) {
                newIcon.appendTo(oldIcon)
            } else {
                newIcon.appendToAndHide(oldIcon)
            }
        })
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

function doAfterMatchroomLobbyAppear(callback) {
    let existLobby = document.getElementById("marked-party-lobby")
    if (existLobby) callback(existLobby)

    const observer = new MutationObserver(mutationsList => {

        function checkNodeAndChildren(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.hasAttribute('data-processed')) return;
                const hasContainer = node.matches('[class*=Matchmaking__PlayHolder]');

                if (hasContainer) {
                    newLevelsModule.processedNode(node);
                    node.id = "marked-party-lobby"
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

    newLevelsModule.registerObserver("matchroom-lobby-observer", observer);
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
