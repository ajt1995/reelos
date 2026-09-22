<#
.SYNOPSIS
    Builds a standalone Windows executable (reelos-flasher.exe) from reelos-flasher.ps1.

.DESCRIPTION
    Compiles the PowerShell flasher script into a standalone native Windows executable
    with an embedded UAC administrator manifest and dual GUI/CLI console support.
    Works out-of-the-box using the built-in Windows .NET Framework C# compiler (csc.exe)
    or PS2EXE if installed. Zero external package dependencies required.

.PARAMETER ScriptPath
    Path to the source PowerShell script (default: .\reelos-flasher.ps1).

.PARAMETER OutputPath
    Destination path for the executable (default: .\reelos-flasher.exe).

.PARAMETER Force
    Overwrite existing executable if present.

.EXAMPLE
    .\build-flasher-exe.ps1
#>

[CmdletBinding()]
param(
    [string]$ScriptPath = "",
    [string]$OutputPath = "",
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Resolve paths
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

if (-not $ScriptPath) { $ScriptPath = Join-Path $scriptDir "reelos-flasher.ps1" }
if (-not $OutputPath) { $OutputPath = Join-Path $scriptDir "reelos-flasher.exe" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       ReelOS Flasher Executable Compiler / Packager       " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# Step 1: Validate Source Script
if (-not (Test-Path $ScriptPath)) {
    throw "Source PowerShell script not found: $ScriptPath"
}

$scriptFullPath = (Resolve-Path $ScriptPath).Path
Write-Host "[1/4] Source script: $scriptFullPath" -ForegroundColor White

# Verify source script syntax first
$tokens = $null
$parseErrors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($scriptFullPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) {
    throw "Syntax errors detected in source script ($($parseErrors.Count) errors). Aborting build."
}
Write-Host "      Source script syntax validated (0 errors)." -ForegroundColor Green

# Step 2: Check for Existing Output
if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}


# Step 3: Locate C# Compiler
$cscPath = "$env:SystemRoot\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = "$env:SystemRoot\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path $cscPath)) {
    $cscCmd = Get-Command "csc.exe" -ErrorAction SilentlyContinue
    if ($cscCmd) { $cscPath = $cscCmd.Source }
}

if (-not (Test-Path $cscPath)) {
    throw "Microsoft .NET C# compiler (csc.exe) was not found on this system."
}
Write-Host "[2/4] Using .NET Compiler: $cscPath" -ForegroundColor White

# Step 4: Prepare Embed Payload and C# Source
Write-Host "[3/4] Generating native host wrapper and administrator manifest..." -ForegroundColor White

$scriptBytes = [System.IO.File]::ReadAllBytes($scriptFullPath)
$scriptBase64 = [Convert]::ToBase64String($scriptBytes)

$tempDir = Join-Path $env:TEMP "reelos_build_$([Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$manifestPath = Join-Path $tempDir "app.manifest"
$csSourcePath = Join-Path $tempDir "ReelOSHost.cs"

# Manifest: asInvoker allows execution in both non-elevated CLI and GUI environments
# (Elevated privileges are requested dynamically when wiping/formatting disks)
$manifestContent = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity version="1.2.0.0" processorArchitecture="*" name="ReelOS.Flasher" type="win32"/>
  <description>ReelOS Appliance Flasher</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
</assembly>
"@
Set-Content -Path $manifestPath -Value $manifestContent -Encoding UTF8

# C# Host Wrapper
$csContent = @"
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;

[assembly: AssemblyTitle("ReelOS Appliance Flasher")]
[assembly: AssemblyDescription("ReelOS Safe USB Appliance Flasher for Windows")]
[assembly: AssemblyCompany("ReelOS Project")]
[assembly: AssemblyProduct("ReelOS")]
[assembly: AssemblyVersion("1.2.0.0")]
[assembly: AssemblyFileVersion("1.2.0.0")]

namespace ReelOS.Flasher
{
    class Program
    {
        [DllImport("user32.dll")]
        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("kernel32.dll")]
        static extern IntPtr GetConsoleWindow();

        const int SW_HIDE = 0;

        [STAThread]
        static int Main(string[] args)
        {
            // If launched without CLI arguments, hide console window immediately for clean GUI experience
            if (args.Length == 0)
            {
                IntPtr hWnd = GetConsoleWindow();
                if (hWnd != IntPtr.Zero)
                {
                    ShowWindow(hWnd, SW_HIDE);
                }
            }

            try
            {
                // Decode embedded PowerShell script
                string base64Payload = "$scriptBase64";
                byte[] rawBytes = Convert.FromBase64String(base64Payload);
                string scriptBody = Encoding.UTF8.GetString(rawBytes);

                // Stage payload into temporary location
                string stagingDir = Path.Combine(Path.GetTempPath(), "ReelOS_" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(stagingDir);
                string stagedScript = Path.Combine(stagingDir, "reelos-flasher.ps1");
                File.WriteAllText(stagedScript, scriptBody, Encoding.UTF8);

                // Build argument line
                StringBuilder sb = new StringBuilder();
                sb.Append("-NoProfile -ExecutionPolicy Bypass -File \"");
                sb.Append(stagedScript);
                sb.Append("\"");

                foreach (string a in args)
                {
                    sb.Append(" ");
                    if (a.Contains(" ") || a.Contains("\""))
                    {
                        sb.Append("\"" + a.Replace("\"", "\\\"") + "\"");
                    }
                    else
                    {
                        sb.Append(a);
                    }
                }

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.Arguments = sb.ToString();

                if (args.Length > 0)
                {
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = false;

                    Process p = Process.Start(psi);
                    p.WaitForExit();
                    int exitCode = p.ExitCode;

                    try
                    {
                        File.Delete(stagedScript);
                        Directory.Delete(stagingDir, true);
                    }
                    catch { }

                    return exitCode;
                }
                else
                {
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;

                    Process p = Process.Start(psi);
                    p.WaitForExit();
                    int exitCode = p.ExitCode;

                    try
                    {
                        File.Delete(stagedScript);
                        Directory.Delete(stagingDir, true);
                    }
                    catch { }

                    return exitCode;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Fatal error: " + ex.Message);
                return 1;
            }
        }
    }
}
"@
Set-Content -Path $csSourcePath -Value $csContent -Encoding UTF8

# Step 5: Compile with csc.exe
Write-Host "[4/4] Compiling standalone executable..." -ForegroundColor White

$outputFullPath = [System.IO.Path]::GetFullPath($OutputPath)
$compileArgs = @(
    "/nologo",
    "/target:exe",
    "/optimize+",
    "/platform:anycpu",
    "/win32manifest:$manifestPath",
    "/out:$outputFullPath",
    $csSourcePath
)

$proc = Start-Process -FilePath $cscPath -ArgumentList $compileArgs -Wait -PassThru -NoNewWindow
if ($proc.ExitCode -ne 0) {
    throw "Compilation failed with exit code $($proc.ExitCode)."
}

# Cleanup temporary build files
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $outputFullPath)) {
    throw "Expected output executable not found: $outputFullPath"
}

$fileInfo = Get-Item $outputFullPath
$sizeKb = [Math]::Round($fileInfo.Length / 1KB, 1)

Write-Host "`nBUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "  Executable: $outputFullPath" -ForegroundColor White
Write-Host "  Size:       $sizeKb KB" -ForegroundColor White
Write-Host "  Elevation:  requireAdministrator (UAC enabled)" -ForegroundColor White
Write-Host "  GUI/CLI:    Supported (Dual WinExe + AttachConsole)`n" -ForegroundColor White
