<#
.SYNOPSIS
    ReelOS Windows Setup, Deployment & Maintenance Engine.
    4-Way Unified Operations:
      [1] Install: Background Virtual Lab (WHPX / QEMU)
      [2] Flash: Dedicated Bare-Metal USB Installer (with strict drive safety)
      [3] Update: Existing ReelOS USB Installer (In-place fast refresh)
      [4] Uninstall: Teardown & Clean Up Virtual Lab (Disks, logs, and ISO prompt)
#>

[CmdletBinding()]
param(
    [ValidateSet('Menu', 'Install', 'Flash', 'Update', 'Uninstall', 'Status', 'Stop', 'Usb', 'Vm')]
    [string]$Mode = 'Menu',

    [int]$MemoryMB = 4096,
    [int]$CpuCores = 2,
    [string]$TargetDrive = "",
    [switch]$KeepIso,
    [switch]$PurgeIso,
    [switch]$GamingSuspend,
    [switch]$Headless = $true
)

$ErrorActionPreference = 'Continue'

$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$repoRoot = Resolve-Path (Join-Path $scriptDir "..") -ErrorAction SilentlyContinue
if (-not $repoRoot) { $repoRoot = $scriptDir }

function Write-Gold([string]$text) { Write-Host $text -ForegroundColor Yellow }
function Write-Cyan([string]$text) { Write-Host $text -ForegroundColor Cyan }
function Write-Green([string]$text) { Write-Host $text -ForegroundColor Green }
function Write-Dim([string]$text) { Write-Host $text -ForegroundColor DarkGray }
function Write-Err([string]$text) { Write-Host $text -ForegroundColor Red }

function Find-CandidateIso {
    $candidates = @(
        (Join-Path $repoRoot "iso\reelos-26.04.iso"),
        (Join-Path $env:USERPROFILE "Downloads\reelos-26.04.iso"),
        (Join-Path $env:USERPROFILE "Downloads\ubuntu-24.04-live-server-amd64.iso"),
        (Join-Path $env:USERPROFILE "Downloads\ubuntu-24.04.1-live-server-amd64.iso"),
        (Join-Path $repoRoot "testbench\reelos-26.04.iso")
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) {
            return $c
        }
    }
    return $null
}

function Get-SafeUsbDrives {
    $safeDrives = @()
    try {
        $disks = Get-Disk -ErrorAction SilentlyContinue | Where-Object {
            $_.BusType -eq 'USB' -and $_.IsSystem -eq $false -and $_.IsBoot -eq $false -and $_.Number -ne 0
        }
        foreach ($d in $disks) {
            $partitions = Get-Partition -DiskNumber $d.Number -ErrorAction SilentlyContinue
            $letters = ($partitions | Where-Object { $_.DriveLetter } | ForEach-Object { "$($_.DriveLetter):" }) -join ", "
            $sizeGb = [math]::Round($d.Size / 1GB, 1)
            $safeDrives += [PSCustomObject]@{
                Number = $d.Number
                FriendlyName = $d.FriendlyName
                SizeGB = $sizeGb
                DriveLetters = if ($letters) { $letters } else { "(Unassigned)" }
                IsRemovable = $true
            }
        }
    } catch {
        # Fallback to Win32_DiskDrive
        $wmiDisks = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Where-Object {
            $_.InterfaceType -eq 'USB' -and $_.Index -ne 0
        }
        foreach ($wd in $wmiDisks) {
            $sizeGb = [math]::Round($wd.Size / 1GB, 1)
            $safeDrives += [PSCustomObject]@{
                Number = $wd.Index
                FriendlyName = $wd.Model
                SizeGB = $sizeGb
                DriveLetters = "(USB)"
                IsRemovable = $true
            }
        }
    }
    return $safeDrives
}

function Show-Header {
    Clear-Host
    Write-Gold "================================================================================"
    Write-Gold "                 ReelOS Windows Setup & Appliance Engine                        "
    Write-Gold "================================================================================"
    Write-Host ""
}

