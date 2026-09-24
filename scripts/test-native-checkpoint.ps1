param(
    [string[]]$Devices = @(),
    [switch]$PersonalUi,
    [string]$ToolchainRoot = 'C:\Users\austi\Documents\Codex\.toolchains'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$audit = Join-Path $repo '.reelos-audit/native-checkpoint'
New-Item -ItemType Directory -Force -Path $audit | Out-Null
$result = [ordered]@{ status='failed'; timestamp=[DateTime]::UtcNow.ToString('o'); stages=@(); scope='Native targeted checkpoint, not release acceptance'; devices=$Devices }
function Check-Exit([string]$Stage, [int]$Code, [string]$Log) {
    if ($Code -ne 0) { throw "$Stage failed. Inspect $Log" }
    $script:result.stages += $Stage
}
Push-Location $repo
try {
    $env:GRADLE_USER_HOME = Join-Path $ToolchainRoot 'gradle-home'
    $env:ANDROID_HOME = Join-Path $ToolchainRoot 'android-sdk'
    $env:REELOS_DESKTOP_FIXTURE = Join-Path $repo 'clients/native/android/src/androidTest/assets/Native-Validation-30s.mp4'
    $env:REELOS_DESKTOP_TRACK_FIXTURE = Join-Path $repo 'clients/native/android/src/androidTest/assets/Native-Tracks-30s.mp4'
    $env:REELOS_TEST_LIBVLC_CALLBACKS = '1'
    $log = Join-Path $audit 'build.log'
    & ./clients/android/gradlew.bat -p ./clients/native :core:test :desktop:test :android:prepareHardwareValidation --offline --max-workers=1 --no-daemon --console=plain > $log 2>&1
    Check-Exit 'native-build-and-tests' $LASTEXITCODE $log
    foreach ($module in @('core','desktop')) {
        $reports = @(Get-ChildItem "clients/native/$module/build/test-results/test" -Filter 'TEST-*.xml' | ForEach-Object { [xml](Get-Content $_.FullName -Raw) })
        $tests = ($reports.testsuite.tests | Measure-Object -Sum).Sum
        $failures = ($reports.testsuite.failures | Measure-Object -Sum).Sum + ($reports.testsuite.errors | Measure-Object -Sum).Sum
        $skips = ($reports.testsuite.skipped | Measure-Object -Sum).Sum
        if ($tests -lt 1 -or $failures -ne 0 -or $skips -ne 0) { throw "$module required tests incomplete: $tests tests, $failures failures, $skips skips" }
        $result[$module] = @{tests=$tests; failures=$failures; skips=$skips}
    }
    foreach ($device in $Devices) {
        foreach ($journey in @('media') + $(if ($PersonalUi) { @('personal-ui') } else { @() })) {
            $safe = $device -replace '[^A-Za-z0-9.-]', '_'
            $log = Join-Path $audit "$safe-$journey.log"
            # Runner throws on omissions and records source/APK hashes, device identity and exact cases.
            & ./scripts/test-native-android-hardware.ps1 -Device $device -Journey $journey -Adb (Join-Path $ToolchainRoot 'android-sdk/platform-tools/adb.exe') > $log 2>&1
            $result.stages += "$safe-$journey"
        }
    }
    foreach ($check in @('context:check','audit:tests')) {
        $log = Join-Path $audit ($check.Replace(':','-') + '.log')
        & npm run $check > $log 2>&1
        Check-Exit $check $LASTEXITCODE $log
    }
    $log = Join-Path $audit 'native-contract.log'
    & node --test scripts/native-foundation.test.mjs > $log 2>&1
    Check-Exit 'native-contract' $LASTEXITCODE $log
    $result.status = 'passed'
} catch { $result.error = $_.Exception.Message }
finally {
    Pop-Location
    [IO.File]::WriteAllText((Join-Path $audit 'result.json'), ($result | ConvertTo-Json -Depth 6))
    $result | ConvertTo-Json -Depth 6 -Compress
}
if ($result.status -ne 'passed') { throw $result.error }
