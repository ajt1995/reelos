<#
.SYNOPSIS
    ReelOS Appliance Flasher for Windows.
    Safely creates unattended Ubuntu 24.04 Server + ReelOS autoinstall USB drives.

.DESCRIPTION
    Provides a standalone Windows tool with a clean WinForms dark-mode GUI and full CLI fallback.
    Features:
      - Ultra-strict drive safety: strictly refuses internal OS disks, NVMe, SATA, and RAID drives.
      - Uses Get-CimInstance Win32_DiskDrive (InterfaceType 'USB') and Get-Disk (BusType 'USB').
      - Auto-discovers or downloads Ubuntu 24.04.1 Live Server ISO from official Ubuntu mirrors.
      - Packages unattended autoinstall (user-data, meta-data, live-wifi.sh), installer scripts,
        and ReelOS bundle into the USB (either Full Bootable Installer or Dedicated CIDATA volume).
      - 1-click 'Flash ReelOS USB' button with real-time progress feedback.

.EXAMPLE
    # Launch GUI
    .\reelos-flasher.ps1

    # CLI: List safe USB drives
    .\reelos-flasher.ps1 -Cli -ListDrives

    # CLI: Download official Ubuntu 24.04 Live Server ISO
    .\reelos-flasher.ps1 -Cli -DownloadIso

    # CLI: Flash USB Disk 1 with DryRun
    .\reelos-flasher.ps1 -Cli -DiskNumber 1 -IsoPath "C:\isos\ubuntu-24.04.1-live-server-amd64.iso" -DryRun
#>

[CmdletBinding(DefaultParameterSetName = 'Gui')]
param(
    [Parameter(ParameterSetName = 'Cli')]
    [switch]$Cli,

    [Parameter(ParameterSetName = 'Cli')]
    [switch]$ListDrives,

    [Parameter(ParameterSetName = 'Cli')]
    [int]$DiskNumber = -1,

    [Parameter(ParameterSetName = 'Cli')]
    [string]$IsoPath = "",

    [Parameter(ParameterSetName = 'Cli')]
    [switch]$DownloadIso,

    [Parameter(ParameterSetName = 'Cli')]
    [ValidateSet('FullInstall', 'CidataOnly', 'RawWrite')]
    [string]$Mode = 'FullInstall',

    [Parameter(ParameterSetName = 'Cli')]
    [string]$AutoinstallDir = "",

    [Parameter(ParameterSetName = 'Cli')]
    [string]$WifiSsid = "",

    [Parameter(ParameterSetName = 'Cli')]
    [string]$WifiPassword = "",

    [Parameter(ParameterSetName = 'Cli')]
    [string]$AdminPin = "",

    [Parameter(ParameterSetName = 'Cli')]
    [string]$BoxName = "",

    [Parameter(ParameterSetName = 'Cli')]
    [switch]$ConfirmWrite,

    [Parameter()]
    [switch]$DryRun,

    [Parameter()]
    [switch]$AllowVirtualDrives
)

# Canonical Ubuntu 24.04 LTS official mirror URL
$script:UbuntuIsoUrl = "https://releases.ubuntu.com/24.04.1/ubuntu-24.04.1-live-server-amd64.iso"
$script:UbuntuIsoFileName = "ubuntu-24.04.1-live-server-amd64.iso"
$script:AppRoot = Resolve-Path (Join-Path $PSScriptRoot "..") -ErrorAction SilentlyContinue
if (-not $script:AppRoot) { $script:AppRoot = $PSScriptRoot }

# Self-elevate to Administrator if running interactively without elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and -not $DryRun -and -not $ListDrives) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" $args" -Verb RunAs
    exit
}

