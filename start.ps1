# Simple startup script - everything in one window
Write-Host "=== SoundCloud Jukebox ===" -ForegroundColor Cyan
Write-Host ""

# Kill any existing processes
Write-Host "Cleaning up..." -ForegroundColor Yellow
Get-Process -Name node,ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Check if ngrok is configured
$ngrokConfig = "$env:LOCALAPPDATA\ngrok\ngrok.yml"
if (-not (Test-Path $ngrokConfig)) {
    Write-Host "⚠️  ngrok not configured!" -ForegroundColor Yellow
    Write-Host "Run: npx --yes ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Starting server only (no tunnel)..." -ForegroundColor Yellow
    Write-Host ""
    node server.js
    exit
}

# Start server in background with auto-reload (nodemon)
Write-Host "Starting server on port 8080 (with auto-reload)..." -ForegroundColor Green
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npx --yes nodemon server.js
}

Start-Sleep -Seconds 2

# Start ngrok in foreground (shows URL)
Write-Host "Starting ngrok tunnel..." -ForegroundColor Green
Write-Host "Your public URL will appear below (NO PASSWORD!):" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop everything" -ForegroundColor Cyan
Write-Host ""

# Start ngrok (this will run in foreground and show the URL)
npx --yes ngrok http 8080

# Cleanup when ngrok stops
Write-Host ""
Write-Host "Stopping server..." -ForegroundColor Yellow
Stop-Job $serverJob
Remove-Job $serverJob

