param(
    [Parameter(Mandatory)][string]$Device,
    [string]$Adb = 'C:\Users\austi\Documents\Codex\.toolchains\android-sdk\platform-tools\adb.exe'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$app = Join-Path $repo 'clients/native/android/build/outputs/apk/debug/android-debug.apk'
$tests = Join-Path $repo 'clients/native/android/build/outputs/apk/androidTest/debug/android-debug-androidTest.apk'
$safeDevice = $Device -replace '[^A-Za-z0-9.-]', '_'
$evidence = Join-Path $repo ".reelos-audit/native-hardware/$safeDevice"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$required = @('valid-local-import-and-decoder','invalid-video-rejected','repeat-import-does-not-leak-private-copies','mutable-provider-retained-bytes-validated','native-player-decodes-real-frame','seek-and-persist-position','resume-restores-position','completed-playback-restarts-from-beginning','player-keeps-screen-on-only-while-playing','profile-isolation-and-revoked-source')
$result = [ordered]@{ schema = 'reelos-native-hardware/v1'; device = $Device; timestamp = [DateTime]::UtcNow.ToString('o'); status = 'failed'; tests = @(); skips = 0; scope = 'Local native media integration only; not whole-product, UI, audio, subtitle, or sustained-playback acceptance.' }
try {
    $devices = (& $Adb devices) -join "`n"
    if ($devices -notmatch "(?m)^$([regex]::Escape($Device))\s+device\s*$") { throw 'Target is not connected and authorized.' }
    $result.model = ((& $Adb -s $Device shell getprop ro.product.model) -join '').Trim()
    $result.abi = ((& $Adb -s $Device shell getprop ro.product.cpu.abilist) -join '').Trim()
    $result.appSha256 = (Get-FileHash -Algorithm SHA256 $app).Hash.ToLowerInvariant()
    $result.testApkSha256 = (Get-FileHash -Algorithm SHA256 $tests).Hash.ToLowerInvariant()
    $result.sources = @{}
    $sourceFiles = @(Get-ChildItem (Join-Path $repo 'clients/native') -Recurse -File | Where-Object {
        $_.FullName -notmatch '[\\/](build|\.gradle|\.kotlin|desktop|test|smoke)[\\/]' -and
        $_.Extension -in @('.kt','.kts','.xml','.java','.mp4')
    })
    $appWritten = (Get-Item -LiteralPath $app).LastWriteTimeUtc
    $testsWritten = (Get-Item -LiteralPath $tests).LastWriteTimeUtc
    foreach ($sourceFile in $sourceFiles) {
        $testOnly = $sourceFile.FullName -match '[\\/]androidTest[\\/]'
        if ($sourceFile.LastWriteTimeUtc -gt $testsWritten -or (-not $testOnly -and $sourceFile.LastWriteTimeUtc -gt $appWritten)) {
            throw "Native source is newer than the APK; rebuild before claiming current-source evidence: $($sourceFile.Name)"
        }
        $result.sources[[IO.Path]::GetRelativePath($repo, $sourceFile.FullName)] = (Get-FileHash -Algorithm SHA256 $sourceFile.FullName).Hash.ToLowerInvariant()
    }
    foreach ($apk in @($app,$tests)) {
        & $Adb -s $Device install -r $apk
        if ($LASTEXITCODE -ne 0) { throw 'Isolated test package installation failed.' }
    }
    & $Adb -s $Device shell input keyevent KEYCODE_WAKEUP
    $stdout = Join-Path $evidence 'instrumentation.txt'
    $stderr = Join-Path $evidence 'instrumentation-error.txt'
    $process = Start-Process -FilePath $Adb -ArgumentList @('-s',$Device,'shell','am','instrument','-w','com.reelos.nativepreview.test/com.reelos.nativepreview.NativeHardwareChecks') -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    while (-not $process.WaitForExit(1000)) {
        if ([DateTime]::UtcNow -gt $deadline) {
            $process.Kill()
            & $Adb -s $Device shell am force-stop com.reelos.nativepreview
            throw 'Native hardware test timed out; only the isolated test app was stopped.'
        }
    }
    $output = Get-Content -LiteralPath $stdout -Raw
    $result.tests = @([regex]::Matches($output, '(?m)^([a-z-]+): passed\s*$') | ForEach-Object { $_.Groups[1].Value })
    $missing = @($required | Where-Object { $_ -notin $result.tests })
    if ($process.ExitCode -ne 0 -or $missing.Count -gt 0 -or $output -match 'FAILED|INSTRUMENTATION_FAILED') { throw "Hardware checks incomplete: $($missing -join ', '). See scoped instrumentation output." }
    $result.status = 'passed'
} catch {
    $result.error = $_.Exception.Message
} finally {
    $resultPath = Join-Path $evidence 'result.json'
    [IO.File]::WriteAllText($resultPath, ($result | ConvertTo-Json -Depth 8))
    Write-Output "$($result.status): $($result.tests.Count)/$($required.Count) native media checks; evidence $resultPath"
}
if ($result.status -ne 'passed') { throw $result.error }
