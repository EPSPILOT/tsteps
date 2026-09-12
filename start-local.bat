@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22+ is required.
  pause
  exit /b 1
)
echo Starting EPS PILOT on http://localhost:3000
echo Close this window to stop the server.
node server.js
pause