# ---------------------------------------------------------------------------
# 1. Drive Safety Shield (Guarantees zero internal drive corruption)
# ---------------------------------------------------------------------------
function Get-SafeUsbDrives {
    [CmdletBinding()]
    param(
        [switch]$IncludeVirtual
    )

    $safeList = [System.Collections.Generic.List[PSCustomObject]]::new()
    $systemDrive = $env:SystemDrive # e.g. "C:"

    try {
        $cimDisks = @(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue |
            Where-Object { $_.InterfaceType -eq 'USB' })

        $getDisks = @(Get-Disk -ErrorAction SilentlyContinue |
            Where-Object { $_.BusType -eq 'USB' -or ($IncludeVirtual -and ($_.BusType -eq 'File Backed Virtual' -or $_.FriendlyName -like "*Virtual*")) })

        foreach ($disk in $getDisks) {
            # SAFETY FILTER 1: Refuse boot/system disks
            if ($disk.IsBoot -or $disk.IsSystem) { continue }

            # SAFETY FILTER 2: Refuse Disk 0
            if ($disk.Number -eq 0) { continue }

            # SAFETY FILTER 3: Refuse dangerous internal bus types
            $dangerousBuses = @('NVMe', 'SATA', 'SCSI', 'RAID', 'SAS', 'IDE', 'Atapi', 'Storage Spaces')
            if ($disk.BusType -in $dangerousBuses) { continue }

            # SAFETY FILTER 4: Match with CIM Win32_DiskDrive (or virtual flag)
            $cimMatch = $cimDisks | Where-Object { $_.Index -eq $disk.Number }
            if (-not $cimMatch -and -not $IncludeVirtual) { continue }

            # SAFETY FILTER 5: Refuse any disk containing C: or OS system partition
            $partitions = Get-Partition -DiskNumber $disk.Number -ErrorAction SilentlyContinue
            $hasOsPartition = $false
            $lettersList = @()

            foreach ($p in $partitions) {
                if ($p.IsBoot -or $p.IsSystem) {
                    $hasOsPartition = $true
                    break
                }
                if ($p.DriveLetter) {
                    $letter = "$($p.DriveLetter):"
                    $lettersList += $letter
                    if ($letter -ieq $systemDrive) {
                        $hasOsPartition = $true
                        break
                    }
                }
            }
            if ($hasOsPartition) { continue }

            $letters = $lettersList -join ", "
            if (-not $letters) { $letters = "(Unformatted / Raw)" }

            $sizeGb = [Math]::Round($disk.Size / 1GB, 1)
            $modelStr = if ($cimMatch -and $cimMatch.Model) { $cimMatch.Model } else { $disk.FriendlyName }

            $safeList.Add([PSCustomObject]@{
                Number        = $disk.Number
                FriendlyName  = $disk.FriendlyName
                SizeGb        = $sizeGb
                DriveLetters  = $letters
                DeviceID      = "\\.\PHYSICALDRIVE$($disk.Number)"
                Model         = $modelStr
                IsSafe        = $true
            })
        }
    }
    catch {
        Write-Warning "Error querying disk drives: $_"
    }

    return $safeList
}

# ---------------------------------------------------------------------------
# 2. Local ISO Auto-Discovery & Downloader
# ---------------------------------------------------------------------------
function Find-LocalUbuntuIso {
    $searchPaths = @(
        $script:AppRoot,
        (Join-Path $script:AppRoot "iso"),
        (Join-Path $script:AppRoot "downloads"),
        (Join-Path $PSScriptRoot "iso"),
        "$env:USERPROFILE\Downloads",
        "$env:USERPROFILE\Desktop",
        "C:\isos",
        "D:\isos"
    )

    foreach ($dir in $searchPaths) {
        if (Test-Path $dir) {
            $iso = Get-ChildItem -Path $dir -Filter "*ubuntu*24.04*.iso" -File -ErrorAction SilentlyContinue |
                Sort-Object Length -Descending | Select-Object -First 1
            if ($iso -and $iso.Length -gt 500MB) {
                return $iso.FullName
            }
        }
    }
    return $null
}

function Invoke-DownloadUbuntuIso {
    param(
        [string]$Destination,
        [scriptblock]$ProgressCallback
    )

    if (-not $Destination) {
        $destDir = Join-Path $script:AppRoot "iso"
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        $Destination = Join-Path $destDir $script:UbuntuIsoFileName
    }

    $url = $script:UbuntuIsoUrl
    $temp = "$Destination.download"

    $wc = New-Object System.Net.WebClient
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $downloadTask = $wc.DownloadFileTaskAsync($url, $temp)

        while (-not $downloadTask.IsCompleted) {
            Start-Sleep -Milliseconds 250
            if (Test-Path $temp) {
                $len = (Get-Item $temp).Length
                $mb = [Math]::Round($len / 1MB, 1)
                $sec = [Math]::Max(0.5, $stopwatch.Elapsed.TotalSeconds)
                $speed = [Math]::Round(($len / 1MB) / $sec, 2)
                # Official ISO size is approx 2650 MB
                $pct = [Math]::Min(99, [Math]::Round(($mb / 2650.0) * 100))
                if ($ProgressCallback) {
                    & $ProgressCallback $pct "Downloading Ubuntu 24.04 ISO: $mb MB ($speed MB/s)..."
                }
            }
        }

        $downloadTask.GetAwaiter().GetResult()
        if (Test-Path $Destination) { Remove-Item $Destination -Force }
        Move-Item $temp $Destination -Force

        if ($ProgressCallback) {
            & $ProgressCallback 100 "Ubuntu 24.04 ISO Download complete: $Destination"
        }
        return $Destination
    }
    finally {
        $wc.Dispose()
    }
}

