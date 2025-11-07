# Cloudflared with certificate verification disabled (for corporate networks)
$env:CLOUDFLARED_SKIP_VERIFY = "true"
Write-Host "Starting cloudflared tunnel (certificate verification disabled)..." -ForegroundColor Green
Write-Host "Your public URL will appear below:" -ForegroundColor Yellow
Write-Host ""
npx --yes cloudflared tunnel --url http://localhost:3000

