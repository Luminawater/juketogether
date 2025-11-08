# PowerShell script to kill all Node.js processes
# Run this script as Administrator if you get permission errors

Write-Host "Finding all Node.js processes..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Cyan
    foreach ($process in $nodeProcesses) {
        Write-Host "  PID: $($process.Id) - $($process.ProcessName)" -ForegroundColor Gray
        try {
            Stop-Process -Id $process.Id -Force -ErrorAction Stop
            Write-Host "  Successfully killed process $($process.Id)" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to kill process $($process.Id): $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "  Try running PowerShell as Administrator" -ForegroundColor Red
        }
    }
} else {
    Write-Host "No Node.js processes found" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done! You can now run npm run dev:all" -ForegroundColor Green

