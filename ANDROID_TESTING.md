# Nortivo Android private test

Version 0.3.0-private, versionCode 2. Package: `no.noah.tracker.privatebeta`.

This is a locally bundled, debug-signed APK for Noah's private month of testing. No expiration timer is built in. It is not a Play Store release. No online account is created. The existing hosted website is not the APK's runtime or login service.

## Install on your phone

1. Copy `Nortivo-0.3.0-private.apk` from this PC's Downloads folder to the phone using USB or Quick Share.
2. Open the APK on the phone. If Android asks, allow installation from the file app used for this file, then install. You can turn that permission off afterward. Keep Play Protect enabled.
3. Open Nortivo. Enter name, height in cm, weight in kg, age, formula basis and activity. Review the maintenance estimate. Applying it as a daily goal is optional.
4. Edit these details later under **Innstillinger → Endre profil og kaloriforslag**.

Requires Android 7.0/API 24 or newer and an up-to-date Android System WebView. Target/compile API 36. App assets and barcode decoder are bundled locally. Food searches need an internet connection. Camera permission is requested only when scanning.

## Your records

Data is local to the app and does not sync with the website or another device. The Android manifest disables OS cloud backup and device transfer; user-triggered JSON export is the backup path. Exports are unencrypted and include profile measurements.

To bring existing website records across: export **Innstillinger → Sikkerhetskopi** on the website, transfer the JSON to the phone, then import it in the APK. Review the restore choice; Replace restores the backup's profile/settings too, while Merge keeps current settings/profile and merges missing records. Skip initial profile setup if you want to restore first.

Make a backup weekly, and before uninstalling or clearing app data. **Sikkerhetskopi** opens Android's share sheet; choose a file destination you trust. Canceling sharing does not save an external backup. CSV is for viewing data; JSON restores the full tracker.

Updates can preserve data when installed over this APK with the same package and signing key. Keep the local Android debug keystore at `%USERPROFILE%/.android/debug.keystore`; do not commit or share it. A future public Play app should use proper release signing and its final package ID; the beta's JSON backup is the transfer path.

## Calories

Mifflin–St Jeor resting-energy formula (kg/cm/years), multiplied by the chosen approximate activity factor 1.4/1.6/1.8/2.0, rounded to 50 kcal. The displayed ±10% band illustrates uncertainty, not a validated confidence interval. The app estimates maintenance, not weight-loss intake. Recorded exercise calories are not added automatically. Existing goal history is preserved; applying an estimate changes the goal from today only.

The app does not generate a suggestion for under-18s, over-78s, pregnancy/breastfeeding, special medical/eating-disorder needs, or an unspecified formula basis. The profile and tracker remain usable. This is an estimate, not medical advice.

Sources: [Mifflin et al., 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/) and [NIDDK activity context and limitations](https://www.niddk.nih.gov/bwp). This calculator does not implement NIDDK's dynamic Body Weight Planner model.

## Build again

Node 24, JDK 21, Android SDK platform 36 and build tools 36.0.0 are used. The local tools downloaded for this build are under `.sites-runtime/android-tools/` and ignored by Git. Gradle wrapper downloads its pinned distribution. Alternatively set JAVA_HOME and ANDROID_HOME to your own installations.

From the project folder:

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File scripts/build-android.ps1
```

APK output: `outputs/android/Nortivo-0.3.0-private.apk` with a SHA-256 file. `npm run dev` still starts the web edition. `npm run mobile:preview` serves a browser preview of the compiled standalone UI, not a native emulator.

## Validation and remaining device checks

Android Gradle build and APK v2 signature verification passed. TypeScript, 19 calculation/schema/storage cases, 2 profile browser journeys and 7 existing browser journeys passed. Desktop and phone-width profile screenshots inspected. V1/V2 records migrate to schema V3 without resetting history. Profile changes without opting into a new goal preserve the current target.

No Android phone was connected (`adb devices` empty), so physical installation, camera scanning, system Back, native provider HTTP, file-picker import and Android share-sheet export remain device checks. Browser simulations are not claimed as native hardware tests. During the month, test offline restart, save/reopen, camera allow/deny, backup/restore and installing an update over the existing app.

Before Play submission: use a signed release AAB and final identity, finish real-device testing and accessibility checks, and prepare the store's required privacy/data disclosures. No Play submission was made.

## Update from 0.2.0

Install the new APK over the old app without uninstalling. Package and signing certificate are unchanged. The display brand is Nortivo. Theme preference is under Innstillinger → Utseende and in the top bar. Popups use a keyboard-aware viewport container;31 automated checks pass. User/device records and personal profile names are preserved.
