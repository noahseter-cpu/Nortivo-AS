# Homepage visibility refinement — 22 September 2026

## User direction

The user rejected the over-sparse homepage and hidden restaurant demo. Restore useful company/product context without returning all details to one page. Show a visible restaurant website preview within Nortivo and retain a strong focus on Nortivo's own product, Arc. This is an extension of the existing identity, not a replacement visual world or a new preview-approval round.

## Implemented hierarchy

1. Existing cinematic introduction with Products as primary action and a restaurant-preview shortcut.
2. Lune immediately below: large clickable HTML excerpt with the restaurant's real demo copy, light blue surface, wordmark treatment and generated food asset. The entire excerpt opens the full localized demo; no embedded iframe or nested controls. A caption identifies the fictional work.
3. Arc: strong product heading, real empty-test screenshot, three capability labels, honest private-test status and primary link to Products.
4. Concise website/app service summaries, followed by About and Contact links. Detailed product, biography, services, contact and support routes remain separate.

The Nortivo palette and type system are preserved. Only the Lune excerpt uses the scoped restaurant identity. No new animation was added: the existing hero sequence and reduced-motion rules remain; product evidence and preview text stay stable while read.

## Verification

58 automated tests pass, including dictionary parity, localized paths/assets, homepage preview/product presence, form contracts and support-security regression tests. Browser checks cover desktop 1440, mobile 390 (English homepage and Norwegian Arc), and 320 English preview without horizontal overflow. The hero shortcut navigates to the preview; activating the preview opens the English restaurant route. Screenshot evidence is under `.impeccable/review/home-showcase/` and consists of named viewport/section captures, not full-page captures.

The layout detector's product-band padding warning is interpreted against its inset child wrapper (64px desktop, 44px mobile). No new assets, tracking, credentials, database changes or production ticket writes. Real devices and screen readers were not tested.
