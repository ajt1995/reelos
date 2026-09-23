Add-Type -AssemblyName System.Drawing

$srcPath = "$PSScriptRoot\..\clients\android\app\src\main\res\drawable-nodpi\reelos_launcher.png"
if (-not (Test-Path $srcPath)) {
    Write-Error "Source file not found: $srcPath"
    exit 1
}

$src = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Output "Loaded master icon: $($src.Width)x$($src.Height)"

# Android standard launcher sizes
$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$baseRes = "$PSScriptRoot\..\clients\android\app\src\main\res"

foreach ($entry in $sizes.GetEnumerator()) {
    $folder = Join-Path $baseRes $entry.Key
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }
    $targetSize = $entry.Value
    $destBmp = New-Object System.Drawing.Bitmap($targetSize, $targetSize)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($src, 0, 0, $targetSize, $targetSize)
    $g.Dispose()

    $destPath = Join-Path $folder "ic_launcher.png"
    $destPathRound = Join-Path $folder "ic_launcher_round.png"
    
    $destBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Save($destPathRound, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Output "Generated $folder -> ${targetSize}x${targetSize}"
}

# Also generate 108dp adaptive foreground / background if needed (432x432 for xxxhdpi)
# In adaptive icons, 108dp contains 72dp safe area (the central 66%)
# So the foreground should scale the central R to fill 72dp of 108dp (66.6% size)
$fgSize = 432
$fgBmp = New-Object System.Drawing.Bitmap($fgSize, $fgSize)
$gFg = [System.Drawing.Graphics]::FromImage($fgBmp)
$gFg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gFg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gFg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gFg.Clear([System.Drawing.Color]::Transparent)

# Draw master image centered
$gFg.DrawImage($src, 0, 0, $fgSize, $fgSize)
$gFg.Dispose()

$fgPath = "$PSScriptRoot\..\clients\android\app\src\main\res\drawable-nodpi\ic_launcher_foreground.png"
$fgBmp.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
$fgBmp.Dispose()
Write-Output "Generated adaptive foreground: $fgPath"

$src.Dispose()
Write-Output "Done generating launcher icons!"
