<#
.SYNOPSIS
  Compatibility entry point for the honest Windows runtime packer.

.DESCRIPTION
  ReelOS does not yet have a signed Windows installer or a certified USB
  target. The default action builds only the source-runtime ZIP and never
  mutates household state. -ModeB fails closed instead of presenting the old
  USB prototype as a supported installer.
#>
[CmdletBinding()]
param(
    [switch]$ModeB,
    [string]$OutputDirectory,
    [switch]$Replace
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($ModeB) {
    throw "Bootable Windows/USB installation is unavailable until a real target passes install, recovery, and rollback acceptance."
}

$packer = Join-Path $PSScriptRoot "pack-windows-bundle.ps1"
if (-not (Test-Path -LiteralPath $packer)) {
    throw "Windows runtime packer is missing: $packer"
}

Write-Host "Building an unsigned ReelOS Windows runtime ZIP. This is not a signed installer." -ForegroundColor Cyan
& $packer -OutputDirectory $OutputDirectory -Replace:$Replace
