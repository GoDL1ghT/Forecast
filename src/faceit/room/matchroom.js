const matchRoomModule = new Module("matchroom", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("matchroom");
    if (!enabled) return;

    const matchId = extractMatchId();

    const calculator = new TeamWinRateCalculator();

    try {
        if (!matchId) return;
        await calculator.getMatchWinRates(matchId);
    } catch (err) {
        error("Error when retrieving match statistics: " + err.message);
    }
})

moduleListener(matchRoomModule);

class TeamWinRateCalculator {
    constructor() {
        this.results = new Map();
    }

    insertHtmlToTeamCard(url, targetElement) {

    }

    insertHtmlToPlayerCard(filePath, playerId, targetNode) {
        let htmlResource = getHtmlResource(filePath).cloneNode(true);
        targetNode.insertAdjacentElement('beforeend', htmlResource);
        let table = document.getElementById("player-table")
        table.id = `player-table-${playerId}`
        table.closest(`[class*="UserCardPopup__UserCardContainer"]`).style.minHeight = "530px"
    }

    async printResults(targetNode) {

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
        const player = await getPlayerStatsById(playerId);
        const currentCountry = extractLanguage();
        const match = player.faceit_url.match(/\/players\/[^/]+/);
        const playerLink = "/" + currentCountry + match[0];

        function isUniqueNode(node) {
            const playerAnchor = node.querySelector(`a[href="${playerLink}"]`);
            const isProcessed = node.hasAttribute('data-processed');
            return playerAnchor && !isProcessed;
        }

        matchRoomModule.observe(function search(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="UserCard__Container"]') || node.querySelector('[class*="UserCard__Container"]')) {
                    const targetNode = node.matches('[class*="UserCard__Container"]') ? node : node.querySelector('[class*="UserCard__Container"]');
                    if (isUniqueNode(targetNode)) {
                        matchRoomModule.processedNode(targetNode);
                        callback(targetNode);
                    }
                }
            }
        })
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

        await this.findUserCard(playerId, userCardElement => {
            const existingTable = document.getElementById(`player-table-${playerId}`)
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
        const team1 = matchDetails["teams"]["faction1"];
        const team2 = matchDetails["teams"]["faction2"];

        const team1Promises = team1["roster"].map(player =>
            this.calculateStats(`${team1.name}$roster1`, player["player_id"])
        );
        const team2Promises = team2["roster"].map(player =>
            this.calculateStats(`${team2.name}$roster2`, player["player_id"])
        );

        await Promise.all([...team1Promises, ...team2Promises]);

        await matchRoomModule.doAfterNodeAppear('[name="info"][class*="Overview__Column"]',async (node) => {
            let uniqueCheck = () => node.querySelector('[id*="team-table"]')
            if (uniqueCheck()) return
            const targetNode = node.matches('[name="info"]') ? node : node.querySelector('[name="info"][class*="Overview__Column"]');
            if (!targetNode) return false;
            if (targetNode.hasAttribute('data-processed')) return false;
            matchRoomModule.processedNode(targetNode);

            let innerNode = targetNode.querySelector('[class*="Overview__Stack"]')
            let htmlResource = getHtmlResource('src/visual/tables/team.html').cloneNode(true)
            htmlResource.id = "team-table"
            const firstChildWithClass = innerNode.querySelector('[class]');
            firstChildWithClass.insertAdjacentElement('afterend', htmlResource);
            matchRoomModule.removalNode(htmlResource);

            this.results.forEach((teamMap, teamName) => {
                const teamMatches = this.aggregateTeamMatches(teamMap);
                this.printTeamMatches(teamName, teamMatches);
            });
        })
    }
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

