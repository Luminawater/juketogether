# Get localtunnel password
Write-Host "Getting localtunnel password..." -ForegroundColor Green
try {
    $password = (Invoke-WebRequest -Uri 'https://loca.lt/mytunnelpassword' -UseBasicParsing).Content.Trim()
    Write-Host ""
    Write-Host "Your Tunnel Password: " -ForegroundColor Cyan -NoNewline
    Write-Host $password -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host ""
    Write-Host "Share this password along with your localtunnel URL!" -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host "Error getting password: $_" -ForegroundColor Red
}

