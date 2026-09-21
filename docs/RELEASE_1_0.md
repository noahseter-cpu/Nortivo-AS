# Arc by Nortivo 1.0 candidate

Candidate: **1.0.0-rc.1**, Android versionCode **10**, prepared 2026-09-21. No public deployment, Play submission, paid integration, online account service or production data change was performed. The accepted brief is [ARC_1_0_BRIEF.md](ARC_1_0_BRIEF.md).

## Implemented scope

Existing React/TypeScript/Vinext web app and Capacitor Android bundle retained. Six views cover overview, money, food, manual activity, history and settings. Personal data is validated and committed transactionally in local IndexedDB. Search cache is separate. There is no bank/watch import, cross-device synchronization or app-owned authentication; multi-account/server-authorization testing is therefore not applicable.

- Full central `nb`/`en` catalogs, locale-aware numbers/dates, complete translated messages and accessible names. User notes, custom categories and brand names remain unchanged. Language selection preserves form drafts and data.
- First-use language: Norway → Norwegian, all other/unknown countries → English. Web uses trusted hosting country metadata only. Android uses device region as a documented fallback; neither claims a physical download country. Manual/persisted preferences always win. Existing users retain Norwegian. No billing or location permission was added. See [LANGUAGE_1_0.md](LANGUAGE_1_0.md).
- One food search combines official bilingual Matvaretabellen and Open Food Facts. Local results survive remote errors/offline use. Favorites, recent foods, saved meals, manual products, label corrections and barcode entry remain available. Source, basis and available nutrients are shown; missing values stay unknown. See [FOOD_SEARCH_1_0.md](FOOD_SEARCH_1_0.md).
- Schema4 preserves older records, historical calorie snapshots, budgets, profile, appearance and legacy package/database/backup identifiers. Backup envelope remains version1. Changes to source data never recalculate past food logs.
- Exact øre calculations now reject aggregate records that could exceed safe integer precision before any storage write. NOK never changes on language switch. Steps are explicitly manual; dates remain Europe/Oslo.
- Mobile language controls and food nutrition layout fit the existing design. Stable dialog viewport behavior, keyboard focus, reduced motion and commit-before-success behavior retained.

## Prioritized work and reproduction

| Priority | Problem/reproduction | Change | Verification |
|---|---|---|---|
| P0 | Sum enough individually valid large transactions to exceed exact JS integer precision | Validate absolute aggregate bounds using BigInt; reject save/import atomically | Core/storage boundary and abort tests |
| P1 | English system outside Norway still sees hardcoded Norwegian; no persistent selector | Central catalogs, locale formatters, source-aware country initialization and manual override | Country NO/GB/SE/DK/unknown, late response, restart, upgrade and draft-preservation tests |
| P1 | Provider selector requires separate searches; English `apple` misses Norwegian `eple` data | Unified partial-result service; official names joined by ID; market separate from locale | Bilingual snapshot, ranking, partial failure and offline tests |
| P1 | Hung native HTTP leaves loading active beyond deadline | Race native transport with abort/deadline; ignore late completion | Never-resolving native-bridge fixture |
| P1 | Editing an imported food log discards its note | Preserve existing note in edited snapshot | Code review and historical-snapshot tests |
| P1 | Changing label calories leaves source macros in the selected-amount preview | Mark derived macros unknown when the confirmed energy/basis changes; original values stay explicitly source-labelled | Browser correction/revert and saved-snapshot test |
| P1 | Release bundle fails Android lint due to a drawable-to-mipmap icon alias | Supply a matching legacy mipmap vector; preserve the Arc design and adaptive icons | Release lint and AAB build |
| P1 | New language controls crowd mobile/onboarding and unbalance desktop settings | Responsive header and existing appearance panel; full-message text | 320/390/1440px screenshots, overflow, dialog focus/bounds |
| P2 | Startup assumes a personal name; brand spelling inconsistent | Empty new personal name; neutral greeting; Arc by Nortivo display name | Empty-state UI and Android label inspection |

## Build and verification

Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run android:build`. The test command starts/reuses localhost:5174 unless `TEST_URL` is provided. Edge is configured on this Windows machine. `MOBILE_PROFILE_TEST=1`, `LIVE_INTEGRATION=1` and `PRODUCTION_TEST=1` enable environment-specific tests; a skip is not a pass. Public-source requests use isolated test data, never the user's diary.

The private APK is `outputs/android/Arc-by-Nortivo-1.0.0-rc.1.apk` with a SHA-256 companion. [VALIDATION.md](../VALIDATION.md) records final executed results and limitations. [RELEASE_REVIEW_1_0.md](RELEASE_REVIEW_1_0.md) records independent review. [ANDROID_RELEASE_1_0.md](ANDROID_RELEASE_1_0.md) describes optional release signing. Screenshots under `outputs/release-1.0/` contain isolated synthetic data.

## Required before public launch

Completed locally:63 main tests,12 mobile-preview tests, offline Worker journey, real MVT adapter request, TypeScript, ESLint (four image advisories), web build, signed private APK and unsigned release AAB. Production OFF returnedHTTP429; it remains the external P1 verification gap. Full evidence and artifact hashes are in [VALIDATION.md](../VALIDATION.md).

- [ ] Test the actual APK on the owner's Android phone: install over the prior beta, retained diary/backups, native region fallback, keyboard, Back, camera denial/scanning, HTTP offline/timeout and share/file picker. Browser simulation does not establish these.
- [ ] Verify successful live Open Food Facts search and barcode requests from the target deployment/network. Existing provider limits and possible unavailability remain external constraints. Ordinary ingredient coverage works locally; restaurant coverage is opportunistic, not comprehensive.
- [ ] Choose and safeguard the Play upload/signing setup and final store identity. Debug-signed beta and release signatures are not interchangeable. Preserve/export data before switching signing identity. No signing keys are generated or committed by this change.
- [ ] Publish an accurate privacy policy with the owner's legal/contact details and URL; complete applicable Play health/data-safety declarations against actual behavior. See [PRIVACY_1_0.md](PRIVACY_1_0.md). The draft is not a claim of legal approval.
- [ ] Confirm hosted first-use country metadata and offline web behavior on the actual deployment; no remote deployment was authorized here.
- [ ] For broad public traffic, register OFF usage and assess aggregate search limits across Worker instances; current per-isolate limits do not enforce a global shared-IP quota. A private month of testing does not prove production capacity.
- [ ] Obtain explicit user approval before public publishing or irreversible production changes.

No known unresolved calculation/storage P0 is accepted. This candidate is prepared for private validation; remaining platform and distribution checks prevent claiming a finished public release.
