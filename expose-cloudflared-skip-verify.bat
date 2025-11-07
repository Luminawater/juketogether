@echo off
set CLOUDFLARED_SKIP_VERIFY=true
echo Starting cloudflared tunnel (certificate verification disabled)...
echo Your public URL will appear below:
echo.
npx --yes cloudflared tunnel --url http://localhost:3000
pause

