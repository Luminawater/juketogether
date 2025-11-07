# Start proxy server and localtunnel to bypass password
Write-Host "Starting proxy server to bypass localtunnel password..." -ForegroundColor Green
Write-Host ""

# Start proxy server in background
$proxyJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    node proxy-server.js
}

Start-Sleep -Seconds 2

Write-Host "Proxy server started on port 3001" -ForegroundColor Cyan
Write-Host "Starting localtunnel on proxy port..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Your public URL (no password required) will appear below:" -ForegroundColor Green
Write-Host ""

# Start localtunnel pointing to proxy
npx --yes localtunnel --port 3001

# Cleanup
Stop-Job $proxyJob
Remove-Job $proxyJob

