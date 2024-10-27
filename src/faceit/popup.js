

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

async function popupLoad() {
    const enabled = await isExtensionEnabled();
    const toggleExtension = document.getElementById('toggleExtension');

    if (toggleExtension) {
        toggleExtension.checked = enabled;
    } else {
        console.error("Toggle switch not found!");
    }

    if (!enabled) {
        document.getElementById("matchStats").innerText = "Расширение отключено!";
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
    await popupLoad();

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
