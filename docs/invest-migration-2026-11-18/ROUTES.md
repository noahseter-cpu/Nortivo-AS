# Host and route map

Both hosts use Netlify project `vermillion-mousse-5e3749` (`648e5822-88a6-42a2-8e0e-7d92799a9dc6`), the existing functions and the existing Supabase records. `nortivo.no` remains primary; `invest.nortivo.no` is an alias, not a second copy of the application.

| Entry | Destination / behavior |
| --- | --- |
| `https://nortivo.no/en/`, `/nb/` | Company homepage, unchanged |
| `https://invest.nortivo.no/` | Language-aware temporary redirect to `/en/terminal/` or `/nb/terminal/` |
| Investment `/en/`, `/nb/` | Same-language terminal entry; no marketing homepage |
| Investment `/{en,nb}/terminal/` | Account entry or signed-in workspace; optional explicit read-only sample |
| Investment `/{en,nb}/pricing/` | Public plan comparison and selection |
| Investment `/{en,nb}/portfolio/` | Portfolio application, authentication, verification, recovery and account management |
| Investment `/{en,nb}/portfolio/?tab=account` | Existing account controls |
| Investment `/{en,nb}/portfolio/?tab=billing` | Existing subscription/billing controls |
| Account/billing `workspace=terminal` or `workspace=portfolio` | Safe originating workspace retained for the Back action; `tab=security` aliases account controls |
| Old company `/terminal/`, `/pricing/`, `/portfolio/` and localized equivalents | GET/HEAD temporary, uncached redirect to corresponding investment route **after** cutover is enabled |
| Verification / recovery | Investment localized Portfolio URL with existing `#verify=` / `#reset=` fragment; fragments are not sent to the server or logged |
| Investment company/support/privacy/report HTML links | Localized absolute company-host destinations |
| Investment `/report-2026/summary.json`, assets | Same-origin assets remain available for the company-history panel |
| `/.netlify/functions/terminal` | Same-origin API on either host, exact validated origins and CSRF checks |
| Existing Stripe webhook | Retained on the existing host; no cross-host POST redirect |
| Broker callback | `https://invest.nortivo.no/.netlify/functions/terminal?action=product-broker-callback` when a real OAuth application is configured |
| Private administration | Company host; no administrative API exposure through investment host |

Safe journey values retain tier, billing interval, locale and a validated internal return destination. Verification/recovery fragments are inherited across HTTP redirects without being copied into queries. Arbitrary return hosts and credential query parameters are not forwarded. POST bodies, API requests and payment webhooks are never redirected to another host by the application migration.

## Hosting changes

Added Netlify domain alias `invest.nortivo.no` to the existing project. Added exactly one DNS record in the existing Domeneshop zone:

```
invest  CNAME  1800  vermillion-mousse-5e3749.netlify.app
```

Existing apex ALIAS, www CNAME, MX, TXT, nameservers and email records were retained. Requested renewal of the existing Let's Encrypt certificate to include the alias. DNS resolution and HTTPS reachability are verified before publishing any new platform links; final certificate/deploy evidence is recorded in `VALIDATION.md`.

## Staged cutover

1. Add alias and CNAME; verify DNS and HTTPS.
2. Deploy host-aware investment entry, explicit origins and product journey fixes with old-host redirects disabled.
3. Verify investment assets, API, both language entries and safe return behavior.
4. Switch public product links and enable `PRODUCT_PLATFORM_MIGRATION_READY=true` only after that proof.

The flag defaults off and can be removed/disabled to keep old bookmarks on the company host while investigating a problem. Redirects are deliberately temporary and uncached during transition.

After stage-one application verification, the Production context was configured with `TERMINAL_ORIGIN=https://invest.nortivo.no` and `PRODUCT_PLATFORM_MIGRATION_READY=true`. Other context values were retained; the flag has one Production value. Public links now use absolute localized investment addresses, including the report navigation, and the company language switch retains that host.

Authentication cookies retain their existing host-only scope, Secure/HttpOnly attributes and CSRF protections. A visitor signs in again on the investment host; the same user ID still opens the same stored records. No database migration or shared parent-domain cookie is introduced.

## External callback limits

Auth email links and Stripe checkout/portal returns derive from the validated request origin. Billing cancellation also retains the selected plan and interval. Existing webhook delivery remains available.

No verified Alpaca OAuth app, Stripe commercial setup, market/news/calendar data contract or funded AI service is activated here. The exact Alpaca redirect above must be registered with a real provider app when one exists; a code adapter alone is not a connected service. These are readiness blockers, not hostname-migration blockers.
