# PowerShell script to kill processes using ports 8080, 8081, and 3000
# Run this script as Administrator if you get permission errors

Write-Host "Checking for processes using ports 8080, 8081, and 3000..." -ForegroundColor Yellow

$ports = @(8080, 8081, 3000)

foreach ($port in $ports) {
    Write-Host ""
    Write-Host "Checking port $port..." -ForegroundColor Cyan
    $connections = netstat -ano | findstr ":$port"
    
    if ($connections) {
        $pids = $connections | ForEach-Object {
            $parts = $_ -split '\s+'
            $parts[-1]
        } | Select-Object -Unique
        
        foreach ($pid in $pids) {
            if ($pid -match '^\d+$') {
                Write-Host "  Found process with PID: $pid" -ForegroundColor Yellow
                try {
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "  Process name: $($process.ProcessName)" -ForegroundColor Gray
                        Write-Host "  Attempting to kill process $pid..." -ForegroundColor Yellow
                        Stop-Process -Id $pid -Force -ErrorAction Stop
                        Write-Host "  Successfully killed process $pid" -ForegroundColor Green
                    }
                } catch {
                    Write-Host "  Failed to kill process $pid : $($_.Exception.Message)" -ForegroundColor Red
                    Write-Host "  Try running PowerShell as Administrator" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "  No processes found on port $port" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Done! You can now run npm run dev:all" -ForegroundColor Green
