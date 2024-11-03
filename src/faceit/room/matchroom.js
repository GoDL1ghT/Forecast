let cachedNodes = [];
let processedNodes = [];
let currentMatchId

const matchRoomModule = new Module("matchroom",async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("matchroom");
    if (!enabled) return;

    const matchId = extractMatchId();
    if (currentMatchId === matchId) return

    const calculator = new TeamWinRateCalculator();

    try {
        if (!matchId) return;
        await calculator.getMatchWinRates(matchId);
        currentMatchId = matchId
    } catch (err) {
        error("Error when retrieving match statistics: " + err.message);
    }
},async () => {
    cachedNodes.forEach((node) => {
        node.remove();
    });
    cachedNodes.length = 0;
    processedNodes.forEach((node) => {
        node.removeAttribute('data-processed')
    });
    processedNodes.length = 0;
    registeredObservers.forEach((observer) => {
        observer.disconnect();
    })
    registeredObservers.clear();
    currentMatchId = null;
})

moduleListener(matchRoomModule);

class TeamWinRateCalculator {
    constructor() {
        this.results = new Map();
    }

    insertHtmlToTeamCard(url, targetElement) {
        let htmlResource = getHtmlResource(url).cloneNode(true)
        const firstChildWithClass = targetElement.querySelector('[class]');
        firstChildWithClass.insertAdjacentElement('afterend', htmlResource);
        cachedNodes.push(htmlResource);
    }

    insertHtmlToPlayerCard(filePath, playerId, targetNode) {
        let htmlResource = getHtmlResource(filePath).cloneNode(true);
        targetNode.insertAdjacentElement('beforeend', htmlResource);
        let table = document.getElementById("player-table")
        table.id = `player-table-${playerId}`
        table.closest(`[class*="UserCardPopup__UserCardContainer"]`).style.minHeight = "530px"
        cachedNodes.push(htmlResource);
    }

    async printResults(targetNode) {
        this.insertHtmlToTeamCard('src/visual/tables/team.html', targetNode);
        const printPromises = [];

        this.results.forEach((teamMap, teamName) => {
            const teamMatches = this.aggregateTeamMatches(teamMap);
            printPromises.push(this.printTeamMatches(teamName, teamMatches));
        });

        await Promise.all(printPromises);
    }

    aggregateTeamMatches(teamMap) {
        const teamMatches = {};

        teamMap.forEach(({maps}) => {
            maps.forEach((data, mapName) => {
                if (!teamMatches[mapName]) {
                    teamMatches[mapName] = {wins: 0, totalGames: 0};
                }
                teamMatches[mapName].wins += data.wins;
                teamMatches[mapName].totalGames += data.totalGames;
            });
        });

        return teamMatches;
    }

    printTeamMatches(teamNameRaw, teamMatches) {
        const roster = teamNameRaw.split("$").pop()
        const teamName = teamNameRaw.split("$")[0]
        addTableTeamTitle(roster, teamName);
        Object.entries(teamMatches)
            .sort(([, dataA], [, dataB]) => dataB.wins / dataB.totalGames - dataA.wins / dataA.totalGames)
            .forEach(([mapName, data]) => {
                const winrate = (data.wins / data.totalGames * 100).toFixed(0);
                addRow(roster, mapName, data.totalGames, winrate)
            });
    }

    printPlayerStats(playerId, playerStats) {
        if (!playerStats) {
            println(`Player stats ${playerId} not found!`);
            return;
        }

        const {maps} = playerStats;

        Array.from(maps.entries())
            .sort(([, {wins: winsA, totalGames: totalA}], [, {wins: winsB, totalGames: totalB}]) =>
                (winsB / totalB) - (winsA / totalA))
            .forEach(([mapName, {totalGames, wins}]) => {
                const winrate = ((wins / totalGames) * 100).toFixed(0);
                addRow(`player-table-${playerId}`, mapName, totalGames, winrate);
            });
    }


    async getMatchWinRates(matchId) {
        if (!matchId) {
            throw new Error("Match ID is not provided!");
        }

        const matchStats = await fetchMatchStats(matchId);

        if (!matchStats || !matchStats.match_id) {
            error("Error when retrieving match statistics: Incorrect match structure.");
        }

        await this.displayWinRates(matchStats);
    }

