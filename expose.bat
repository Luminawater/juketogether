@echo off
echo Starting tunnel for SoundCloud Jukebox on port 3000...
echo.
echo Choose a method:
echo 1. cloudflared (no account/password needed - RECOMMENDED)
echo 2. ngrok (requires account, but more reliable)
echo 3. localtunnel (no account, but requires password)
echo.
set /p choice="Enter choice (1-3, default: 1): "

if "%choice%"=="1" (
    echo Starting cloudflared (no password required)...
    echo Your public URL will be shown below:
    npx --yes cloudflared tunnel --url http://localhost:3000
) else if "%choice%"=="2" (
    echo Starting ngrok...
    echo Your public URL will be shown below:
    npx --yes ngrok http 3000
) else if "%choice%"=="3" (
    echo Starting localtunnel (password required)...
    echo Your public URL will be shown below:
    echo Get password with: curl https://loca.lt/mytunnelpassword
    npx --yes localtunnel --port 3000
) else (
    echo Starting cloudflared by default (no password required)...
    npx --yes cloudflared tunnel --url http://localhost:3000
)

pause

