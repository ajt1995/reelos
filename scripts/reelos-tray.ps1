Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Create context menu
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

$menuOpen = $contextMenu.Items.Add("Open ReelOS Home")
$menuOpen.add_Click({
    [System.Diagnostics.Process]::Start("http://localhost:8080/")
})

$menuTv = $contextMenu.Items.Add("TV Couch Mode (/tv)")
$menuTv.add_Click({
    [System.Diagnostics.Process]::Start("http://localhost:8080/tv")
})

$menuSettings = $contextMenu.Items.Add("Settings and Diagnostics (/settings)")
$menuSettings.add_Click({
    [System.Diagnostics.Process]::Start("http://localhost:8080/settings")
})

$contextMenu.Items.Add("-") | Out-Null

$menuTvAdb = $contextMenu.Items.Add("Living Room Android TV (192.168.1.95)")
$menuTvAdb.add_Click({
    [System.Diagnostics.Process]::Start("http://localhost:8080/settings")
})

$contextMenu.Items.Add("-") | Out-Null

$menuExit = $contextMenu.Items.Add("Stop ReelOS")
$menuExit.add_Click({
    $notifyIcon.Visible = $false
    # Stop ReelOS node processes on port 8080
    Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    [System.Windows.Forms.Application]::Exit()
})

# Create System Tray NotifyIcon
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Text = "ReelOS Media Appliance (Online :8080)"

# Use reliable system icon that renders perfectly across all DPI scales
$notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
$notifyIcon.ContextMenuStrip = $contextMenu
$notifyIcon.Visible = $true

# Left-click opens ReelOS Home
$notifyIcon.add_MouseClick({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        [System.Diagnostics.Process]::Start("http://localhost:8080/")
    }
})

# Double-click opens ReelOS Home
$notifyIcon.add_DoubleClick({
    [System.Diagnostics.Process]::Start("http://localhost:8080/")
})

# Balloon tip notification on startup
$notifyIcon.ShowBalloonTip(3000, "ReelOS is Running", "Direct Hardware Scaling active on port 8080. Right-click for options.", [System.Windows.Forms.ToolTipIcon]::Info)

# Run message loop
[System.Windows.Forms.Application]::Run()
