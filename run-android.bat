@echo off
echo Building web assets...
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%

echo Syncing with Capacitor...
call npx cap sync
if %errorlevel% neq 0 exit /b %errorlevel%

echo Running on Android...
call npx cap run android
