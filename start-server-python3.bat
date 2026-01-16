@echo off
echo Starting local web server for FretForge...
echo.
echo Server will run at: http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
python3 -m http.server 8000
