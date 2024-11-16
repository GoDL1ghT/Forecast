const MAX_REQUESTS_PER_SECOND = 20;
const requestQueue = [];
let activeRequests = 0;
const matchIds = [];
const matchDetailedDatas = new Map();
const loadingMatches = new Set();
const nodesToBatch = [];
const matchNodesByMatchStats = [];

class MatchNodeByMatchStats {
    constructor(node, matchId, index) {
        this.node = node;
        this.matchId = matchId;
        this.matchStats = null;
        this.rounds = 0;
        this.score = "";
        this.isWin = false;
        this.index = index
        this.setupMatchCounterArrow()
    }

    async loadMatchStats(playerId) {
        if (!matchDetailedDatas.has(this.matchId)) {
            await processQueue(() => getDetailedMatchData(this.matchId));
        }
        const detailedMatchInfo = matchDetailedDatas.get(this.matchId);
        if (!detailedMatchInfo) return;

        const {player: stats, team} = findPlayerInTeamById(detailedMatchInfo.rounds[0].teams, playerId);
        this.matchStats = stats?.["player_stats"];
        this.rounds = parseInt(detailedMatchInfo.rounds[0].round_stats["Rounds"], 10);
        this.score = detailedMatchInfo.rounds[0].round_stats["Score"].replace(/\s+/g, '');
        this.isWin = team["team_stats"]["Team Win"] === "1";

        this.setupStatsToNode();
    }

    setupStatsToNode() {
        if (!this.matchStats) return;
        const {
            "Kills": k,
            "Assists": a,
            "Deaths": d,
            "ADR": adr,
            "K/D Ratio": kd,
            "K/R Ratio": kr,
            "Entry Count": entryCount,
            "First Kills": firstKills
        } = this.matchStats;
        const entryImpact = Math.min(parseInt(entryCount, 10), parseInt(firstKills, 10));
        const rounds = this.rounds;
        const kast = ((parseInt(k, 10) + parseInt(a, 10) + entryImpact) / rounds) * 100;
        const impact = (parseInt(k, 10) + 0.5 * parseInt(a, 10) - entryImpact * 1.5) / rounds;

        const rating = (0.0073 * kast + 0.3591 * parseFloat(kr) - 0.5329 * (parseInt(d, 10) / rounds) + 0.2372 * impact + 0.0032 * parseInt(adr, 10) + 0.1587).toFixed(2);
        insertStatsIntoNode(this.node, this.score, rating, k, d, kd, kr, adr, this.isWin);
    }

    setupMatchCounterArrow() {
        let matchNumber = (this.index + 1)
        if (matchNumber % 20 !== 0) return
        const arrow = getHtmlResource("src/visual/tables/match-counter-arrow.html").cloneNode(true);
        for (let child of this.node.children) {
            // Добавляем псевдо-элемент для каждого дочернего элемента
            child.style.position = "relative";  // Убедитесь, что у элемента есть относительное позиционирование
            child.style.paddingBottom = "1px";  // Добавляем пространство для псевдо-элемента

            // Создаем и добавляем псевдо-элемент с бордером
            const borderElement = document.createElement("div");
            borderElement.style.position = "absolute";
            borderElement.style.bottom = "-1px";  // Сдвигаем на 1px ниже
            borderElement.style.left = "0";
            borderElement.style.width = "100%";
            borderElement.style.height = "1px";
            borderElement.style.backgroundColor = "rgb(255, 85, 0)";  // Цвет бордера

            // Добавляем псевдо-элемент в дочерний элемент
            child.appendChild(borderElement);
        }

        this.node.insertAdjacentElement("afterend", arrow)
        arrow.querySelector("[class=square]").innerText = matchNumber
    }
}

function insertStatsIntoNode(root, score, rating, k, d, kd, kr, adr, isWin) {
    const tableTemplate = getHtmlResource("src/visual/tables/matchscore.html").cloneNode(true);
    const fourthNode = root?.children[3];
    matchHistoryModule.removalNode(tableTemplate);
    insertRow(tableTemplate, score, rating, k, d, kd, kr, adr, isWin);
    tableTemplate.appendToAndHide(fourthNode.querySelector("span"));
}

