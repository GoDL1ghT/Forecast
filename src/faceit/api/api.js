const baseUrl = "https://open.faceit.com/data/v4";

const playerDataCache = new Map();
const playerGamesDataCache = new Map();
const competitionCache = new Map()
const matchDataCache = new Map();
const matchDataStatsCache = new Map();

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

async function getPlayerGameStats(playerId, game, matchAmount = 20) {
    return await fetchData(
        playerGamesDataCache,
        playerId,
        `${baseUrl}/players/${playerId}/games/${game}/stats?limit=${matchAmount}`,
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
    const nick = window.location.href.match(/players\/([a-zA-Z0-9-_]+)/);
    return nick ? nick[1] : null;
}

function extractGameType() {
    const match = window.location.href.match(/stats\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}


async function getApiKey() {
    let apiKey = getCookie("forecast-api-key")
    if (!apiKey) {
        let data = await fetch("https://raw.githubusercontent.com/GoDL1ghT/Forecast/refs/heads/master/api-key")
        apiKey = await data.text()
        setCookie("forecast-api-key", apiKey, 5)
    }
    return apiKey
}

function setCookie(name, value, minutes) {
    const date = new Date();
    date.setTime(date.getTime() + (minutes * 60 * 1000)); // Устанавливаем время истечения в миллисекундах
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/;domain=.faceit.com;secure";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return decodeURIComponent(cookie.substring(nameEQ.length));
        }
    }
    return null;
}

