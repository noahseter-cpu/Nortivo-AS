# Nortivo homepage refinement — 26 October 2026

User request: make the main Nortivo homepage more modern and less generic, keep Arc central, then publish. Direct implementation is authorized by the current request and the established no-preview workflow. Scope: homepage in Bokmål and English; keep shared navigation, product/support routes, backend and the Lune demo intact.

Mode: Persuade. A visitor should understand Arc's breadth, its private-test status and Nortivo's separate website/app services. No invented launch, integrations, clients or testimonials.

## Direction contract

THESIS: Replace the decorative opening with Arc itself. Preserve Nortivo's navy identity while removing the duplicated generic introduction/product introduction.

OWN-WORLD: Existing navy, pale text, Manrope and solid blue actions. Open aligned regions, no floating decorative cards or background artwork. A real app screen supplies the visual contrast.

STORY: Meet Arc, understand money/food/manual steps, explore its product page, then inspect the explicitly fictional Lune website and contact Nortivo about work.

FIRST VIEWPORT: Left-aligned two-line product heading and one clear Arc action alongside a wide real desktop screenshot. Private-test status stays with the action. On phones, copy precedes a readable portrait screenshot excerpt with an honest dated caption. Three feature links follow without repeated product introduction.

FORM: Code-led refinement within the incumbent visual world; no concept seed or image approval round. Signature interaction is ordinary direct navigation through the three Arc areas. A single 600ms, already-visible screenshot settlement reuses the existing ease-out; reduced motion is immediate. All content remains available without JavaScript.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Assets and constraints

Reuse the existing, isolated empty-state Arc screenshots from 21 September 2026, with no personal records. Retain original pixel files/provenance. Lune remains a clearly fictional example, not customer work. No new dependencies or external assets. Homepage styling is loaded only by the homepage so shared support and product layouts remain unchanged.

## Implemented scope

- `dist/index.html` and its generated Bokmål/English pages now open with Arc: a two-line heading, one primary product action, private-test status and the real September 2026 empty-test screenshot. The screenshot links to the product page's app-view section; its caption explicitly identifies the date, Norwegian interface and absence of personal data.
- `dist/assets/home.css` extends the existing Manrope/navy system. The scoped display size is `clamp(2.6rem,4.15vw,3.7rem)` with a pale-blue second line (`#a9ccf0`). The desktop opening uses an `.8fr/1.2fr` split, stacks at 880px, and switches to the portrait screenshot at 560px with a maximum 420px visible excerpt. The caption remains outside the crop. These are surface details, not replacements for global tokens.
- The three feature links use semantic h2 headings and open, divided regions; they become readable rows through 720px. The following Lune preview reuses its existing colors and food image, with an explicit fictional-example label. Website/app service summaries stay compact and link to the existing enquiry paths.
- Only the screenshot receives the existing 600ms settlement, starting visibly at opacity .8 with a 12px vertical offset. Reduced motion removes it. Shared navigation, controls and Lune interactions keep their established behavior; no new motion system or assets were introduced.

This is an ordinary extension of the incumbent visual world. [DESIGN.md](../DESIGN.md) records the superseding homepage scope; its frontmatter and `.impeccable/design.json` are preserved. Pre-existing historical homepage descriptions in README and older global design passages remain outside this pass; this brief governs the current homepage where those descriptions differ. No broader documentation or token drift repair was performed.

## Verification

- Locale build produces 18 pages. All 65 Node tests pass, including real-image/heading/isolation coverage and existing bilingual navigation, support and security contracts. `git diff --check` passes.
- Final full-page evidence in `.impeccable/review/home-oct26/`: `desktop.png` (1440×1000 nb), `mobile.png` (390×844 nb), `narrow-en.png` (320×740 en), `tablet-en.png` (1024×900 en), `user-575.png` (575×660 nb). Page content was inspected after settling and all images loaded. No horizontal overflow at the measured sizes.
- A single inspection correction batch changed 575px feature columns into readable rows, made the screenshot caption explicit, and corrected the feature heading hierarchy from h3 to h2. Final captures were checked again.
- Browser: menu open, Escape and focus return; keyboard activation of Explore Arc; runtime English-to-Bokmål switch; screenshot link reaches `/products/#app-view`; website-work shortcut reaches `#work`. Both fragment targets land 24px from the viewport top. Error log empty.
- One detector pass: three warnings (heading skip fixed; two section-padding reports disproved by computed 48px top padding at 575px and 72px/64px desktop styling). Type-size/headline-tint advisories are scoped homepage refinements; Lune preview colors are inherited. No repeated detector run.
- Existing reduced-motion rules and the new explicit immediate fallback inspected in source. Real-device performance, screen-reader use and reduced-motion playback were not tested. No real ticket/email or production data was touched.
- Independent finish review inspected all five final viewport captures listed above and the implementation source. Verdict: **SHIP**, with no corrections requested. This verdict covers the homepage refinement and the documented checks, not the untested integrations or hardware listed above.
- Documentation checked against `dist/index.html`, `dist/assets/home.css` and the inherited rules in `dist/assets/site.css`; existing global tokens and the design sidecar remain unchanged.

## Release status

Published on 26 October 2026. Implementation commit `11aa3724516e24752f68bb4127c547b2b07e9190` was pushed; Netlify deploy `6ade8d3285e55c7f2fe5402a` showed **Published** in the dashboard.

Post-publication checks confirmed HTTP 200 and Content-Security-Policy headers for `/nb/`, `/en/` and `/assets/home.css`; all three responses were SHA-256 byte-identical to the local release files. `/nb/support/` returned HTTP 200 with `no-store` and Content-Security-Policy headers. A refreshed live Bokmål homepage was visually checked and captured as `.impeccable/review/home-oct26/live.png`. These checks do not extend the ticket/email, real-device or assistive-technology test scope above.
