# Arc by Nortivo 1.0 Android release preparation

This repository is prepared to build an unsigned release bundle or to sign it with an owner-supplied upload key. No key was created, no signing credentials were provisioned, and nothing was uploaded or published by this work.

Current build identity:

- Application ID and namespace: `no.noah.tracker.privatebeta`.
- Version code: `10`; version name: `1.0.0-rc.1`.
- Android Gradle Plugin: `8.13.0`; use the committed Gradle wrapper.
- JDK 21, Android SDK platform 36 and build tools 36.0.0.
- Web assets are bundled locally by Vite and Capacitor before Gradle runs.

## Build the private test APK

From the repository root, run:

```powershell
npm run android:build
```

The existing script prepares assets, syncs Capacitor, builds `assembleDebug`, verifies the APK signature and writes `outputs/android/Arc-by-Nortivo-1.0.0-rc.1.apk` plus its SHA-256 file. It uses the existing local debug signing identity for private-beta updates. This APK is for testing; it is not the store release artifact.

## Prepare web assets for a release bundle

Run in PowerShell from the repository root, with dependencies installed. Set `JAVA_HOME` to your installed JDK 21 and `ANDROID_HOME` to your Android SDK. If `android/local.properties` already exists, its ignored SDK path must agree with that installation. The private APK build script can prepare this local SDK configuration on the current workstation.

```powershell
$ErrorActionPreference = 'Stop'
node node_modules/vite/bin/vite.js build --config vite.mobile.config.ts
if ($LASTEXITCODE -ne 0) { throw 'Mobile web build failed.' }
node node_modules/@capacitor/cli/bin/capacitor sync android
if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
```

Do not skip this step after frontend changes: Gradle packages the last synchronized assets.

## Build an unsigned AAB

Clear all four optional signing variables in the current shell, then build:

```powershell
$arcSigningNames = @(
  'ARC_UPLOAD_STORE_FILE',
  'ARC_UPLOAD_STORE_PASSWORD',
  'ARC_UPLOAD_KEY_ALIAS',
  'ARC_UPLOAD_KEY_PASSWORD'
)
foreach ($arcSigningName in $arcSigningNames) {
  Remove-Item -LiteralPath "Env:$arcSigningName" -ErrorAction SilentlyContinue
}
./android/gradlew.bat -p android :app:bundleRelease --no-daemon --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Unsigned release bundle build failed.' }
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`.

No signing variables means the release stays unsigned. Supplying only some variables stops Gradle configuration with a message naming the missing variables. Supplying a missing keystore path also stops configuration. The project does not print credential values. The debug build remains separate; release never falls back to its debug key.

The `.env.example` file lists the supported names with empty values. It is documentation, not an automatic loader. Real environment files and keystores remain ignored by Git; only the root `.env.example` is allowlisted.

## Sign with an existing owner-controlled upload key

Use an upload keystore created and backed up by the owner outside this repository. The following prompts avoid placing password literals in shell history. Run after the asset preparation step above:

```powershell
$env:ARC_UPLOAD_STORE_FILE = Read-Host 'Absolute path to your existing upload keystore'
$env:ARC_UPLOAD_KEY_ALIAS = Read-Host 'Upload key alias'
$arcStoreSecret = Read-Host 'Keystore password' -AsSecureString
$arcKeySecret = Read-Host 'Key password' -AsSecureString
try {
  $env:ARC_UPLOAD_STORE_PASSWORD = [System.Net.NetworkCredential]::new('', $arcStoreSecret).Password
  $env:ARC_UPLOAD_KEY_PASSWORD = [System.Net.NetworkCredential]::new('', $arcKeySecret).Password
  ./android/gradlew.bat -p android :app:bundleRelease --no-daemon --console=plain
  if ($LASTEXITCODE -ne 0) { throw 'Signed release bundle build failed.' }
} finally {
  foreach ($arcSigningName in @('ARC_UPLOAD_STORE_FILE', 'ARC_UPLOAD_STORE_PASSWORD', 'ARC_UPLOAD_KEY_ALIAS', 'ARC_UPLOAD_KEY_PASSWORD')) {
    Remove-Item -LiteralPath "Env:$arcSigningName" -ErrorAction SilentlyContinue
  }
  $arcStoreSecret.Dispose()
  $arcKeySecret.Dispose()
}
```

The signed bundle uses the same `app-release.aab` output path. Archive each artifact with its version and signing status to avoid confusing a later unsigned rebuild with a signed one. Verify the result using the JDK tool:

```powershell
& "$env:JAVA_HOME/bin/jarsigner.exe" -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

Check that the output reports a verified signature and the intended certificate. An unsigned JAR/AAB can return a successful process exit, so exit code alone is insufficient. This owner-key path has not been exercised with real release credentials.

## Private-beta and store compatibility

Google Play uses the upload signature to accept an AAB, then signs delivered APKs with the configured app-signing key. A different app-signing certificate cannot ordinarily update the installed debug beta. Debug certificates are unsuitable for store publication. See the official [Android app-signing guide](https://developer.android.com/studio/publish/app-signing).

For this private RC, install the new APK over the previous private APK while retaining the original debug keystore. Before a future transition to a differently signed store app, export and verify the JSON backup, then plan installation and restore. Do not uninstall the beta merely to test this update. The package, local origin, IndexedDB keys and backup format remain unchanged; language and appearance changes do not change the signing requirement.

An AAB is not directly installable by tapping it on a phone. Play App Signing setup, the owner’s upload key, store listing/privacy disclosures and real-device release checks still need completion before a public submission. This document prepares the build; it does not establish store acceptance.
