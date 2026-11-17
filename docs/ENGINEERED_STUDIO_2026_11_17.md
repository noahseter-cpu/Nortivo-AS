# Nortivo studio redesign, 17 November 2026

The user supplied a complete website implementation brief headed “NORTIVO — WORLD-CLASS WEBSITE REDESIGN”. It calls for a coherent technology-studio presentation covering websites, applications, intelligent systems, trading tools, company information, support and contact.

The implementation is in the separate local worktree at C:/Users/noahn/Documents/ChatGPT/Nortivo-engineered-studio on branch codex/nortivo-engineered-studio. The preview uses http://127.0.0.1:4419. The existing production worktree and its published 41aaaee commit provide the rollback boundary for this pass. This document records local work and does not assert a new production release.

## Implemented presentation

The homepage now has an original metallic architectural hero, a two-line industrial display heading, a concise company introduction, four service rows, large Arc and Lune previews, geometric engineering imagery, a five-stage process, the working Decision Replay example and a closing contact action.

The shared public header links Work, Services, About, Support and Contact. Work opens the homepage project section. Trading tools remain directly accessible from footers and the project area. Existing page routes, explicit Norwegian and English paths, contact/support element identifiers and backend functions are retained.

The public extension lives in dist/assets/nortivo-engineered.css and dist/assets/nortivo-engineered.js. Earlier stylesheet assets are wrapped in the nt-legacy cascade layer. The extension provides the current dark palette and component treatments while using the established source markup and behaviour where appropriate.

Services includes website and application development alongside trading software, crypto automation and educational guides. Company, contact, support, privacy, product and administration surfaces share the revised visual rules. Lune retains its own demonstration identity and Vibb remains an authenticated tool with a separate design.

## Assets and licences

The hero is an original generated image. Its source is C:/Users/noahn/.codex/generated_images/01a0ae54-c623-7e11-a729-ffb19029d33e/exec-b6059b6b-e986-4585-8417-616cb35e3c51.png. The shipped JPEG is dist/assets/engineered-hero.jpg, 143,331 bytes. Its subject is a monumental, precision-machined dark titanium structure with rectangular frames, a brushed silver edge and dark negative space. No stock-photo licence is claimed. The exact generation prompt, source and conversion are recorded in [engineered-hero-provenance.json](engineered-hero-provenance.json).

Barlow Condensed SemiBold is served from dist/assets/fonts/barlow-condensed-semibold.ttf. Its SIL Open Font License is shipped as dist/assets/fonts/BarlowCondensed-OFL.txt. Manrope continues to carry body and interface text. Font origins are documented in THIRD_PARTY_FONTS.md.

Arc uses the existing actual empty-test screenshots and its supplied wordmark. Lune keeps the existing generated restaurant illustrations and their existing provenance records. Product and demonstration states remain explicit.

## Implemented motion

Desktop marketing motion consists of an 850ms heading entry from visible content and an 1800ms hero-image settlement. Fine-pointer project hover scales imagery to 1.018 over 260ms. Service arrows move three pixels and public action press feedback uses a .98 scale over 120ms.

Supported browsers use CSS view timelines for the introduction heading, project-image reveal, footer wordmark, geometric frames and process divider progression. Static layouts remain available when that feature is unavailable. Reduced motion disables animations, transitions and smooth scrolling in the extension. The existing mobile menu keeps immediate keyboard operation and interruptible pointer feedback. There is no scroll hijacking, real-time 3D scene or new animation-library dependency.

## Validation evidence

The parent implementation run reported 78 passing automated tests. The recorded browser matrix in .impeccable/review/browser-checks.json covers 56 combinations across 14 routes, both languages and desktop/mobile widths. It reports no runtime, missing-asset or horizontal-overflow issues. Additional homepage geometry checks cover widths of 320, 820, 1024, 1920 and 2560 pixels.

The local review captures include desktop.png, mobile.png, hero.png and route-specific full-page images in .impeccable/review. Fonts and lazy images were decoded before final captures. The review identified inherited light-panel styles and field/tab contrast problems, which the parent corrected before the final captures.

The parent also checked local form validation, error/draft retention against the preview server's 503 response, language switching with an existing draft, a saved-ticket interface using an intercepted test response, skip-link contrast, keyboard menu close/focus recovery, reduced-motion state, Lune dessert filtering and report range-keyboard selection. The browser recorded the native view timelines and the header surface change after the introduction action in .impeccable/review/motion-checks.json. Reduced motion produced no running animations in that check.

A single localhost Lighthouse run is recorded in .impeccable/review/lighthouse.json. It returned 100 for performance, accessibility, best practices and SEO, with first contentful paint and largest contentful paint at 1.5 seconds and cumulative layout shift at 0.021. The run reported no warnings. These are local audit results, not production or real-device scores.

