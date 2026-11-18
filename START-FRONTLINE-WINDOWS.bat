@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 20+ is nodig. Installeer van https://nodejs.org/
  pause
  exit /b 1
)
echo FRONTLINE V18 server start op http://localhost:3000
echo Dit venster open laten tijdens multiplayer.
start "Frontline Browser" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
npm start
pause
