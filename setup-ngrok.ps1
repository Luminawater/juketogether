# Setup ngrok for password-free tunneling
Write-Host "=== ngrok Setup (No Password Required) ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Sign up for a free ngrok account" -ForegroundColor Yellow
Write-Host "Visit: https://dashboard.ngrok.com/signup" -ForegroundColor Green
Write-Host ""

$hasToken = Read-Host "Do you already have an ngrok authtoken? (y/n)"

if ($hasToken -eq 'y' -or $hasToken -eq 'Y') {
    $token = Read-Host "Enter your ngrok authtoken"
    
    Write-Host ""
    Write-Host "Configuring ngrok..." -ForegroundColor Yellow
    npx --yes ngrok config add-authtoken $token
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ ngrok configured successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Starting ngrok tunnel..." -ForegroundColor Yellow
        Write-Host "Your public URL (no password!) will appear below:" -ForegroundColor Green
        Write-Host ""
        npx --yes ngrok http 8080
    } else {
        Write-Host "❌ Failed to configure ngrok. Please check your token." -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "1. Sign up at https://dashboard.ngrok.com/signup" -ForegroundColor Cyan
    Write-Host "2. Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Cyan
    Write-Host "3. Run this script again and enter your token" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or run manually:" -ForegroundColor Yellow
    Write-Host "  ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor White
    Write-Host "  npx --yes ngrok http 8080" -ForegroundColor White
}

