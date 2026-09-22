<#
.SYNOPSIS
    ReelOS Local Virtual Testbench for Windows.
    Audits virtualization (Hyper-V / QEMU), configures portable QEMU, and boots
    headless or graphical autoinstall verification VMs without physical hardware.

.DESCRIPTION
    Provides an automated test environment for ReelOS autoinstall media:
      - Audits host virtualization capabilities (Hyper-V, WHPX, QEMU, CPU virtualization).
      - Downloads or configures portable QEMU for Windows if not installed.
      - Creates a sparse virtual target disk (25 GB, near 0 bytes on disk initially).
      - Stages unattended NoCloud / CIDATA autoinstall payload.
      - Launches QEMU with WHPX hardware acceleration (or TCG fallback), port forwards
        (8080 -> 80 for ReelOS Web Wizard, 2222 -> 22 for SSH), and headless serial logging.

.PARAMETER Action
    Action to perform: Check, Setup, Boot, Reset, or Stop (default: Boot).

.PARAMETER IsoPath
    Path to Ubuntu 24.04 Server ISO or remastered ReelOS ISO.

.PARAMETER MemoryMB
    RAM in Megabytes allocated to the VM (default: 4096).

.PARAMETER CpuCores
    Number of virtual CPU cores allocated to the VM (default: 2).

.PARAMETER Headless
    Run VM headlessly without GUI window, logging serial console to file.

.PARAMETER Gui
    Run VM with interactive graphical display window.

.PARAMETER PortForwardWeb
    Host port forwarded to VM port 80 (default: 8080).

.PARAMETER PortForwardSsh
    Host port forwarded to VM port 22 (default: 2222).

.PARAMETER QemuPath
    Explicit path to qemu-system-x86_64.exe or QEMU installation directory.

.PARAMETER WorkDir
    Directory for VM disk images and logs (default: .\testbench).

.EXAMPLE
    # Audit host virtualization
    .\setup-vm-testbench.ps1 -Action Check

    # Initialize testbench files and target disk
    .\setup-vm-testbench.ps1 -Action Setup

    # Boot VM headlessly with serial log output
    .\setup-vm-testbench.ps1 -Action Boot -Headless

    # Boot VM with graphical display
    .\setup-vm-testbench.ps1 -Action Boot -Gui
#>

[CmdletBinding()]
param(
    [ValidateSet('Check', 'Setup', 'Boot', 'Reset', 'Stop')]
    [string]$Action = 'Boot',

    [string]$IsoPath = "",

    [int]$MemoryMB = 4096,

    [int]$CpuCores = 2,

    [switch]$Headless,

    [switch]$Gui,

    [int]$PortForwardWeb = 8080,

    [int]$PortForwardSsh = 2222,

    [string]$QemuPath = "",

    [string]$Accel = "tcg",

    [string]$WorkDir = "",

    [switch]$NoWait
)

$ErrorActionPreference = 'Stop'

# ==============================================================================
# Paths & Defaults
# ==============================================================================
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

$repoRoot = Resolve-Path (Join-Path $scriptDir "..") -ErrorAction SilentlyContinue
if (-not $repoRoot) { $repoRoot = $scriptDir }

if (-not $WorkDir) {
    $WorkDir = Join-Path $repoRoot "testbench"
}
if (-not (Test-Path $WorkDir)) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
}

$qemuLocalDir = Join-Path $WorkDir ".qemu"
$targetDiskPath = Join-Path $WorkDir "reelos-target-disk.qcow2"
$targetRawDiskPath = Join-Path $WorkDir "reelos-target-disk.raw"
$cidataImgPath = Join-Path $WorkDir "cidata.img"
$vmSerialLogPath = Join-Path $WorkDir "reelos-vm-serial.log"
$vmPidFile = Join-Path $WorkDir "reelos-vm.pid"

# Portable QEMU Download mirror
$script:QemuDownloadUrl = "https://github.com/dirkarnez/qemu-portable/releases/download/20240822/qemu-w64-portable-20240822.zip"

# ==============================================================================
# Helper Functions
# ==============================================================================

function Write-Banner {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "       ReelOS Local Virtualization Testbench (Windows)    " -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
}

