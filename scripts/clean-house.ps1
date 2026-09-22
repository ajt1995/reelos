param(
    [switch]$FactoryReset = $false
)

Write-Host "Cleaning house for ReelOS..."
$ports = @(8080, 8096, 5555)
foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($conn in $conns) {
            $procId = $conn.OwningProcess
            if ($procId -gt 0) {
                Write-Host "Killing process $procId holding port $port"
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

# Resolve state dir dynamically
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoDir = Resolve-Path (Join-Path $scriptDir "..") -ErrorAction SilentlyContinue
$stateDir = if ($env:REELOS_STATE) { $env:REELOS_STATE } else { Join-Path $repoDir ".reelos-state" }

if (Test-Path $stateDir) {
    Remove-Item "$stateDir\*.pid" -Force -ErrorAction SilentlyContinue
    Remove-Item "$stateDir\*.lock" -Force -ErrorAction SilentlyContinue
    Remove-Item "$stateDir\provisioned" -Force -ErrorAction SilentlyContinue
    
    if ($FactoryReset) {
        Write-Host "Performing 100% Factory Reset (purging all credentials and profiles)..."
        Remove-Item "$stateDir\answers.json" -Force -ErrorAction SilentlyContinue
        Remove-Item "$stateDir\profiles.json" -Force -ErrorAction SilentlyContinue
        Remove-Item "$stateDir\gate_secret.key" -Force -ErrorAction SilentlyContinue
        Remove-Item "$stateDir\playback-progress.json" -Force -ErrorAction SilentlyContinue
    } else {
        $profilesPath = "$stateDir\profiles.json"
        if (-not (Test-Path $profilesPath)) {
            $profilesData = @{
                activeResidentId = "primary"
                residents = @(
                    @{ id = "primary"; name = "Primary"; avatar = "clapperboard"; isKids = $false; watchlist = @(); watchProgress = @{} }
                )
            }
            $profilesData | ConvertTo-Json -Depth 5 | Out-File -FilePath $profilesPath -Encoding utf8
        }
    }
}

Write-Host "Clean house complete."