function insertRow(node, score, rating, k, d, kd, kr, adr, isWin) {
    const table = node.querySelector('tbody');
    const newRow = table.insertRow();
    const green = "rgb(61,255,108)", red = "rgb(255, 0, 43)", white = "rgb(255, 255, 255)";

    const createColoredDiv = (text, condition, isSlash = false) => {
        const div = document.createElement("span");
        div.style.color = isSlash ? white : (condition ? green : red);
        if (condition) div.style.fontWeight = "bold";
        div.innerHTML = text;
        return div;
    };

    const createCompositeCell = (texts) => {
        const container = document.createElement("div");
        texts.forEach(({
                           text,
                           condition,
                           isSlash
                       }) => container.appendChild(createColoredDiv(text, condition, isSlash)));
        return container;
    };

    let [scorePart1, scorePart2] = score.split("/");
    newRow.insertCell(0).appendChild(createCompositeCell([{text: scorePart1, condition: isWin}, {
        text: "/",
        isSlash: true
    }, {text: scorePart2, condition: isWin}]));
    newRow.insertCell(1).appendChild(createColoredDiv(rating, rating >= 1.0));
    newRow.insertCell(2).appendChild(createCompositeCell([{text: k, condition: kd >= 1.0}, {
        text: "/",
        isSlash: true
    }, {text: d, condition: kd >= 1.0}]));
    newRow.insertCell(3).appendChild(createCompositeCell([{text: kd, condition: kd >= 1.0}, {
        text: "/",
        isSlash: true
    }, {text: kr, condition: kr >= 0.65}]));
    newRow.insertCell(4).appendChild(createColoredDiv(adr, adr >= 65));
}

const matchHistoryModule = new Module("matchhistory", async () => {
    if (!(await isExtensionEnabled()) || !(await isSettingEnabled("matchhistory"))) return;

    const playerId = (await getPlayerStatsByNickName(extractPlayerNick())).player_id;
    matchHistoryModule.playerId = playerId;
    await loadAllPlayerMatches(playerId);

    let ended = false;
    await matchHistoryModule.doAfterAllNodeAppearPack("tr[class*='styles__MatchHistoryTableRow']:not([id*='table-row-id'])", async (nodes) => {
        if (ended) return;
        for (let node of nodes) {
            const index = Array.from(node.parentNode.children).filter(child => child.tagName === 'TR').indexOf(node) - 1;
            if (node.id === `table-row-id-${index}`) continue;
            node.id = `table-row-id-${index}`;
            if (index === 299) ended = true;
            if (index === -1) continue;
            nodesToBatch.push(new MatchNodeByMatchStats(node, matchIds[index], index));
        }
    });

    matchHistoryModule.every(500, async () => {
        const batch = [...nodesToBatch];
        nodesToBatch.length = 0;
        await Promise.all(batch.map(matchNode => processQueue(() => matchNode.loadMatchStats(playerId))));
    });
}, async () => {
    matchNodesByMatchStats.forEach(data => data.node.remove());
    matchNodesByMatchStats.length = 0;
    matchIds.length = 0;
});

async function getDetailedMatchData(matchId) {
    if (matchDetailedDatas.has(matchId)) return matchDetailedDatas.get(matchId);
    if (loadingMatches.has(matchId)) return;

    loadingMatches.add(matchId);
    try {
        const data = await fetchMatchStatsDetailed(matchId);
        matchDetailedDatas.set(matchId, data);
    } catch (error) {
        console.error(error);
    } finally {
        loadingMatches.delete(matchId);
    }
    return matchDetailedDatas.get(matchId);
}

function processQueue(requestFn) {
    return new Promise(resolve => {
        if (activeRequests >= MAX_REQUESTS_PER_SECOND) {
            requestQueue.push(() => requestFn?.().then(resolve));
        } else {
            activeRequests++;
            requestFn?.().then(resolve).finally(() => {
                activeRequests--;
                if (requestQueue.length) {
                    let nextRequest = requestQueue.shift();
                    setTimeout(() => processQueue(nextRequest), 1000 / MAX_REQUESTS_PER_SECOND);
                }
            });
        }
    });
}

async function loadAllPlayerMatches(playerId) {
    const results = await Promise.all([0, 100, 200].map(from => loadPlayerMatches(playerId, from)));
    results.flat().forEach(id => matchIds.push(id));
}

async function loadPlayerMatches(playerId, from) {
    const playerGameDatas = await getPlayerGameStats(playerId, extractGameType(), 100, from);
    return playerGameDatas.items.map(item => item.stats["Match Id"]);
}

function findPlayerInTeamById(teams, playerId) {
    for (const team of teams) {
        const player = team.players.find(player => player.player_id === playerId);
        if (player) return {team, player};
    }
    return {};
}

moduleListener(matchHistoryModule);