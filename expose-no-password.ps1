# Quick script to expose without password using cloudflared
Write-Host "Starting cloudflared tunnel (no password required)..." -ForegroundColor Green
Write-Host "Your public URL will be shown below:" -ForegroundColor Yellow
Write-Host ""
npx --yes cloudflared tunnel --url http://localhost:3000

