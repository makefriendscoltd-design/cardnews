@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Cardnews Server - keep open
where node >nul 2>nul
if errorlevel 1 goto NONODE
echo Starting Cardnews server... the browser will open automatically.
echo Keep this window OPEN. Stop with Ctrl + C.
echo.
node "%~dp0tools\server.js"
echo.
echo [Server stopped] Check the messages above.
pause
exit /b

:NONODE
echo.
echo [ERROR] Node.js is not installed (or not in PATH).
echo Install the LTS version from https://nodejs.org then run start.bat again.
echo.
pause
exit /b
