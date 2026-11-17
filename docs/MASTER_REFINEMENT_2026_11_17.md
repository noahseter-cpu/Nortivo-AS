# Nortivo: research, made tangible

Implementation plan for the owner's master brief, 17 November 2026. Starting point: published and local revision a76476d, retaining the existing static Netlify architecture, original report files and operational contracts.

## Direction and scope

The homepage is a company introduction with a report cover, rather than a trading terminal. Keep the existing titanium image, use a calmer publication frame, and reduce the hero to three reported metrics. Promote the full report action. Explain trading bots, market analysis and practical guides in the opening copy.

The next chapter adds all monthly closing-equity changes, including losses, instead of repeating the P&L and equity chart. Follow with the existing Decision Replay, research methods, actual learning resources and a concise company/contact close. Keep existing fragment destinations and secondary project routes.

Use Manrope for the display and interface, with IBM Plex Mono only for financial quantities. Desktop hero size 76–94px, mobile 40–48px, body 16–18px. Use a 12-column composition, seven narrative columns and five report columns, within 1440px; content gutters range from 20px to 56px.

Shared colors: near-black #08090b, surface #111318, raised #181b21, warm white #f2f1ed, supporting text #b5b8c0, rules #30343c, silver #c6cad1, positive #78b99a and negative #dc8c91. Data signs and labels supplement color.

## Motion

| Event | Purpose | Implementation | Static alternative |
| --- | --- | --- | --- |
| Hero/report arrival | Introduce company and evidence together | One 700ms sequence; visible baseline, restrained mask/12px movement; exact values never count up | Complete static composition |
| Report/contact actions | Identify the action and acknowledge input | Stationary hit area; inner surface wipe, 3px arrow and 1px label movement over 240ms; 140ms press | Immediate contrast/focus states |
| Evidence chapter | Reveal the context as one composition | 520ms grouped entrance, once | Immediate content |
| Decision Replay | Explain rules and outcomes | Preserve user-triggered, interruptible stages | Immediate final result |
| Menu | Maintain spatial context and focus | Compact 220ms transition; scroll lock, Escape and focus restoration | Immediate opening/closing |

No cursor attraction, chart tilt, live-data fiction, number animation, new animation library or scroll hijacking. Preserve server-rendered content and no-JavaScript fallback.

## Verification and delivery boundary

Capture the published baseline, then inspect the implementation together at 1440×900, 1366×768, 1920px, tablet, 390×844 and narrow mobile. Verify exact summary/series agreement, both languages, full report/source download, menu focus and rapid interruption, chart keyboard/pointer input, draft/error/success form states, preserved support contracts, reduced motion, enlarged text, asset loading and console errors. Perform one bounded correction batch and confirm it.

Implement on codex/nortivo-research-master and preserve the published revision as the rollback point. This file records a local implementation pass; it does not assert publication or external provider verification.

## Implemented local checkpoint

The completed master refinement preserves the existing titanium asset and static Netlify route architecture. Manrope now supplies public display and UI type; IBM Plex Mono remains the numerical companion. Barlow Condensed assets are retained historically, rather than selected for the current public hierarchy. The implemented palette and responsive type values are recorded in DESIGN.md and extracted from dist/assets/investment-v2.css. No font dependency, runtime animation library, backend contract or secret was added.

The homepage now pairs company identity and report cover, then progresses through evidence, systems, research approach, actual guide destinations and company/contact. The prescribed identity line remains confined to the hero. The report action, period, original equity curve and three primary metrics stay together. Secondary Arc/Lune projects and operational support/admin routes retain their destinations. Research describes available methods and sources without inventing publication dates or a publication catalogue.

The headline report values come from dist/report-2026/summary.json: NOK 145,538.19 profit after reported costs, +58.22% on opening equity, −26.65% maximum drawdown, NOK 250,000 opening equity, NOK 395,538.19 closing equity, 222 sessions and 1,152 reported trades over January 2–November 17, 2026. Build validation in scripts/report-presentation.mjs checks the integer minor-unit summary against the source endpoints, period, return and maximum drawdown. This verifies agreement within supplied material; it does not establish independent audit or live execution.

