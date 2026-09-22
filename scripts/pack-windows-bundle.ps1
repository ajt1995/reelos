<#
.SYNOPSIS
  Creates a source-only Windows runtime bundle for release staging.

.NOTES
  This script is intentionally pure: it never stops a process, updates an
  installed copy, reads household state, creates credentials, or copies to a
  network/cloud location. It does not claim to produce a signed installer.
#>
[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [switch]$Replace
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $root "dist-windows"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$bundlePath = Join-Path $OutputDirectory "ReelOS.runtime.zip"

# The shared boundary excludes .reelos-state, private presets, credentials,
# retired server-stack paths, nested artifacts, and test-only sources.
$boundary = Join-Path $root "scripts\release-artifact-boundary.mjs"
$node = (Get-Command node -ErrorAction Stop).Source

if (Test-Path -LiteralPath $bundlePath) {
    if (-not $Replace) {
        throw "Refusing to overwrite $bundlePath. Pass -Replace for this generated artifact."
    }
    Remove-Item -LiteralPath $bundlePath -Force
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$staging = Join-Path ([IO.Path]::GetTempPath()) ("reelos-runtime-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
try {
    & $node $boundary stage --root $root --artifact $staging --platform windows
    if ($LASTEXITCODE -ne 0) { throw "Shared release artifact verification failed ($LASTEXITCODE)." }
    if (-not (Test-Path -LiteralPath (Join-Path $staging "bundle-manifest.json"))) {
        throw "Shared release boundary did not create bundle-manifest.json."
    }
    [IO.Compression.ZipFile]::CreateFromDirectory($staging, $bundlePath)
} finally {
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}

$sizeMb = [math]::Round((Get-Item -LiteralPath $bundlePath).Length / 1MB, 2)
Write-Host "Created local runtime bundle: $bundlePath ($sizeMb MB)" -ForegroundColor Green
Write-Host "No executable was compiled, signed, installed, stopped, or synced." -ForegroundColor Yellow
