const baseUrl = "https://open.faceit.com/data/v4";

const playerDataCache = new LimitedMap(50);
const playerGamesDataCache = new LimitedMap(50);
const matchDataCache = new LimitedMap(20);
const matchDataStatsCache = new LimitedMap(20);
const registeredObservers = new LimitedMap(100);

async function fetchMatchStats(matchId) {
    const matchDataCached = matchDataCache.get(matchId)
    if (matchDataCached) return matchDataCached;

    const apiKey = await getApiKey();

    const url = `${baseUrl}/matches/${matchId}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        throw new Error(`Error when retrieving match statistics: ${response.statusText}`);
    }
    const newMatchData = await response.json()
    matchDataCache.set(matchId, newMatchData);

    return newMatchData;
}

async function fetchMatchStatsDetailed(matchId) {
    const matchDataCached = matchDataStatsCache.get(matchId)
    if (matchDataCached) return matchDataCached;

    const apiKey = await getApiKey();

    const url = `${baseUrl}/matches/${matchId}/stats`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        throw new Error(`Error when retrieving match statistics: ${response.statusText}`);
    }
    const newMatchData = await response.json()
    matchDataStatsCache.set(matchId, newMatchData);

    return newMatchData;
}

async function getPlayerGameStats(playerId, matchAmount = 20) {
    const cachedStats = playerGamesDataCache.get(playerId);
    if (cachedStats) return cachedStats;

    const url = `${baseUrl}/players/${playerId}/games/cs2/stats?limit=${matchAmount}`;

    const apiKey = await getApiKey();

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        error("Error when requesting player data: Error when receiving data");
    }
    const newStats = response.json();
    playerGamesDataCache.set(playerId, newStats);
    return newStats;
}

async function getPlayerStatsById(playerId) {
    const cachedStats = playerDataCache.get(playerId);
    if (cachedStats) return cachedStats;
    const url = `${baseUrl}/players/${playerId}`;

    const apiKey = await getApiKey();

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        error("Error when requesting player data: Error when receiving data");
    }

    const newStats = response.json();
    playerDataCache.set(playerId, newStats)
    return newStats;
}

async function getPlayerStatsByNickName(nickname) {
    const cachedStats = playerDataCache.get(nickname);
    if (cachedStats) return cachedStats;

    const url = `${baseUrl}/players?nickname=${encodeURIComponent(nickname)}`;
    const apiKey = await getApiKey();
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        error("Error when requesting player data: " + response.statusText);
    }

    const newStats = await response.json();
    playerDataCache.set(nickname, newStats)
    return newStats;
}

async function getApiKey() {
    const settings = await chrome.storage.sync.get(['apiKey']);
    return settings.apiKey || '';
}