    async findUserCard(playerId, callback) {
        if (registeredObservers.has(playerId)) return;

        const player = await getPlayerStatsById(playerId);
        const currentCountry = extractLanguage();
        const match = player.faceit_url.match(/\/players\/[^/]+/);
        const playerLink = "/" + currentCountry + match[0];

        function isUniqueNode(node) {
            const playerAnchor = node.querySelector(`a[href="${playerLink}"]`);
            const isProcessed = node.hasAttribute('data-processed');
            return playerAnchor && !isProcessed;
        }

        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                let found = false
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (found) break
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches('[class*="UserCard__Container"]') || node.querySelector('[class*="UserCard__Container"]')) {
                                const targetNode = node.matches('[class*="UserCard__Container"]') ? node : node.querySelector('[class*="UserCard__Container"]');
                                if (isUniqueNode(targetNode)) {
                                    targetNode.setAttribute('data-processed', 'true');
                                    processedNodes.push(targetNode);
                                    callback(targetNode);
                                    found = true
                                    break;
                                }
                            }
                        }
                    }
                }
                if (found) break
            }
        });

        observer.observe(document.body, {
            childList: true,
            attributes: true,
            subtree: true,
        });

        registeredObservers.set(playerId, observer);
    }


    async calculateStats(team, playerId) {
        const matchAmount = await getSliderValue();
        let data = await getPlayerGameStats(playerId, "cs2", matchAmount);

        if (!data.items || data.items.length === 0) {
            return;
        }

        if (!this.results.has(team)) {
            this.results.set(team, new Map());
        }

        const teamMap = this.results.get(team);

        data.items.forEach(item => {
            const stats = item.stats;
            if (stats["Game Mode"] !== "5v5") return;

            const mapName = stats["Map"];
            const result = parseInt(stats["Result"]);

            if (!teamMap.has(playerId)) {
                teamMap.set(playerId, {nickname: stats["Nickname"], maps: new Map()});
            }

            const playerData = teamMap.get(playerId).maps;

            if (!playerData.has(mapName)) {
                playerData.set(mapName, {wins: 0, totalGames: 0});
            }

            const mapData = playerData.get(mapName);
            mapData.wins += result;
            mapData.totalGames += 1;
        });

        await this.findUserCard(playerId, async userCardElement => {
            const existingTable = userCardElement.querySelector('.fc-score-table');
            if (!existingTable) {
                this.insertHtmlToPlayerCard('src/visual/tables/player.html', playerId, userCardElement);

                const playerStats = teamMap.get(playerId);
                if (playerStats) {
                    this.printPlayerStats(playerId, playerStats);
                }
            }
        });
    }


    async displayWinRates(matchDetails) {
        const team1 = matchDetails.teams.faction1;
        const team2 = matchDetails.teams.faction2;

        const team1Promises = team1.roster.map(player =>
            this.calculateStats(`${team1.name}$roster1`, player.player_id)
        );
        const team2Promises = team2.roster.map(player =>
            this.calculateStats(`${team2.name}$roster2`, player.player_id)
        );

        await Promise.all([...team1Promises, ...team2Promises]);

        const element = document.querySelector(`[name="info"][class*="Overview__Column"]`);
        if (element) {
            await handleInfoNode(this, element);
        } else {
            if (registeredObservers.has("info-table")) return
            const observer = new MutationObserver((mutationsList) => {
                observerCallback(this, mutationsList);
            });
            observer.observe(document.body, {attributes: true, childList: true, subtree: true});
            registeredObservers.set("info-table", observer);
            println("Registering observer for INFO-TABLE");
        }
    }
}

async function handleInfoNode(calculator, node) {
    if (!node.matches('[name="info"]') && !node.querySelector('[name="info"][class*="Overview__Column"]')) return false;
    const targetNode = node.matches('[name="info"]') ? node : node.querySelector('[name="info"][class*="Overview__Column"]');
    if (targetNode.hasAttribute('data-processed')) return false;

    targetNode.setAttribute('data-processed', 'true');
    processedNodes.push(targetNode);
    await calculator.printResults(targetNode);
    return true
}

async function observerCallback(calculator, mutationsList) {
    let found = false
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;
                if (!await handleInfoNode(calculator, addedNode)) continue;
                found = true;
                break;
            }
        }
        if (mutation.type === 'attributes') {
            if (found) break
            const targetNode = mutation.target;
            if (!await handleInfoNode(calculator, targetNode)) continue;
            break;
        }
        if (found) break
    }
}

function extractMatchId() {
    const match = window.location.href.match(/room\/([a-z0-9-]+)/i);
    return match ? match[1] : null;
}

function extractLanguage() {
    const url = window.location.href;
    const match = url.match(/https:\/\/www\.faceit\.com\/([^/]+)\//);
    return match ? match[1] : null;
}

function addTableTeamTitle(roster, title) {
    const titleElement = document.getElementById(roster + "-name")
    titleElement.textContent = title
}

function addRow(nameTable, map, games, winPercent) {
    const table = document.getElementById(nameTable).getElementsByTagName('tbody')[0];
    const newRow = table.insertRow();

    const mapCell = newRow.insertCell(0);
    const gamesCell = newRow.insertCell(1);
    const winrateCell = newRow.insertCell(2);

    mapCell.innerHTML = map;
    gamesCell.innerHTML = games;
    winrateCell.innerHTML = winPercent + "%";

    setGradientColor(winrateCell, winPercent);
}

