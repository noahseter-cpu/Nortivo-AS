# Nortivo

Norwegian Bokmål personal tracker for money, category and overall monthly budgets, daily steps and food intake. No sample personal records are seeded.

## Run locally

Node.js 24 recommended. From this folder:

    npm ci
    npm run dev

Open the Local URL printed by the server. For a production build:

    npm run build
    npm run start

The bundled Sites helper's npm shim fails on this Windows host. Equivalent verified fallback: `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run build` (or `ci` / `run dev`). The application itself does not depend on that absolute path.

## Everyday use

- Oversikt: select month, set budgets, add expenses/income, update steps and open food search. Dates are always explicit in forms.
- Økonomi: expenses, income and category refunds, filters, edit/delete, monthly budgets. Category caps never add to the overall cap. Refunds affect their own recorded dates.
- Mat og kalorier: deliberate external search, barcode camera/manual lookup, portions, private products, favourites, recent foods and saved meals. Confirm ambiguous product units. Log meals as one aggregate snapshot. Individual-food and manual daily-total modes retain their records but only one contributes to the daily total.
- Aktivitet: replace a day's step total, optional burned calories and note. Missing days are excluded from averages; explicitly recorded zero participates.
- Historikk: select any previous date and edit records.
- Innstillinger: effective-dated goals, opening balance, categories, warning thresholds, JSON backups/restore and CSV exports.

Opening balance is the balance at the START of its effective date. Transactions on that date and later change recorded balance; earlier transactions remain in their historical reports. Recorded balance is never a live bank balance.

## Data and privacy

Personal records live in IndexedDB `noah-tracker-private-v1`, transactionally validated and committed before success is shown. Other tabs receive an update notification. Public search caches use a separate database. Records are local to this origin, browser profile and device: phone and PC do not sync. Back up regularly. JSON/CSV files are not encrypted. Browser data deletion can remove everything.

Version 1 backups contain a full schema and are validated before mutation. Merge preserves existing matching IDs, dates, monthly budgets and settings. Replace explicitly replaces personal data. Invalid imports abort before any write. CSV cells are quoted and formula-like user strings are neutralised.

The essential production app shell and loaded resources are cached by a service worker after successful loading. Saved foods work without a network. New external searches, uncached product imagery and first-time camera decoder download need a connection. Local development intentionally does not register the service worker.

External searches send only the chosen query or barcode to a read-only same-origin adapter and its selected provider. Private records, custom foods and camera frames are never sent. No analytics or bank/watch connection is included. Sites hosting may require the owner's platform sign-in; the tracker has no fake login or sync controls.

## Provider integrations

- Matvaretabellen: official `https://www.matvaretabellen.no/api/nb/foods.json`; all foods downloaded and parsed, result search local to the adapter; public cache for repeat queries. Calories use the explicit `calories.quantity` in kcal, per 100 g. Portions use only supplied weights in grams. Attribution preserved.
- Open Food Facts: barcode lookup pinned to `/api/v3.4/product/{code}.json`. The official September 2026 change log documents the incompatible nutrition structure introduced in 3.5, so 3.4 intentionally requests the previous documented nutrient representation. Barcode strings preserve zeros; normalization is delegated to OFF. Ordinary text search uses `/cgi/search.pl`; structured brand search uses `/api/v2/search`. v3 product lookup is not used for text searches. Norway context/ranking preserves international results.
- OFF `energy-kcal_100g` is never confused with kJ or serving energy. The user explicitly confirms grams versus millilitres from the label, with personal corrections retained separately. Missing or suspicious energy stays missing. Rate limits verified on 2026-09-16: provider docs list 15 product/min and 10 search/min. Adapter permits at most 12/8 per minute per isolate, bounded caches, 15-second upstream deadline, no automatic retry storms. Provider HTTP 429/503 is surfaced with a wait message. Cloud deployments can use several isolates, so the provider's own limit remains authoritative.
- API identification uses NoahTracker/1.0 and the app's real origin. Source docs: https://www.matvaretabellen.no/api/ ; https://openfoodfacts.github.io/openfoodfacts-server/api/ ; https://openfoodfacts.github.io/openfoodfacts-server/api/ref-api-and-product-schema-change-log/ . OFF's usage-registration form has not been submitted on your behalf.
- OFF data attribution: ODbL; contents DbCL; product photos CC BY-SA. The app does not publish a merged food database.

`OFF_STAGING=1` selects the documented OFF staging service with its public staging credentials. No private diary data is sent in either mode. Camera decoding uses ZXing in the browser. HTTPS (or localhost) and explicit camera permission are required. Typed barcode/search remain available.

## Validation

    npm run typecheck
    npm test

Tests use Playwright with Microsoft Edge on this Windows host. Override `TEST_URL` to test a production server. See `VALIDATION.md` for actual results and limitations. For another platform, adjust `playwright.config.ts` to its browser installation.

## Architecture

React + TypeScript on the supplied Vinext/Vite Sites starter. Existing Radix/Shadcn primitives manage dialogs, focus and tabs; Lucide supplies icons. Pure calculations/validation: `lib/tracker-core.ts`. IndexedDB repository/cache: `lib/tracker-store.ts`. Provider adapters and read-only route: `lib/food-adapters.ts`, `app/api/foods/route.ts`. Feature views: `components/tracker-*.tsx`. CSS tokens and motion: `app/globals.css`. Manrope is self-hosted under its included SIL Open Font License.

The initial requirement for image approval was explicitly superseded by Noah's request to stop showing previews and build directly. No rejected mockup is an approved visual reference.

## Android private beta (0.2.0)

See ANDROID_TESTING.md for APK installation, exact rebuild steps and native-device checks. Run `npm run android:build` on this Windows host. The Android bundle is self-contained and does not require the hosted website to load.

Optional local profile: name, height, weight, age, selected formula, activity and suitability. A maintenance-calorie estimate is reviewed before optional adoption. No online registration or syncing is included. Android automatic cloud backup/device transfer is disabled; use the explicit JSON backup/share action. Existing website data can be exported and imported into the app.

Stored schema is now version 2, migrated from version 1 without resetting records. The backup envelope remains version 1; its data contains the schema version. Merge keeps the current profile/settings; Replace restores the imported ones. See lib/profile.ts and ANDROID_TESTING.md for calculation sources and limitations.

## Nortivo 0.3.0-private update

Company/app branding is now Nortivo. Android versionCode2 retains the original package and signing certificate, so install over0.2.0 without uninstalling. Schema3 migrates schema1/2 records and adds persisted appearance preference (System by default). Theme controls are in the header and Innstillinger → Utseende. Personal names, historical records and older backup identifiers are preserved.

All tracker dialogs now use a single flex viewport container without stock transform-centering utilities. The container tracks the visible viewport while the keyboard opens; Android uses adjustResize. Dialogs focus their container on opening, allowing the user to open the keyboard deliberately by tapping an input.
