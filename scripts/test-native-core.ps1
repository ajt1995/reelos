param([string]$GradleCache = $env:GRADLE_USER_HOME)
$ErrorActionPreference = 'Stop'
$reelosRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $GradleCache) {
    $reelosBundledCache = Join-Path $reelosRoot '../.toolchains/gradle-home'
    $GradleCache = if (Test-Path -LiteralPath $reelosBundledCache) { $reelosBundledCache } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) '.gradle' }
}
$reelosModules = Join-Path $GradleCache 'caches/modules-2/files-2.1'
function Get-CachedJar([string]$Group, [string]$Artifact, [string]$Version) {
    $reelosArtifactPath = Join-Path $reelosModules "$Group/$Artifact/$Version"
    $reelosJar = Get-ChildItem -LiteralPath $reelosArtifactPath -Recurse -Filter "$Artifact-$Version.jar" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $reelosJar) { throw "Missing cached build dependency $Group`:$Artifact`:$Version. This offline check downloads nothing." }
    return $reelosJar.FullName
}
$reelosCompilerJars = @(
    (Get-CachedJar 'org.jetbrains.kotlin' 'kotlin-compiler-embeddable' '2.0.21'),
    (Get-CachedJar 'org.jetbrains.kotlin' 'kotlin-stdlib' '2.0.21'),
    (Get-CachedJar 'org.jetbrains.kotlin' 'kotlin-script-runtime' '2.0.21'),
    (Get-CachedJar 'org.jetbrains.kotlin' 'kotlin-reflect' '1.6.10'),
    (Get-CachedJar 'org.jetbrains.kotlin' 'kotlin-daemon-embeddable' '2.0.21'),
    (Get-CachedJar 'org.jetbrains.intellij.deps' 'trove4j' '1.0.20200330'),
    (Get-CachedJar 'org.jetbrains.kotlinx' 'kotlinx-coroutines-core-jvm' '1.6.4'),
    (Get-CachedJar 'org.jetbrains' 'annotations' '13.0')
)
$reelosSources = @(Get-ChildItem (Join-Path $reelosRoot 'clients/native/core/src/main/kotlin'), (Join-Path $reelosRoot 'clients/native/core/src/smoke/kotlin') -Recurse -Filter '*.kt' | Sort-Object FullName)
if (-not ($reelosSources | Where-Object Name -eq 'CoreSmoke.kt')) { throw 'Missing executable core smoke suite' }
$reelosRunId = [Guid]::NewGuid().ToString('N')
$reelosOutput = Join-Path $reelosRoot ".reelos-audit/native-core/$reelosRunId"
New-Item -ItemType Directory -Path $reelosOutput -Force | Out-Null
$reelosClassPath = $reelosCompilerJars -join [IO.Path]::PathSeparator
$reelosCompilerArgs = @('-Xmx768m', '-cp', $reelosClassPath, 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-jvm-target', '17', '-classpath', $reelosClassPath, '-d', $reelosOutput) + @($reelosSources.FullName)
& java @reelosCompilerArgs
if ($LASTEXITCODE -ne 0) { throw "Native Kotlin compilation failed ($LASTEXITCODE)" }
& java '-Xmx256m' '-cp' ($reelosOutput + [IO.Path]::PathSeparator + $reelosClassPath) 'com.reelos.core.CoreSmokeKt'
if ($LASTEXITCODE -ne 0) { throw "Native core smoke failed ($LASTEXITCODE)" }
$reelosEvidence = [ordered]@{
    schema = 'reelos-native-core-smoke/v1'
    generatedAt = [DateTime]::UtcNow.ToString('o')
    outcome = 'passed'
    scope = 'Kotlin core smoke only; not UI, models, playback or hardware acceptance'
    sources = @($reelosSources | ForEach-Object { @{ path = [IO.Path]::GetRelativePath($reelosRoot, $_.FullName); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } })
}
$reelosEvidence | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $reelosOutput 'result.json') -Encoding utf8
Write-Output "Native core smoke PASS. Evidence: $reelosOutput/result.json"
