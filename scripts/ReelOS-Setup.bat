@echo off
echo ReelOS Windows Native Delivery
echo Select mode:
echo 1) Mode A (Native Windows Services) - Node.js 22 LTS, Decypharr, Caddy (Zero-VM overhead, native GPU transcoding)
echo 2) Mode B (Bare-Metal Debian 12 USB Flasher)
set /p mode="Choose 1 or 2: "
if "%mode%"=="1" (
    powershell -ExecutionPolicy Bypass -File "%~dp0build-windows-installer.ps1"
) else if "%mode%"=="2" (
    powershell -ExecutionPolicy Bypass -File "%~dp0build-windows-installer.ps1" -ModeB
) else (
    echo Invalid choice.
)
