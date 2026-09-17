# Calorie verification — 2026-09-17

## Full Matvaretabellen comparison

Fetched https://www.matvaretabellen.no/api/nb/foods.json again and compared the complete calories objects by foodId against the bundled snapshot: **2,121 compared, 2,121 identical, zero missing IDs or calorie mismatches**. The adapter test separately verifies the 2,118 readable food records preserve source kcal and provenance. Three other records do not pass the existing adapter's schema. This verifies transport/parsing, not independent laboratory accuracy or suitability for a particular packaged food.

## Manufacturer checks (10 products)

These are reference checks, NOT automatic overrides by product name. Match country, exact variant, barcode and current packaging before changing a personal record. All units below are copied from the source, not converted using an assumed density.

| Specific product | Manufacturer kcal | Basis | Source |
| --- | ---: | --- | --- |
| Mountain Dew, Norwegian Ringnes product | 29 | 100 ml | https://www.ringnes.no/produkter/mountain-dew/mountain-dew/ |
| 7UP | 30 | 100 ml | https://www.ringnes.no/produkter/7up/7up/?Ckey=38757 |
| Pepsi Cola | 18 | 100 ml | https://www.ringnes.no/produkter/pepsi/pepsi-cola/ |
| Pepsi Original Taste | 43 | Page does not explicitly label quantity basis; check packaging | https://ringnes.no/produkter/pepsi/pepsi-original-taste/?Ckey=38547 |
| Solo | 43 | 100 ml | https://ringnes.no/produkter/solo/solo/ |
| Solo Super | 4 | 100 ml | https://www.ringnes.no/produkter/solo/solo-super/ |
| Solo Rabarbra & Bringebær | 43 | 100 ml | https://www.ringnes.no/produkter/solo/solo-rabarbra-bringebaer/ |
| Pepsi Max Koffeinfri | <1 (not exactly zero) | 100 ml | https://www.ringnes.no/produkter/pepsi/pepsi-max-koffeinfri/ |
| TINE Fettfri Skummetmelk | 34 | 100 g | https://www.tine.no/merkevarer/tinemelk/produkter/tinemelk-skummet-fettfri-melk |
| TINE Laktosefri Lettmelk 1.0% | 35 | 100 g | https://www.tine.no/merkevarer/tine-laktosefri/produkter/tine-laktosefri-lettmelk-1-2-fett |

The reported Mountain Dew 20 kcal does not match the Norwegian producer's29. Exact OFF record/barcode remains unknown. OFF live search returned503 again, including the separate v2 endpoint; no claim of validating all OFF records is made.

The source comparison also shows why identical names are not enough: Matvaretabellen's Skummet melk, Tine (01.003) has33 kcal/100g while the current producer page has34. Its generic lactose-free1% milk entry (01.215) has37; the specific current TINE product has35. These source/variant differences are documented, not silently overwritten. Historical diary entries remain immutable snapshots unless the user deliberately edits them.

## Profile estimates

The implemented Mifflin–St Jeor formula is tested for both coefficients and selected activity multipliers. Example test fixture:80kg,180cm,30years, male coefficient gives1780 resting kcal; factor1.6 gives2848, rounded to2850. This is a rough maintenance estimate, not a measured personal requirement. Activity factors and the illustrative ±10% range do not guarantee an individual's true needs. Users can keep their existing goal, adopt the suggestion, or enter their own positive daily goal. No automatic goal is set for ineligible profiles.

References: https://pubmed.ncbi.nlm.nih.gov/2305711/ and https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner . The app does not implement NIDDK's dynamic model.
