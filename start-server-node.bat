@echo off
echo Checking for npx...
where npx >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js/npm not found. Please install Node.js or use Python server instead.
    pause
    exit /b
)

echo Starting local web server for FretForge...
echo.
echo Server will run at: http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
npx http-server -p 8000
