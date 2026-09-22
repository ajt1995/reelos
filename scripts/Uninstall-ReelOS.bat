@echo off
title Uninstall ReelOS Native leftovers
echo This stops the old test box on :8080/:8096 and wipes local wizard state.
echo It does not delete your git repo, node_modules, or media.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-windows-native.ps1" -FactoryReset -AlsoVm
echo.
pause
