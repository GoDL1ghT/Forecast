console.log("Content script loaded.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message) {
        if (request.message === "loadmatch-8642") {
            initialize();
        }
    }
});

async function initialize() {
    const enabled = await isExtensionEnabled();
    if (!enabled) return;
    const apiKey = await getApiKey();

    if (apiKey) {
        const rawMatchId = window.location.href.split("/").pop();
        const matchId = extractMatchId();

        const calculator = new TeamWinRateCalculator(apiKey);

        try {
            if (!rawMatchId || rawMatchId !== matchId) return;
            await calculator.getMatchWinRates(matchId);
        } catch (error) {
            console.error("Ошибка при получении статистики матча: " + error.message);
        }
    } else {
        console.log("Пожалуйста, введите ваш API Key в настройках!");
    }
}

function extractMatchId() {
    const match = window.location.href.match(/room\/([a-z0-9-]+)/i);
    return match ? match[1] : null;
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

    async insertHtmlFromFile(filePath, playerId, targetElement, callback = () => {
    }) {
        const response = await fetch(chrome.runtime.getURL(filePath));

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        let htmlContent = await response.text();

        htmlContent = htmlContent.replace(/id="player-table"/g, `id="player-table-${playerId}"`);

        targetElement.insertAdjacentHTML('beforeend', htmlContent);

        callback();
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

    printPlayersStats(teamMap) {
        console.log("\nPlayers:");
        teamMap.forEach(({nickname, maps}) => {
            const totalGames = Array.from(maps.values()).reduce((sum, data) => sum + data.totalGames, 0);
            console.log(` ${nickname}: Stats for ${totalGames} matches`);

            Array.from(maps.entries())
                .sort(([, dataA], [, dataB]) => dataB.wins / dataB.totalGames - dataA.wins / dataA.totalGames)
                .forEach(([mapName, data]) => {
                    const winrate = (data.wins / totalGames * 100).toFixed(2);
                    console.log(`  ${mapName} - Games: ${data.totalGames}, Wins: ${data.wins}, Winrate: ${winrate}%`);
                });
        });
    }

    printPlayerStats(playerId, playerStats) {
        if (!playerStats) {
            console.log(`Player stats not found.`);
            return;
        }

        const {maps} = playerStats;

        Array.from(maps.entries())
            .sort(([, {wins: winsA, totalGames: totalA}], [, {wins: winsB, totalGames: totalB}]) =>
                (winsB / totalB) - (winsA / totalA))
            .forEach(([mapName, {totalGames, wins}]) => {
                const winrate = ((wins / totalGames) * 100).toFixed(2);
                console.log(document.getElementById(`player-table-${playerId}`));
                console.log(`player-table-${playerId}`);
                addRow(`player-table-${playerId}`, mapName, totalGames, winrate);
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

    async getPlayerGameStats(playerId) {
        const url = `https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats?limit=20`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            console.error("Ошибка при запросе данных игрока: Ошибка при получении данных");
        }

        return response.json();
    }

    async getPlayerStats(playerId) {
        const url = `https://open.faceit.com/data/v4/players/${playerId}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            console.error("Ошибка при запросе данных игрока: Ошибка при получении данных");
        }

        return response.json();
    }

    async findUserCard(playerId, callback) {
        const player = await this.getPlayerStats(playerId);
        const currentCountry = extractLanguage();
        const match = player.faceit_url.match(/\/players\/[^/]+/);
        const playerLink = "/" + currentCountry + match[0];
        console.log("Ссылка игрока:", playerLink);

        // Набор для хранения уникальных обработанных узлов
        const processedNodes = new Set();

        // Функция для проверки уникальности ноды
        function isUniqueNode(node) {
            const playerAnchor = node.querySelector(`a[href="${playerLink}"]`);
            const hasTable = node.querySelector('.player-background-table');
            return playerAnchor && !hasTable; // Уникальная, если есть ссылка и нет таблицы
        }

        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                // Обрабатываем изменения атрибутов
                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    // Проверяем, если это элемент с классом UserCard__Container
                    if (target.nodeType === Node.ELEMENT_NODE && target.matches('[class*="UserCard__Container"]') && isUniqueNode(target) && !processedNodes.has(target)) {
                        console.log("Контейнер найден (по изменению атрибутов):", target);
                        processedNodes.add(target);
                        if (typeof callback === "function") {
                            callback(target);
                        }
                    }
                }
            }
        });

        observer.observe(document.body, {childList: true, subtree: true, attributes: true});
    }

    async calculateStats(team, playerId) {
        const data = await this.getPlayerGameStats(playerId)

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

        await this.findUserCard(playerId, (userCardElement) => {
            console.log("Card found!");
            this.insertHtmlFromFile('src/visual/tables/player.html', playerId, userCardElement, () => {
                let playerStats;
                this.results.forEach((teamMap) => {
                    if (teamMap.has(playerId)) {
                        playerStats = teamMap.get(playerId);
                    }
                });
                this.printPlayerStats(playerId, playerStats);
            });
        });
    }

    async displayWinRates(matchDetails) {
        const team1 = matchDetails.teams.faction1;
        const team2 = matchDetails.teams.faction2;

        for (const player of team1.roster) {
            await this.calculateStats(team1.name + "$roster1", player.player_id);
        }

        var i = 0
        for (const player of team2.roster) {
            await this.calculateStats(team2.name + "$roster2", player.player_id);
        }

        await this.printResults();
    }
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

