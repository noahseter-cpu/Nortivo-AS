$ErrorActionPreference = 'Stop'
$trackerRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $trackerRoot
$trackerNode = (Get-Command node -ErrorAction Stop).Source
if (-not $env:JAVA_HOME) {
  $trackerJdk = Get-ChildItem -LiteralPath "$trackerRoot/.sites-runtime/android-tools/jdk" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $trackerJdk) { throw 'Set JAVA_HOME to a JDK 21 installation.' }
  $env:JAVA_HOME = $trackerJdk.FullName
}
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$trackerRoot/.sites-runtime/android-tools/sdk" }
if (-not (Test-Path -LiteralPath "$env:ANDROID_HOME/platforms/android-36/android.jar")) { throw 'Install Android SDK platform 36 and set ANDROID_HOME.' }
Set-Content -LiteralPath "$trackerRoot/android/local.properties" -Value ('sdk.dir=' + $env:ANDROID_HOME.Replace('\','/'))
& $trackerNode node_modules/vite/bin/vite.js build --config vite.mobile.config.ts
if ($LASTEXITCODE -ne 0) { throw 'Mobile web build failed.' }
& $trackerNode node_modules/@capacitor/cli/bin/capacitor sync android
if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
& ./android/gradlew.bat -p android :app:assembleDebug --console=plain
if ($LASTEXITCODE -ne 0) { throw 'APK build failed.' }
$trackerApk = "$trackerRoot/android/app/build/outputs/apk/debug/app-debug.apk"
& "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --verbose $trackerApk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
New-Item -ItemType Directory -Force "$trackerRoot/outputs/android" | Out-Null
$trackerOutput = "$trackerRoot/outputs/android/Arc-by-Norvido-0.4.0-private.apk"
Copy-Item -LiteralPath $trackerApk -Destination $trackerOutput -Force
(Get-FileHash -LiteralPath $trackerOutput -Algorithm SHA256).Hash | Set-Content -LiteralPath "$trackerOutput.sha256"
Write-Output $trackerOutput
