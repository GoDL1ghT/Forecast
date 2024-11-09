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
            let currentLevel = getLevel(elo, "cs2");
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
            case /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats\/([^\/]+)$/.test(url):
                return "stats";
            case /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/collections.*/.test(url):
                return "collections";
            case /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)(\/.*)?$/.test(url):
                return "profile";
            case /^https:\/\/www\.faceit\.com\/\w+\/cs2\/room\/[\w\-]+(\/.*)?$/.test(url):
                return "matchroom";
            default:
                return null;
        }
    };

    let lobbyType = defineUrlType(window.location.href)
    if (lobbyType === "matchroom") {
        let matchId = extractMatchId()
        let matchData = await fetchOldMatchStats(matchId);
        doAfterNickNameNodeAppear(async (nickNode) => {
            handleMatchRoomLobby(nickNode, matchData)
        })
    } else if (lobbyType === "profile") {
        doAfterMainLevelAppear(async (node) => {
            let nick = extractPlayerNick()
            let playerStatistic = await getPlayerStatsByNickName(nick);
            let {gameStats, gameType} = getStatistic(playerStatistic)
            if (!gameStats) return
            if (document.getElementById("new-elo-level-icon")) return
            let isTopIcon = node.getElementsByTagName("i").length > 0
            if (!gameStats) return
            let elo = parseInt(gameStats["faceit_elo"], 10);
            let currentLevel = getLevel(elo, gameType);
            let icon = levelIcons.get(currentLevel).cloneNode(true).firstChild
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
    } else {
        doAfterMasterLevelNodeAppear(async (node) => {
            let nick = extractPlayerNick()
            let playerStatistic = await getPlayerStatsByNickName(nick);
            let {gameStats, gameType} = getStatistic(playerStatistic)
            if (!gameStats) return
            if (document.getElementById("new-elo-level-icon")) return
            if (!gameStats) return
            let elo = parseInt(gameStats["faceit_elo"], 10);
            let levelRanges = gameLevelRanges[gameType];
            let currentLevel = getLevel(elo, gameType);
            let progress = getBarProgress(elo, gameType)
            let icon = levelIcons.get(currentLevel).cloneNode(true).firstChild
            icon.id = "new-elo-level-icon"
            newLevelsModule.removalNode(icon);
            if (document.getElementById("new-elo-level-icon")) return
            if (lobbyType === "stats") {
                icon.style.width = '48px';
                icon.style.height = '48px';
            }
            let isTopIcon = node.getElementsByTagName("i").length > 0
            if (isTopIcon) {
                if (lobbyType === "stats") {
                    icon.style.width = '38px';
                    icon.style.height = '38px';
                }
                node.parentElement.prepend(icon)
                node.parentElement.style.flexDirection = "column";
            } else {
                icon.appendToAndHide(node)
            }
            doAfterMasterProgressBarAppear(async (node) => {
                let section = node.parentElement.parentElement.parentElement

                let newTable = getHtmlResource("src/visual/tables/elo-progress-bar-master.html").cloneNode(true)
                newTable.appendToAndHide(section)

                let {min: currmin} = levelRanges[currentLevel - 1]
                let {min: nextmin} = currentLevel === levelRanges.length ? {min: '∞'} : levelRanges[currentLevel]

                document.getElementById("master-progress-bar").style.width = `${progress}%`;
                let prevLevelIcon = levelIcons.get(currentLevel-1)?.cloneNode(true)?.firstChild
                let nextLevelIcon = levelIcons.get(currentLevel+1)?.cloneNode(true)?.firstChild
                if (prevLevelIcon) prevLevelIcon.appendToAndHide(document.getElementById("master-min-icon"))
                if (nextLevelIcon) nextLevelIcon.appendToAndHide(document.getElementById("master-max-icon"))

                document.getElementById("master-min-value").textContent = currmin
                document.getElementById("master-max-value").textContent = nextmin
            })
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
            let currentLevel = getLevel(elo, "cs2");
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
                let currentLevel = getLevel(elo, gameType);
                let icon = levelIcons.get(currentLevel).cloneNode(true).firstChild
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

function findPlayerInTeamByNickname(teams, nickname) {
    for (let team of [teams["faction1"], teams["faction2"]]) {
        let player = team["roster"].find(player => player.nickname === nickname);
        if (player) {
            return player;
        }
    }
    return null;
}

function handleMatchRoomLobby(nickNode, matchData) {
    let playerCardNodes = nickNode.parentNode.parentNode.parentNode.parentNode.parentNode.children
    let nickname = nickNode.innerText
    let playerData = findPlayerInTeamByNickname(matchData["teams"], nickname)
    let elo = parseInt(playerData["elo"], 10)
    newLevelsModule.doAfter(() => playerCardNodes.length === 3, () => {
        let section = playerCardNodes[playerCardNodes.length - 1].firstChild.childNodes
        newLevelsModule.doAfter(() => section.length === 3, () => {
            let currentLevel = getLevel(elo, "cs2");
            let newIcon = levelIcons.get(currentLevel).cloneNode(true).firstChild
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
    let currentLevel = getLevel(elo, gameType)
    let progressBarPercentage = getBarProgress(elo, gameType);
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
    newLevelsModule.observe(function search(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.hasAttribute('data-processed')) return;
            const hasContainer = node.matches('[class*=Matchmaking__PlayHolder]');

            if (hasContainer) {
                newLevelsModule.processedNode(node);
                node.id = "marked-party-lobby"
                callback(node);
                return;
            }
            node.childNodes.forEach(search);
        }
    })
}

function doAfterSearchPlayerNodeAppear(callback) {
    const targetHrefPattern = new RegExp(`^/${extractLanguage()}/players\/([a-zA-Z0-9-_]+)$`);

    newLevelsModule.observe(function search(node) {
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
            node.childNodes.forEach(search);
        }
    })
}

function doAfterStatisticBarNodeAppear(nick, callback) {
    if (document.getElementById("statistic-progress-bar")) return
    const targetHrefPattern = new RegExp(`^/${extractLanguage()}/players/${nick}/stats/`);

    let found = !!document.getElementById("statistic-progress-bar");

    newLevelsModule.observe(function searchForRemove(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const href = node.getAttribute('href');
            const hasSvg = node.querySelector('svg');
            let targetNode = node.parentElement
            if (href && targetHrefPattern.test(href) && hasSvg && targetNode.id !== "user-url") {
                hideNode(targetNode)
                return;
            }
            node.childNodes.forEach(searchForRemove);
        }
    })

    newLevelsModule.observe(function search(node) {
        if (found) return;

        if (node.nodeType === Node.ELEMENT_NODE) {
            let selector = '#main-header-height-wrapper div[class*="styles__ProfileContainer"]'
            let appearNode = document.querySelector(selector)
            if (appearNode) {
                let newNode = document.createElement("div")
                let result = appearNode.parentElement
                result.children[1].insertAdjacentElement("afterend", newNode)
                callback(newNode);
                found = true;
                return;
            }
            node.childNodes.forEach(search);
        }
    })
}

function doAfterSelfNickNodeAppear(callback) {

    let selfNickNode = document.querySelector('[class*="styles__NicknameText-"]')
    if (selfNickNode) {
        selfNickNode.id = "self-nickname-node"
        callback(selfNickNode.innerText)
    }

    let found = !!document.getElementById("self-nickname-node")

    newLevelsModule.observe(function search(node) {
        if (found) return;

        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches('[class*="styles__NicknameText-"]')) {
                callback(node.innerText)
                found = true;
                return;
            }
            node.childNodes.forEach(search);
        }
    })
}

function doAfterMainLevelAppear(callback) {
    let mainLevelNode = document.querySelector('[class*="styles__TitleContainer-"]');
    if (mainLevelNode) {
        callback(mainLevelNode)
        return
    }

    let found = false;

    newLevelsModule.observe(function search(node) {
        if (found) return;
        if (node.nodeType === Node.ELEMENT_NODE && node.matches('[class*="styles__TitleContainer-"]')) {
            found = true;
            const svgObserver = new MutationObserver(innerMutations => {
                for (const innerMutation of innerMutations) {
                    if (innerMutation.type === 'childList') {
                        if (node.querySelector('svg')) {
                            callback(node);
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
        node.childNodes.forEach(search);
    })
}

function doAfterMasterLevelNodeAppear(callback) {
    let mainLevelNode = document.querySelector('[class*="SkillIcon__StyledSvg"]');
    if (!mainLevelNode) mainLevelNode = document.querySelector('[class*="BadgeHolder__Holder"]');
    if (mainLevelNode) {
        callback(mainLevelNode)
        return
    }

    newLevelsModule.observe(function search(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches('[class*="SkillIcon__StyledSvg"]') || node.matches('[class*="BadgeHolder__Holder"]')) {
                callback(node);
                return;
            }
            node.childNodes.forEach(search);
        }
    })
}

function doAfterMasterProgressBarAppear(callback) {
    let mainProgressbar = document.querySelector('[class*="ProgressBar__ProgressHolder"]');
    if (mainProgressbar) {
        callback(mainProgressbar)
        return
    }

    let found = false;
    newLevelsModule.observe(function search(node) {
        if (found) return;
        if (node.nodeType === Node.ELEMENT_NODE && node.matches('[class*="ProgressBar__ProgressHolder"]')) {
            found = true;
            callback(node);
            return;
        }
        node.childNodes.forEach(search);
    })
}

function doAfterWidgetEloNodeAppear(callback) {
    let found = !!document.getElementById("edited-widget");
    newLevelsModule.observe(function search(node) {
        if (found) return;
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches('[class*="EloWidget__Holder-"]')) {
                callback(node)
                found = true;
                return;
            }
            node.childNodes.forEach(search);
        }
    })
}

function doAfterNickNameCardNodeAppear(callback) {
    newLevelsModule.observe(function search(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches('[class*="UserStats__StatsContainer-"]') || node.querySelector('[class*="UserStats__StatsContainer-"]')) {
                callback(node)
                return;
            }
            node.childNodes.forEach(search);
        }
    })
}

function doAfterNickNameNodeAppear(callback) {
    let nodes = document.querySelectorAll('[class*="Nickname__Name-"]')
    nodes.forEach((node) => {
        callback(node)
    })
    newLevelsModule.observe(function search(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches('[class*="styles__Nickname-"]') || node.matches('[class*="Nickname__Name-"]')) {
                callback(node)
                return;
            }
            node.childNodes.forEach(search);
        }
    })
}

moduleListener(newLevelsModule);