The checks do not verify real provider delivery, database writes, authenticated administration or email receipt. The local server does not connect the production support services. Physical iPhone/Android hardware and assistive-technology behaviour remain outside the reported evidence. No professional certification is asserted.

## Design record and history

DESIGN.md now records the implemented obsidian/silver public identity, Barlow Condensed/Manrope hierarchy, component treatments and actual motion. Its extensions are recorded in .impeccable/design.json. The previous public palette remains retrievable in Git history at 41aaaee and earlier commits. Historical release records and scoped restaurant/private-tool design documents remain in place.

The fresh finish review is a separate check. This record does not assign itself a review disposition or imply that a reviewer approved uninspected integration behaviour.

## Incremental V2 investment-technology extension

The later user brief headed “NORTIVO V2 — INVESTMENT TECHNOLOGY & PREMIUM MOTION REFINEMENT” explicitly retains the existing cinematic identity. The extension strengthens investment research, algorithmic trading, market analysis and educational methods while keeping the titanium imagery, black/silver palette, condensed display type and existing routes.

The homepage opens with the prescribed investment-technology identity line, a more specific trading headline and the existing reported-performance preview. A larger report section follows. Research disciplines, Decision Replay, educational offerings, trading tools, company information and contact form the remaining narrative. Arc and Lune remain available through secondary project links. The hero eyebrow is explicitly prescribed for that location and does not establish a default for other sections.

### Report presentation and source boundary

The compact preview, editorial showcase and dedicated report read the shared dist/report-2026/summary.json. Financial amounts are held as exact integer NOK øre. The shared presentation uses reported trading profit of NOK 145,538.19, reported return on opening equity of +58.22%, 222 sessions, 1,152 reported trades and maximum drawdown of −26.65%, covering 2 January through 17 November 2026.

The equity chart is generated from all 222 existing account-equity rows. The report-presentation build module validates currency, exact profit reconciliation, period endpoints, session count, closing equity, return and drawdown before rendering the localized presentation. Agreement among supplied records does not establish an external audit. The original PDF and equity series remain unchanged.

Pointer movement or the labelled keyboard range control selects a source row. Its date and NOK equity appear in an output and aria-valuetext. The SVG and summary values are present in the built HTML, so a failed interactive fetch leaves the report readable. The chart's optional one-time clip reveal lasts 850ms. It does not change the financial values or invent intermediate account history.

Reported results remain identified as historical results. The account-equity return and the existing average return on deployed capital retain their respective definitions. Nothing in this extension asserts regulated financial authorization, guarantees returns or labels a disconnected data source as live.

### Interaction and type extension

The new style and behaviour files are dist/assets/investment-v2.css and investment-v2.js. They use native CSS, Web Animations and existing shared easing, with no additional competing animation runtime.

Action fills and borders use 220ms/320ms transitions. The clipped label moves up one pixel and its stroked arrow moves right four pixels on eligible hover. Text links and active navigation have a sweeping underline. Selected major desktop actions move their inner face by at most two pixels per axis for a mouse pointer. The anchor's hit target stays fixed. Pointer leave, blur, keyboard input and reduced-motion/pointer preference changes clear the movement. Touch devices and reduced-motion users receive the stable control.

Native page transitions use 100ms outgoing and 180ms incoming opacity where supported. Existing navigation remains the fallback. Reduced motion removes these transitions. Fields retain their explicit labels and gain short border/background focus feedback.

IBM Plex Mono Regular is added for financial figures, dates and technical readouts. It is self-hosted with its SIL Open Font License. Barlow Condensed and Manrope retain their existing roles.

### V2 validation

The V2 implementation run reports 81 passing automated tests. The 56 route/language/viewport baseline checks are supplemented by seven focused viewport checks and the recorded feature checks in .impeccable/review/v2/feature-checks.json. The focused run covers shared summary agreement, keyboard chart selection, language changes, Decision Replay, magnetic feedback, keyboard and reduced-motion behaviour, the content security policy and contact validation with an intercepted saved-ticket response. It reports no issues.

The V2 desktop/mobile captures are in .impeccable/review/v2, including home-en-1440.png, home-en-390.png, hero-1440.png and hero-390.png. The later local mobile Lighthouse run records Performance 99, Accessibility 100, Best Practices 100 and SEO 100 in .impeccable/review/v2/lighthouse.json. Those figures describe that local audit and supersede the earlier base-run score as the current V2 evidence.

Real email delivery, provider/database writes, authenticated production administration and physical-device behaviour remain outside this pass. This record describes a finished local extension and does not claim a new production release.
