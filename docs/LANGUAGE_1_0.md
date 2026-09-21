# Arc 1.0 language, region and migration

Arc remains a local React/Vinext application, bundled with Capacitor for Android and also served through Cloudflare Workers. It has one on-device profile, no accounts or account switching. Language choice belongs to that local profile and is included in explicit backups.

## Priority and first use

1. An explicit selection saved transactionally in IndexedDB.
2. Any previously preserved language, including Norwegian for upgraded installations.
3. First-use country evidence where available: `NO` selects `nb`; any other country selects `en`.
4. Unknown country selects `en`.

The app waits for local state and bounded initialization before revealing its interface. The country request is used only on a genuinely new profile. A delayed response cannot replace an already saved manual selection because the transaction rereads current settings. Settings and first-run setup expose “Språk / Language”, “Norsk (bokmål)” and “English”. A language change updates React subscribers without remounting forms, and reports success only after the write commits.

## What each platform can actually know

- Android: the bundled `DeviceRegion` Capacitor plugin reads the first system locale's explicit country through `Resources.getSystem().getConfiguration().getLocales().get(0).getCountry()`. This is a **device-region fallback**, not physical location, download country or Google Play country. A bare language with no region is unknown. Android private sideloads do not supply a download country. No GPS, tracking service, telephony permission or billing integration was added. Android device behavior must still be checked on hardware.
- Web/PWA: `/api/locale` accepts only Cloudflare's `request.cf.country`. This approximates the incoming network's country at first use; VPNs can change it. Client-supplied headers and browser language are not trusted country signals. Vinext's installed request pipeline and `NextRequest` constructor both preserve Workers `cf` metadata; the live hosted route has not been verified without deployment, so missing metadata deliberately returns unknown. Responses are private/no-store. Local development usually has no edge country and defaults to English.
- iOS: no iOS application exists in this project. Apple's Storefront is not implemented or claimed.

Only selected language and a coarse selection reason are stored; no country or IP address is copied into the profile. A manual preference is never reconsidered on travel, network changes or VPN use. Norwegian browser/system language alone never overrides non-Norwegian country evidence.

Official documentation checked 2026-09-21:

- [Android Configuration locales](https://developer.android.com/reference/android/content/res/Configuration#getLocales()) describes preferred device locale access.
- [Google Play billing configuration](https://developer.android.com/google/play/billing/integrate#query-users-billing-configuration) supplies Play country but forbids storing returned billing configuration data and limits use. This app does not add billing merely to choose a language.
- [Cloudflare incoming request metadata](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties) documents network country.

## Translation and formatting

`lib/i18n.ts` composes source-phrase catalogs owned by core, general UI, settings and food. Full sentences use named interpolation. Missing English entries retain readable source text and are tracked; `tests/language.spec.ts` statically checks literal `t`/`tr` calls and interpolation parity. Dynamic catalog entries also need rendered journey coverage; this check does not claim to prove every arbitrary future string is translated.

`nb` uses `nb-NO`; `en` uses `en-GB`. NOK and exact integer øre, food quantities in g/ml, Monday-first weeks and Europe/Oslo calendar dates remain independent of language. Only unchanged built-in category IDs/names are translated. Custom categories, notes, food names and other user text are preserved.

Money accepts ungrouped comma/dot decimals with at most two decimal places, and correctly grouped spaces (`2 300,50`). Incomplete grouping, comma/dot thousands notation, exponents and negative unsigned values are rejected. Quantity inputs use the current language's decimal separator; simple alternate decimals such as `1.5`/`1,5` remain accepted, but a foreign separator followed by a three-digit group is rejected as ambiguous.

## Data migration and recovery

Schema 4 adds nullable initial language, its source, an independent food market (`no` or `world`) and optional food provenance/nutrient metadata. Schema 1 → 2 → 3 → 4 is validated in memory. All previously released schemas preserve Norwegian by adding `language: nb`, `languageSource: legacy`. New profiles start unresolved until initialization commits a choice. Existing database names, object-store keys, backup envelope identifier and Android package remain unchanged.

Historical logs retain their stored amount, calorie total and food snapshot. Optional nutrition metadata does not invent missing values; missing is distinct from zero. Every write and restored backup is validated before commit. Merge retains current settings and matching records; explicit replacement restores backup settings. An invalid or future schema aborts rather than deleting records.

Before upgrading, export a JSON backup. There is no automatic downgrade from schema 4 to schema 3: retain the pre-upgrade backup if reverting to an older APK, or restore the validated backup in the new app. Do not uninstall or clear application data as a migration method.

Automated coverage is in `tests/language.spec.ts`, existing storage/core tests and browser journeys: country policy, manual-choice race, restart preservation, old-schema roundtrip, malformed backup rejection, money/date invariants, exact synthetic nutrition, trusted edge metadata and catalog completeness. Native region selection and live edge-country propagation require device/deployment evidence and are not claimed as verified by unit tests.
