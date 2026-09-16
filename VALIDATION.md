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
