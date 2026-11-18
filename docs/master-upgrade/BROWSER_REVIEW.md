# Combined local browser review

18 November 2026. Tested against the isolated loopback gateway on port 4490. All customer, owner and operator identities and messages below were synthetic. No production configuration, accounts, permissions, DNS, email, deployment or orders were changed.

## Observed journeys

| Check | Observed result |
| --- | --- |
| Independent Invest homepage | EN and NB public pages rendered before any terminal initialization. Workspace prices, report link, full reference image, custom-system destinations, guidance, conversation and qualified KORVNT link were present. No terminal client script is included. |
| Reference enlargement | Opened the complete aspect-preserving reference in a dialog. Escape closed it and restored focus to Enlarge preview. |
| Company website | EN/NB navigation preserves Invest, research, systems, guides, KORVNT, about and report. The report remains in the opening experience with its original NOK values, period and limitations. Footer badge visibly says In development/Under utvikling. |
| Company support | The NB company support page opens the corresponding Invest conversation page, where the same signed-in conversation was visible. Older ticket forms remain available in source; their email transport is explicitly disconnected in this review. |
| Guest conversation | Sent a message, saw confirmation, reloaded and observed the persisted message and timestamp. No external email was sent. |
| Actual operator login | Entered the synthetic named verified account's password and an unused MFA recovery code through the normal company administrator form. The protected workspace opened. Expired MFA freshness subsequently required a new normal sign-in. No preauthenticated browser fixture was used for this check. |
| Operator reply | Operator opened the real conversation, sent a human reply, and customer Refresh showed that reply in the same history. |
| Availability | Default offline-message path was shown. An authenticated operator explicitly checked in; customer Refresh then showed Online. Going offline removed that status. No typing/read/delivery promises were invented. |
| Bot request | Completed all four English stages, reviewed the brief and separately confirmed scoping. The server issued a durable reference. Customer tracking showed Received. Operator changed it to More information needed and added a question; customer tracking showed both the new state and question. |
| Engine request | Completed the Norwegian conditional engine fields at 390 CSS pixels, with explicit undecided requirements. A draft survived reload. Review, explicit checkbox confirmation and receipt worked. The receipt sidebar gives tracking guidance rather than an empty draft's unresolved fields. |
| Support launcher | On Invest, an authenticated customer's same message was visible in both the embedded view and dialog. Escape restored focus to the research enquiry trigger. At 390 × 844, the support sheet stayed viewport-bounded (about 650 CSS pixels high); the page had no horizontal overflow. No launcher was added to the terminal. |
| Ownership denial | The verified fixture customer could not claim the earlier guest conversation whose linked project contact belonged to another email. The server returned a generic unavailable-record message. A matching-email/proof positive claim and post-claim isolation are covered by handler tests, not claimed as this browser observation. |
| Owner access | Normal local account login with MFA opened Owner access. Subscription view explicitly showed Portfolio and Terminal Pro without a Nortivo subscription and unlimited internal owner AI requests, while retaining provider limits, usage charges and safety controls. No checkout occurred. |
| Ordinary account | A verified fixture customer without a subscription could sign in. Portfolio write access and Pro automation remained gated; actual records/account views remained accessible. Provider unavailability was distinct from account access. |
| Terminal fidelity | Inspected at actual 1920 × 1062 CSS pixels (the requested 1061 rounded to 1062 in this browser). Compared against the current supplied `Downloads/trading-platform-1920.jpg`: compact header/sidebar, six KPI cards, left stack, dominant chart, right stack, bottom panels and footer remain in place. Only the parent logo changed. Provider mode correctly showed unknown values when deliberately disconnected. |
| Dedicated security | Security host rendered the distinct KORVNT experience. The alias preserved locale and anchor while redirecting to the canonical local host. The company legacy security paths remain supported by routing tests. Private/function/admin security-host routes are denied by HTTP and edge tests. |
| Responsible report tool | Prepared a synthetic local report draft and saw the explicit Not submitted result and Download text file action. This is a local draft tool, not a verified operational submission channel. |

## Dimensions, accessibility and visual evidence

Actual browser measurements include 1920 × 1062 for the terminal, 1280 × 720 for company/Invest/security desktop, 768 × 1024 for the Norwegian Invest tablet layout, and 390 × 844 for Invest, both service flow types, company/support and dedicated security phone layouts. No page-wide horizontal overflow was observed. The desktop header is about 81 pixels and the tablet header about 73 pixels.

Phone menus include their full destinations. Company menu Escape returned focus to Menu. Preview and conversation dialog Escape returned focus to their initiating controls. The native request confirmation checkbox has an explicit label and a separate financial-access explanation. Focus outlines and ivory-on-dark text were visually checked; this is not a complete assistive-technology or WCAG certification audit.

The new Invest/security motion only opts in under `prefers-reduced-motion: no-preference`; workflow scrolling opts out under the reduced-motion query. Source rules were reviewed. The connected browser exposes viewport sizing but no reduced-motion emulation; a forced OS reduced-motion render, physical mobile keyboard, browser zoom and screen-reader pass were **not** verified. The supplemental isolated workflow browser script exercised 320-pixel reflow. This combined browser pass does not claim that as its own 320-pixel or physical-device evidence.

Screenshots are private local evidence in `.local/master-preview/evidence/`: `invest-desktop.jpg`, `invest-tablet.jpg`, `company-phone.jpg`, `security-phone.jpg`, `security-desktop.jpg`, `terminal-desktop.jpg`. They contain public pages or explicitly fictional sample data, not authentication secrets. Reopen the previews for full-page review. The screenshot is a reference for composition, not a claim of current prices or investor returns. Temporary viewports were reset, the operator was signed out, and the three public previews were left available for review.

## Read-only production recheck

Used the already authenticated owner tab on `invest.nortivo.no`; did not provision or change an account. Account access and the provider terminal were accessible. A reload initially showed Opening your workspace; the complete shell was observed by the next check about 15.7 seconds later. This is an upper-bound observation with other local work between checks, **not** a controlled performance benchmark or a verified improvement from the earlier 45-second observation.

Instrument search returned NVDA with its exact XNAS venue. Selecting it rendered a 64-candle, five-minute chart and the source label Nortivo Data / Alpaca IEX (single venue). The bar timestamp was 18 Nov 2026, 22:55 with Stale shown. Connection health had shown Current separately. No consolidated real-time coverage is asserted. News, calendar, AI, brokerage and trading engine remained unavailable; no broker was connected and automation remained stopped. The candidate preserves the published compact bootstrap, request cancellation, chart lifecycle and bounded optional-request fixes, with market regressions passing. A controlled first-usable/first-chart profile on a funded, licensed production configuration remains a release follow-up.

## Verification records

The final repository run passed **423/423**, zero failures or skips; the focused security/workflow run passed **100/100**; standalone KORVNT passed **37/37**; the separate market suite passed **87/87**. These suites overlap and must not be added together. The publish-boundary scan examined 219 files, including 192 textual files, and reported zero findings within its stated scope. The static check and locale build passed. Source digests and exact run times are in [integration-verification.json](../../services/security-core/evidence/integration-verification.json). A green scan is not proof that every possible secret or security defect is absent.

Nothing in this review establishes hosted cookie/TLS behavior, production database migration, provider redistribution rights, a staffed inbox, operational alert delivery or production backup recovery. Those remain explicit [release gates](RELEASE_CHECKLIST.md).