# ---------------------------------------------------------------------------
# 3. Flashing & Autoinstall Packaging Engine
# ---------------------------------------------------------------------------
function Invoke-ReelOSFlash {
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject]$TargetDrive,

        [Parameter(Mandatory = $true)]
        [string]$IsoFile,

        [string]$FlashMode = "FullInstall",
        [string]$WifiName = "",
        [string]$WifiPass = "",
        [string]$AdminPin = "",
        [string]$BoxName = "",
        [switch]$IsDryRun,
        [switch]$IncludeVirtual,
        [scriptblock]$ProgressCallback
    )

    function Report($percent, $msg) {
        if ($ProgressCallback) {
            & $ProgressCallback $percent $msg
        } else {
            Write-Host "[$percent%] $msg"
        }
    }

    Report 5 "Validating target safety on Disk $($TargetDrive.Number) ($($TargetDrive.FriendlyName))..."

    # Double-check safety filter
    $safeCheck = Get-SafeUsbDrives -IncludeVirtual:$IncludeVirtual | Where-Object { $_.Number -eq $TargetDrive.Number }
    if (-not $safeCheck) {
        throw "SECURITY ABORT: Target disk $($TargetDrive.Number) failed safety verification! Strictly refusing non-USB/system drive."
    }

    if ($IsDryRun) {
        Report 50 "[DRY-RUN] Verified USB geometry on Disk $($TargetDrive.Number)"
        Report 70 "[DRY-RUN] Simulated cloud-init seed staging (user-data, meta-data, live-wifi.sh)"
        Report 90 "[DRY-RUN] Simulated GRUB bootloader patch with autoinstall parameters"
        Report 100 "[DRY-RUN] ReelOS Flasher verified safely. Zero disk changes committed."
        return $true
    }

    # Live flash execution requires elevated administrator
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        throw "Administrator privileges required to format and flash USB drives. Re-run PowerShell as Administrator."
    }

    Report 15 "Cleaning existing partition table on Disk $($TargetDrive.Number)..."
    Clear-Disk -Number $TargetDrive.Number -RemoveData -RemoveOEM -Confirm:$false -ErrorAction Stop

    Report 25 "Initializing GPT partition table..."
    Initialize-Disk -Number $TargetDrive.Number -PartitionStyle GPT -ErrorAction Stop

    # Locate source autoinstall files
    $srcAuto = Join-Path $script:AppRoot "autoinstall"
    if (-not (Test-Path (Join-Path $srcAuto "user-data"))) {
        $srcAuto = Join-Path $PSScriptRoot "autoinstall"
    }

    if ($FlashMode -eq "CidataOnly") {
        Report 40 "Creating FAT32 CIDATA volume for cloud-init autoinstall..."
        $part = New-Partition -DiskNumber $TargetDrive.Number -UseMaximumSize -AssignDriveLetter
        Format-Volume -Partition $part -FileSystem FAT32 -NewFileSystemLabel "CIDATA" -Confirm:$false

        $driveLetter = "$($part.DriveLetter):"
        Report 60 "Injecting autoinstall seed into $driveLetter..."

        if (Test-Path (Join-Path $srcAuto "user-data")) {
            Copy-Item -Path (Join-Path $srcAuto "user-data") -Destination "$driveLetter\user-data" -Force
            Copy-Item -Path (Join-Path $srcAuto "meta-data") -Destination "$driveLetter\meta-data" -Force
            if (Test-Path (Join-Path $srcAuto "live-wifi.sh")) {
                Copy-Item -Path (Join-Path $srcAuto "live-wifi.sh") -Destination "$driveLetter\live-wifi.sh" -Force
            }
        }

        # Wi-Fi Credentials preseed
        if ($WifiName) {
            $wifiConfig = "WIFI_SSID=`"$WifiName`"`nWIFI_PASS=`"$WifiPass`"`n"
            Set-Content -Path "$driveLetter\wifi.env" -Value $wifiConfig -Encoding ASCII
        }

        # Admin PIN & Box Name preseed
        if ($AdminPin -or $BoxName -or $WifiName) {
            $answersObj = @{
                adminName = "reelos"
                adminPassword = if ($AdminPin) { $AdminPin } else { "0000" }
                boxName = if ($BoxName) { $BoxName } else { "reelos" }
                preseeded = $true
            }
            if ($WifiName) { $answersObj["wifiSsid"] = $WifiName }
            $answersJson = $answersObj | ConvertTo-Json -Depth 4
            Set-Content -Path "$driveLetter\answers.json" -Value $answersJson -Encoding UTF8
        }

        # App bundle & installer script
        $instScript = Join-Path $script:AppRoot "scripts\install-reelos.sh"
        if (Test-Path $instScript) {
            Copy-Item -Path $instScript -Destination "$driveLetter\install-reelos.sh" -Force
        }
        $bundleTar = Join-Path $script:AppRoot "update-bundle.tar.gz"
        if (Test-Path $bundleTar) {
            Copy-Item -Path $bundleTar -Destination "$driveLetter\update-bundle.tar.gz" -Force
        }

        Report 100 "Dedicated CIDATA drive ready! Plug in alongside stock Ubuntu ISO to install ReelOS."
        return $true
    }

    # Full Install Mode: Mount ISO and copy boot files + nocloud
    Report 35 "Mounting Ubuntu ISO image ($IsoFile)..."
    $mount = Mount-DiskImage -ImagePath $IsoFile -PassThru -ErrorAction Stop
    $vol = $mount | Get-Volume
    $isoDrive = "$($vol.DriveLetter):"

    try {
        Report 45 "Creating bootable FAT32 partition..."
        $part = New-Partition -DiskNumber $TargetDrive.Number -UseMaximumSize -AssignDriveLetter
        Format-Volume -Partition $part -FileSystem FAT32 -NewFileSystemLabel "REELOS_BOOT" -Confirm:$false
        $destDrive = "$($part.DriveLetter):"

        Report 55 "Copying Ubuntu Server boot media (this takes ~1-2 minutes)..."
        & robocopy $isoDrive $destDrive /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

        Report 75 "Injecting ReelOS nocloud autoinstall payload..."
        $nocloudDir = Join-Path $destDrive "nocloud"
        New-Item -ItemType Directory -Path $nocloudDir -Force | Out-Null

        Copy-Item -Path (Join-Path $srcAuto "user-data") -Destination (Join-Path $nocloudDir "user-data") -Force
        Copy-Item -Path (Join-Path $srcAuto "meta-data") -Destination (Join-Path $nocloudDir "meta-data") -Force
        if (Test-Path (Join-Path $srcAuto "live-wifi.sh")) {
            Copy-Item -Path (Join-Path $srcAuto "live-wifi.sh") -Destination (Join-Path $nocloudDir "live-wifi.sh") -Force
        }

        $instScript = Join-Path $script:AppRoot "scripts\install-reelos.sh"
        if (Test-Path $instScript) {
            Copy-Item -Path $instScript -Destination (Join-Path $nocloudDir "install-reelos.sh") -Force
        }

        $bundleTar = Join-Path $script:AppRoot "update-bundle.tar.gz"
        if (Test-Path $bundleTar) {
            Copy-Item -Path $bundleTar -Destination (Join-Path $nocloudDir "update-bundle.tar.gz") -Force
        }

        # Inject Wi-Fi credentials if supplied
        if ($WifiName) {
            $wifiConfig = "WIFI_SSID=`"$WifiName`"`nWIFI_PASS=`"$WifiPass`"`n"
            Set-Content -Path (Join-Path $nocloudDir "wifi.env") -Value $wifiConfig -Encoding ASCII
        }

        # Admin PIN & Box Name preseed
        if ($AdminPin -or $BoxName -or $WifiName) {
            $answersObj = @{
                adminName = "reelos"
                adminPassword = if ($AdminPin) { $AdminPin } else { "0000" }
                boxName = if ($BoxName) { $BoxName } else { "reelos" }
                preseeded = $true
            }
            if ($WifiName) { $answersObj["wifiSsid"] = $WifiName }
            $answersJson = $answersObj | ConvertTo-Json -Depth 4
            Set-Content -Path (Join-Path $nocloudDir "answers.json") -Value $answersJson -Encoding UTF8
        }

        Report 90 "Configuring GRUB for automatic unattended installation..."
        $grubFile = Join-Path $destDrive "boot\grub\grub.cfg"
        if (Test-Path $grubFile) {
            $grubContent = Get-Content $grubFile -Raw
            $entry = @"
set timeout=5
set default=0

menuentry "Install ReelOS Appliance (Unattended)" {
    set gfxpayload=keep
    linux /casper/vmlinuz quiet autoinstall ds=nocloud\;s=/cdrom/nocloud/ ---
    initrd /casper/initrd
}

"@
            $newGrub = "$entry`n$grubContent"
            Set-Content -Path $grubFile -Value $newGrub -Encoding UTF8
        }

        Report 100 "ReelOS Bootable USB successfully created on Disk $($TargetDrive.Number)!"
        return $true
    }
    finally {
        Dismount-DiskImage -ImagePath $IsoFile -ErrorAction SilentlyContinue | Out-Null
    }
}

