async function exec(args, func) {
    chrome.scripting.executeScript({
        target: {tabId: (await chrome.tabs.query({active: true, currentWindow: true}))[0].id},
        func: func,
        args: args
    });
}

class TeamWinRateCalculator {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://open.faceit.com/data/v4";
    }

    async fetchMatchStats(matchId) {
        const url = `${this.baseUrl}/matches/${matchId}/stats`;
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

    async fetchPlayerStats(playerId) {
        const url = `${this.baseUrl}/players/${playerId}/games/cs2/stats`;
        const params = new URLSearchParams({ limit: 100 });

        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                const errorDetails = await response.json();
                console.error(`Ошибка при получении статистики игрока с ID ${playerId}: ${errorDetails.message}`);
                throw new Error(`Ошибка: ${errorDetails.message}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Ошибка при выполнении запроса для игрока с ID ${playerId}: ${error.message}`);
        }
    }


    async getMatchWinRates(matchId) {
        if (!matchId) {
            throw new Error("Match ID is not provided.");
        }

        try {
            const matchStats = await this.fetchMatchStats(matchId);

            if (!matchStats || !matchStats.rounds || !Array.isArray(matchStats.rounds)) {
                console.error("Invalid match stats structure:", matchStats);
                throw new Error("Invalid match stats structure.");
            }

            await this.displayWinRates(matchStats);
        } catch (error) {
            console.error("Ошибка при получении статистики матча:", error.message);
        }
    }

    async calculateTeamAverageWinRate(teamStats) {
        const totalWinRates = {};
        const totalGames = {};

        if (!teamStats || !teamStats.players || !Array.isArray(teamStats.players)) {
            console.warn("Команда не найдена или не содержит игроков:", teamStats);
            return totalWinRates; // Возвращаем пустой объект, если команда не найдена
        }

        const playerStatsPromises = teamStats.players.map(async (player) => {
            try {
                return await this.fetchPlayerStats(player.player_id);
            } catch (error) {
                console.warn(`Не удалось получить статистику для игрока с ID ${player.player_id}: ${error.message}`);
                return null; // Возвращаем null в случае ошибки
            }
        });

        const playerStatsArray = await Promise.all(playerStatsPromises);

        for (const playerStats of playerStatsArray) {
            if (!playerStats) continue; // Пропускаем, если данных нет

            if (!playerStats.items || !Array.isArray(playerStats.items)) {
                console.warn("Нет данных о матчах для игрока:", playerStats);
                continue; // Пропускаем, если данных нет
            }

            let wins = 0;
            let games = playerStats.items.length;

            for (const match of playerStats.items) {
                if (match.winner === playerStats.player_id) {
                    wins++;
                }
            }

            totalWinRates[playerStats.player_id] = (wins / games) * 100; // Процент побед
            totalGames[playerStats.player_id] = games; // Общее количество игр
        }

        const totalWinRate = Object.values(totalWinRates).reduce((acc, rate) => acc + rate, 0);
        const teamAverageWinRate = totalWinRate / Object.keys(totalWinRates).length;

        return {
            teamAverageWinRate,
            totalGames: Object.values(totalGames).reduce((a, b) => a + b, 0) // Общее количество игр по всем игрокам
        };
    }

    async displayWinRates(matchStats) {
        exec([matchStats], (matchStats) => {
            console.log(matchStats);
        })

        // exec(
        //     [team1WinRate, team2WinRate],
        //     (team1WinRate, team2WinRate) => {
        //         let info = document.querySelector('[class*="Overview__Column"][name="info"]');
        //
        //         if (info == null) {
        //             console.warn("Целевой элемент не найден. Проверьте, существует ли он на странице.");
        //             return;
        //         }
        //
        //         const winRateElement = document.createElement('div');
        //         winRateElement.style.marginTop = '10px';
        //         winRateElement.innerHTML = `
        //             <h4>Проценты побед:</h4>
        //             <p>Команда 1: ${team1WinRate.teamAverageWinRate.toFixed(2)}% (Игры: ${team1WinRate.totalGames})</p>
        //             <p>Команда 2: ${team2WinRate.teamAverageWinRate.toFixed(2)}% (Игры: ${team2WinRate.totalGames})</p>
        //         `;
        //
        //         info.appendChild(winRateElement);
        //         console.log("Данные успешно добавлены к элементу.");
        //     }
        // )
    }
}

