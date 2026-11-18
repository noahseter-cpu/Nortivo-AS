# Approved-design verification — 19 November 2026

**Findings:** no remaining actionable P0/P1/P2 visual findings on the reviewed surfaces. The following records are actual browser comparisons, not build-success substitutes.

## Targets and evidence

| Surface | Exact source | Implementation capture | Measured browser state |
| --- | --- | --- | --- |
| KORVNT | `design-references/approved-master-20261118/korvnt-approved.png` — 856 × 1838 | `.local/master-preview/evidence/approved-v2/korvnt-desktop.jpg` — 840 × 1880 | NB, closed functional details, reference-width 856 CSS pixels; complete public composition. |
| Invest | `design-references/approved-master-20261118/invest-approved.png` — 897 × 1752 | `.local/master-preview/evidence/approved-v2/invest-desktop.jpg` — 882 × 4244 | NB, 897 requested/898 measured CSS pixels, complete page including additional required sections. |
| Request | `design-references/approved-master-20261118/request-approved.png` — 1487 × 1058 | `.local/master-preview/evidence/approved-v2/request-desktop.jpg` — 1472 × 1048 | NB, stage 2, crypto bot, research/paper selection, existing synthetic support history, top-reset 1487 × 1058 CSS viewport. |
| Terminal | `design-references/approved-master-20261118/terminal-original.jpg` | `.local/master-preview/evidence/approved-v2/terminal-desktop.jpg` — 1920 × 1061 | Actual 1920 × 1062 CSS viewport, explicitly read-only fixed sample, synthetic signed-in customer. No terminal style/layout change in this revision. |

The screenshot service normalizes the content viewport uniformly while excluding its scrollbar. No aspect ratio is stretched. Fixed-path comparison pages placed reference and capture in the **same input at equal displayed widths**; saved composite captures are `korvnt-comparison.jpg`, `invest-comparison.jpg` and `request-comparison.jpg` in the same evidence directory. Their lower full-page heights are not mistaken for matching viewport states. The implementation includes extra requested functional sections beyond reference B's depicted sequence.

Full KORVNT composition was examined together with its source. Invest typography/header/hero/preview were examined together, followed by a focused comparison of service rows and invitation (comparison-page region x0/y800/w1265/h650). Request header, grid and controls were compared together before and after density corrections. Terminal source was inspected, its protected composition rechecked in the current browser, and application styling was kept outside its scope. The supplied original parent mark is preserved; the terminal drawn inside another generated mock never overrides the original JPEG.

## Required fidelity surfaces

- **Typography:** self-hosted Manrope provides the selected neutral bold sans-serif hierarchy, tight display wrapping, readable labels and compact navigation. The old serif Invest hero is gone. Approved uppercase display, KORVNT tagline and practical field labels remain. Browser rounding/antialiasing and factual translated labels explain minor glyph/wrap differences.
- **Spacing/layout:** KORVNT retains aperture/ivory index/dark needs sequence; Invest retains split hero, substantial complete terminal preview and broad services. Request preserves the 62/38 specification/support split. Final Next bottom is 1055.8 in a 1058-pixel top-reset viewport. Extra required integration/rule/risk fields are retained rather than removed to imitate generated text.
- **Colors/tokens:** neutral black/charcoal/ivory and restrained titanium match the selected images. The specification sheet is ivory with dark fields/labels, the support area remains charcoal, and semantic financial colors remain confined to actual account/sample information. Phone copy is no longer over the light aperture. Accessible focus colors are functional states.
- **Assets:** project-bound background-only architectural PNGs were generated from the selected references and inspected. They contain no embedded UI; all type/controls are semantic interfaces. Exact supplied parent PNG, existing KORVNT emblem and original terminal JPEG remain intact. Existing standard UI icons are reused; decorative illustrations were not approximated with CSS drawings.
- **Copy/content:** generated spelling/concept wording was corrected. Canonical KORVNT identity, parent endorsement, case-specific recovery limits, development qualification and actual provider/owner states replace unsupported claims. No invented certification, recovery outcome, live quote or response promise.

## Correction history

1. Initial request comparison found excess header/banner and requirement-control height. Corrected the workspace-only 66-pixel mast, banner spacing, inline uncertainty controls and desktop pairing of the additional integration field. The first measurement was affected by browser scrolling; a new query/top-reset capture exposed the remaining gap. Final 14-pixel row spacing recaptured from the top places Next fully inside the intended viewport. Post-fix source and implementation are shown together in `request-comparison.jpg`.
2. Phone KORVNT paragraph crossed the bright opening and its parent endorsement wrapped awkwardly. A phone-only 40% image position keeps the paragraph on dark material; the short Nortivo link retains the full localized relationship as its accessible name. Fresh 390 × 844 inspection confirmed readable copy and no horizontal overflow; `korvnt-phone.jpg` records it. Desktop visual composition was preserved.
3. A synthetic tracking value appeared in an early test readout. That single proof was invalidated. Both receipt interfaces now omit the key from the DOM until explicit reveal, clear it on Hide and track from private in-memory state. Handler and frontend tests cover this; no real credential was involved.

## Interaction and responsive verification

Normal named password/MFA administration, separate company inboxes, real KORVNT receipt/state/reply round trip, KORVNT logout independent from Nortivo, both four-stage Invest submissions and retained engine drafts were verified locally. EN/NB destinations, original terminal sample, 1280 desktop, reference-width views, 768 tablet, 390 phone and 320 narrow layouts were checked. No page-wide horizontal overflow observed. Menus/Escape, native labelled controls and visible focus were checked. Console spot checks returned no errors/warnings.

Remaining P3/follow-up: small generated-to-browser kerning/height differences and additional truthful copy; forced OS reduced-motion rendering, native browser zoom, physical mobile keyboard and complete screen-reader verification remain unverified. Source media rules opt out of decorative motion; these limitations are not claimed as completed tests. Hosted TLS/cookies, providers, deployment, live trading and operational delivery are separate release gates, not visual acceptance claims.

**Implementation checklist:** approved assets installed; three selected surfaces implemented; terminal protected; same-input comparisons captured; material desktop/phone defects corrected and recaptured; real workflows verified; remaining external/assistive-technology checks documented; local previews retained.

final result: passed
