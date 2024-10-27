console.log("Content script loaded.");

async function initialize() {
    const enabled = await isExtensionEnabled();
    if (!enabled) return;
    const apiKey = await getApiKey();

    if (apiKey) {
        const matchId = window.location.href.split("/").pop();

        if (!matchId) {
            console.log("Не удалось получить ID матча. Убедитесь, что вы на странице матча.");
            return;
        }

        const calculator = new TeamWinRateCalculator(apiKey);

        try {
            await calculator.getMatchWinRates(matchId);
        } catch (error) {
            console.log("Ошибка при получении статистики матча: " + error.message);
        }
    } else {
        console.log("Пожалуйста, введите ваш API Key в настройках!");
    }
}

class TeamWinRateCalculator {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://open.faceit.com/data/v4";
        this.results = new Map();
    }

    async fetchMatchStats(matchId) {
        const url = `${this.baseUrl}/matches/${matchId}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка при получении статистики матча: ${response.statusText}`);
        }

        return await response.json();
    }

    async insertHtmlFromFileByName(filePath, targetElementName) {
        try {
            const response = await fetch(chrome.runtime.getURL(filePath));

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const htmlContent = await response.text();
            const targetElement = document.querySelector(`[name="${targetElementName}"]`);

            if (targetElement) {
                const firstChildWithClass = targetElement.querySelector('[class]');

                if (firstChildWithClass) {
                    firstChildWithClass.insertAdjacentHTML('afterend', htmlContent);
                } else {
                    console.error(`No child with the specified class found inside the element with name "${targetElementName}".`);
                }
            } else {
                console.error(`Element with name "${targetElementName}" not found.`);
            }
        } catch (error) {
            console.error('Error loading HTML file:', error);
        }
    }

    async printResults() {
        await this.insertHtmlFromFileByName('src/visual/tables/team.html', 'info')
        this.results.forEach((teamMap, teamName) => {
            const teamMatches = this.aggregateTeamMatches(teamMap);
            this.printTeamMatches(teamName, teamMatches);
            this.printPlayersStats(teamMap);
        });
    }

    aggregateTeamMatches(teamMap) {
        const teamMatches = {};

        teamMap.forEach(({ maps }) => {
            maps.forEach((data, mapName) => {
                if (!teamMatches[mapName]) {
                    teamMatches[mapName] = { wins: 0, totalGames: 0 };
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
        addTableTeamTitle(roster,teamName);
        Object.entries(teamMatches)
            .sort(([, dataA], [, dataB]) => dataB.wins / dataB.totalGames - dataA.wins / dataA.totalGames)
            .forEach(([mapName, data]) => {
                const winrate = (data.wins / data.totalGames * 100).toFixed(0);
                addRow(roster,mapName, data.totalGames, winrate)
            });
    }

    printPlayersStats(teamMap) {
        console.log("\nPlayers:");
        teamMap.forEach(({ nickname, maps }) => {
            const totalGames = Array.from(maps.values()).reduce((sum, data) => sum + data.totalGames, 0);
            console.log(` ${nickname}: Stats for ${totalGames} matches`);

            Array.from(maps.entries())
                .sort(([, dataA], [, dataB]) => dataB.wins / dataB.totalGames - dataA.wins / dataA.totalGames)
                .forEach(([mapName, data]) => {
                    const winrate = (data.wins / totalGames * 100).toFixed(2);
                    console.log(`  ${mapName} - Games: ${data.totalGames}, Wins: ${data.wins}, Winrate: ${winrate}%`);
                });
            console.log("========================================");
        });
    }

    async getMatchWinRates(matchId) {
        if (!matchId) {
            throw new Error("Match ID is not provided.");
        }

        const matchStats = await this.fetchMatchStats(matchId);

        if (!matchStats || !matchStats.match_id) {
            console.error("Ошибка при получении статистики матча: Неверная структура матча.");
        }

        await this.displayWinRates(matchStats);
    }

    async calculateStats(team, playerId) {
        const url = `https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats?limit=20`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            console.error("Ошибка при запросе данных игрока: Ошибка при получении данных");
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return;
        }

        if (!this.results.has(team)) {
            this.results.set(team, new Map());
        }

        const teamMap = this.results.get(team);

        data.items.forEach((item) => {
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

    }

    async displayWinRates(matchDetails) {
        const team1 = matchDetails.teams.faction1;
        const team2 = matchDetails.teams.faction2;

        for (const player of team1.roster) {
            await this.calculateStats(team1.name + "$roster1", player.player_id);
        }

        for (const player of team2.roster) {
            await this.calculateStats(team2.name + "$roster2", player.player_id);
        }

        await this.printResults();
    }
}

function addTableTeamTitle(roster,title) {
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

function setGradientColor(winrateCell, percent) {
    percent = Math.min(Math.max(percent, 0), 100);
    const ratio = percent / 100;
    const colorRed = "#ff0022";
    const colorYellow = "#fbec1e";
    const colorGreen = "#32d35a";
    let gradientColor;
    if (ratio < 0.5) {
        const t = ratio * 2;
        gradientColor = interpolateColor(colorRed, colorYellow, t);
    } else {
        const t = (ratio - 0.5) * 2;
        gradientColor = interpolateColor(colorYellow, colorGreen, t);
    }
    winrateCell.style.color = gradientColor;
}

function interpolateColor(color1, color2, factor) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * factor).toString(16).padStart(2, '0');
    const g = Math.round(g1 + (g2 - g1) * factor).toString(16).padStart(2, '0');
    const b = Math.round(b1 + (b2 - b1) * factor).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

initialize();

