param(
    [Parameter(Mandatory)][string]$Device,
    [ValidateSet('media','personal-ui','first-run','connection','provider-live','provider-playback')][string]$Journey = 'media',
    [string]$Adb = 'C:\Users\austi\Documents\Codex\.toolchains\android-sdk\platform-tools\adb.exe'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$app = Join-Path $repo 'clients/native/android/build/outputs/apk/debug/android-debug.apk'
$tests = Join-Path $repo 'clients/native/android/build/outputs/apk/androidTest/debug/android-debug-androidTest.apk'
$safeDevice = $Device -replace '[^A-Za-z0-9.-]', '_'
$personalJourney = $Journey -eq 'personal-ui'
$freshJourney = $Journey -eq 'first-run'
$connectionJourney = $Journey -eq 'connection'
$liveProviderJourney = $Journey -eq 'provider-live'
$providerPlaybackJourney = $Journey -eq 'provider-playback'
$playbackStarted = $false
$evidence = Join-Path $repo $(if ($liveProviderJourney) { ".reelos-audit/native-provider-live/$safeDevice" } elseif ($connectionJourney) { ".reelos-audit/native-connection/$safeDevice" } elseif ($freshJourney) { ".reelos-audit/native-first-run/$safeDevice" } elseif ($personalJourney) { ".reelos-audit/native-personal-ui/$safeDevice" } else { ".reelos-audit/native-hardware/$safeDevice" })
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
if ($providerPlaybackJourney) {
    $evidence = Join-Path $repo ".reelos-audit/native-provider-playback/$safeDevice"
    New-Item -ItemType Directory -Force -Path $evidence | Out-Null
}
$required = if ($liveProviderJourney) {
    @('live-provider-account','live-provider-exact-file','live-provider-range-bytes')
} elseif ($connectionJourney) {
    @('keystore-protected-roundtrip','keystore-reopen-and-clear','keystore-tamper-fails-closed','keystore-disable-rejects-stale-save')
} elseif ($freshJourney) {
    @('fresh-identity-and-back','fresh-color-and-guidance','fresh-taste-and-restart','fresh-standalone-and-empty-home','fresh-completed-restart','fresh-import-requires-confirmation','fresh-confirmed-import-and-save','fresh-ui-playback-and-return','fresh-ui-resume')
} elseif ($personalJourney) {
    @('personal-appearance-controls','personal-taste-like-love','personal-taste-cozy-reset-dismiss','personal-taste-finish-and-reentry','personal-second-profile-isolation','personal-restart-persistence','personal-setup-finish')
} else {
    @('valid-local-import-and-decoder','invalid-video-rejected','repeat-import-does-not-leak-private-copies','mutable-provider-retained-bytes-validated','native-player-decodes-real-frame','seek-and-persist-position','resume-restores-position','completed-playback-restarts-from-beginning','player-keeps-screen-on-only-while-playing','active-playback-stops-after-source-revocation','active-playback-stops-after-profile-switch','profile-isolation-and-revoked-source')
}
$result = [ordered]@{
    schema = if ($liveProviderJourney) { 'reelos-native-provider-live/v1' } elseif ($connectionJourney) { 'reelos-native-connection/v1' } elseif ($freshJourney) { 'reelos-native-first-run/v1' } elseif ($personalJourney) { 'reelos-native-personal-ui/v1' } else { 'reelos-native-hardware/v1' }
    journey = $Journey
    device = $Device
    timestamp = [DateTime]::UtcNow.ToString('o')
    status = 'failed'
    tests = @()
    skips = 0
    scope = if ($liveProviderJourney) { 'Explicit owner-authorized account, exact-file resolution and 16KiB range verification inside the app. No secrets/media identifiers logged; not decoder or sustained-playback acceptance.' } elseif ($connectionJourney) { 'Synthetic-key Android Keystore, protected persistence, tamper and revocation checks. No provider network calls or live credentials.' } elseif ($freshJourney) { 'Empty-profile native first run, explicit import, Save/Library and local fixture playback. No seeded profile transitions; not Family/provider/audio/artwork or whole-product acceptance.' } elseif ($personalJourney) { 'Seeded isolated-profile appearance and taste UI interaction only; not fresh onboarding or whole-product acceptance.' } else { 'Local native media integration only; not whole-product, UI, audio, subtitle, or sustained-playback acceptance.' }
}
try {
    if ($providerPlaybackJourney) {
        $required = @('provider-native-frame-and-progress','provider-native-seek-and-persist','provider-native-resume','provider-native-revocation-stops-player','provider-native-owner-state-preserved')
        $result.schema = 'reelos-native-provider-playback/v1'
        $result.scope = 'Owner-authorized real provider bytes through shared preparation and native player: rendered frames/progression, seek, resume, revocation and restored test baseline. Muted short video, not full-film/audio/subtitle/analysis acceptance.'
    }
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
        $_.Extension -in @('.kt','.kts','.xml','.java','.mp4','.properties','.tsv')
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
    $instrumentArgs = @('-s',$Device,'shell','am','instrument','-w')
    if ($personalJourney -or $freshJourney -or $connectionJourney -or $liveProviderJourney -or $providerPlaybackJourney) { $instrumentArgs += @('-e','journey',$Journey) }
    $instrumentArgs += 'com.reelos.nativepreview.test/com.reelos.nativepreview.NativeHardwareChecks'
    $playbackStarted = $providerPlaybackJourney
    $process = Start-Process -FilePath $Adb -ArgumentList $instrumentArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $deadline = [DateTime]::UtcNow.AddSeconds($(if ($providerPlaybackJourney) { 300 } elseif ($personalJourney -or $freshJourney) { 180 } else { 120 }))
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
    $unexpected = @($result.tests | Where-Object { $_ -notin $required })
    if ($process.ExitCode -ne 0 -or $missing.Count -gt 0 -or $unexpected.Count -gt 0 -or $result.tests.Count -ne $required.Count -or $output -match 'FAILED|INSTRUMENTATION_FAILED') {
        throw "Native $Journey checks incomplete: $($missing -join ', '). See scoped instrumentation output."
    }
    if ($personalJourney) {
        $shot = [regex]::Match($output, '(?m)^INSTRUMENTATION_RESULT: screenshot=(.+)\s*$')
        if ($shot.Success) {
            $shotPath = $shot.Groups[1].Value.Trim()
            $shotFile = Join-Path $evidence 'personal-ui.png'
            & $Adb -s $Device pull $shotPath $shotFile | Out-Null
            if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $shotFile)) {
                $result.screenshotSha256 = (Get-FileHash -LiteralPath $shotFile -Algorithm SHA256).Hash.ToLowerInvariant()
            } else { $result.screenshotNote = 'Device screenshot could not be copied; interaction results are unaffected.' }
        }
    }
    $result.status = 'passed'
} catch {
    $result.error = $_.Exception.Message
} finally {
    if ($playbackStarted) {
        # Restoration must survive failed Activity cleanup or a killed instrumentation process.
        # Stop players first so no stale player can write over the restored baseline.
        try {
            & $Adb -s $Device shell am force-stop com.reelos.nativepreview | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Cannot stop validation player for recovery.' }
            $recoveryOutput = Join-Path $evidence 'recovery.txt'
            $recoveryError = Join-Path $evidence 'recovery-error.txt'
            $recovery = Start-Process -FilePath $Adb -ArgumentList @('-s',$Device,'shell','am','instrument','-w','-e','journey','provider-recovery','com.reelos.nativepreview.test/com.reelos.nativepreview.NativeHardwareChecks') -WindowStyle Hidden -PassThru -RedirectStandardOutput $recoveryOutput -RedirectStandardError $recoveryError
            if (-not $recovery.WaitForExit(30000)) { $recovery.Kill(); throw 'Recovery timed out; in-app baseline retained.' }
            $recoveryText = Get-Content -LiteralPath $recoveryOutput -Raw
            if ($recovery.ExitCode -ne 0 -or $recoveryText -notmatch 'provider-baseline-recovery: passed' -or $recoveryText -match 'FAILED') {
                throw 'Recovery did not verify; in-app baseline retained. Do not continue device tests.'
            }
            $result.recovery = 'verified'
        } catch {
            $result.status = 'failed'
            $result.error = $_.Exception.Message
            $result.recovery = 'blocked'
        }
    }
    $resultPath = Join-Path $evidence 'result.json'
    [IO.File]::WriteAllText($resultPath, ($result | ConvertTo-Json -Depth 8))
    Write-Output "$($result.status): $($result.tests.Count)/$($required.Count) native $Journey checks; evidence $resultPath"
}
if ($result.status -ne 'passed') { throw $result.error }
