@echo off
setlocal
set REPO_URL=https://github.com/GoDL1ghT/Forecast.git
set TEMP_DIR=temp_Forecast
if exist "%TEMP_DIR%" (
    rmdir /s /q "%TEMP_DIR%"
)
git clone %REPO_URL% "%TEMP_DIR%"
if not exist "src" (
    mkdir "src"
)
if not exist "_locales" (
    mkdir "_locales"
)
xcopy "%TEMP_DIR%\src\*" "src\" /E /Y
xcopy "%TEMP_DIR%\_locales\*" "_locales\" /E /Y
copy /Y "%TEMP_DIR%\manifest.json" "manifest.json"
rmdir /s /q "%TEMP_DIR%"
endlocal