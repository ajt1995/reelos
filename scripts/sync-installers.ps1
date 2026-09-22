<#
.SYNOPSIS
  Builds a local Windows runtime bundle.

.DESCRIPTION
  This legacy-named entry point deliberately does not synchronise anything.
  It neither stops ReelOS nor touches an installed copy, cloud folder, or
  household state. It produces only a local, unsigned runtime bundle.
#>
[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [switch]$Replace
)

$ErrorActionPreference = "Stop"
$packer = Join-Path $PSScriptRoot "pack-windows-bundle.ps1"
if (-not (Test-Path -LiteralPath $packer)) {
    throw "Windows bundle packer is missing: $packer"
}

Write-Host "Building an isolated local Windows runtime bundle. No installer is launched or synced." -ForegroundColor Cyan
& $packer -OutputDirectory $OutputDirectory -Replace:$Replace
