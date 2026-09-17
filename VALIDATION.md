# Validation — 2026-09-16

## Executed

- TypeScript: tsc --noEmit passed.
- Production Vinext build passed; packaging uses a rebuilt matching source state.
- 23 automated tests passed: 14 calculation/schema/provider-fixture cases; 2 IndexedDB atomicity/concurrency cases; 5 browser journeys; 2 desktop/mobile interface cases.
- Production Worker on localhost:8787 passed offline shell reload, retained step data, offline expense save and second reload.
- Actual Matvaretabellen query banan through the production adapter passed.
- Actual Open Food Facts staging text search tine followed by returned barcode lookup through separate production adapter endpoints passed. Staging was enabled only in the local validation process.
- Production OFF returned HTTP 429/503 in this environment; friendly rate-limit fallback verified. Successful live-production OFF results are not claimed.
- Screenshots at 1440px and390px inspected; all six phone views checked for horizontal overflow. Reduced-motion dialog, Escape focus return, repeated opening/closing, rapid save, failed storage and invalid restore exercised.
- Impeccable detector returned no findings. Independent finish review found mobile size, placeholder contrast and nested-budget issues; corrections applied, screenshots regenerated and scoped disposition ship returned.
- Documenter extracted CSS tokens. User explicitly waived image preview/approval after rejecting all prior concepts.

## Evidence

Tests are under tests/; screenshots under .impeccable/review/. Populated screenshots and browser records are isolated synthetic test fixtures. Built offline test requires PRODUCTION_TEST=1 and TEST_URL pointed at the production server. External tests require LIVE_INTEGRATION=1 to avoid provider requests on every test run. Default npm test runs deterministic cases and skips these opt-in tests.

## Limits

Physical camera scanning on a phone has not been tested. Camera denial/fallback was simulated in Edge; typed barcodes work through the provider adapter. WebMCP was tested in a simulated supported context, not a browser shipping that experimental API. Cross-device sync is absent. Offline shell caching works after an online load; first-ever offline visits cannot work. Private hosting sign-in must first complete online. No bank or watch connections are claimed.

## Profile and private Android beta — 2026-09-16

Added 3 formula/migration tests and2 profile browser journeys; all pass. Existing14 core,2 storage and7 browser checks also passed:28 distinct checks. TypeScript passed. Standalone mobile Vite build, Capacitor Android sync, Gradle debug APK build and apksigner v2 verification passed. Manifest inspected: package no.noah.tracker.privatebeta, minSDK24, target36, Internet and Camera permissions, OS backups disabled. APK is debug-signed for private testing. No phone was connected; native camera, Back, native HTTP, share sheet and file picker await device testing. See ANDROID_TESTING.md. Browser screenshots are evidence for the UI only, not native hardware behavior.

## Nortivo popup/theme patch — 0.3.0-private

Reproduced the class-level positioning conflict implicated by the user's screenshots; replaced mixed fixed/translated dialog placement with a shared visible-viewport container. Geometry assertions pass at412×892,412×360,892×360 and320×400; Save remains reachable by scrolling. Light/dark dialog screenshots inspected. No physical Samsung device or keyboard was connected; viewport resizing is a browser simulation, not a hardware test.

Appearance checks pass for all six views and popup/input surfaces. Explicit dark preference survives reload, System follows emulated OS preference, and schema2 migration retains data. All31 distinct automated cases passed (24 core/storage/profile/appearance cases plus7 prior browser regression cases). Two initial browser cases encountered a server-start connection refusal; both passed after the development server became ready. Final TypeScript, Gradle APK build and APK signature checks passed. VersionCode2 and Nortivo launcher label verified with aapt; certificate fingerprint matches0.2.0.

## Arc by Norvido 0.4.0 (2026-09-17)

Open Food Facts is selected first by default. Android Matvaretabellen search uses the bundled official 2026-09-17 snapshot (2,118 readable records), without a native HTTP download. This removes the network dependency; the original failure was not reproduced on physical Android hardware. Source-switch requests are cancelled so old results cannot replace the new provider.

