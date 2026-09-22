# System & Thermal Sentry for ReelOS
# Continuously logs CPU, Memory, GPU temp, and Remote HP appliance health

$logDir = "C:\Users\austi\reelos\.reelos-state"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir "sentry-telemetry.log"

Write-Host ">>> ReelOS Hardware & Thermal Sentry Active" -ForegroundColor Green
Write-Host ">>> Logging to: $logFile" -ForegroundColor Cyan

function Get-GpuTemp {
    try {
        $out = cmd /c "nvidia-smi --query-gpu=temperature.gpu,utilization.gpu --format=csv,noheader,nounits" 2>$null
        if ($out -match "(\d+),\s*(\d+)") {
            return @{ TempC = [int]$matches[1]; UtilPercent = [int]$matches[2] }
        }
    } catch {}
    return $null
}

function Get-HpStatus {
    try {
        $res = Invoke-RestMethod -Uri "http://192.168.1.234:8080/api/system/remote-compute" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($res -and $res.hardware) {
            return @{
                Online = $true
                TempC = $res.hardware.temperatureC
                FreeMemMb = $res.hardware.freeMemoryMb
                TotalMemMb = $res.hardware.totalMemoryMb
                CpuLoad = ($res.hardware.loadAverage -join ", ")
                Safe = $res.safetyGovernor.safe
            }
        }
    } catch {}
    return @{ Online = $false }
}

$iter = 0
while ($true) {
    $now = Get-Date -Format "HH:mm:ss"
    
    # 1. Host CPU and RAM
    $cpuLoad = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $osMem = Get-CimInstance Win32_OperatingSystem
    $freeRamGb = [math]::Round($osMem.FreePhysicalMemory / 1MB, 2)
    $totalRamGb = [math]::Round($osMem.TotalVisibleMemorySize / 1MB, 2)
    $usedRamGb = [math]::Round($totalRamGb - $freeRamGb, 2)

    # 2. ReelOS & Node Processes
    $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match "node|reelos" }
    $procSummary = @()
    $totalReelOsMemMb = 0
    foreach ($p in $procs) {
        $memMb = [math]::Round($p.WorkingSet64 / 1MB, 1)
        $totalReelOsMemMb += $memMb
        $procSummary += "$($p.ProcessName)[$($p.Id)]=${memMb}MB"
    }
    $procStr = if ($procSummary.Count -gt 0) { $procSummary -join ", " } else { "Idle (no ReelOS processes)" }

    # 3. GPU Temp
    $gpu = Get-GpuTemp
    $gpuStr = if ($gpu) { "GPU: $($gpu.TempC)°C (Util: $($gpu.UtilPercent)%)" } else { "GPU: N/A" }

    # 4. HP Remote Node (checked every 10s)
    $hpStr = ""
    if ($iter % 2 -eq 0) {
        $hp = Get-HpStatus
        if ($hp.Online) {
            $hpStr = " | HP Appliance: $($hp.TempC)°C, Load: [$($hp.CpuLoad)], FreeRAM: $($hp.FreeMemMb)MB, Safe: $($hp.Safe)"
        } else {
            $hpStr = " | HP Appliance: Offline/Unreachable"
        }
    }

    $line = "[$now] Host CPU: $cpuLoad% | Host RAM: ${usedRamGb}/${totalRamGb}GB (Free: ${freeRamGb}GB) | $gpuStr | ReelOS RAM: ${totalReelOsMemMb}MB ($procStr)$hpStr"
    
    Write-Host $line
    Add-Content -Path $logFile -Value $line

    $iter++
    Start-Sleep -Seconds 5
}
