class MatchroomPopup {
    constructor() {
        this.popupElement = getHtmlResource("src/visual/tables/hover-popup-matchroom.html").cloneNode(true);
        Object.assign(this.popupElement.style, {
            display: "none",
            position: "absolute",
            transition: "opacity 0.3s ease, transform 0.3s ease",
            opacity: "0",
            pointerEvents: "none"
        });

        document.body.appendChild(this.popupElement);

        this.targetNodes = new Map();
        this.activeTarget = null;
        this.isPopupVisible = false;

        // Добавляем обработчик кликов по документу
        document.addEventListener("click", this.handleDocumentClick.bind(this));

        // Обработчик для pop-up
        this.popupElement.addEventListener("mouseleave", this.handlePopupMouseLeave.bind(this));
    }

    attachToElement(element, matchStatistic, playerId) {
        if (this.targetNodes.has(element)) return;
        this.playerId = playerId

        this.targetNodes.set(element, matchStatistic);
        const button = element.querySelector('.show-popup-button');
        const popupContainer = element.querySelector('.show-popup-button-wrap');

        button.addEventListener("mouseenter", (event) => this.handleButtonMouseEnter(event, element));
        button.addEventListener("mouseleave", this.handleButtonMouseLeave.bind(this));
        popupContainer.addEventListener("mouseleave", this.handlePopupMouseLeave.bind(this));
    }

    handleButtonMouseEnter(event, target) {
        this.activeTarget = target;
        this.updateContent(target);
        this.showPopup();
        this.positionPopup(event.target.getBoundingClientRect());
    }

    handleButtonMouseLeave(event) {
        if (!this.popupElement.contains(event.relatedTarget)) {
            this.hidePopup();
            this.activeTarget = null;
        }
    }

    handlePopupMouseLeave(event) {
        if (!this.targetNodes.has(this.activeTarget) || !this.popupElement.contains(event.relatedTarget)) {
            this.hidePopup();
            this.activeTarget = null;
        }
    }

    handleDocumentClick(event) {
        if (this.isPopupVisible && !this.popupElement.contains(event.target)) {
            this.hidePopup();
            this.activeTarget = null;
        }
    }

    positionPopup(buttonRect) {
        const popupRect = this.popupElement.getBoundingClientRect();
        const top = buttonRect.bottom + window.scrollY;
        const left = buttonRect.left + window.scrollX - popupRect.width / 2 + buttonRect.width / 2;

        this.popupElement.style.top = `${top}px`;
        this.popupElement.style.left = `${Math.max(left, 0)}px`;
    }

    showPopup() {
        this.popupElement.style.display = "block";
        setTimeout(() => {
            Object.assign(this.popupElement.style, {
                opacity: "1",
                transform: "translateY(0)",
                pointerEvents: "auto"
            });
            this.isPopupVisible = true;
        }, 50);
    }

    hidePopup() {
        Object.assign(this.popupElement.style, {
            opacity: "0",
            transform: "translateY(10px)",
            pointerEvents: "none"
        });

        setTimeout(() => {
            if (this.popupElement.style.opacity === "0") {
                this.popupElement.style.display = "none";
                this.isPopupVisible = false;
            }
        }, 300);
    }

    updateContent(target) {
        const matchStats = this.targetNodes.get(target);
        const sortByKills = (players) => players.sort((a, b) => b.player_stats["Kills"] - a.player_stats["Kills"]);

        const teams = [
            sortByKills(matchStats.rounds[0].teams[0].players),
            sortByKills(matchStats.rounds[0].teams[1].players),
        ];

        teams.forEach((team, index) => {
            const table = this.popupElement.querySelector(`#team-table-popup-${index + 1}`);
            table.innerHTML = "";

            team.forEach((playerStats) => {
                const row = document.createElement("tr");
                row.classList.add("table-row");
                const stats = playerStats["player_stats"];
                const data = [
                    playerStats.nickname,
                    stats["Kills"],
                    stats["Assists"],
                    stats["Deaths"],
                    stats["K/R Ratio"],
                    stats["K/D Ratio"],
                    stats["Headshots"],
                    stats["Headshots %"],
                    stats["MVPs"],
                    stats["ADR"],
                ];

                data.forEach((value, index) => {
                    const cell = document.createElement("td");
                    if (index === 0 && this.playerId === playerStats.player_id) {
                        cell.style.color = "rgb(255, 85, 0)"
                    }
                    cell.classList.add("table-cell");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                table.appendChild(row);
            });
        });
    }
}