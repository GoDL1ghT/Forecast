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
        try {
            const response = await fetch(url, {
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

            const team1WinRate = await this.calculateTeamAverageWinRate(matchStats.rounds[0].teams[0]);
            const team2WinRate = await this.calculateTeamAverageWinRate(matchStats.rounds[0].teams[1]);

            if (team1WinRate === undefined || team2WinRate === undefined) {
                console.error("Невозможно получить данные о проценте побед для команд.");
                return;
            }

            this.displayWinRates(team1WinRate, team2WinRate);
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

    displayWinRates(team1WinRate, team2WinRate) {
        // Ищем целевой элемент
        // let info = document.querySelector('[class*="Overview__Column"][name="info"]');
        let selector = "#MATCHROOM-OVERVIEW-qICZPRMrBnzXTDOQvdEMo > div.Overview__BrandingContainer-sc-1aec568f-1.hdvPZE > div > div.Overview__Column-sc-1aec568f-4.caCwWw > div.Overview__Stack-sc-1aec568f-5.jPAgTv"
        let info = document.querySelector(selector);

        // Проверяем, найден ли элемент
        if (info == null) {
            console.warn("Целевой элемент не найден. Проверьте, существует ли он на странице.");
            return; // Прерываем выполнение, если элемент не найден
        }

        const winRateElement = document.createElement('div');
        winRateElement.style.marginTop = '10px';
        winRateElement.innerHTML = `
        <h4>Проценты побед:</h4>
        <p>Команда 1: ${team1WinRate.teamAverageWinRate.toFixed(2)}% (Игры: ${team1WinRate.totalGames})</p>
        <p>Команда 2: ${team2WinRate.teamAverageWinRate.toFixed(2)}% (Игры: ${team2WinRate.totalGames})</p>
    `;

        // Теперь безопасно добавляем элемент в целевой элемент
        info.appendChild(winRateElement);
        console.log("Данные успешно добавлены к элементу.");
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
        const matchId = await getMatchIdFromActiveTab();

        if (!matchId) {
            document.getElementById("matchStats").innerText = "Не удалось получить ID матча. Убедитесь, что вы на странице матча.";
            return;
        }

        const calculator = new TeamWinRateCalculator(apiKey);
        try {
            setTimeout(() => {
                calculator.getMatchWinRates(matchId);
            }, 3000);

        } catch (error) {
            document.getElementById("matchStats").innerText = "Ошибка при получении статистики матча: " + error.message;
        }
    } else {
        document.getElementById("matchStats").innerText = "Пожалуйста, введите ваш API Key в настройках!";
    }
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
    await initialize();

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