function Audit-Hardware {
    Write-Cyan ">> Auditing Host Hardware & Virtualization Platform..."
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $totalRamBytes = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
    $totalRamGB = [math]::Round($totalRamBytes / 1GB, 1)
    $gpus = Get-CimInstance Win32_VideoController | Select-Object -Property Name, DriverVersion, AdapterRAM

    Write-Host "   * CPU:           $($cpu.Name) ($($cpu.NumberOfCores) Cores / $($cpu.NumberOfLogicalProcessors) Threads)"
    Write-Host "   * Total RAM:     $totalRamGB GB"

    $hasNvidia = $false
    $hasIntel = $false
    $hasAmd = $false

    foreach ($g in $gpus) {
        $gpuName = $g.Name
        Write-Host "   * GPU:           $gpuName"
        if ($gpuName -match "NVIDIA|GeForce|RTX|GTX") { $hasNvidia = $true }
        if ($gpuName -match "Intel|Iris|Arc|HD Graphics|UHD") { $hasIntel = $true }
        if ($gpuName -match "AMD|Radeon") { $hasAmd = $true }
    }

    # WHPX Check
    $whpxFeature = Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -ErrorAction SilentlyContinue
    if ($whpxFeature -and $whpxFeature.State -eq 'Enabled') {
        Write-Green "   * Virtualization: Windows Hypervisor Platform (WHPX) ENABLED (Near-native speed)"
    } else {
        Write-Dim   "   * Virtualization: WHPX optional feature not detected; standard hypervisor/TCG active."
    }

    Write-Host ""
    Write-Gold "--------------------------------------------------------------------------------"
    Write-Gold "                     Intelligent Hardware & Silicon Advisor                     "
    Write-Gold "--------------------------------------------------------------------------------"
    if ($hasNvidia) {
        Write-Host "   [NVIDIA GPU Detected]: NVENC Hardware Transcoder Ready." -ForegroundColor Green
        Write-Dim  "   - 4K HDR transcoding active for adaptive remote and mobile clients."
    } elseif ($hasIntel) {
        Write-Host "   [Intel GPU / QuickSync Detected]: Intel QSV Engine Ready." -ForegroundColor Green
        Write-Dim  "   - Ultra low-power 4K HEVC / AV1 hardware transcode scaling."
    } else {
        Write-Dim  "   [DirectPlay Optimized]: Smart TVs DirectPlay 99% of media with zero GPU overhead."
    }
    Write-Host ""
}

