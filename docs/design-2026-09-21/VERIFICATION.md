# Nortivo website — verification, 21 September 2026

## Scope and delivery status

Implemented directly after the user explicitly ended preview/approval rounds. Public website only; the separate Arc application, existing database rows, credentials, DNS and production deployment are unchanged. Local delivery, not a claim of production readiness.

The redesigned site uses an original blue/black N-and-Arc scene, a separate visible founder line, actual empty-state app screenshots, a product-detail page, services/contact, bilingual support/admin and a short data-use page. Impeccable informed composition, legibility and responsive review; Animate informed short pointer feedback and immediate keyboard/menu/language actions. No animation library, scroll hijacking or hidden entrance content.

## Checks and evidence

| Requirement | Check | Result |
| --- | --- | --- |
| Localized public routes | `node scripts/build-locales.mjs` | Pass: ten static pages, translated copy, metadata, canonical and hreflang |
| Security and API contracts | Native Node tests with synthetic configuration and mocked providers | Pass: 21 backend tests; no real database/email requests |
| Locale/edge/local server | Native Node fixture tests | Pass: 11 tests, including traversal, 404, safe 503 and language priority |
| Shared UI/contact | Native Node DOM fixtures | Pass: 17 tests including nested failure cases; drafts, duplicate-submit guard, true saved success and delivery warning |
| Combined suite | `node --test tests/*.test.mjs` | Pass: 49 tests, zero failures |
| Reflow | In-app Chromium, five routes at 320, 360, 768 and 1280 CSS px | Pass: document width did not exceed viewport in any of20 measurements |
| Visual layout | Actual viewport screenshots at320,360,390,768,1280,1440 | Pass for inspected views; mobile hero recomposed to retain N/Arc artwork |
| Founder identity | Home desktop/mobile and footer screenshots | Correct Noah J.C. Sæter, separate from primary CTA |
| Mobile menu | Open, Escape, focus return; Node fixture repeats state checks | Pass: closes and returns focus to trigger |
| Product navigation | Hero CTA, feature anchor, native FAQ disclosure, support link | Pass in browser |
| Contact | Empty submission, local synthetic draft, English→Norwegian switch, local503 | Pass: focused first invalid field, retained draft, honest error, no email sent |
| Support lookup | Invalid ticket syntax, synthetic valid-format ticket/email, nb→en switch, local503 | Pass: inline validation, draft retained, no private conversation disclosed |
| Admin | Direct route, desktop/mobile logged-out/unavailable state | Visually checked; no real password entered; authenticated browser journey NOT tested |
| Contrast | Numeric foreground/background checks | Default action white/blue5.60:1; hover darkened; main field border strengthened; portal agent checked text/placeholders/field borders |
| Motion | CSS and event-path review | Hover capability gate, pointer-only transform, reduced-motion override; no timed entry or keyboard animation. Physical-device feel NOT tested |
| Raster provenance | Impeccable `embed-prompt --scan dist/assets` | Four shipping rasters, zero missing provenance; path-free shipping sidecars |
| Mechanical design scan | Impeccable detector, one run | Small status text fixed to12px on narrow screens. Remaining full-bleed-section padding warnings passed to independent reviewer; content uses inset `.wrap` containers |
| Source hygiene | `git diff --check`, JS parsing, local link/asset signature tests | Pass; Git only warns about expected LF/CRLF normalization |

## Screenshot record

Current actual screenshots are under `.impeccable/review/2026-09-21/`. Required final evidence: `final-home-desktop.png`, `final-home-mobile.png`, `final-home-320.png`, `final-home-360.png`, `final-home-768.png`, `final-home-1280.png`, `final-arc-desktop.png`, `final-arc-mobile.png`, `final-services-desktop.png`, `final-contact-desktop.png`, `final-products-desktop.png`, `final-products-mobile.png`, `final-privacy-mobile.png`. Portal evidence: `built-support-desktop.png`, `built-support-mobile.png`, `built-support-lookup-mobile.png`, `built-admin-desktop.png`, `built-admin-mobile.png`, `built-contact-mobile.png`.

The browser's full-page stitching repeated content at seam boundaries. `built-home-full-desktop.png` is rejected as malformed evidence. Separate verified viewport captures are used instead; these are not design mockups.

## Explicitly not verified

Independent finish review: `FINISH_REVIEW.md` returned **disposition: ship** for the supplied local UI evidence. All19 required viewport captures were valid; no material UI fixes were requested. It did not certify production readiness, and no separate QUALITY BAR card or approved comp was supplied.

- No public deploy, actual Resend delivery, real Supabase write/read or existing customer record was tested.
- Netlify edge geography, redirects, secure-cookie behavior and production CSP/headers require an approved deployment check.
- End-to-end admin answer/status/logout and verified-customer browser sessions remain deployment tests; mocked handler tests do not substitute for them.
- No Safari, physical iPhone/Android, actual mobile keyboard, throttled-network run, browser zoom run, Lighthouse or field Core Web Vitals measurement. Reflow widths are not a claim that every device or full WCAG is covered.
- In-memory abuse limits are per serverless process, not globally distributed. Email proof is reusable until expiry. Reply delivery and storage are not atomic. See `../SUPPORT_SECURITY.md`.
- No invented public Arc download. Current app screenshots show a private test build and empty test data; their Norwegian UI is identified even on the English site.

## Publication checklist

Obtain explicit publication approval, deploy through the existing Netlify/Git workflow, verify environment values without printing secrets, and use a user-approved test recipient for one full ticket→confirmation→secure link→admin reply→customer conversation flow. Confirm language persistence, direct localized refresh, unknown-route404, noindex on support/admin, and production headers. Do not migrate or reset existing data.