// Получение API ключа из настроек
async function getApiKey() {
    const settings = await chrome.storage.sync.get(['apiKey']);
    return settings.apiKey || '';
}

// Проверка, включено ли расширение
async function isExtensionEnabled() {
    const settings = await chrome.storage.sync.get(['isEnabled']);
    return settings.isEnabled !== undefined ? settings.isEnabled : true;
}

// Получение matchId с активной вкладки
async function getMatchIdFromActiveTab() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const url = new URL(tab.url);
    return url.pathname.split('/').pop() || null;
}

// Инициализация и загрузка настроек
async function initialize() {
    console.log("Initialization...");
    const enabled = await isExtensionEnabled();
    const toggleExtension = document.getElementById('toggleExtension');

    if (toggleExtension) {
        toggleExtension.checked = enabled;
    } else {
        console.error("Toggle switch not found!");
    }

    if (!enabled) {
        document.getElementById("matchStats").innerText = "Расширение отключено!";
        return;
    }

    const apiKey = await getApiKey();

    if (apiKey) {
        const matchId = window.location.href.split("/").pop();//await getMatchIdFromActiveTab();

        if (!matchId) {
            document.getElementById("matchStats").innerText = "Не удалось получить ID матча. Убедитесь, что вы на странице матча.";
            return;
        }

        const calculator = new TeamWinRateCalculator(apiKey);

        try {
            await calculator.getMatchWinRates(matchId);
        } catch (error) {
            document.getElementById("matchStats").innerText = "Ошибка при получении статистики матча: " + error.message;
        }
    } else {
        document.getElementById("matchStats").innerText = "Пожалуйста, введите ваш API Key в настройках!";
    }
    console.log("Initialized");
}

// Загрузка настроек при открытии popup
async function loadSettings() {
    const settings = await chrome.storage.sync.get(['apiKey', 'isEnabled']);
    const apiKeyInput = document.getElementById('apiKeyInput');

    if (apiKeyInput) {
        apiKeyInput.value = settings.apiKey || '';
    } else {
        console.error("API Key input not found!");
    }

    const toggleExtension = document.getElementById('toggleExtension');
    if (toggleExtension) {
        toggleExtension.checked = settings.isEnabled !== undefined ? settings.isEnabled : true;
    } else {
        console.error("Toggle switch not found during load settings!");
    }
}

// Сохранение настроек
async function saveSettings() {
    const apiKey = document.getElementById('apiKeyInput').value;
    const isEnabled = document.getElementById('toggleExtension').checked;

    chrome.storage.sync.set({apiKey, isEnabled}, () => {
        console.log('Настройки сохранены:', {apiKey, isEnabled});
        showSaveMessage();
    });
}

// Отображение сообщения о сохранении
function showSaveMessage() {
    const saveMessage = document.getElementById('saveMessage');
    saveMessage.classList.add('show');

    setTimeout(() => {
        saveMessage.classList.remove('show');
    }, 2000);
}

// Обработчик нажатия кнопки сохранения
document.getElementById('saveSettings').addEventListener('click', (event) => {
    saveSettings();
    event.currentTarget.classList.add('active');

    setTimeout(() => {
        event.currentTarget.classList.remove('active');
    }, 200);
});

// Загрузка настроек при загрузке документа
document.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
    // await initialize(); Чтобы не перепрогружалось при нажатии на расширение

    // Слушатель для переключателя
    const toggleExtension = document.getElementById('toggleExtension');
    if (toggleExtension) {
        toggleExtension.addEventListener('change', function () {
            const isEnabled = this.checked;
            chrome.storage.sync.set({isEnabled}, () => {
                console.log('Расширение включено:', isEnabled);
            });
        });
    }
});
