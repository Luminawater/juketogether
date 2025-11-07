@echo off
echo === SoundCloud Jukebox ===
echo.

echo Cleaning up...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ngrok.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo Starting server on port 8080 (with auto-reload)...
start /B npx --yes nodemon server.js
timeout /t 2 /nobreak >nul

echo Starting ngrok tunnel...
echo Your public URL will appear below (NO PASSWORD!):
echo.
echo Press Ctrl+C to stop everything
echo.

npx --yes ngrok http 8080

echo.
echo Stopping server...
taskkill /F /IM node.exe >nul 2>&1

pause

