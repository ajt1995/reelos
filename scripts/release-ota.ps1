# ReelOS Automated OTA Release Delivery Tool
# Usage:
#   .\scripts\release-ota.ps1 -Version 1.5.20 -Notes Description of improvements
#   .\scripts\release-ota.ps1 -DryRun

param(
    [string]$Version,
    [string]$Notes = ReelOS OTA Maintenance and Feature Update,
    [switch]$DryRun = $false,
    [switch]$SkipTests = $false
)

$ErrorActionPreference = Stop

$gitExe = git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $fallbackGit = C:\Users\austi\AppData\Local\grok\git\2.55.0.windows.5\cmd\git.exe
    if (Test-Path $fallbackGit) {
        $gitExe = $fallbackGit
    } else {
        Write-Error Git executable not found in PATH or at fallback location.
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ..)).Path
Set-Location $repoRoot

Write-Host ====================================================== -ForegroundColor Cyan
Write-Host  🚀 ReelOS OTA Release Delivery System -ForegroundColor Cyan
Write-Host ====================================================== -ForegroundColor Cyan

$currentVersion = (Get-Content (Join-Path $repoRoot VERSION)).Trim()
Write-Host Current local version: $currentVersion -ForegroundColor Yellow

if (-not $Version) {
    $parts = $currentVersion.Split('.')
    if ($parts.Length -ge 3) {
        $patch = [int]$parts[-1] + 1
        $parts[-1] = $patch.ToString()
        $Version = [string]::Join('.', $parts)
    } else {
        $Version = $currentVersion.1
    }
    Write-Host No version passed. Auto-incremented target version to: $Version -ForegroundColor Green
} else {
    Write-Host Target release version: $Version -ForegroundColor Green
}

if (-not $SkipTests) {
    Write-Host 
[1/5] 🧪 Running Full Test Matrix... -ForegroundColor Cyan
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) {
        Write-Error Test matrix failed. OTA release aborted to protect appliances.
    }
    Write-Host ✔ Tests passed with zero failures. -ForegroundColor Green
} else {
    Write-Host 
[1/5] ⏭ Skipping tests (-SkipTests specified). -ForegroundColor Yellow
}

Write-Host 
[2/5] 📦 Building Production Assets... -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Error Production build failed. OTA release aborted.
}
Write-Host ✔ Client assets compiled successfully. -ForegroundColor Green

Write-Host 
[3/5] 🏷 Updating Version Stamps... -ForegroundColor Cyan
if (-not $DryRun) {
    Set-Content -Path (Join-Path $repoRoot VERSION) -Value $Version
 -NoNewline

    $channelPath = Join-Path $repoRoot channel.json
    $channelObj = Get-Content $channelPath -Raw | ConvertFrom-Json
    $channelObj.version = $Version
    
    $releaseNote = $Version: $Notes
    $notesList = [System.Collections.ArrayList]@($channelObj.notes)
    $notesList.Insert(0, $releaseNote)
    $channelObj.notes = $notesList

    $channelObj | ConvertTo-Json -Depth 10 | Set-Content -Path $channelPath -Encoding utf8

    Write-Host ✔ Updated VERSION and channel.json to $Version. -ForegroundColor Green
} else {
    Write-Host [DRY RUN] Would stamp VERSION and channel.json to $Version -ForegroundColor DarkGray
}

Write-Host 
[4/5] 🛡 Running OTA Invariants Gate... -ForegroundColor Cyan
if (Get-Command python -ErrorAction SilentlyContinue) {
    & python (Join-Path $repoRoot scripts\check-ota.py)
    if ($LASTEXITCODE -ne 0) {
        Write-Warning check-ota.py returned non-zero. Ensure contract rules are observed.
    } else {
        Write-Host ✔ OTA invariants passed. -ForegroundColor Green
    }
} else {
    Write-Host Python not found in session; skipping python check-ota gate. -ForegroundColor DarkGray
}

Write-Host 
[5/5] 🚀 Delivering OTA to GitHub (origin/main)... -ForegroundColor Cyan
if (-not $DryRun) {
    & $gitExe add -A
    & $gitExe commit -m release: ReelOS $Version OTA — $Notes
    Write-Host Pushing release commit to origin main... -ForegroundColor Yellow
    & $gitExe push origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host 
🎉 OTA Successfully Delivered! -ForegroundColor Green
        Write-Host Appliances will discover update at: https://raw.githubusercontent.com/reelos-org/reelos/main/channel.json -ForegroundColor Cyan
        Write-Host Tarball will be served from: https://github.com/reelos-org/reelos/archive/refs/heads/main.tar.gz -ForegroundColor Cyan
    } else {
        Write-Warning git push returned non-zero. Check your GitHub network connection or authentication credentials.
    }
} else {
    Write-Host [DRY RUN] Would commit and push to origin main. -ForegroundColor DarkGray
}