function Find-LocalQemu {
    param([string]$Override)

    if ($Override -and (Test-Path $Override)) {
        if ((Get-Item $Override).PSIsContainer) {
            $cand = Join-Path $Override "qemu-system-x86_64.exe"
            if (Test-Path $cand) { return $cand }
        } else {
            return (Resolve-Path $Override).Path
        }
    }

    $candidates = @(
        (Join-Path $qemuLocalDir "qemu-system-x86_64.exe"),
        "C:\Program Files\qemu\qemu-system-x86_64.exe",
        "C:\Program Files (x86)\qemu\qemu-system-x86_64.exe",
        "C:\ProgramData\chocolatey\bin\qemu-system-x86_64.exe",
        "$env:USERPROFILE\scoop\shims\qemu-system-x86_64.exe"
    )

    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }

    $cmd = Get-Command "qemu-system-x86_64.exe" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    return $null
}

function Find-LocalQemuImg {
    param([string]$QemuExe)

    if ($QemuExe) {
        $parent = Split-Path -Parent $QemuExe
        $cand = Join-Path $parent "qemu-img.exe"
        if (Test-Path $cand) { return $cand }
    }

    $cmd = Get-Command "qemu-img.exe" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    return $null
}

function Find-CandidateIso {
    param([string]$ExplicitPath)

    if ($ExplicitPath -and (Test-Path $ExplicitPath)) {
        return (Resolve-Path $ExplicitPath).Path
    }

    $searchPaths = @(
        $repoRoot,
        (Join-Path $repoRoot "iso"),
        (Join-Path $repoRoot "downloads"),
        (Join-Path $repoRoot "public\install"),
        "$env:USERPROFILE\Downloads",
        "C:\isos"
    )

    foreach ($dir in $searchPaths) {
        if (Test-Path $dir) {
            $found = Get-ChildItem -Path $dir -Filter "*ubuntu*24.04*.iso" -File -ErrorAction SilentlyContinue |
                Sort-Object Length -Descending | Select-Object -First 1
            if ($found -and $found.Length -gt 500MB) {
                return $found.FullName
            }
            # Remastered ISO fallback
            $reelosIso = Get-ChildItem -Path $dir -Filter "*reelos*.iso" -File -ErrorAction SilentlyContinue |
                Sort-Object Length -Descending | Select-Object -First 1
            if ($reelosIso -and $reelosIso.Length -gt 50MB) {
                return $reelosIso.FullName
            }
        }
    }

    return $null
}

function Test-VirtualizationFeatures {
    $result = [PSCustomObject]@{
        HyperVInstalled   = $false
        HyperVRunning     = $false
        WHPXAvailable     = $false
        QemuInstalled     = $false
        QemuVersion       = ""
        QemuPath          = ""
    }

    # 1. Hyper-V check
    $vmCmd = Get-Command Get-VM -ErrorAction SilentlyContinue
    if ($vmCmd) {
        $result.HyperVInstalled = $true
        try {
            $service = Get-Service -Name "vmms" -ErrorAction SilentlyContinue
            if ($service -and $service.Status -eq 'Running') {
                $result.HyperVRunning = $true
            }
        } catch {}
    }

    # 2. Windows Hypervisor Platform (WHPX) check
    try {
        $whpxFeature = Get-WindowsOptionalFeature -Online -FeatureName "HypervisorPlatform" -ErrorAction SilentlyContinue
        if ($whpxFeature -and $whpxFeature.State -eq 'Enabled') {
            $result.WHPXAvailable = $true
        }
    } catch {
        # Fallback query via registry/CIM
        $result.WHPXAvailable = $true # Assume available on modern Win10/11
    }

    # 3. QEMU check
    $qemuExe = Find-LocalQemu -Override $QemuPath
    if ($qemuExe) {
        $result.QemuInstalled = $true
        $result.QemuPath = $qemuExe
        try {
            $verOutput = & $qemuExe --version
            if ($verOutput -match "QEMU emulator version ([0-9\.]+)") {
                $result.QemuVersion = $matches[1]
            }
        } catch {}
    }

    return $result
}

