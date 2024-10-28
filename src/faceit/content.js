let registeredObservers = new LimitedMap(100);
let matchDataCache = new LimitedMap(5);
let playerDataCache = new LimitedMap(50);
let playerGamesDataCache = new LimitedMap(50);
let cachedNodes = [];
let processedNodes = [];
let isLoaded = false
let currentMatchId

chrome.runtime.onMessage.addListener((request) => {
    console.log(request.url);
    if (request.message) {
        if (request.message === "loadmatch") {
            console.log("Loading...");
            addListenerToRun(async () => {
                await initialize();
            }).then(() => {
                console.log("Enabled");
            }).catch(error => {
                console.error("Error during activation:", error);
            });
        }
        if (request.message === "reload") {
            console.log("Reloading...");
            addListenerToRun(async () => {
                disable();
                await initialize();
            }).then(() => {
                console.log("Enabled");
            }).catch(error => {
                console.error("Error during activation:", error);
            });
        }
        if (request.message === "disable") {
            addListenerToRun(() => {
                disable()
            }).then(() => {
                console.log("Disabled");
            }).catch(error => {
                console.error("Disconnection error:", error);
            });
        }
    }
});

function disable() {
    console.log("Disabling...");
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
    isLoaded = false;
    currentMatchId = undefined;
}

function addListenerToRun(callback) {
    return new Promise((resolve) => {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                callback().then(resolve);
            });
        } else {
            callback().then(resolve);
        }
    });
}

async function initialize() {
    const matchId = extractMatchId();
    if (isLoaded && currentMatchId === matchId) return
    console.log("Running...");
    const enabled = await isExtensionEnabled();
    if (!enabled) return;
    const apiKey = await getApiKey();

    if (apiKey) {
        const calculator = new TeamWinRateCalculator(apiKey);

        try {
            if (!matchId) return;
            await calculator.getMatchWinRates(matchId);
            currentMatchId = matchId
            isLoaded = true;
        } catch (error) {
            console.error("Error when retrieving match statistics: " + error.message);
        }
    } else {
        console.log("Please enter your API Key in the settings!");
    }
}

class TeamWinRateCalculator {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://open.faceit.com/data/v4";
        this.results = new Map();
    }

    async fetchMatchStats(matchId) {
        const matchDataCached = matchDataCache.get(matchId)
        if (matchDataCached) return matchDataCached;

        const url = `${this.baseUrl}/matches/${matchId}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error when retrieving match statistics: ${response.statusText}`);
        }
        const newMatchData = await response.json()
        matchDataCache.set(matchId, newMatchData);
        return newMatchData;
    }

    async insertHtmlToTeamCard(filePath, targetElement) {
        const response = await fetch(chrome.runtime.getURL(filePath));
        if (!response.ok) {
            console.error(`HTTP error! Status: ${response.status}`);
            return null;
        }

        const htmlContent = await response.text();
        const firstChildWithClass = targetElement.querySelector('[class]');

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        if (firstChildWithClass) {
            firstChildWithClass.insertAdjacentElement('afterend', tempDiv);
        }
        cachedNodes.push(tempDiv);
    }

    async insertHtmlToPlayerCard(filePath, playerId, targetNode) {
        const response = await fetch(chrome.runtime.getURL(filePath));

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        let htmlContent = await response.text();

        htmlContent = htmlContent.replace(/id="player-table"/g, `id="player-table-${playerId}"`);

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        targetNode.insertAdjacentElement('beforeend', tempDiv);

        cachedNodes.push(tempDiv);
    }


    async printResults(targetNode) {
        await this.insertHtmlToTeamCard('src/visual/tables/team.html', targetNode);
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
            console.log(`Player stats not found!`);
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

        const matchStats = await this.fetchMatchStats(matchId);

        if (!matchStats || !matchStats.match_id) {
            console.error("Error when retrieving match statistics: Incorrect match structure.");
        }

        await this.displayWinRates(matchStats);
    }

    async getPlayerGameStats(playerId) {
        const cachedStats = playerGamesDataCache.get(playerId);
        if (cachedStats) return cachedStats;

        const url = `https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats?limit=20`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            console.error("Error when requesting player data: Error when receiving data");
        }
        const newStats = response.json();
        playerGamesDataCache.set(playerId, newStats);
        return newStats;
    }

    async getPlayerStats(playerId) {
        const cachedStats = playerDataCache.get(playerId);
        if (cachedStats) return cachedStats;
        const url = `https://open.faceit.com/data/v4/players/${playerId}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            console.error("Error when requesting player data: Error when receiving data");
        }

        const newStats = response.json();
        playerDataCache.set(playerId, newStats)
        return newStats;
    }

    async findUserCard(playerId, callback) {
        if (registeredObservers.has(playerId)) return;

        const player = await this.getPlayerStats(playerId);
        const currentCountry = extractLanguage();
        const match = player.faceit_url.match(/\/players\/[^/]+/);
        const playerLink = "/" + currentCountry + match[0];

        console.log("Looking for player link:", playerLink);

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
        const data = await this.getPlayerGameStats(playerId);

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
            const existingTable = userCardElement.querySelector('.player-background-table');
            if (!existingTable) {
                await this.insertHtmlToPlayerCard('src/visual/tables/player.html', playerId, userCardElement);

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
            console.log("Registering observer for INFO-TABLE");
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
                console.log(addedNode)
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