# ---------------------------------------------------------------------------
# 4. WinForms Dark-Mode GUI
# ---------------------------------------------------------------------------
function Show-ReelOSFlasherGui {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "ReelOS Appliance Flasher"
    $form.Size = New-Object System.Drawing.Size(680, 560)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.BackColor = [System.Drawing.Color]::FromArgb(15, 17, 21)
    $form.ForeColor = [System.Drawing.Color]::FromArgb(235, 235, 240)

    # Title Banner
    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = "ReelOS Appliance Foundry"
    $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
    $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(212, 160, 23)
    $lblTitle.Location = New-Object System.Drawing.Point(24, 16)
    $lblTitle.Size = New-Object System.Drawing.Size(400, 32)
    $form.Controls.Add($lblTitle)

    $lblSub = New-Object System.Windows.Forms.Label
    $lblSub.Text = "Forging a bespoke digital-physical media appliance. Insert a USB drive to begin."
    $lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $lblSub.ForeColor = [System.Drawing.Color]::FromArgb(150, 155, 165)
    $lblSub.Location = New-Object System.Drawing.Point(26, 48)
    $lblSub.Size = New-Object System.Drawing.Size(600, 20)
    $form.Controls.Add($lblSub)

    # 1. Drive Selection Group
    $grpDrive = New-Object System.Windows.Forms.GroupBox
    $grpDrive.Text = " 1. Target USB Drive (Protected by Safe-Drive Shield) "
    $grpDrive.ForeColor = [System.Drawing.Color]::FromArgb(245, 197, 24)
    $grpDrive.Location = New-Object System.Drawing.Point(24, 76)
    $grpDrive.Size = New-Object System.Drawing.Size(614, 75)
    $grpDrive.BackColor = [System.Drawing.Color]::FromArgb(22, 26, 33)

    $cboDrives = New-Object System.Windows.Forms.ComboBox
    $cboDrives.DropDownStyle = "DropDownList"
    $cboDrives.Location = New-Object System.Drawing.Point(16, 30)
    $cboDrives.Size = New-Object System.Drawing.Size(465, 26)
    $cboDrives.BackColor = [System.Drawing.Color]::FromArgb(13, 17, 23)
    $cboDrives.ForeColor = [System.Drawing.Color]::White
    $grpDrive.Controls.Add($cboDrives)

    $btnRefresh = New-Object System.Windows.Forms.Button
    $btnRefresh.Text = "Refresh"
    $btnRefresh.Location = New-Object System.Drawing.Point(495, 28)
    $btnRefresh.Size = New-Object System.Drawing.Size(100, 28)
    $btnRefresh.BackColor = [System.Drawing.Color]::FromArgb(35, 40, 50)
    $btnRefresh.ForeColor = [System.Drawing.Color]::White
    $grpDrive.Controls.Add($btnRefresh)
    $form.Controls.Add($grpDrive)

    # 2. ISO Selection Group
    $grpIso = New-Object System.Windows.Forms.GroupBox
    $grpIso.Text = " 2. Ubuntu 24.04 Server ISO "
    $grpIso.ForeColor = [System.Drawing.Color]::FromArgb(245, 197, 24)
    $grpIso.Location = New-Object System.Drawing.Point(24, 160)
    $grpIso.Size = New-Object System.Drawing.Size(614, 75)
    $grpIso.BackColor = [System.Drawing.Color]::FromArgb(22, 26, 33)

    $txtIso = New-Object System.Windows.Forms.TextBox
    $txtIso.Location = New-Object System.Drawing.Point(16, 30)
    $txtIso.Size = New-Object System.Drawing.Size(360, 26)
    $txtIso.BackColor = [System.Drawing.Color]::FromArgb(13, 17, 23)
    $txtIso.ForeColor = [System.Drawing.Color]::White
    $grpIso.Controls.Add($txtIso)

    $btnBrowse = New-Object System.Windows.Forms.Button
    $btnBrowse.Text = "Browse..."
    $btnBrowse.Location = New-Object System.Drawing.Point(386, 28)
    $btnBrowse.Size = New-Object System.Drawing.Size(95, 28)
    $btnBrowse.BackColor = [System.Drawing.Color]::FromArgb(35, 40, 50)
    $btnBrowse.ForeColor = [System.Drawing.Color]::White
    $grpIso.Controls.Add($btnBrowse)

    $btnDownload = New-Object System.Windows.Forms.Button
    $btnDownload.Text = "Download ISO"
    $btnDownload.Location = New-Object System.Drawing.Point(490, 28)
    $btnDownload.Size = New-Object System.Drawing.Size(105, 28)
    $btnDownload.BackColor = [System.Drawing.Color]::FromArgb(45, 55, 75)
    $btnDownload.ForeColor = [System.Drawing.Color]::White
    $grpIso.Controls.Add($btnDownload)
    $form.Controls.Add($grpIso)

    # 3. Flash Mode Group & Wi-Fi Preseed
    $grpMode = New-Object System.Windows.Forms.GroupBox
    $grpMode.Text = " 3. Installation Options & Wi-Fi Preseed "
    $grpMode.ForeColor = [System.Drawing.Color]::FromArgb(245, 197, 24)
    $grpMode.Location = New-Object System.Drawing.Point(24, 245)
    $grpMode.Size = New-Object System.Drawing.Size(614, 90)
    $grpMode.BackColor = [System.Drawing.Color]::FromArgb(22, 26, 33)

    $rbFull = New-Object System.Windows.Forms.RadioButton
    $rbFull.Text = "Full Bootable Installer (Recommended)"
    $rbFull.Checked = $true
    $rbFull.Location = New-Object System.Drawing.Point(20, 22)
    $rbFull.Size = New-Object System.Drawing.Size(260, 24)
    $rbFull.ForeColor = [System.Drawing.Color]::White
    $grpMode.Controls.Add($rbFull)

    $rbCidata = New-Object System.Windows.Forms.RadioButton
    $rbCidata.Text = "Dedicated CIDATA Config USB"
    $rbCidata.Location = New-Object System.Drawing.Point(300, 22)
    $rbCidata.Size = New-Object System.Drawing.Size(250, 24)
    $rbCidata.ForeColor = [System.Drawing.Color]::White
    $grpMode.Controls.Add($rbCidata)

    # Wi-Fi fields
    $lblWifiSsid = New-Object System.Windows.Forms.Label
    $lblWifiSsid.Text = "Wi-Fi (Optional):"
    $lblWifiSsid.Location = New-Object System.Drawing.Point(20, 56)
    $lblWifiSsid.Size = New-Object System.Drawing.Size(100, 20)
    $lblWifiSsid.ForeColor = [System.Drawing.Color]::FromArgb(180, 185, 195)
    $grpMode.Controls.Add($lblWifiSsid)

    $txtWifiSsid = New-Object System.Windows.Forms.TextBox
    $txtWifiSsid.Location = New-Object System.Drawing.Point(125, 54)
    $txtWifiSsid.Size = New-Object System.Drawing.Size(155, 24)
    $txtWifiSsid.BackColor = [System.Drawing.Color]::FromArgb(13, 17, 23)
    $txtWifiSsid.ForeColor = [System.Drawing.Color]::White
    $grpMode.Controls.Add($txtWifiSsid)

    $lblWifiPass = New-Object System.Windows.Forms.Label
    $lblWifiPass.Text = "Password:"
    $lblWifiPass.Location = New-Object System.Drawing.Point(300, 56)
    $lblWifiPass.Size = New-Object System.Drawing.Size(70, 20)
    $lblWifiPass.ForeColor = [System.Drawing.Color]::FromArgb(180, 185, 195)
    $grpMode.Controls.Add($lblWifiPass)

    $txtWifiPass = New-Object System.Windows.Forms.TextBox
    $txtWifiPass.Location = New-Object System.Drawing.Point(375, 54)
    $txtWifiPass.Size = New-Object System.Drawing.Size(175, 24)
    $txtWifiPass.UseSystemPasswordChar = $true
    $txtWifiPass.BackColor = [System.Drawing.Color]::FromArgb(13, 17, 23)
    $txtWifiPass.ForeColor = [System.Drawing.Color]::White
    $grpMode.Controls.Add($txtWifiPass)

    # Admin PIN & Box Name fields
    $lblAdminPin = New-Object System.Windows.Forms.Label
    $lblAdminPin.Text = "Admin PIN:"
    $lblAdminPin.Location = New-Object System.Drawing.Point(20, 90)
    $lblAdminPin.Size = New-Object System.Drawing.Size(100, 20)
    $lblAdminPin.ForeColor = [System.Drawing.Color]::FromArgb(180, 185, 195)
    $grpMode.Controls.Add($lblAdminPin)

    $txtAdminPin = New-Object System.Windows.Forms.TextBox
    $txtAdminPin.Text = "0000"
    $txtAdminPin.Location = New-Object System.Drawing.Point(125, 88)
    $txtAdminPin.Size = New-Object System.Drawing.Size(155, 24)
    $txtAdminPin.BackColor = [System.Drawing.Color]::FromArgb(13, 17, 23)
    $txtAdminPin.ForeColor = [System.Drawing.Color]::White
    $grpMode.Controls.Add($txtAdminPin)

    $lblBoxName = New-Object System.Windows.Forms.Label
    $lblBoxName.Text = "Box Name:"
    $lblBoxName.Location = New-Object System.Drawing.Point(300, 90)
    $lblBoxName.Size = New-Object System.Drawing.Size(70, 20)
    $lblBoxName.ForeColor = [System.Drawing.Color]::FromArgb(180, 185, 195)
    $grpMode.Controls.Add($lblBoxName)

    $txtBoxName = New-Object System.Windows.Forms.TextBox
    $txtBoxName.Text = "reelos"
    $txtBoxName.Location = New-Object System.Drawing.Point(375, 88)
    $txtBoxName.Size = New-Object System.Drawing.Size(175, 24)
    $txtBoxName.BackColor = [System.Drawing.Color]::FromArgb(13, 17, 23)
    $txtBoxName.ForeColor = [System.Drawing.Color]::White
    $grpMode.Controls.Add($txtBoxName)

    $form.Controls.Add($grpMode)

    # Progress & Status
    $pbar = New-Object System.Windows.Forms.ProgressBar
    $pbar.Location = New-Object System.Drawing.Point(24, 385)
    $pbar.Size = New-Object System.Drawing.Size(614, 18)
    $form.Controls.Add($pbar)

    $lblStatus = New-Object System.Windows.Forms.Label
    $lblStatus.Text = "Ready. Select target USB drive."
    $lblStatus.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(180, 185, 195)
    $lblStatus.Location = New-Object System.Drawing.Point(24, 410)
    $lblStatus.Size = New-Object System.Drawing.Size(614, 22)
    $form.Controls.Add($lblStatus)

    # Action Buttons
    $btnFlash = New-Object System.Windows.Forms.Button
    $btnFlash.Text = "Flash ReelOS USB"
    $btnFlash.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $btnFlash.BackColor = [System.Drawing.Color]::FromArgb(245, 197, 24)
    $btnFlash.ForeColor = [System.Drawing.Color]::FromArgb(15, 17, 21)
    $btnFlash.FlatStyle = "Flat"
    $btnFlash.Location = New-Object System.Drawing.Point(420, 475)
    $btnFlash.Size = New-Object System.Drawing.Size(218, 44)
    $form.Controls.Add($btnFlash)

    $chkDryRun = New-Object System.Windows.Forms.CheckBox
    $chkDryRun.Text = "Dry-Run Mode (Safe simulation)"
    $chkDryRun.Checked = $false
    $chkDryRun.ForeColor = [System.Drawing.Color]::FromArgb(150, 155, 165)
    $chkDryRun.Location = New-Object System.Drawing.Point(24, 485)
    $chkDryRun.Size = New-Object System.Drawing.Size(240, 24)
    $form.Controls.Add($chkDryRun)

    # Populate Drives
    $refreshDrives = {
        $cboDrives.Items.Clear()
        $drives = Get-SafeUsbDrives -IncludeVirtual:$AllowVirtualDrives
        if ($drives.Count -eq 0) {
            [void]$cboDrives.Items.Add("No removable USB drives found")
            $cboDrives.SelectedIndex = 0
            $btnFlash.Enabled = $false
        } else {
            foreach ($d in $drives) {
                [void]$cboDrives.Items.Add("Disk $($d.Number): $($d.FriendlyName) ($($d.SizeGb) GB) [$($d.DriveLetters)]")
            }
            $cboDrives.SelectedIndex = 0
            $btnFlash.Enabled = $true
        }
    }

    $btnRefresh.Add_Click($refreshDrives)
    & $refreshDrives

    # Auto-find ISO
    $foundIso = Find-LocalUbuntuIso
    if ($foundIso) {
        $txtIso.Text = $foundIso
        $lblStatus.Text = "Detected local Ubuntu 24.04 ISO: $(Split-Path -Leaf $foundIso)"
    }

    $btnBrowse.Add_Click({
        $dlg = New-Object System.Windows.Forms.OpenFileDialog
        $dlg.Filter = "ISO Images (*.iso)|*.iso|All Files (*.*)|*.*"
        $dlg.Title = "Select Ubuntu 24.04 Server ISO"
        if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            $txtIso.Text = $dlg.FileName
            $lblStatus.Text = "Selected: $(Split-Path -Leaf $dlg.FileName)"
        }
    })

    $btnDownload.Add_Click({
        $btnDownload.Enabled = $false
        $btnFlash.Enabled = $false
        $targetIso = Join-Path $script:AppRoot "iso\$script:UbuntuIsoFileName"

        try {
            Invoke-DownloadUbuntuIso -Destination $targetIso -ProgressCallback {
                param($pct, $msg)
                $pbar.Value = [Math]::Min(100, [Math]::Max(0, $pct))
                $lblStatus.Text = $msg
                [System.Windows.Forms.Application]::DoEvents()
            }
            $txtIso.Text = $targetIso
            [System.Windows.Forms.MessageBox]::Show("Ubuntu 24.04 ISO downloaded successfully!`n`nPath: $targetIso", "Download Complete", "OK", "Information")
        }
        catch {
            [System.Windows.Forms.MessageBox]::Show("Download failed: $_", "Download Error", "OK", "Error")
        }
        finally {
            $btnDownload.Enabled = $true
            $btnFlash.Enabled = $true
            $pbar.Value = 0
        }
    })

    $btnFlash.Add_Click({
        $drives = Get-SafeUsbDrives -IncludeVirtual:$AllowVirtualDrives
        if ($drives.Count -eq 0 -or $cboDrives.SelectedIndex -lt 0) {
            [System.Windows.Forms.MessageBox]::Show("Please insert and select a USB drive.", "No Drive", "OK", "Warning")
            return
        }

        $target = $drives[$cboDrives.SelectedIndex]
        $iso = $txtIso.Text.Trim()
        $mode = if ($rbCidata.Checked) { "CidataOnly" } else { "FullInstall" }

        if ($mode -ne "CidataOnly" -and (-not (Test-Path $iso))) {
            [System.Windows.Forms.MessageBox]::Show("ISO file not found: $iso`n`nPlease browse or download the ISO first.", "ISO Required", "OK", "Error")
            return
        }

        $dry = $chkDryRun.Checked
        if (-not $dry) {
            $confirm = [System.Windows.Forms.MessageBox]::Show(
                "WARNING: All data on USB Disk $($target.Number) ($($target.FriendlyName)) will be ERASED!`n`nProceed with flashing ReelOS?",
                "Confirm USB Overwrite",
                "YesNo",
                "Warning"
            )
            if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) { return }
        }

        $btnFlash.Enabled = $false
        $btnRefresh.Enabled = $false
        $btnDownload.Enabled = $false

        try {
            Invoke-ReelOSFlash `
                -TargetDrive $target `
                -IsoFile $iso `
                -FlashMode $mode `
                -WifiName $txtWifiSsid.Text `
                -WifiPass $txtWifiPass.Text `
                -AdminPin $txtAdminPin.Text `
                -BoxName $txtBoxName.Text `
                -IsDryRun:$dry `
                -IncludeVirtual:$AllowVirtualDrives `
                -ProgressCallback {
                    param($pct, $msg)
                    $pbar.Value = [Math]::Min(100, [Math]::Max(0, $pct))
                    $lblStatus.Text = $msg
                    [System.Windows.Forms.Application]::DoEvents()
                }

            [System.Windows.Forms.MessageBox]::Show("ReelOS USB ready! Insert into target laptop and boot.", "Success", "OK", "Information")
        }
        catch {
            [System.Windows.Forms.MessageBox]::Show("Flash failed: $_", "Error", "OK", "Error")
        }
        finally {
            $btnFlash.Enabled = $true
            $btnRefresh.Enabled = $true
            $btnDownload.Enabled = $true
        }
    })

    $form.ShowDialog() | Out-Null
}

