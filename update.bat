@echo off
setlocal
set BASE_URL=https://raw.githubusercontent.com/GoDL1ghT/Forecast/master
set DEST_DIR=%cd%

if exist "src" rmdir /s /q "src"
if exist "_locales" rmdir /s /q "_locales"

mkdir "src\faceit\api" "src\faceit\history" "src\faceit\ranking" "src\faceit\resources" "src\faceit\room" "src\icons" "src\listener" "src\module" "src\utils" "src\visual\tables\levels" "_locales\en"

curl -L -o src\faceit\api\api.js %BASE_URL%/src/faceit/api/api.js
curl -L -o src\faceit\history\matchhistory.js %BASE_URL%/src/faceit/history/matchhistory.js
curl -L -o src\faceit\ranking\levels.js %BASE_URL%/src/faceit/ranking/levels.js
curl -L -o src\faceit\ranking\ranking.js %BASE_URL%/src/faceit/ranking/ranking.js
curl -L -o src\faceit\resources\resources.js %BASE_URL%/src/faceit/resources/resources.js
curl -L -o src\faceit\room\matchroom.js %BASE_URL%/src/faceit/room/matchroom.js
curl -L -o src\icons\logo.png %BASE_URL%/src/icons/logo.png
curl -L -o src\listener\background.js %BASE_URL%/src/listener/background.js
curl -L -o src\module\module.js %BASE_URL%/src/module/module.js
curl -L -o src\utils\utils.js %BASE_URL%/src/utils/utils.js
curl -L -o src\visual\tables\levels\level1.html %BASE_URL%/src/visual/tables/levels/level1.html
curl -L -o src\visual\tables\levels\level2.html %BASE_URL%/src/visual/tables/levels/level2.html
curl -L -o src\visual\tables\levels\level3.html %BASE_URL%/src/visual/tables/levels/level3.html
curl -L -o src\visual\tables\levels\level4.html %BASE_URL%/src/visual/tables/levels/level4.html
curl -L -o src\visual\tables\levels\level5.html %BASE_URL%/src/visual/tables/levels/level5.html
curl -L -o src\visual\tables\levels\level6.html %BASE_URL%/src/visual/tables/levels/level6.html
curl -L -o src\visual\tables\levels\level7.html %BASE_URL%/src/visual/tables/levels/level7.html
curl -L -o src\visual\tables\levels\level8.html %BASE_URL%/src/visual/tables/levels/level8.html
curl -L -o src\visual\tables\levels\level9.html %BASE_URL%/src/visual/tables/levels/level9.html
curl -L -o src\visual\tables\levels\level10.html %BASE_URL%/src/visual/tables/levels/level10.html
curl -L -o src\visual\tables\levels\level11.html %BASE_URL%/src/visual/tables/levels/level11.html
curl -L -o src\visual\tables\levels\level12.html %BASE_URL%/src/visual/tables/levels/level12.html
curl -L -o src\visual\tables\levels\level13.html %BASE_URL%/src/visual/tables/levels/level13.html
curl -L -o src\visual\tables\levels\level14.html %BASE_URL%/src/visual/tables/levels/level14.html
curl -L -o src\visual\tables\levels\level15.html %BASE_URL%/src/visual/tables/levels/level15.html
curl -L -o src\visual\tables\levels\level16.html %BASE_URL%/src/visual/tables/levels/level16.html
curl -L -o src\visual\tables\levels\level17.html %BASE_URL%/src/visual/tables/levels/level17.html
curl -L -o src\visual\tables\levels\level18.html %BASE_URL%/src/visual/tables/levels/level18.html
curl -L -o src\visual\tables\levels\level19.html %BASE_URL%/src/visual/tables/levels/level19.html
curl -L -o src\visual\tables\levels\level20.html %BASE_URL%/src/visual/tables/levels/level20.html
curl -L -o src\visual\tables\elo-progress-bar.html %BASE_URL%/src/visual/tables/elo-progress-bar.html
curl -L -o src\visual\tables\level-progress-table.html %BASE_URL%/src/visual/tables/level-progress-table.html
curl -L -o src\visual\tables\matchscore.html %BASE_URL%/src/visual/tables/matchscore.html
curl -L -o src\visual\tables\player.html %BASE_URL%/src/visual/tables/player.html
curl -L -o src\visual\tables\team.html %BASE_URL%/src/visual/tables/team.html
curl -L -o src\visual\popup.html %BASE_URL%/src/visual/popup.html
curl -L -o src\visual\popup.js %BASE_URL%/src/visual/popup.js
curl -L -o src\visual\styles.css %BASE_URL%/src/visual/styles.css
curl -L -o _locales\en\messages.json %BASE_URL%/_locales/en/messages.json
curl -L -o manifest.json %BASE_URL%/manifest.json

echo Загрузка завершена.

endlocal