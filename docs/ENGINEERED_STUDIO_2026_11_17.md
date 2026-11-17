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
