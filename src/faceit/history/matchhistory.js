const matchDatas = [];

class MatchNodeByMatchStats {
    constructor(node) {
        this.node = node
        this.matchStats = null
        this.rounds = 0
        this.score = ""
        this.isWin = false
    }

    async setupStatsToNode() {
        this.node.setAttribute("data-processed", "true");
        if (!this.matchStats) return
        let stats = this.matchStats;
        let kills = parseInt(stats["Kills"], 10);
        let assists = parseInt(stats["Assists"], 10);
        let deaths = parseInt(stats["Deaths"], 10);
        let rounds = this.rounds;
        let adr = parseInt(stats["ADR"], 10);
        let kdratio = parseFloat(stats["K/D Ratio"]);
        let krratio = parseFloat(stats["K/R Ratio"]);
        let entryCount = parseInt(stats["Entry Count"], 10)
        let firstKills = parseInt(stats["First Kills"], 10)
        let entryImpact = entryCount < firstKills ? entryCount : firstKills

        let kast = ((kills + assists + entryImpact) / rounds) * 100;
        let impact = (kills + 0.5 * assists - entryImpact * 1.5) / rounds;

        let rating = (
            0.0073 * kast +
            0.3591 * krratio +
            -0.5329 * (deaths / rounds) +
            0.2372 * impact +
            0.0032 * adr +
            0.1587
        ).toFixed(2);

        insertStatsIntoNode(this.node, this.score.replace(/\s+/g, ''), rating, kills, deaths, kdratio, krratio, adr, this.isWin)
    }
}

function insertStatsIntoNode(root, score, raiting, k, d, kd, kr, adr, isWin) {
    let table = getHtmlResource("src/visual/tables/matchscore.html").cloneNode(true)
    let fourthNode = root?.children[3];
    if (fourthNode && fourthNode.children.length === 1) {
        let singleChild = fourthNode.children[0];
        table.appendToAndHide(singleChild)
        matchHistoryModule.removalNode(table);
        insertRow(table, score, raiting, k, d, kd, kr, adr, isWin)
    }
}

function insertRow(node, score, raiting, k, d, kd, kr, adr, isWin) {
    const table = node.getElementsByTagName('tbody')[0];
    const newRow = table.insertRow();
    const scoreCell = newRow.insertCell(0);
    const raitingCell = newRow.insertCell(1);
    const kdCell = newRow.insertCell(2);
    const kdkrCell = newRow.insertCell(3);
    const adrCell = newRow.insertCell(4);
    let green = "rgb(61,255,108)";
    let red = "rgb(255, 0, 43)";

    let scoreNode = document.createElement("div");
    scoreNode.style.color = isWin ? green : red;
    scoreNode.innerHTML = score;

    let raitingNode = document.createElement("div");
    raitingNode.style.color = raiting > 1.0 ? green : red;
    raitingNode.innerHTML = raiting;

    let killsDeathNode  = document.createElement("div");
    killsDeathNode.style.color = kd > 1.0 ? green : red;
    killsDeathNode.innerHTML = `${k}/${d}`;

    scoreCell.appendChild(scoreNode);
    raitingCell.appendChild(raitingNode);
    kdCell.appendChild(killsDeathNode)
    kdkrCell.innerHTML = `${kd}/${kr}`;
    adrCell.innerHTML = adr;
}

const matchHistoryModule = new Module("matchhistory", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("matchhistory");
    if (!enabled) return;
    doAfterTableNodeAppear(async (node) => {
        const tableRows = node.querySelectorAll("tr[class*='styles__MatchHistoryTableRow']");
        const rowsArray = Array.from(tableRows);
        rowsArray.slice(1, 31).forEach((node) => {
            if (!node.hasAttribute("data-processed")) {
                matchDatas.push(new MatchNodeByMatchStats(node));
            }
        });
        await scanPlayerStatistic();
        await Promise.all(matchDatas.map(async (data) => {
            await data.setupStatsToNode();
        }));
    })
}, async () => {
    matchDatas.forEach((data) => {
        data.node.remove()
    })
    matchDatas.length = 0;
})

async function scanPlayerStatistic() {
    let playerNickName = extractPlayerNick();
    const playerData = await getPlayerStatsByNickName(playerNickName);
    const playerId = playerData.player_id;
    const playerGameDatas = await getPlayerGameStats(playerId, extractGameType(), 30);
    const matchesInfo = playerGameDatas.items
    const filteredMatchDatas = matchDatas.filter((data) => {
        return !data.node.hasAttribute("data-processed")
    })
    await fetchMatchStatsForPlayers(filteredMatchDatas, matchesInfo, playerId);
}

async function fetchMatchStatsForPlayers(filteredMatchDatas, matchesInfo, playerId) {
    const promises = filteredMatchDatas.map(async (matchNodeByStats, i) => {
        let matchInfo = matchesInfo[i];
        if (matchInfo) {
            let matchId = matchInfo.stats["Match Id"];
            let detailedMatchInfo = await fetchMatchStatsDetailed(matchId);
            let matchStats = detailedMatchInfo.rounds[0];
            let {player: detailedPlayerStats, team: team} = findPlayerInTeamById(matchStats.teams, playerId);
            matchNodeByStats.matchStats = detailedPlayerStats["player_stats"];
            matchNodeByStats.rounds = parseInt(matchStats.round_stats["Rounds"], 10);
            matchNodeByStats.score = matchStats.round_stats["Score"];
            matchNodeByStats.isWin = team["team_stats"]["Team Win"] === "1";
        }
    });

    await Promise.all(promises);
}

function findPlayerInTeamById(teams, playerId) {
    for (let team of teams) {
        let player = team.players.find(player => player.player_id === playerId);
        if (player) {
            return {team: team, player: player};
        }
    }
    return null;
}

function doAfterTableNodeAppear(callback) {
    let matchHistoryNode = document.getElementById("match-history-table")
    if (matchHistoryNode) {
        matchHistoryModule.processedNode(matchHistoryNode);
        callback(matchHistoryNode)
    }

    matchHistoryNode = document.querySelector('[class*="styles__MatchHistoryTable-"]')
    if (matchHistoryNode) {
        matchHistoryNode.id = "match-history-table"
        matchHistoryModule.processedNode(matchHistoryNode);
        callback(matchHistoryNode)
    }

    function isUniqueNode(node) {
        return !node.hasAttribute('data-processed') && node.querySelector(`tbody`);
    }

    let found = !!document.getElementById("match-history-table")
    matchHistoryModule.observe(function search(node) {
        if (matchDatas.length >= 30) return;
        if (found) return
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches('[class*="styles__MatchHistoryTable-"]') || node.querySelector('[class*="styles__MatchHistoryTable-"]')) {
                const targetNode = node.matches('[class*="styles__MatchHistoryTable-"]') ? node : node.querySelector('[class*="styles__MatchHistoryTable-"]');
                if (isUniqueNode(targetNode)) {
                    targetNode.id = "match-history-table"
                    matchHistoryModule.processedNode(targetNode);
                    callback(targetNode);
                    found = true
                }
            }
        }
    })
}

moduleListener(matchHistoryModule);

