g@echo off
echo Starting proxy server to bypass localtunnel password...
echo.

start /B node proxy-server.js
timeout /t 2 /nobreak >nul

echo Proxy server started on port 3001
echo Starting localtunnel on proxy port...
echo.
echo Your public URL (no password required) will appear below:
echo.

npx --yes localtunnel --port 3001

pause