Validation: 21 core/provider/profile/storage tests passed, plus the mobile offline food-search/default-provider test, three migration/theme/dialog tests and two profile UI tests (27 unique tests). TypeScript passed. APK build and signature verification passed; certificate matches the previous 0.3.0 APK. Browser mobile testing simulates native platform selection and offline status; physical Android remains untested. No private storage migration or reset. API dataset provenance and caching terms: https://www.matvaretabellen.no/api/ .

## Arc 0.4.1 bounded whole-app pass (2026-09-17)

Inspected all six main screens in the mobile build, plus desktop overview. Checked 320/390/768/1440px widths across all six routes: no horizontal overflow. Improved mobile touch targets, food-source selection, result text, search status announcements, offline help, and frequency-appropriate press feedback. 27 tests passed (core/storage/profile/native-provider simulation/mobile profile/dialog/theme), TypeScript passed, APK assembled and signature verified. Reduced-motion computed transition duration is zero. No schema or private-data changes. Physical Android, live OFF availability and every device-specific integration are not claimed tested. Evidence is local under .sites-runtime/audit. Design/motion review used Impeccable, Visual Craft 3.0, Animate, Emil Design Engineering and Review Animations.

## Arc 0.4.2 nutrition and manual entry (2026-09-17)

Manual product entry is now a prominent full-width mobile action above search. The form removes the redundant blank product identity and supports optional save-and-log in one flow. Names, kcal per 100 and g/ml remain explicit; favourites default on for new personal products. Choosing a different unit clears consumed/portion quantities, and a supplied gram portion is not offered for a millilitre entry. Personal corrections take precedence when selecting the same source product again. Historical snapshots remain unchanged.

OFF parsing accepts numeric kcal strings, rejects explicit non-kcal units and suppresses conflicting explicit kcal/kJ declarations (difference above max(20 kcal,20%) requires manual label entry; this is an app sanity check, not certification). No calories are inferred from macros or serving values. Public query cache is versioned independently of personal data. Matvaretabellen values remain per100g; raw/cooked/dry guidance is shown. No blanket product-value overrides are made.

Sources checked: https://openfoodfacts.github.io/openfoodfacts-server/dev/explain-nutrition-data/ and https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/how-to-create-data-quality-controls-in-your-app/ ; https://www.matvaretabellen.no/api/ . The reported Mountain Dew 20 versus29 kcal/100ml discrepancy was not directly verified: the live OFF search returned503. User-provided label values apply to their specific variant, not all products with the same name.

Validation:30 tests passed including private correction precedence, energy units, no serving fallback, and mobile create/save/log/reload at29kcal/100ml ×500ml =145kcal. TypeScript passed. Mobile screenshots inspected; external data accuracy and physical Android hardware remain unverified. APK0.4.2 is signed with existing debug identity, versionCode5; no schema changes.

## Arc0.4.3 verification

31 tests passed, including custom daily calories, default keep behavior, save/reload, eligible suggestion and ineligible profile. TypeScript passed. APK versionCode6 assembled and signature verified. No schema changes; existing effective-dated goals are reused. Manufacturer and full dataset comparison findings are recorded in docs/CALORIE_VERIFICATION.md; do not describe matching source data as independently verified nutrition. Physical Android remains untested.

## Arc 0.4.4 quick polish (2026-09-17)

The bounded Impeccable pass tightened Settings: personal calorie choice and body profile are separated visually, selected calorie options have clear bordered rows and full touch targets, and forms expose aria-busy while saving. No data model or migration changes. Existing motion stays restrained: no added navigation animation, and reduced-motion behavior remains intact.

Validation: 9 profile/theme/dialog tests passed and TypeScript passed. APK versionCode 7 assembled and signature verified. Physical Android remains untested.

## Arc 0.4.5 logo (2026-09-17)

Rendered the shared Arc SVG in the web brand and favicon, cached it in the service worker shell, and replaced the Android adaptive foreground with the matching vector arch-A mark. Web smoke check found one mobile brand image and one sidebar brand image; Android build and v2 signature verification passed. The package ID and signing identity remain unchanged. Physical launcher rendering on a device remains untested.