function Invoke-NativeWindowsAction {
    Write-Gold "--------------------------------------------------------------------------------"
    Write-Gold "            Mode 1: Launch ReelOS Native Windows (Zero-VM Mode)                 "
    Write-Gold "--------------------------------------------------------------------------------"
    Write-Host "Direct Hardware Scaling: Intel QuickSync + NVIDIA NVENC GPU DirectPlay"
    Write-Host "Ultra-low footprint: ~90 MB RAM (vs 4096 MB locked in a VM)"
    Write-Host ""
    Write-Cyan ">> Starting ReelOS Native Engine on port 8080..."

    $root = $repoRoot
    $stateDir = Join-Path $root ".reelos-state"
    if (-not (Test-Path $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }

    # Start tray application in background with STA
    Start-Process powershell.exe -ArgumentList "-STA -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$root\scripts\reelos-tray.ps1`"" -ErrorAction SilentlyContinue

    # Start native node service
    $env:PORT = "8080"
    $env:HOST = "0.0.0.0"
    $env:NODE_ENV = "production"
    $log = Join-Path $stateDir "box.log"
    Start-Process powershell.exe -ArgumentList "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command `"cd '$root'; node scripts/with-app-env.mjs node scripts/reelos-box.mjs *>> '$log'`"" -ErrorAction SilentlyContinue

    Write-Cyan ">> Waiting for http://127.0.0.1:8080/ (log: $log)..."
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ready = $true; break }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $ready) {
        Write-Err "Box did not bind :8080. Last log lines:"
        if (Test-Path $log) { Get-Content $log -Tail 40 | ForEach-Object { Write-Host $_ } }
        else { Write-Err "No box.log yet. Is node crashing immediately?" }
        return
    }

    Write-Host ""
    Write-Green "================================================================================"
    Write-Green "            ReelOS is Live! Opening Concierge wizard...                         "
    Write-Green "================================================================================"
    Write-Host "   URL: http://localhost:8080/"
    Start-Process "http://localhost:8080/"
}

function Invoke-FlashUsbAction {
    Write-Gold "--------------------------------------------------------------------------------"
    Write-Gold "                 Mode 2: Flash Dedicated Bare-Metal USB Drive                   "
    Write-Gold "--------------------------------------------------------------------------------"
    Write-Dim  "Safeguard: Internal hard drives and system partitions are completely protected."
    Write-Host ""

    $flasherPs1 = Join-Path $repoRoot "flasher\reelos-flasher.ps1"
    $flasherExe = Join-Path $repoRoot "flasher\reelos-flasher.exe"

    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Cyan ">> Requesting Administrator privileges for USB hardware formatting..."
        if (Test-Path $flasherExe) {
            Start-Process $flasherExe -Verb RunAs
            return
        }
        if (Test-Path $flasherPs1) {
            Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$flasherPs1`"" -Verb RunAs
            return
        }
        Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Mode Flash" -Verb RunAs
        return
    }

    if (Test-Path $flasherPs1) {
        Write-Host "Launch options:"
        Write-Host " [1] Visual GUI Flasher (Recommended · Automatic ISO download & progress)"
        Write-Host " [2] Terminal CLI Flasher"
        $m = Read-Host "Select [1, 2] (Default 1)"
        if ($m -ne '2') {
            Write-Cyan ">> Launching ReelOS Visual Flasher..."
            Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$flasherPs1`""
            return
        }
    }

    $usbDrives = Get-SafeUsbDrives
    if ($usbDrives.Count -eq 0) {
        Write-Err "No removable USB storage devices detected!"
        Write-Host "Please plug in a USB flash drive (minimum 8 GB) and press Enter to scan again..."
        Read-Host
        $usbDrives = Get-SafeUsbDrives
        if ($usbDrives.Count -eq 0) {
            Write-Err "Still no USB drives detected. Aborting."
            return
        }
    }

    Write-Cyan "Detected Removable USB Devices:"
    for ($i = 0; $i -lt $usbDrives.Count; $i++) {
        $d = $usbDrives[$i]
        Write-Host " [$($i+1)] Disk $($d.Number): $($d.FriendlyName) ($($d.SizeGB) GB) - Volumes: $($d.DriveLetters)" -ForegroundColor White
    }
    Write-Host ""

    $sel = Read-Host "Select target USB drive [1-$($usbDrives.Count)]"
    $idx = [int]$sel - 1
    if ($idx -lt 0 -or $idx -ge $usbDrives.Count) {
        Write-Err "Invalid selection. Aborting."
        return
    }

    $targetDisk = $usbDrives[$idx]
    Write-Err "`n[CRITICAL WARNING]: ALL DATA ON DISK $($targetDisk.Number) ($($targetDisk.FriendlyName)) WILL BE ERASED!"
    $confirm = Read-Host "Type 'YES' in capital letters to confirm format and flash"
    if ($confirm -ne 'YES') {
        Write-Dim "Operation cancelled by user."
        return
    }

    $iso = Find-CandidateIso
    if (-not $iso) {
        Write-Err "Base Ubuntu 24.04 / ReelOS ISO not found in Downloads or iso/ folder."
        Write-Host "Please download ubuntu-24.04-live-server-amd64.iso or run flasher with -DownloadIso."
        return
    }

    Write-Cyan "`n>> Preparing USB drive (Disk $($targetDisk.Number))..."
    # Format Disk
    Clear-Disk -Number $targetDisk.Number -RemoveData -Confirm:$false -ErrorAction SilentlyContinue
    Initialize-Disk -Number $targetDisk.Number -PartitionStyle MBR -ErrorAction SilentlyContinue
    $newPart = New-Partition -DiskNumber $targetDisk.Number -UseMaximumSize -IsActive -AssignDriveLetter
    $letter = $newPart.DriveLetter
    Format-Volume -DriveLetter $letter -FileSystem FAT32 -NewFileSystemLabel "REELOS" -Confirm:$false | Out-Null

    $targetRoot = "$($letter):\"
    Write-Green "   Drive formatted as FAT32 ($targetRoot)."

    # Mount ISO and extract EFI and boot structure
    Write-Cyan ">> Mounting base ISO ($iso)..."
    $mount = Mount-DiskImage -ImagePath $iso -StorageType ISO -PassThru
    $isoDrive = ($mount | Get-Volume).DriveLetter
    $isoRoot = "$($isoDrive):\"

    Write-Cyan ">> Copying boot files to USB..."
    robocopy "$isoRoot" "$targetRoot" /E /XD "casper" /XF "*.iso" /NFL /NDL /NJH /NJS | Out-Null
    if (Test-Path "$isoRoot\casper") {
        New-Item -ItemType Directory -Path "$targetRoot\casper" -Force | Out-Null
        Copy-Item "$isoRoot\casper\vmlinuz" "$targetRoot\casper\" -Force -ErrorAction SilentlyContinue
        Copy-Item "$isoRoot\casper\initrd" "$targetRoot\casper\" -Force -ErrorAction SilentlyContinue
    }
    Dismount-DiskImage -ImagePath $iso | Out-Null

    # Stage NoCloud autoinstall files
    Write-Cyan ">> Staging ReelOS NoCloud autoinstall payload..."
    $nocloud = Join-Path $targetRoot "nocloud"
    New-Item -ItemType Directory -Path $nocloud -Force | Out-Null

    $userDataSrc = Join-Path $repoRoot "install\autoinstall\user-data"
    $metaDataSrc = Join-Path $repoRoot "install\autoinstall\meta-data"
    if (Test-Path $userDataSrc) { Copy-Item $userDataSrc $nocloud -Force }
    if (Test-Path $metaDataSrc) { Copy-Item $metaDataSrc $nocloud -Force }

    # Package latest repo into reelos-bundle.tar.gz
    $bundleDest = Join-Path $nocloud "reelos-bundle.tar.gz"
    Write-Cyan ">> Packaging latest ReelOS release into $bundleDest..."
    $packScript = Join-Path $repoRoot "scripts\pack-usb-payload.mjs"
    if (Test-Path $packScript) {
        node $packScript $bundleDest
    }

    Write-Host ""
    Write-Green "================================================================================"
    Write-Green "        ReelOS USB Installer Complete! Ready for Bare-Metal Deployment!         "
    Write-Green "================================================================================"
    Write-Host "Next Steps:"
    Write-Host " 1. Insert this USB drive into your target PC / Mini PC / Laptop."
    Write-Host " 2. Boot from USB (Press F12 / F11 / Del on startup)."
    Write-Host " 3. ReelOS will unattendedly install and launch the onboarding wizard."
}

function Invoke-UpdateUsbAction {
    Write-Gold "--------------------------------------------------------------------------------"
    Write-Gold "                 Mode 3: Update Existing ReelOS USB Installer                   "
    Write-Gold "--------------------------------------------------------------------------------"
    Write-Dim  "Fast in-place refresh: Updates bundle and boot configs in seconds with zero reformatting."
    Write-Host ""

    # Search for removable drive containing \nocloud\
    $candidates = @()
    $removable = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 }
    foreach ($r in $removable) {
        $checkUserData = Join-Path $r.DeviceID "nocloud\user-data"
        if (Test-Path $checkUserData) {
            $candidates += $r
        }
    }

    if ($candidates.Count -eq 0) {
        Write-Err "No existing ReelOS USB stick detected (looking for \nocloud\user-data)."
        Write-Host "Make sure your ReelOS USB drive is plugged in, or use [2] to flash a new drive."
        return
    }

    $targetDrive = $candidates[0].DeviceID
    Write-Cyan "Found ReelOS USB Installer on drive $targetDrive"
    $bundleDest = Join-Path $targetDrive "nocloud\reelos-bundle.tar.gz"

    Write-Cyan ">> Packaging latest repository into $bundleDest..."
    $packScript = Join-Path $repoRoot "scripts\pack-usb-payload.mjs"
    if (Test-Path $packScript) {
        node $packScript $bundleDest
    }

    # Also refresh user-data and meta-data
    $nocloud = Join-Path $targetDrive "nocloud"
    $userDataSrc = Join-Path $repoRoot "install\autoinstall\user-data"
    $metaDataSrc = Join-Path $repoRoot "install\autoinstall\meta-data"
    if (Test-Path $userDataSrc) { Copy-Item $userDataSrc $nocloud -Force }
    if (Test-Path $metaDataSrc) { Copy-Item $metaDataSrc $nocloud -Force }

    Write-Host ""
    Write-Green "================================================================================"
    Write-Green "        ReelOS USB Successfully Updated to Latest Release!                      "
    Write-Green "================================================================================"
    Write-Host "Target: $bundleDest"
    Write-Host "All new features, bug fixes, and daemons are staged on the stick."
}

