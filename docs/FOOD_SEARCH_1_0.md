# Arc by Nortivo 1.0 — food search

Implemented and checked 2026-09-21. This extends the existing Matvaretabellen/Open Food Facts adapters; no new service, paid dependency, public upload or account was introduced.

## Fixed issues and evidence

| Priority | Reproduction before 1.0 | Change | Verification |
| --- | --- | --- | --- |
| P1 | Choose a provider before every food search; a provider outage prevents seeing the other library. | One submitted search queries both adapters. Available results appear immediately, with source-specific failures alongside them. | UI test: no HTTP request while typing, one OFF request on submit, MVT results survive HTTP 503. |
| P1 | Search `apple` in the Norwegian-only MVT snapshot. | Official English and Norwegian names/keywords are joined only by stable food ID. | All 2,121 food IDs retain their official English names; apple/eple overlap is tested. |
| P1 | Select a food: no protein/carbohydrate/fat information. | Preserve six source-backed nutrients per 100 and show the selected amount. Optional manual-product fields keep unknowns blank. | Zero, missing, scaling and incompatible-unit tests. |
| P1 | An Android native HTTP promise never resolves despite a requested timeout. | Race the bridge against cancellation/deadline; ignore late responses. Native connect/read limits remain. | A mocked unresolved native bridge settles when cancelled. |
| P1 | Edit a historical food entry that contains a note. | Preserve `entry.note` when changing amount/date. | Code review; the storage snapshot tests remain part of the overall suite. |

## Data and nutrition

The bundled MVT dataset contains 2,121 foods, retrieved 2026-09-21 from both official language endpoints. `scripts/refresh-matvaretabellen.mjs` validates both datasets before replacing the public snapshot. It does not access private storage. MVT documents its unversioned endpoints, permits caching and requests attribution. [Official API](https://www.matvaretabellen.no/api/)

The app stores source ID, URL, snapshot/version description, bilingual source names, market tags, original energy basis and available protein/carbohydrate/fat/fibre/sugars/salt. MVT uses the official constituent IDs `Protein`, `Karbo`, `Fett`, `Fiber`, `Mono+Di` and `NaCl`, with gram units. Null quantities remain unknown, including foods whose calorie declaration explicitly contains null. A missing macro is never converted to zero. [MVT nutrient definitions](https://www.matvaretabellen.no/api/nb/nutrients.json)

OFF product lookup remains explicitly pinned to API 3.4, whose `nutriments` representation matches this adapter. The current change log documents incompatible nutrition changes starting at 3.5; upgrading the number without migrating the schema would be unsafe. Full-text search keeps the documented legacy `cgi/search.pl`; the existing structured-brand route uses v2. [Official API](https://openfoodfacts.github.io/openfoodfacts-server/api/) · [Schema change log](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-api-and-product-schema-change-log/)

Energy reads explicit kcal/100 fields. If only explicit kJ/100 is present, kcal is `kJ / 4.184`, with original value/unit saved and a conversion explanation in the form. Conflicting kcal/kJ declarations remain unavailable. Serving-only energy and ambiguous generic energy are not silently reused. Product volume/weight does not establish the nutrition basis; OFF's ambiguous 100-unit basis still requires label confirmation. No density conversion is performed.

Documented MVT portion weights can fill the amount. A missing portion size cannot become 100 g by default. Every committed diary record still stores its own food snapshot and quantity. Provider refreshes do not rewrite earlier entries. Personal names/notes are not translated. Older snapshots without an official English name retain the original food name.

## Search, market and offline behavior

- One explicit Search action, never an OFF request on every keypress. Barcode search calls OFF only and retains leading zeroes.
- Exact product names/barcodes rank above loose matches. Only matching source IDs are deduplicated; different variants, preparation states and product sizes stay separate.
- Norway-first/all-markets is a persisted setting independent of interface language, NOK, units or timezone. Known OFF market tags and unknown markets are displayed. MVT is labelled as generic Norwegian food data.
- MVT is searched in a lazy bundled library on web and Android. Android includes that file in its APK. A web offline session needs the library chunk to have been available locally; saved foods/favourites remain separate and reusable regardless.
- The OFF cache is separate from private records, validates cached values and has a 24-hour freshness policy. Offline cached searches are allowed. Cache-write failure does not discard a successful provider response.
- Previous searches are cancelled or ignored after a new request. The UI distinguishes zero results from a source outage and keeps the query, locally saved products and manual-product action available.
- OFF query errors contain a canonical message key plus localized API text. Internal JSON/network/schema errors use a human-readable translated fallback.

## Licence, privacy and capacity

OFF distinguishes the database (ODbL), individual contents (DbCL) and product photographs (CC BY-SA). Product results retain their source and original product URL; the app's source notice links to the terms. Images are not rebundled into a merged public dataset. User foods and diary entries stay private and are never uploaded to OFF. A future public combined dataset or bulk image mirror would require a separate licence review. [OFF licensing guide](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/) · [Terms](https://world.openfoodfacts.org/terms-of-use)

Official OFF limits checked on 2026-09-21: 10 search and 15 product read requests per minute per IP. Existing adapter limits stay below those at 8/12 per minute per process, with an hour server cache and 100-query bound. Android requests leave from the device's connection. Hosted web requests can share an egress IP; several worker isolates do not provide a global shared limit. Production capacity therefore still needs a load/egress review before broad launch; partial MVT/offline functionality does not eliminate this constraint. The OFF usage-registration form has not been submitted on the owner's behalf. [OFF integration guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/)

USDA FoodData Central was evaluated. It provides useful US foods and CC0 data but requires a private data.gov API key. The current self-contained APK has no secret-holding service for that integration; embedding an API key would expose it. No USDA or restaurant-specific source was added. Restaurant data is limited to actual source records with their available market metadata; coverage of every restaurant/product is not claimed. No commercial subscription is needed for the implemented sources. [USDA API guide](https://fdc.nal.usda.gov/api-guide/)

## Validation and remaining limits

- `npm run typecheck`: passed after the final food changes.
- `tests/food-unified.spec.ts`: 8 focused tests passed across the final split runs (seven normalization/service tests and one browser workflow). These cover official bilingual identity, zero vs unknown nutrition, 250 kcal/100 g × 150 g = 375 kcal, 40 kcal/100 ml × 500 ml = 200 kcal, decimal quantity, explicit kJ conversion, ranking/deduplication, partial results, cancellation of a native bridge, localized errors and query/market behavior.
- Existing provider/correction focused checks: 4 passed before the final localized UI changes. The main project suite is rerun by the release workflow.
- Impeccable detector for `components/tracker-food.tsx`: no findings. Composition reuses the implemented panels/forms/tokens; frequent search updates are immediate and no decorative animation was added.
- Live MVT retrieval succeeded. Both OFF staging text-search and barcode probes timed out after 20 seconds from this host on 2026-09-21. Mocked integration paths are tested, but live OFF availability is not certified by this run.
- Root's separate production-Worker integration passed the live MVT adapter query; the production OFF text search returned HTTP429 before barcode selection. The external integration test remains failed, rather than being relabelled a success because the error UI works.
- Camera permission/scanning on a physical Android device and the final native bridge in an installed APK still require device testing. Tests use synthetic nutrition fixtures and never inject them into user records.

This is a source and calculation validation, not a guarantee that every provider product matches every manufacturer's label or market variant.
