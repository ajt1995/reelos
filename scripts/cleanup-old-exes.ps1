$toDelete = @(
    "C:\Users\austi\Desktop\ReelOS.exe",
    "C:\Users\austi\Desktop\ReelOS_Installers\ReelOS-Setup.exe",
    "C:\Users\austi\Desktop\ReelOS_Installers\ReelOS.exe",
    "C:\Users\austi\Downloads\ReelOS-Uninstall.exe",
    "C:\Users\austi\OneDrive\Desktop\ReelOS-Setup.exe",
    "C:\Users\austi\OneDrive\ReelOS_Installers\ReelOS-Setup.exe",
    "C:\Users\austi\reelos\ReelOS-Setup.exe",
    "C:\Users\austi\reelos\ReelOS.exe",
    "C:\Users\austi\reelos\dist-windows\ReelOS-Setup.exe",
    "C:\Users\austi\reelos\flasher\ReelOS-Setup.exe",
    "C:\Users\austi\reelos\flasher\reelos-flasher.exe",
    "C:\Users\austi\reelos\src\installer\ReelOS.exe"
)

foreach ($f in $toDelete) {
    if (Test-Path $f) {
        Remove-Item -Path $f -Force
        Write-Host "Deleted: $f"
    }
}

if (Test-Path "C:\Users\austi\reelos - Copy") {
    Remove-Item -Path "C:\Users\austi\reelos - Copy" -Recurse -Force
    Write-Host "Deleted directory: C:\Users\austi\reelos - Copy"
}

if (Test-Path "C:\Users\austi\.gemini\antigravity\scratch\reelos\flasher") {
    Remove-Item -Path "C:\Users\austi\.gemini\antigravity\scratch\reelos\flasher" -Recurse -Force
    Write-Host "Deleted scratch flasher"
}

Write-Host ">>> Cleanup complete. Only verified fresh ReelOS.exe remains."