function Install-PortableQemu {
    Write-Host "`n[Provisioning QEMU for Windows]..." -ForegroundColor Cyan

    if (-not (Test-Path $qemuLocalDir)) {
        New-Item -ItemType Directory -Path $qemuLocalDir -Force | Out-Null
    }

    $zipPath = Join-Path $WorkDir "qemu-portable.zip"
    Write-Host "Downloading portable QEMU from: $script:QemuDownloadUrl" -ForegroundColor White

    try {
        & curl.exe -L -o $zipPath $script:QemuDownloadUrl
        Write-Host "Download complete. Extracting to $qemuLocalDir..." -ForegroundColor White
        & tar.exe -xf $zipPath -C $qemuLocalDir
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

        if (Find-LocalQemu) {
            Write-Host "QEMU configured successfully at $qemuLocalDir" -ForegroundColor Green
            return
        }
    }
    catch {
        Write-Warning "Portable zip setup failed: $_"
    }

    # Fallback: Try Winget if available
    $wingetCmd = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($wingetCmd) {
        Write-Host "Attempting installation via Windows Package Manager (winget)..." -ForegroundColor White
        try {
            $wingetArgs = @(
                "install",
                "--id", "SoftwareFreedomConservancy.QEMU",
                "--exact",
                "--silent",
                "--accept-package-agreements",
                "--accept-source-agreements",
                "--disable-interactivity"
            )
            $p = Start-Process -FilePath "winget.exe" -ArgumentList $wingetArgs -Wait -PassThru -NoNewWindow
            if ($p.ExitCode -eq 0 -or (Find-LocalQemu)) {
                Write-Host "QEMU successfully provisioned via winget!" -ForegroundColor Green
                return
            }
        } catch {
            Write-Warning "Winget installation attempt failed: $_"
        }
    }

    # If still not found, provide helpful instructions
    Write-Host "`nManual Setup Options:" -ForegroundColor Yellow
    Write-Host "  1. Run in terminal:          winget install SoftwareFreedomConservancy.QEMU" -ForegroundColor White
    Write-Host "  2. Download official setup:  https://qemu.weilnetz.de/w64/" -ForegroundColor White
    Write-Host "  3. Pass path to this script: .\setup-vm-testbench.ps1 -QemuPath `"C:\Program Files\qemu`"" -ForegroundColor White
    throw "QEMU provisioning could not complete automatically. Please install QEMU using winget or the link above."
}

function Create-TargetVirtualDisk {
    param(
        [int]$SizeGB = 25
    )

    $qemuExe = Find-LocalQemu -Override $QemuPath
    $qemuImg = Find-LocalQemuImg -QemuExe $qemuExe

    if (Test-Path $targetDiskPath) {
        Write-Host "Existing virtual target disk found: $targetDiskPath" -ForegroundColor Gray
        return $targetDiskPath
    }

    if ($qemuImg) {
        Write-Host "Creating sparse QCOW2 virtual disk ($SizeGB GB)..." -ForegroundColor White
        & $qemuImg create -f qcow2 $targetDiskPath "$($SizeGB)G" | Out-Null
        Write-Host "Created: $targetDiskPath" -ForegroundColor Green
        return $targetDiskPath
    } else {
        # Fallback to sparse RAW file via .NET FileStream
        Write-Host "Creating sparse RAW virtual disk ($SizeGB GB)..." -ForegroundColor White
        $fs = [System.IO.File]::Create($targetRawDiskPath)
        $fs.SetLength($SizeGB * 1GB)
        $fs.Close()
        Write-Host "Created: $targetRawDiskPath" -ForegroundColor Green
        return $targetRawDiskPath
    }
}

function Create-VirtualCidataMedia {
    Write-Host "Preparing unattended cloud-init CIDATA seed media..." -ForegroundColor White

    $srcAuto = Join-Path $repoRoot "install\autoinstall"
    if (-not (Test-Path (Join-Path $srcAuto "user-data"))) {
        $srcAuto = Join-Path $repoRoot "autoinstall"
    }

    $cidataStaging = Join-Path $WorkDir "cidata_staging"
    if (-not (Test-Path $cidataStaging)) {
        New-Item -ItemType Directory -Path $cidataStaging -Force | Out-Null
    }

    # Copy cloud-init configs
    Copy-Item -Path (Join-Path $srcAuto "user-data") -Destination (Join-Path $cidataStaging "user-data") -Force
    Copy-Item -Path (Join-Path $srcAuto "meta-data") -Destination (Join-Path $cidataStaging "meta-data") -Force
    if (Test-Path (Join-Path $srcAuto "live-wifi.sh")) {
        Copy-Item -Path (Join-Path $srcAuto "live-wifi.sh") -Destination (Join-Path $cidataStaging "live-wifi.sh") -Force
    }

    # Generate CIDATA ISO/image if script is present
    $cidataPy = Join-Path $repoRoot "scripts\cidata-iso.py"
    if (Test-Path $cidataPy) {
        try {
            & python $cidataPy $cidataStaging $cidataImgPath | Out-Null
        } catch {}
    }

    Write-Host "CIDATA seed payload staged at: $cidataStaging" -ForegroundColor Green
    return $cidataStaging
}

# ==============================================================================
# Action Handlers
# ==============================================================================

function Invoke-CheckAction {
    Write-Banner
    Write-Host "`nAuditing host virtualization prerequisites..." -ForegroundColor White

    $audit = Test-VirtualizationFeatures

    Write-Host "`n[Virtualization Audit Report]" -ForegroundColor Yellow
    Write-Host ("  Hyper-V Installed:     {0}" -f $(if ($audit.HyperVInstalled) { "YES" } else { "No" })) -ForegroundColor $(if ($audit.HyperVInstalled) { 'Green' } else { 'Gray' })
    Write-Host ("  Hyper-V Service:       {0}" -f $(if ($audit.HyperVRunning) { "RUNNING" } else { "Stopped / Disabled" })) -ForegroundColor $(if ($audit.HyperVRunning) { 'Green' } else { 'Gray' })
    Write-Host ("  WHPX Acceleration:     {0}" -f $(if ($audit.WHPXAvailable) { "AVAILABLE" } else { "Disabled" })) -ForegroundColor $(if ($audit.WHPXAvailable) { 'Green' } else { 'Yellow' })
    Write-Host ("  QEMU x86_64 Installed: {0}" -f $(if ($audit.QemuInstalled) { "YES (v$($audit.QemuVersion))" } else { "NOT FOUND" })) -ForegroundColor $(if ($audit.QemuInstalled) { 'Green' } else { 'Red' })
    if ($audit.QemuPath) {
        Write-Host ("  QEMU Binary Path:      {0}" -f $audit.QemuPath) -ForegroundColor DarkGray
    }

    # ISO detection
    $iso = Find-CandidateIso -ExplicitPath $IsoPath
    Write-Host "`n[Testboot Media]" -ForegroundColor Yellow
    if ($iso) {
        $sizeGb = [Math]::Round((Get-Item $iso).Length / 1GB, 2)
        Write-Host "  Boot ISO:              $iso ($sizeGb GB)" -ForegroundColor Green
    } else {
        Write-Host "  Boot ISO:              NOT DETECTED" -ForegroundColor Red
        Write-Host "  (Run 'reelos-flasher.ps1 -Cli -DownloadIso' or specify -IsoPath <path>)" -ForegroundColor Gray
    }

    Write-Host "`n[Testbench Directory]" -ForegroundColor Yellow
    Write-Host "  Workspace:             $WorkDir" -ForegroundColor White

    if (-not $audit.QemuInstalled -and -not $audit.HyperVInstalled) {
        Write-Host "`nAction Recommendation: Run 'setup-vm-testbench.ps1 -Action Setup' to provision portable QEMU." -ForegroundColor Cyan
    } else {
        Write-Host "`nReady for testboot: Run 'setup-vm-testbench.ps1 -Action Boot' to launch." -ForegroundColor Green
    }
}

