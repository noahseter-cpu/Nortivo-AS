# Lune editorial verification — 22 September 2026

- Scope: restaurant demo only; corporate Arc overview, support header, backend and data untouched.
- Locale build: 18 localized pages; only restaurant HTML differs.
- Automated suite: 63 passing tests, including restaurant truth/no-network, Oslo calendar, locale parity, support header parity and new explicit form-label colour/font-scope checks.
- Actual browser captures: `.impeccable/review/lune-editorial/`. Desktop 1440×1000, user's 1280×720, mobile 390×844 and narrow 320×740. These are section viewport captures, not full-page screenshots.
- Inspected heading/image composition, menu/vegetarian label, booking layout and reading contrast. Corrected food detail overlapping the menu action and inherited corporate label colour. Narrow layout has no horizontal overflow.
- Dessert + vegetarian gives two dishes. English booking confirmed 25 September 2026 / 18:00 / two guests; Norwegian keyboard radio ArrowRight changed 18:00 to 19:00 and Enter confirmed. Both explicitly say no reservation was made. No real booking or customer record created.
- Browser error log empty. Reduced-motion and keyboard gating checked in CSS/JS; not a real-device or assistive-technology audit.
- Existing AI image assets reused with their provenance. Gloock is self-hosted and ships its OFL licence.
- One detector scan reported scoped Lune typography/palette against the corporate DESIGN.md; Lune's scoped design documentation records these intentional differences.

## Publication blocker

Independent finish reviewer disposition: **ship**, scoped to the eight supplied captures and source review. No material corrections requested. Nonblocking limits: the English mobile headline wraps less gracefully than Norwegian; repeated image assets limit visual storytelling. This is not user aesthetic approval or a real-device motion assessment.

Implementation pushed to GitHub main as `fcc5e51`. Netlify attempt `6ab2581d271c8200080b6b56` is explicitly **Skipped due to account credit usage exceeded**, and still identifies `fe4bb0a` as Published. Local working preview: `http://127.0.0.1:4399/nb/restaurant/`.

Netlify deployment dashboard explicitly reports production deploys paused because the team's available credits are exhausted; Trigger deploy is disabled. The existing published version remains fe4bb0a. No billing change, upgrade or quota bypass was attempted. This revision must not be described as live until a later successful production deploy is verified.
