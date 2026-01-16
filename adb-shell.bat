@echo off
:: Check if adb is in PATH
where adb >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting ADB Shell...
    adb shell
    goto :eof
)

:: Check default Android Studio location
if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
    echo Starting ADB Shell from default location...
    "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" shell
    goto :eof
)

echo Error: ADB not found.
echo Please ensure Android Studio Platform Tools are installed.
echo You can install them via Android Studio: Tools ^> SDK Manager ^> SDK Tools.
pause