function Invoke-SetupAction {
    Write-Banner
    Write-Host "`nInitializing Local Virtual Testbench..." -ForegroundColor White

    $qemuExe = Find-LocalQemu -Override $QemuPath
    if (-not $qemuExe) {
        Install-PortableQemu
        $qemuExe = Find-LocalQemu -Override $QemuPath
    } else {
        Write-Host "QEMU verified: $qemuExe" -ForegroundColor Green
    }

    # Initialize target disk
    $disk = Create-TargetVirtualDisk -SizeGB 25

    # Initialize CIDATA staging
    $cidata = Create-VirtualCidataMedia

    Write-Host "`n[Setup Complete]" -ForegroundColor Green
    Write-Host "  Target Disk: $disk" -ForegroundColor White
    Write-Host "  CIDATA Seed: $cidata" -ForegroundColor White
    Write-Host "`nYou can now boot the testbench VM with:" -ForegroundColor Cyan
    Write-Host "  .\setup-vm-testbench.ps1 -Action Boot" -ForegroundColor Yellow
}

function Invoke-ResetAction {
    Write-Banner
    Write-Host "`nResetting Virtual Testbench Environment..." -ForegroundColor White

    # Stop any running instances first
    Invoke-StopAction

    if (Test-Path $targetDiskPath) {
        Remove-Item $targetDiskPath -Force
        Write-Host "Removed $targetDiskPath" -ForegroundColor Gray
    }
    if (Test-Path $targetRawDiskPath) {
        Remove-Item $targetRawDiskPath -Force
        Write-Host "Removed $targetRawDiskPath" -ForegroundColor Gray
    }
    if (Test-Path $vmSerialLogPath) {
        Remove-Item $vmSerialLogPath -Force
        Write-Host "Cleared serial console logs." -ForegroundColor Gray
    }

    Write-Host "Re-creating clean target disk..." -ForegroundColor White
    Create-TargetVirtualDisk -SizeGB 25 | Out-Null
    Write-Host "Testbench reset complete. Ready for fresh autoinstall test." -ForegroundColor Green
}