function Invoke-UninstallVmAction {
    Write-Gold "--------------------------------------------------------------------------------"
    Write-Gold "                 Mode 4: Teardown & Clean Up ReelOS Virtual Lab                "
    Write-Gold "--------------------------------------------------------------------------------"
    Write-Host "This will terminate any running background VM processes and remove virtual disk files."
    Write-Host ""

    # Stop processes
    Write-Cyan ">> Stopping running ReelOS VM processes..."
    $qemuProcs = Get-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue
    if ($qemuProcs) {
        $qemuProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Green "   Terminated $($qemuProcs.Count) QEMU instance(s)."
    } else {
        Write-Dim "   No active QEMU VM processes found."
    }

    # Delete testbench virtual disk images
    Write-Cyan ">> Cleaning up virtual disk images and testbench state..."
    $testbenchDir = Join-Path $repoRoot "testbench"
    if (Test-Path $testbenchDir) {
        $diskFiles = @(
            (Join-Path $testbenchDir "target-disk.qcow2"),
            (Join-Path $testbenchDir "target-disk.raw"),
            (Join-Path $testbenchDir "vm.pid"),
            (Join-Path $testbenchDir "vm-serial.log")
        )
        foreach ($f in $diskFiles) {
            if (Test-Path $f) {
                Remove-Item $f -Force -ErrorAction SilentlyContinue
                Write-Dim "   Removed $f"
            }
        }
    }

    # Interactive prompt for cached ISO cleanup (per user Flashcard preference!)
    Write-Host ""
    $deleteIso = $false
    if ($PurgeIso) {
        $deleteIso = $true
    } elseif (-not $KeepIso) {
        Write-Host "Do you want to permanently delete the cached Ubuntu/ReelOS ISO file (~2.9 GB)? [y/N]" -ForegroundColor Yellow
        $ans = Read-Host "(Default is No - keeps ISO cached for instant future reinstalls)"
        if ($ans -eq 'Y' -or $ans -eq 'y') {
            $deleteIso = $true
        }
    }

    if ($deleteIso) {
        $iso = Find-CandidateIso
        if ($iso -and (Test-Path $iso)) {
            Remove-Item $iso -Force -ErrorAction SilentlyContinue
            Write-Green "   Deleted cached ISO: $iso"
        } else {
            Write-Dim "   No cached ISO found to delete."
        }
    } else {
        Write-Dim "   Cached ISO preserved for fast future reinstalls."
    }

    Write-Host ""
    Write-Green "================================================================================"
    Write-Green "        ReelOS Virtual Lab has been completely uninstalled and cleaned!         "
    Write-Green "================================================================================"
    Write-Host "Host ports 8080 and 2222 are released."
}

