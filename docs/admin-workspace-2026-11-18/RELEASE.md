# Admin support workspace — 18 November 2026

Replaces the Vibb/Arc project launcher with a support overview, inbox and operations area. Private project endpoints and their existing protection remain intact; the admin page no longer loads the encrypted project registry to establish its session.

## Included

- Loaded-ticket counts for open, answered and closed statuses, linked to the corresponding inbox filter.
- Oldest open tickets older than 24 hours and recently updated tickets. Reopened tickets are included; these are ticket ages, not an unanswered/SLA metric.
- Search by number, name, email and subject, sorting, status/age filters, clear filters and loading older pages.
- Explicit loaded scope and refresh timestamp. Counts are not presented as company-wide totals.
- Existing reply, close and reopen controls, with reply drafts and honest email acceptance wording.
- Operations links to the website, investment platform, Netlify deployments and Resend activity.
- Authenticated configuration-only service status. No secrets, customer investment accounts, private orders, payment records or provider probes are returned.
- English/Norwegian text, compact Nortivo surfaces and deliberate phone reflow.

## Backend boundary

Existing `admin-tickets` authentication and origin checks are retained. GET list requests return at most 200 tickets, probing one extra row for pagination. Offsets are validated and bounded. The additive `page` object identifies the loaded page; `?view=operations` uses a fixed allowlist of configuration fields. The investment hostname continues to block this admin endpoint. No new administration endpoint, authentication credential or financial permission is introduced.

## Verification

Browser checks use local synthetic tickets and intercepted database/email transports on port 4423. The fixture has 205 tickets to exercise pagination, long subjects and text containing HTML-like characters. No real customer email is sent and no production ticket is modified. Desktop measured 1440×1000; phone measured 390×844, with no page-wide overflow. Screenshots named `fixture` show test data only.

Final automated suite: **263 tests passed, zero failed**. Added tests cover loaded-scope summaries, age/search/sort behavior, deduplicated pagination, bounded backend pages, configuration secrecy/authentication, expired-session races and stale submitted-reply completions. Module-aware syntax checks retain shared-script ordering and validate local ES-module dependencies.

Actual browser verification covered 200→205 loaded tickets, email search finding ticket 205, short-reply validation, accepted fixture replies, closing/reopening, and retained drafts. The first browser pass exposed a loaded-window reset after replying; the final pass confirmed all 205 records and the email-search match remain after reply and status changes. Norwegian Operations labels and phone draft retention across Overview/Inbox also passed. Fixture responses were accepted locally, with no claim of real inbox delivery.

Read-only review also found and fixed expired-session request ownership: old list/Operations completions cannot replace or release a newer request; old submitted replies cannot clear a new-session draft. Writes are not replayed. Removed project shortcuts and registry bootstrap were checked in the source. Production private support records have not been inspected or changed for this release.

## Publication receipt

- Published production commit `21a46d7` to the existing Netlify project.
- Netlify deploy `6afdf85e528e59b0c499c000` completed successfully on 18 November 2026 at 20:11 Europe/Oslo in 15 seconds, deploying 13 functions and the existing edge function.
- Live administration: https://nortivo.no/nb/admin/ and https://nortivo.no/en/admin/ .
- Seven read-only hosted checks passed: both localized shells, three published assets, ticket/Operations authentication and investment-host admin isolation. See `hosted-checks.json`.
- Browser verified the published sign-in page in English and Norwegian and its working password-visibility control. The updated login page was left open. Authenticated production tickets were not accessed; authenticated functional checks used the isolated local fixtures described above.
- Temporary QA tabs were closed, viewport overrides reset, and the local fixture server stopped.
- `published-signin-nb.jpg` and `netlify-publication.jpg` are production evidence; `fixture` screenshots contain synthetic local tickets only.
