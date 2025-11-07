@echo off
echo Starting cloudflared tunnel (no password required)...
echo Your public URL will be shown below:
echo.
npx --yes cloudflared tunnel --url http://localhost:3000
pause