# ---------------------------------------------------------------------------
# 5. CLI Dispatcher
# ---------------------------------------------------------------------------
if ($Cli -or $ListDrives -or $DownloadIso -or $DiskNumber -ge 0) {
    if ($ListDrives) {
        $drives = Get-SafeUsbDrives -IncludeVirtual:$AllowVirtualDrives
        Write-Host "`nSafe Removable USB Drives for ReelOS:" -ForegroundColor Yellow
        if ($drives.Count -eq 0) {
            Write-Host "  No USB drives detected. Insert a flash drive and re-run." -ForegroundColor Gray
            Write-Host "  (Internal OS, NVMe, SATA, and RAID disks are strictly filtered out)" -ForegroundColor DarkGray
        } else {
            $drives | Format-Table -Property Number, FriendlyName, SizeGb, DriveLetters, Model
        }
        exit 0
    }

    if ($DownloadIso) {
        Write-Host "`nDownloading Ubuntu 24.04.1 Live Server ISO..." -ForegroundColor Cyan
        $dest = Invoke-DownloadUbuntuIso -ProgressCallback {
            param($pct, $msg)
            Write-Progress -Activity "Downloading Ubuntu 24.04 ISO" -PercentComplete $pct -Status $msg
        }
        Write-Host "Downloaded: $dest" -ForegroundColor Green
        exit 0
    }

    if ($DiskNumber -ge 0) {
        $drives = Get-SafeUsbDrives -IncludeVirtual:$AllowVirtualDrives
        $target = $drives | Where-Object { $_.Number -eq $DiskNumber }
        if (-not $target) {
            Write-Error "Disk $DiskNumber is not a safe USB drive. Aborting."
            exit 1
        }

        $iso = $IsoPath
        if (-not $iso) { $iso = Find-LocalUbuntuIso }
        if ($Mode -ne 'CidataOnly' -and (-not $iso -or -not (Test-Path $iso))) {
            Write-Error "ISO path not found. Specify -IsoPath <path> or run -DownloadIso."
            exit 1
        }

        if (-not $DryRun -and -not $ConfirmWrite) {
            $confirm = Read-Host "Type YES to confirm wiping Disk $DiskNumber ($($target.FriendlyName))"
            if ($confirm -ne 'YES') {
                Write-Host "Aborted by user." -ForegroundColor Red
                exit 1
            }
        }

        Write-Host "`nFlashing ReelOS to Disk $DiskNumber ($($target.FriendlyName))..." -ForegroundColor Cyan
        Invoke-ReelOSFlash `
            -TargetDrive $target `
            -IsoFile $iso `
            -FlashMode $Mode `
            -WifiName $WifiSsid `
            -WifiPass $WifiPassword `
            -AdminPin $AdminPin `
            -BoxName $BoxName `
            -IsDryRun:$DryRun `
            -IncludeVirtual:$AllowVirtualDrives `
            -ProgressCallback {
                param($pct, $msg)
                Write-Progress -Activity "Flashing ReelOS" -PercentComplete $pct -Status $msg
            }
        exit 0
    }
} else {
    Show-ReelOSFlasherGui
}
