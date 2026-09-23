param(
    [Parameter(Mandatory)][string]$Device,
    [ValidateSet('Inspect','Tap','Type','Key')][string]$Action = 'Inspect',
    [string]$Value,
    [string]$Adb = 'C:\Users\austi\Documents\Codex\.toolchains\android-sdk\platform-tools\adb.exe'
)
$ErrorActionPreference = 'Stop'
$expectedPackage = 'com.reelos.nativepreview'
$foreground = (& $Adb -s $Device shell dumpsys activity activities) -join "`n"
if ($foreground -notmatch 'topResumedActivity=.*com\.reelos\.nativepreview/') {
    throw 'Isolated validation app is not foreground; no input sent.'
}
function Read-NativeUi {
    $dumpResult = (& $Adb -s $Device shell uiautomator dump /sdcard/reelos-native-validation.xml 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0 -or $dumpResult -notmatch 'UI hierchary dumped to:') { throw "Fresh UI dump failed: $dumpResult" }
    [xml]$tree = (& $Adb -s $Device shell cat /sdcard/reelos-native-validation.xml) -join ''
    return $tree
}
if ($Action -eq 'Tap') {
    $tree = Read-NativeUi
    $matches = @($tree.SelectNodes('//node') | Where-Object { $_.package -eq $expectedPackage -and $_.text -eq $Value })
    if ($matches.Count -ne 1) { throw "Expected one visible '$Value', found $($matches.Count)." }
    $target = $matches[0]
    while ($target -and $target.clickable -ne 'true') { $target = $target.ParentNode }
    if (-not $target -or $target.enabled -ne 'true') { throw 'Control is not enabled/clickable.' }
    $bounds = [regex]::Match($target.bounds, '^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$')
    if (-not $bounds.Success) { throw 'No observed control bounds.' }
    $x = [int](([int]$bounds.Groups[1].Value + [int]$bounds.Groups[3].Value) / 2)
    $y = [int](([int]$bounds.Groups[2].Value + [int]$bounds.Groups[4].Value) / 2)
    & $Adb -s $Device shell input tap $x $y
} elseif ($Action -eq 'Type') {
    if ($Value -notmatch '^[a-zA-Z0-9_-]{1,80}$') { throw 'Only non-sensitive ASCII validation text is supported.' }
    $tree = Read-NativeUi
    $focused = @($tree.SelectNodes('//node[@focused="true" and @class="android.widget.EditText"]') | Where-Object { $_.package -eq $expectedPackage })
    if ($focused.Count -ne 1) { throw 'No unique focused app text field; no text sent.' }
    & $Adb -s $Device shell input text $Value
} elseif ($Action -eq 'Key') {
    if ($Value -notmatch '^KEYCODE_(DPAD_UP|DPAD_DOWN|DPAD_LEFT|DPAD_RIGHT|DPAD_CENTER|BACK|ENTER|TAB)$') { throw 'Unsupported test key.' }
    & $Adb -s $Device shell input keyevent $Value
}
$tree = Read-NativeUi
$tree.SelectNodes('//node') | Where-Object { $_.package -eq $expectedPackage -and ($_.text -or $_.focused -eq 'true') } |
    Select-Object text,class,focused,bounds | ConvertTo-Json -Compress
