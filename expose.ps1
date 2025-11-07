# Script to expose SoundCloud Jukebox to the internet
# Choose one of the methods below

Write-Host "Starting tunnel for SoundCloud Jukebox on port 3000..." -ForegroundColor Green
Write-Host ""
Write-Host "Choose a method:" -ForegroundColor Yellow
Write-Host "1. cloudflared (no account/password needed - RECOMMENDED)" -ForegroundColor Green
Write-Host "2. ngrok (requires account, but more reliable)"
Write-Host "3. localtunnel (no account, but requires password)"
Write-Host ""

$choice = Read-Host "Enter choice (1-3, default: 1)"

switch ($choice) {
    "1" {
        Write-Host "Starting cloudflared (no password required)..." -ForegroundColor Cyan
        Write-Host "Your public URL will be shown below:" -ForegroundColor Yellow
        npx --yes cloudflared tunnel --url http://localhost:3000
    }
    "2" {
        Write-Host "Starting ngrok..." -ForegroundColor Cyan
        Write-Host "Your public URL will be shown below:" -ForegroundColor Yellow
        npx --yes ngrok http 3000
    }
    "3" {
        Write-Host "Starting localtunnel (password required)..." -ForegroundColor Cyan
        Write-Host "Getting tunnel password..." -ForegroundColor Yellow
        try {
            $password = (Invoke-WebRequest -Uri 'https://loca.lt/mytunnelpassword' -UseBasicParsing).Content.Trim()
            Write-Host ""
            Write-Host "Tunnel Password: $password" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Share both the URL and password with visitors!" -ForegroundColor Yellow
            Write-Host ""
        } catch {
            Write-Host "Could not get password automatically. Get it manually with:" -ForegroundColor Yellow
            Write-Host "curl https://loca.lt/mytunnelpassword" -ForegroundColor Yellow
            Write-Host ""
        }
        Write-Host "Your public URL will be shown below:" -ForegroundColor Yellow
        Write-Host ""
        npx --yes localtunnel --port 3000
    }
    default {
        Write-Host "Starting cloudflared by default (no password required)..." -ForegroundColor Green
        npx --yes cloudflared tunnel --url http://localhost:3000
    }
}

