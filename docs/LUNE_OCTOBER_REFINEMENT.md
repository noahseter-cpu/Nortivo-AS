# Lune refinement — 25–26 October 2026

User requested a modest, more modern and less generic refinement plus pushing the updates. Scope is the open Lune restaurant demo and its matching homepage preview copy; Arc, support, administration, backend and stored data remain unchanged.

## Implemented

- Manrope headings with the existing Gloock logo, smaller section titles and clearer type hierarchy.
- Paper hero with copy/actions beside one un-darkened room image; removed circular decoration and repeated room photo.
- Shorter bilingual copy, tighter menu spacing and a compact about/opening-hours section. One repeated fictional-restaurant explanation removed; disclosure remains explicit in the banner, about, menu, booking and confirmation.
- Existing menu filters, native date/guest/time controls, local-only confirmation, focus and reduced-motion behavior retained. No new animation library, asset or data dependency.
- Scoped design tokens and narrative updated in `restaurant/DESIGN.md` and `restaurant-design.json`.

## Verification

- Independent reviewer requested stronger text contrast in the blue about/hours section; changed its paragraphs from muted to ink before publication.

- Locale build produces 18 pages; 64 automated tests pass, including unchanged support navigation and security contracts.
- Browser captures at `.impeccable/review/lune-oct25/`: 1440×1000 English desktop/visit; 390×844 Bokmål home, filtered menu and confirmation; 320×740 English home. These are viewport sections, not a full-page or real-device audit.
- Vegetarian + main-dish filter returned one dish. Native radio ArrowRight changed 18:00 to 19:00; Enter confirmed 27 October 2026 / two guests. Confirmation explicitly says no reservation. No personal data entered, sent or stored.
- No horizontal overflow in measured desktop/narrow views; browser error log empty. Preserved reduced-motion gating inspected in code, not claimed as device playback testing.
- One detector scan: 45 scoped font/color/type-size/radius advisories against the corporate design system; Lune intentionally has a separate documented system. No new raster assets.

## Release

Before this change, public HTML/CSS still matched fe4bb0a, not the September editorial commit. User signed in to Netlify during this task; Trigger deploy was enabled. Publication must be verified against the new production revision after push.
