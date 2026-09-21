# Arc 1.0 focused release-safety review

Reviewed 2026-09-21 against the current working changes. Scope: migration and backups, locale ordering/isolation, country trust, financial precision, food snapshots, network boundaries and actual account architecture. This is a bounded code/test review, not a security certification or physical-device acceptance test.

## Concrete findings

| Severity | Reproduction and effect | Resolution / evidence |
| --- | --- | --- |
| P1 | Editing an imported food log containing a note wrote `note: ""`, erasing that historical text when only the amount changed. | FoodForm now preserves `entry?.note ?? ""`. Code change inspected; browser regression belongs to the food agent's suite. |
| P1 | Native search awaited `CapacitorHttp.get` while only aborting a JavaScript controller that the native promise did not observe. A hung native bridge could leave the search pending after its advertised deadline. | Fixed by the food owner with a transport/abort race and late-response suppression. The unresolved-native-promise regression in `tests/food-unified.spec.ts` is present and was reported passing by that agent. The final audit inspected the change without rerunning the root's active suite. Browser `fetch` also observes its signal. |
| P2 | 9,007 transactions of 1,000,000,000,000 øre plus a remaining amount can reach the maximum exact JS integer. One more øre or a budget/refund calculation beyond that boundary was accepted by individual row validation, allowing inexact totals. | Fixed: validation uses BigInt to bound absolute transaction sums plus the larger of opening balance magnitude and any budget cap. Unsafe import/write aborts before commit. Exact boundary, failed extra-øre write, negative opening balance and refund/budget overflow regressions pass. Ordinary records are unaffected; an already oversized record remains preserved rather than being silently recalculated. |
| P2 | Default category names in Settings remained Norwegian after selecting English. | Settings now uses categoryLabel for display/accessibility; raw custom names and editor values stay intact. Inspected after correction. |

## Safety conclusions supported by inspection/tests

- Schema 1 → 2 → 3 → 4 preserves transactions, food snapshots, activity, budgets, names and effective-dated goals. Existing releases retain Norwegian. JSON roundtrip and 12,000 transactions plus 12,000 food snapshots pass; unsupported versions, bad references, duplicate IDs and inconsistent calorie snapshots reject.
- IndexedDB `updateState` reads the latest state inside a read/write transaction, validates the result and reports success only on transaction completion. Failed writes preserve prior data. UI save locking prevents overlapping repeated submits. Public provider caching remains in a different database.
- Delayed country detection rereads current settings before committing. A newer explicit language choice wins; failed language writes leave visible and stored preferences unchanged. The app gates normal content until initialization completes. Manual values are included in backups; merge preserves current settings and explicit replacement restores the imported settings.
- The mutable language store is used by the single local browser profile. Server food responses use the request's language parameter and an explicit catalog, rather than setting that mutable store. No server entry point calls setLanguage/syncLanguage; no observed request-to-request locale leak. Future server-localized rendering must retain request-local selection rather than mutate this client store.
- Country detection accepts only Workers `request.cf.country`, ignoring caller-supplied country headers and browser language. Vinext's installed request pipeline and NextRequest implementation preserve that metadata. The endpoint is private/no-store and the service worker excludes `/api/`. No raw country/IP is saved. Android uses a documented device-region fallback and cannot prove download country.
- Food logs store cloned nutrition snapshots and their calculated total. External catalog refreshes do not rewrite prior entries. Missing energy/units remain distinct from zero; source kcal/kJ values are normalized by source-specific adapters. Gram/millilitre confirmation remains explicit and no density conversion is invented.
- Provider requests contain the explicit public food query/barcode, selected language and market. Private diaries, custom foods, finances and profile measurements are not sent by those adapters. API URLs are built against fixed provider hosts; product names are React text and provider images are restricted to the OFF image origin.
- This is one local profile per origin/browser/device, with no tracker accounts or server-stored private diaries. The unused Sites auth helper is not tracker authentication. Account-switch isolation tests are inapplicable; shared-browser users share the same local profile. The native manifest disables Android automatic backup and cleartext traffic. Explicit JSON/CSV exports remain unencrypted.

## Verification executed during this work

- Core, language, storage, profile and schema-upgrade tests: 30 passed, 2 existing browser/native-layout tests skipped without their opt-in environment.
- After the precision finding was fixed: `tests/core.spec.ts`, `tests/language.spec.ts` and `tests/storage.spec.ts`: **27 passed**. Includes the exact 2,300 − 120 − 80 budget scenario; synthetic 250 kcal/100 g × 150 g = 375 kcal and 40 kcal/100 ml × 500 ml = 200 kcal; locale races; quota failure; backup validation; high-volume migration; money boundary; trusted country metadata; translation-literal and interpolation checks.
- TypeScript check passed before the final precision guard. Root's final build/check rerun must include that guard and any subsequent food transport fixes.

Hardware APK upgrade retention, native region selection, actual mobile keyboard/camera permissions, live hosted country metadata and production-wide OFF rate-limit behavior are not established by these unit tests. The root release checklist and browser/Android build evidence cover additional validation; this review does not authorize publication.

## Final root UI read-only pass

An AST scan of raw JSX text and literal visible/accessibility attributes in `tracker.tsx`, `tracker-money.tsx` and `tracker-shared.tsx` found only the Arc/Nortivo brand and `kcal` outside translation calls. No old Noah/Norvido display branding was found in those files; compatibility event/database identifiers remain intentionally unchanged. Amounts come from committed state and core calculations, budget overspend is explicitly labelled, and form values are not keyed/remounted by language.

Dynamic findings sent to the root/food owners for the final pass:

- **P1 translation completeness:** `save` displays its message directly. Food forms still supplied a few untranslated Norwegian success phrases at audit time. The food owner was asked to translate each success message before passing it to `save`.
- **P2 language consistency:** Overview recent-food cards and deletion labels used the stored base `food.name` instead of the official language-specific name when one exists. Use the existing localizedFoodName helper; custom/user names must remain unchanged.
- **P2 language consistency:** Already-visible error banners are stored as translated strings. A language switch preserves the old message language until the next validation/save; no internal exception text was observed. Existing transaction amount inputs also initially use a comma in English, although the parser safely accepts it without changing value.

No additional tests were run during this final pass to avoid overlapping the root's final suite.

Root disposition: the reported food success messages now translate before saving; recent/delete food labels use official localized names while preserving user text; root/shared error banners translate on render; monetary input defaults use the locale-aware ungrouped formatter. The final63-test main suite passed after these changes. See VALIDATION.md for the final mobile, build and external-provider outcomes, which supersede earlier partial-run counts above.