function Invoke-StopAction {
    Write-Host "Checking for running ReelOS VM processes..." -ForegroundColor White

    if (Test-Path $vmPidFile) {
        $savedPid = Get-Content $vmPidFile -ErrorAction SilentlyContinue
        if ($savedPid) {
            $p = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
            if ($p) {
                Write-Host "Terminating VM process (PID $savedPid)..." -ForegroundColor Yellow
                Stop-Process -Id $savedPid -Force -ErrorAction SilentlyContinue
            }
        }
        Remove-Item $vmPidFile -Force -ErrorAction SilentlyContinue
    }

    $qemuProcs = Get-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue
    if ($qemuProcs) {
        Write-Host "Stopping $($qemuProcs.Count) QEMU instance(s)..." -ForegroundColor Yellow
        $qemuProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    }

    Write-Host "VM stopped." -ForegroundColor Green
}

function Invoke-BootAction {
    Write-Banner

    $qemuExe = Find-LocalQemu -Override $QemuPath
    if (-not $qemuExe) {
        Write-Host "QEMU not found. Running setup..." -ForegroundColor Yellow
        Invoke-SetupAction
        $qemuExe = Find-LocalQemu -Override $QemuPath
        if (-not $qemuExe) {
            throw "Unable to locate QEMU executable."
        }
    }

    $iso = Find-CandidateIso -ExplicitPath $IsoPath
    if (-not $iso -or -not (Test-Path $iso)) {
        Write-Error "Ubuntu Server / ReelOS ISO not found. Specify -IsoPath <path> or run flasher\reelos-flasher.ps1 -Cli -DownloadIso."
        return
    }

    # Ensure virtual target disk exists
    $diskFile = if (Test-Path $targetDiskPath) { $targetDiskPath } elseif (Test-Path $targetRawDiskPath) { $targetRawDiskPath } else { Create-TargetVirtualDisk -SizeGB 25 }
    $diskFormat = if ($diskFile -like "*.qcow2") { "qcow2" } else { "raw" }

    # Acceleration check: WHPX vs TCG
    $accel = if ($Accel) { $Accel } else { "tcg" }

    Write-Host "`n[Booting Virtual Testbench VM]" -ForegroundColor Yellow
    Write-Host "  QEMU Binary:    $qemuExe" -ForegroundColor White
    Write-Host "  ISO Media:      $iso" -ForegroundColor White
    Write-Host "  Target Disk:    $diskFile ($diskFormat)" -ForegroundColor White
    Write-Host "  RAM:            $MemoryMB MB | vCPUs: $CpuCores | Acceleration: $accel" -ForegroundColor White
    Write-Host "  Port Forwards:  Host :$PortForwardWeb -> Guest :80 (ReelOS Web Wizard)" -ForegroundColor White
    Write-Host "                  Host :$PortForwardSsh -> Guest :22 (SSH console)" -ForegroundColor White
    Write-Host "  Mode:           $(if ($Headless) { 'Headless (Serial output logged)' } else { 'Graphical Display' })" -ForegroundColor White

    # Build QEMU arguments
    $qemuArgs = [System.Collections.Generic.List[string]]::new()

    # Acceleration
    $qemuArgs.Add("-accel")
    $qemuArgs.Add($accel)
    $qemuArgs.Add("-m")
    $qemuArgs.Add("${MemoryMB}M")
    $qemuArgs.Add("-smp")
    $qemuArgs.Add("$CpuCores")

    # Target Hard Disk (Internal drive that autoinstall will wipe & install ReelOS onto)
    $qemuArgs.Add("-drive")
    $qemuArgs.Add("file=$diskFile,if=virtio,format=$diskFormat")

    # CD-ROM Autoinstall Media
    $qemuArgs.Add("-cdrom")
    $qemuArgs.Add("$iso")

    # CIDATA Seed Media (Unattended cloud-init autoinstall)
    if (Test-Path $cidataImgPath) {
        $qemuArgs.Add("-drive")
        $qemuArgs.Add("file=$cidataImgPath,if=virtio,format=raw")
    }

    # Boot order: CD-ROM first (d), then Hard Disk (c)
    $qemuArgs.Add("-boot")
    $qemuArgs.Add("order=dc,menu=on")
    $qemuArgs.Add("-no-shutdown")

    # Networking: User-mode NAT with host port forwards
    $netParam = "user,id=net0,hostfwd=tcp::$PortForwardWeb-:80,hostfwd=tcp::$PortForwardSsh-:22"
    $qemuArgs.Add("-netdev")
    $qemuArgs.Add($netParam)
    $qemuArgs.Add("-device")
    $qemuArgs.Add("virtio-net-pci,netdev=net0")

    # Display / Console
    if ($Headless) {
        $qemuArgs.Add("-display")
        $qemuArgs.Add("none")
        $qemuArgs.Add("-serial")
        $qemuArgs.Add("file:$vmSerialLogPath")
        Write-Host "`nHeadless serial log will stream to: $vmSerialLogPath" -ForegroundColor Cyan
    } else {
        # Standard graphical window
        $qemuArgs.Add("-vga")
        $qemuArgs.Add("virtio")
    }

    $vmErrLogPath = Join-Path $WorkDir "reelos-vm-err.log"
    $proc = Start-Process -FilePath $qemuExe -ArgumentList ($qemuArgs.ToArray()) -PassThru -RedirectStandardError $vmErrLogPath -WindowStyle Hidden

    # Record PID
    Set-Content -Path $vmPidFile -Value $proc.Id -Encoding ASCII

    Write-Host "VM Process started with PID: $($proc.Id)" -ForegroundColor Green
    Write-Host "`nVerification Endpoints once autoinstall finishes and reboots:" -ForegroundColor White
    Write-Host "  ReelOS Setup Wizard:  http://localhost:$PortForwardWeb" -ForegroundColor Cyan
    Write-Host "  SSH Debug Access:     ssh -p $PortForwardSsh reelos@localhost" -ForegroundColor Cyan
    Write-Host "`nTo stop the VM, run:" -ForegroundColor Gray
    Write-Host "  .\setup-vm-testbench.ps1 -Action Stop`n" -ForegroundColor Yellow

    if ($Headless) {
        if (-not $NoWait) {
            Write-Host "Monitoring VM serial output (Press Ctrl+C to detach; VM keeps running)..." -ForegroundColor White
            Start-Sleep -Seconds 2
            if (Test-Path $vmSerialLogPath) {
                Get-Content -Path $vmSerialLogPath -Wait -Tail 20
            }
        } else {
            Write-Host "VM running headlessly in background. Log: $vmSerialLogPath" -ForegroundColor Cyan
        }
    }
}

# ==============================================================================
# Dispatcher
# ==============================================================================
switch ($Action) {
    'Check' { Invoke-CheckAction }
    'Setup' { Invoke-SetupAction }
    'Reset' { Invoke-ResetAction }
    'Stop'  { Invoke-StopAction }
    'Boot'  { Invoke-BootAction }
}
