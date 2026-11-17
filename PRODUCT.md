# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Prospective customers evaluating Nortivo’s market research, algorithmic trading software, automation and investment education.
- Visitors inspecting reported historical results, strategy methods and clearly labeled trading demonstrations.
- Customers who need to create or follow a support ticket.
- Visitors and account holders testing a rule-based strategy in the isolated Nortivo Trading Platform paper workspace.
- Nortivo’s administrator, who uses private side projects/tools and reviews, answers and closes support tickets.

## Product Purpose

Nortivo presents investment technology, financial research and education, provides a direct support workflow and gives its owner an authenticated workspace. Success means visitors immediately understand the company’s services, inspect the existing report with its historical definitions, explore testable tools and methods, and make a relevant enquiry. Customers can create and follow tickets; the administrator can open private tools or answer support. Existing software and design projects remain accessible as secondary work.

## Positioning

The owner positions Nortivo as an investment company focused on financial research and trading technology, founded by Noah J.C. Sæter in Lillestrøm, Norway. The site presents algorithmic trading software, stock and crypto market analysis, quantitative methods, automation, historical performance analysis and practical investment education. The existing 2026 report is presented as reported historical results with its original definitions and no guarantee of future returns. The site does not assert regulated investment-adviser, broker or asset-manager authorization. Interactive trading demonstrations remain explicitly simulated. Arc, Lune, software engineering and design work remain available through their existing routes and the secondary project links. Contact, support and private administration retain their existing backend contracts.

## Capabilities and Constraints

- Static website deployed through Netlify from the `dist` directory.
- Netlify Functions provide ticket creation, lookup, authentication, administration and email replies.
- Supabase stores tickets and replies; Resend handles email delivery.
- Existing `/`, `/products/`, `/support/` and `/admin/` routes and all form IDs/API contracts must remain stable.
- The complete public journey supports Norwegian Bokmål and English, with static `/nb/` and `/en/` routes. Explicit language choices are remembered independently of the Arc application.
- Admin opens on Projects & tools with Support tickets as a separate choice. The project registry is read-only; external shortcuts keep their destination's authentication.
- The private course runs under `/admin/projects/vibb/` with authentication on every asset and tutor request. It remains distinct from the separately hosted Vibb site. The optional tutor requires a server-only provider key; unconfigured requests report 503.
- Its private [Vibb app and code workspace](docs/PRIVATE_VIBB_APP.md) pairs a compiled practice copy with the protected source catalog and can open beside the course. Code is read-only; practice records use separate browser storage. This learning surface retains Vibb's own warm identity.
- The public Git repository may contain only the encrypted private-content package. Plaintext local inputs and the content key remain ignored; see [PRIVATE_WORKSPACE.md](docs/PRIVATE_WORKSPACE.md).
- `/en/terminal/` and `/nb/terminal/` are a distinct operational application with server-owned paper balances, exact USD-cent accounting, session authorization and private persistence. Its fixed fictional replay, virtual USD 100,000 opening balance and in-tab engine are disclosed. The public NOK report remains separate.
- The complete local terminal uses Node 24 SQLite. Hosted activation requires the additive `supabase/terminal.sql` migration and separate terminal security configuration; a static preview does not activate it. Provider research requires explicit credentials and display permission. Real-money brokerage execution is disabled unconditionally. See [TERMINAL_SERVER.md](docs/TERMINAL_SERVER.md) and [TERMINAL_ENGINE.md](docs/TERMINAL_ENGINE.md).

## Brand Commitments

- Company name: Nortivo. Product display name: Arc by Nortivo.
- Founder credit: Noah J.C. Sæter.
- Arc is presented as a Nortivo product in development.
- Nortivo Support is a service path for enquiries and existing customers, not a second commercial product.
- Voice: direct, calm and confident; avoid inflated claims.

## Evidence on Hand

- Support and administration flows are implemented in this repository. The current redesign has local automated coverage; real email delivery and authenticated production flows still need deployment verification.
- The existing 2026 report, PDF and 222-session equity series supply the reported historical results shown on the site. The canonical summary reconciles opening and closing equity, profit, return and maximum drawdown; it does not establish independent audit or broker verification. Preserve metric definitions and the distinction between these results and simulations.
- No customer testimonials, customer logos or additional performance evidence are supplied; the site must not fabricate them.

## Product Principles

1. Make the purpose obvious before adding atmosphere.
2. Keep support direct and easy to recover.
3. Use real product facts instead of generic agency claims.
4. Preserve existing service contracts and routes during visual changes.

## Accessibility & Inclusion

Keyboard focus, readable contrast, responsive reflow and reduced-motion behavior are required across public and administration surfaces.