The evidence chapter derives eleven close-to-close monthly equity changes from the original 222-point series, including two losing months. It labels that basis explicitly. The dedicated report retains its supplied monthly trading P&L instead, and explains that May and July each differ by one øre from the closing-equity changes, offsetting over the full period. No PDF, summary or equity-series source record was rewritten.

The dedicated report now includes a table of contents, account and deployed-capital definitions, risk context, original source links, attributed transaction costs and the modelled-slippage qualification. Its native expandable table exposes all 222 session closing values, alongside pointer and keyboard chart exploration. Narrow-screen plot/table regions scroll horizontally with labels; core content and PDF/source links remain available without enhanced scripts.

## Implemented motion and navigation

The master homepage uses one coordinated 700ms entrance family for the already-visible introduction, report cover and source-curve clip. Introduction travel is 12px from .7 opacity; report travel is 8px from .75 opacity with a 70ms offset; the curve reveal has a 100ms offset. Selected editorial groups enter once over 520ms with restrained 12–16px travel and a small clip. The titanium background is static. Numeric values are never interpolated. Reduced motion, saveData and missing enhancement APIs retain the complete static composition; keyboard input cancels active entrance animations.

Actions keep stationary hit targets. A 240ms inner wipe coordinates with a one-pixel label lift and three-pixel arrow travel on a fine-pointer hover. A 140ms press scales only the inner face to .98. There is no magnetic pointer attraction. Text links sweep a thin underline; keyboard and reduced-motion interactions suppress decorative transforms. Native cross-document transitions remain optional at 100ms outgoing/180ms incoming opacity.

The 220ms mobile menu is interruptible and preserves dialog semantics, a focus trap, background inertness, scroll locking and restoration. Escape, repeated toggles, responsive changes and closing restore the appropriate focus, scroll and prior semantic attributes. The site.js menu implementation remains the behavioral source.

The final reflow correction uses rem-based auto-fit columns for actions, metrics, process stages and footer links, zero-minimum grid children and an 18rem monthly-chart container threshold. The footer wordmark now has a two-rem minimum. Enlarged text can therefore wrap the composition without hiding content or compressing its labels. SaveData explicitly disables inherited footer and structural animation as well as the enhanced entrances.

The finish review identified one desktop footer regression from intrinsic sizing. The corrected shell explicitly allocates navigation 1.6 fractions beside one fraction for identity, with a single-column shell at 900px. Independent confirmation records three aligned 218.77px navigation columns at 1440px, and stacked readable groups without overflow at 390px with doubled text. Evidence is in home-footer-confirm-results.json.

## Verification at this checkpoint

The local implementation checkpoint reports 88 automated tests passing, plus 40 route/viewport checks and focused menu/contact mock flows. The report received four initial viewport checks and two narrow-screen confirmation checks. Final homepage evidence is recorded in .impeccable/review/master/home-motion-results.json and home-geometry.json; report evidence is in report-qa.json and report-qa-confirmation.json. Screens include home-en-1440.png, home-nb-390.png, report-en-1440.png and report-nb-390.png in the same review directory. These are local browser captures, not a production publication claim. The initial 200%-text/390px finding was corrected and is superseded by home-final-results.json: English and Bokmål now show no document overflow or clipped visible text at 200% text. The report 200%-text checks also pass in both languages while retaining eight metric values and all 222 source rows.

A single local mobile Lighthouse run in .impeccable/review/master/lighthouse.json measured Performance 99, Accessibility 100, Best Practices 100 and SEO 100, with FCP/LCP 1.7s, CLS 0 and no warnings. These are local automated measurements, not production or physical-device guarantees.

Final release checks and deployment are owned by the release pass. This document does not certify production, real email delivery, database writes, authenticated administration, provider sessions or physical-device performance. Contact success/error checks used intercepted responses where stated. The original report remains reported historical material with its original definitions and future-return qualification.