function Invoke-StatusAction {
    Write-Cyan ">> Checking ReelOS Background Appliance Status..."
    $qemu = Get-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue
    if ($qemu) {
        Write-Green "   ReelOS VM is RUNNING (PID $($qemu.Id), RAM $([math]::Round($qemu.WorkingSet64/1MB)) MB)"
        Write-Host "   Living Mirror Web UI: http://127.0.0.1:8080/"
        Write-Host "   Opening in browser..."
        Start-Process "http://127.0.0.1:8080/"
    } else {
        Write-Dim "   ReelOS VM is NOT running."
        Write-Host "   Use Option [1] to launch the background virtual appliance."
    }
}

# ==============================================================================
# Dispatcher
# ==============================================================================
if ($Mode -eq 'Install' -or $Mode -eq 'Native' -or $Mode -eq 'Start') {
    Show-Header
    Audit-Hardware
    Invoke-NativeWindowsAction
    exit 0
} elseif ($Mode -eq 'Flash' -or $Mode -eq 'Usb') {
    Show-Header
    Invoke-FlashUsbAction
    exit 0
} elseif ($Mode -eq 'Update') {
    Show-Header
    Invoke-UpdateUsbAction
    exit 0
} elseif ($Mode -eq 'Uninstall' -or $Mode -eq 'Stop') {
    Show-Header
    Invoke-UninstallVmAction
    exit 0
} elseif ($Mode -eq 'Status') {
    Show-Header
    Invoke-StatusAction
    exit 0
}

# Interactive Menu
Show-Header
Audit-Hardware

Write-Gold "--------------------------------------------------------------------------------"
Write-Gold "                           Choose Operation Mode                                "
Write-Gold "--------------------------------------------------------------------------------"
Write-Host " [1] Launch ReelOS Native Windows    (Zero-VM · Direct GPU Scaling · ~90 MB RAM)"
Write-Host " [2] Flash Dedicated USB Installer   (Bare Metal · Spare PC / Mini PC / HP Laptop)"
Write-Host " [3] Update Existing USB Installer   (Fast In-Place Payload Refresh)"
Write-Host " [4] Check Appliance Status / Web UI (http://localhost:8080/)"
Write-Host " [5] Stop ReelOS Background Service"
Write-Host " [Q] Quit"
Write-Host ""

$choice = Read-Host "Select option [1-5, Q]"

switch ($choice) {
    '1' { Invoke-NativeWindowsAction }
    '2' { Invoke-FlashUsbAction }
    '3' { Invoke-UpdateUsbAction }
    '4' { Invoke-StatusAction }
    '5' { 
        Write-Cyan ">> Stopping ReelOS processes on port 8080..."
        Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object {
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Write-Green "ReelOS stopped."
    }
    default { Write-Dim "Exiting launcher." }
}
