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
    $buildEvidencePath = Join-Path $repo 'clients/native/android/build/outputs/native-validation-build.json'
    if (-not (Test-Path -LiteralPath $buildEvidencePath)) {
        throw 'Missing build provenance. Run :android:prepareHardwareValidation before hardware checks.'
    }
    $buildEvidence = Get-Content -LiteralPath $buildEvidencePath -Raw | ConvertFrom-Json
    $result.productVersionSha256 = (Get-FileHash -LiteralPath (Join-Path $repo 'VERSION') -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($buildEvidence.schema -ne 'reelos-native-validation-build/v1' -or
        $buildEvidence.productVersionSha256 -ne $result.productVersionSha256 -or
        $buildEvidence.appSha256 -ne $result.appSha256 -or
        $buildEvidence.testApkSha256 -ne $result.testApkSha256) {
        throw 'APK bytes do not match build provenance. Rebuild with :android:prepareHardwareValidation.'
    }
    $nativeRoot = Join-Path $repo 'clients/native'
    $sourceFiles = @(Get-ChildItem $nativeRoot -Recurse -File | Where-Object {
        $_.FullName -notmatch '[\\/](build|\.gradle|\.kotlin|desktop|test|smoke)[\\/]' -and
        $_.Name -ne 'local.properties' -and
        $_.Extension -in @('.kt','.kts','.xml','.java','.mp4','.properties')
    })
    $declared = @($buildEvidence.sources.PSObject.Properties)
    if ($sourceFiles.Count -ne $declared.Count) { throw 'Native source set changed; rebuild the validation APKs.' }
    $result.sources = @{}
    foreach ($sourceFile in $sourceFiles) {
        $relative = [IO.Path]::GetRelativePath($nativeRoot, $sourceFile.FullName).Replace([IO.Path]::DirectorySeparatorChar, '/'[0])
        $expected = $buildEvidence.sources.PSObject.Properties[$relative]
        $actual = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        if (-not $expected -or $actual -ne $expected.Value) {
            throw "Native source differs from built evidence: $relative"
        }
        $result.sources["clients/native/$relative"] = $actual
    }
    $result.sourceRevision = $buildEvidence.sourceRevision
    $result.displayVersion = $buildEvidence.displayVersion
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
