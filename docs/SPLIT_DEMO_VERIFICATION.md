# Separate pages and Lune demo — 2026-09-22

## Scope

User-authorized changes to the public website only: shorten the homepage, use “Produkter”, distribute services/biography/contact to separate pages, add a professional fictional restaurant demonstration under Nortivo, and publish to the existing Netlify project. No Arc app, database, production credentials or customer records changed.

## Automated checks

`node scripts/build-locales.mjs` builds 18 localized pages. `node --test tests/*.test.mjs`: 57 passing tests. Coverage includes translation parity, local links/assets, headings/labels/IDs, old homepage-fragment redirects, contact prefill and submission contracts, support authorization, email-link signatures, rate limiting and server error handling. New restaurant tests cover impossible/leap dates, Oslo date boundaries, closed days, time slots, guest bounds, past-date rejection and absence of network/storage/personal-data inputs in the demo.

## Browser checks

- Desktop 1440×1000: home, services, biography, contact and restaurant first views.
- Mobile 390×844: those same pages; restaurant menu and booking sections. No horizontal overflow found. Restaurant first view additionally checked at 320×740.
- Menu category plus vegetarian filter leaves the matching dish; reset displays all eight dishes.
- Sunday selection shows the closed-day explanation. Friday 25 September 2026, 18:00, two guests shows a clearly fictional confirmation.
- Switching to English preserves and translates that confirmation; returning to the form preserves the selected values.
- Contact `?project=web` selects the website option. Backend wiring is unchanged. This pass did not send another real ticket or email.
- English restaurant route rendered and passed a DOM overflow check.

Evidence is in the local, gitignored `.impeccable/review/2026-09-22-split-demo/` directory. The full-page screenshot API failed; evidence uses first-viewport screenshots and named section captures, not claimed full-page captures. Desktop/mobile screenshots were opened and inspected. This is not a real-device, screen-reader or exhaustive browser-compatibility test.

## Design checks

One detector run; mechanically corrected heading skips, tiny functional text and CTA hover contrast. Removed whitespace-only contact feedback and corrected singular menu-count wording. Remaining palette/radius advisories concern the deliberately separate fictional restaurant identity; container-padding warnings need interpretation against the inner wrappers and actual screenshots.

Independent finish review disposition: **ship**, scoped to the 14 supplied captures and inspected code. No blocking visual defect found; padding findings were judged false positives. Review did not independently rerun integrations. Minor singular guest wording was subsequently corrected, and the direction contract now distinguishes dark booking buttons from the yellow Nortivo CTA. Legacy unprefixed About/Services/Contact source fallback metadata still reflects the homepage; deployed language-prefixed output has correct per-page metadata and the edge redirects bare routes there.

## Image provenance

`dist/assets/lune-table.webp`: original AI-generated image for this fictional demo, 1536×1024, converted to WebP quality 85 with Sharp, no compositional edits. Exact prompt in `docs/LUNE_IMAGE_PROMPT.txt`, also retained in the shipped `.webp.json` provenance sidecar. The original generated PNG remains in the local source archive outside `dist`; no unnecessary 2.7 MB PNG is deployed. The visible image caption identifies it as generated illustration.
