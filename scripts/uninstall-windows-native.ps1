<#
.SYNOPSIS
    Stop and uninstall ReelOS native Windows leftovers.

    The old "Uninstall" menu only tore down the QEMU lab. Native node on
    :8080 kept serving the previous test checkout, so Launch looked "successful"
    against stale UI.

    Default: stop native processes, then wipe local state so Concierge runs again.
    Does not delete the git checkout, node_modules, or media libraries.
#>
[CmdletBinding()]
param(
    [switch]$StopOnly,
    [switch]$FactoryReset = $true,
    [switch]$AlsoVm,
    [switch]$Yes
)

$ErrorActionPreference = 'Continue'

function Write-Gold([string]$text) { Write-Host $text -ForegroundColor Yellow }
function Write-Cyan([string]$text) { Write-Host $text -ForegroundColor Cyan }
function Write-Green([string]$text) { Write-Host $text -ForegroundColor Green }
function Write-Dim([string]$text) { Write-Host $text -ForegroundColor DarkGray }

$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = Resolve-Path (Join-Path $scriptDir "..") -ErrorAction SilentlyContinue
if (-not $repoRoot) { $repoRoot = $scriptDir }

$ports = @(8080, 8096)

function Stop-ListenersOnPort([int]$port) {
    $n = 0
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        $procId = $_.OwningProcess
        if ($procId -gt 4) {
            Write-Dim "   kill pid $procId on :$port"
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            $n++
        }
    }
    return $n
}

function Stop-ReelOsProcesses {
    Write-Cyan ">> Stopping native ReelOS (node box, tray, :8080, :8096)..."
    $killed = 0
    foreach ($port in $ports) { $killed += Stop-ListenersOnPort $port }

    $match = 'reelos-box\.mjs|with-app-env\.mjs|reelos-tray\.ps1|reelos-windows-launcher\.ps1'
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -and $_.CommandLine -match $match
    } | ForEach-Object {
        if ($_.ProcessId -gt 4 -and $_.ProcessId -ne $PID) {
            Write-Dim "   kill pid $($_.ProcessId) $($_.Name)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            $killed++
        }
    }

    Write-Green "   Stopped $killed process(es)."
}

function Get-StateDirs {
    @(
        (Join-Path $repoRoot ".reelos-state"),
        (Join-Path $env:USERPROFILE "reelos\.reelos-state"),
        (Join-Path $env:USERPROFILE ".reelos-state")
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
}

function Reset-StateDirs {
    $dirs = Get-StateDirs
    if (-not $dirs) {
        Write-Dim "   No .reelos-state directories found."
        return
    }
    foreach ($dir in $dirs) {
        Write-Cyan ">> Wiping state $dir"
        Remove-Item (Join-Path $dir "provisioned") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "answers.json") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "*.pid") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "*.lock") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "box.log") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "neural-weights.json") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "hdd-telemetry.json") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "gate_secret.key") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "profiles.json") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "playback-progress.json") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $dir "hardware-profile.json") -Force -ErrorAction SilentlyContinue
        Write-Green "   Cleared $dir (repo and media left intact)."
    }
}

Write-Gold "--------------------------------------------------------------------------------"
Write-Gold "            ReelOS Native Uninstaller                                           "
Write-Gold "--------------------------------------------------------------------------------"

Stop-ReelOsProcesses

if ($StopOnly) {
    Write-Green "ReelOS native processes stopped. State left in place."
    exit 0
}

if ($FactoryReset) {
    if (-not $Yes) {
        Write-Host "Wipe local wizard/state so the next launch is Concierge, not the old test box? [Y/n]" -ForegroundColor Yellow
        $ans = Read-Host
        if ($ans -eq 'n' -or $ans -eq 'N') {
            Write-Dim "   State preserved."
        } else {
            Reset-StateDirs
        }
    } else {
        Reset-StateDirs
    }
}

if ($AlsoVm) {
    Write-Cyan ">> Stopping QEMU virtual lab..."
    Get-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $testbenchDir = Join-Path $repoRoot "testbench"
    if (Test-Path $testbenchDir) {
        foreach ($f in @("target-disk.qcow2", "target-disk.raw", "vm.pid", "vm-serial.log")) {
            $p = Join-Path $testbenchDir $f
            if (Test-Path $p) {
                Remove-Item $p -Force -ErrorAction SilentlyContinue
                Write-Dim "   Removed $p"
            }
        }
    }
}

Write-Host ""
Write-Green "Done. Ports 8080/8096 should be free."
Write-Host "Next: from THIS checkout run launcher option [1] (Native Windows)."
Write-Host "Do not open an old clone's start-windows-native.bat — that is the stale box."
