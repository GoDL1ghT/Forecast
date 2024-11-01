const baseUrl = "https://open.faceit.com/data/v4";

const playerDataCache = new LimitedMap(50);
const playerGamesDataCache = new LimitedMap(50);
const matchDataCache = new LimitedMap(20);
const matchDataStatsCache = new LimitedMap(20);
const registeredObservers = new LimitedMap(100);

async function fetchData(cache, key, url, errorMsg) {
    const cachedData = cache.get(key);
    if (cachedData) return cachedData;

    const apiKey = await getApiKey();
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        throw new Error(`${errorMsg}: ${response.statusText}`);
    }

    const newData = await response.json();
    cache.set(key, newData);
    return newData;
}

async function fetchMatchStats(matchId) {
    return fetchData(
        matchDataCache,
        matchId,
        `${baseUrl}/matches/${matchId}`,
        "Error when retrieving match statistics"
    );
}

async function fetchMatchStatsDetailed(matchId) {
    return fetchData(
        matchDataStatsCache,
        matchId,
        `${baseUrl}/matches/${matchId}/stats`,
        "Error when retrieving detailed match statistics"
    );
}

async function getPlayerGameStats(playerId, matchAmount = 20) {
    return fetchData(
        playerGamesDataCache,
        playerId,
        `${baseUrl}/players/${playerId}/games/cs2/stats?limit=${matchAmount}`,
        "Error when requesting player game data"
    );
}

async function getPlayerStatsById(playerId) {
    return fetchData(
        playerDataCache,
        playerId,
        `${baseUrl}/players/${playerId}`,
        "Error when requesting player data by ID"
    );
}

async function getPlayerStatsByNickName(nickname) {
    return fetchData(
        playerDataCache,
        nickname,
        `${baseUrl}/players?nickname=${encodeURIComponent(nickname)}`,
        "Error when requesting player data by nickname"
    );
}


function extractPlayerNick() {
    const nick = window.location.href.match(/players\/([a-zA-Z0-9-]+)/);
    return nick ? nick[1] : null;
}

function extractGameType() {
    const match = window.location.href.match(/stats\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}


async function getApiKey() {
    const settings = await chrome.storage.sync.get(['apiKey']);
    return settings.apiKey || '';
}
