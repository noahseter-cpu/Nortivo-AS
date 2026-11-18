# Nortivo website

The public Nortivo website, separate from the Arc application. Static HTML/CSS/JavaScript, Netlify Functions, Supabase storage and Resend email. The additive subscription product uses maintained Stripe and OTPAuth server libraries; run `npm ci` before testing or deployment.

Subscription implementation: two exact USD plans, `/pricing/`, a manual `/portfolio/` workspace, the extended `/terminal/`, additive account/billing persistence and production provider adapters. Read [the complete brief](docs/SUBSCRIPTION_SPEC.md), [the shared contract](docs/SUBSCRIPTION_CONTRACT.md) and [the current implementation plan](docs/SUBSCRIPTION_PLAN.md). `PRODUCT_ENABLED` gates the new product; leaving it off preserves the earlier terminal. Provider adapters and fixture tests do not establish commercial permissions, successful real-provider connections or permission to trade. Checkout stays closed while required readiness evidence is missing.

Current release: [Nortivo Trading Platform](docs/TRADING_PLATFORM_RELEASE.md), published on 17 November 2026 with a real homepage showcase and a server-backed bilingual paper workspace. The terminal has separate private Supabase storage; external providers and real-money brokerage remain disabled. The release record distinguishes local, hosted preview and production verification.

## Local development

Use Node.js 24 or newer for the complete product:

```powershell
npm ci
node scripts/build-locales.mjs
npm test
node scripts/serve.mjs
```

Open `http://127.0.0.1:4399/nb/` or `/en/`. The local server deliberately returns 503 for server functions: it does not read production secrets, create tickets or send email. Form drafts remain in the open page after errors or language changes, not after reload/navigation.

For the complete trading platform, use **Node 24 or newer** and run `node scripts/serve-terminal.mjs --port 4420`. Open `http://127.0.0.1:4420/en/terminal/` or `/nb/terminal/`. This separate local server implements the paper engine and private SQLite persistence while leaving support/email and external providers disconnected. It does not read production secrets. See [terminal setup](docs/TERMINAL_SERVER.md), [engine and accounting](docs/TERMINAL_ENGINE.md), and [shared contract](docs/TRADING_PLATFORM_CONTRACT.md). Hosted activation requires the documented migration and security configuration; the terminal is not activated by uploading static files alone.

## Editing

- English source pages: `dist/index.html` and `dist/{products,services,about,contact,restaurant,support,admin,privacy}/index.html`.
- Shared copy: `dist/assets/site-copy.json`. Runtime copy is embedded in `site.js`; the contract test checks they remain identical.
- Support/admin copy: `dist/assets/portal-copy.json`; page scripts embed the relevant dictionaries.
- Shared foundation: `dist/assets/site.css`; cinematic public design: `nortivo-engineered.css`; incremental investment presentation and interactions: `investment-v2.css` and `investment-v2.js`. Operational surfaces retain `portal-v2.css`.
- Report summary: `dist/report-2026/summary.json`. The builder validates it against the retained equity series and renders the marked values on the homepage and dedicated report through `scripts/report-presentation.mjs`.
- Run the locale build after source/copy changes. It writes twenty-six static pages under `/nb/` and `/en/`, including translated metadata and alternate-language links, and synchronizes the separately authored report pages.
- Terminal source: `dist/terminal/`, with its own compact bilingual application shell, chart and licensed icon assets. The same locale build also creates `/en/terminal/` and `/nb/terminal/` entry pages. Terminal logic is served from `netlify/terminal/` through the separate `terminal.mjs` function; support/admin authentication remains unchanged.
- Existing non-prefixed routes are preserved. On Netlify, the edge function chooses an explicit language, saved cookie, Norway signal, then English. Explicit prefixed routes are never redirected by geolocation.

## Deployment boundary

The redesign was implemented and tested locally on 2026-09-21. The user explicitly authorized publication to the existing Netlify project and support integration checks on 2026-09-22. Future production changes still require appropriate authorization: a Git push to the linked production branch triggers Netlify automatically.

`netlify.toml` runs the locale builder and publishes `dist`, with Functions from `netlify/functions` and the language edge function from `netlify/edge-functions`. A manual upload of `dist` alone does not establish the complete backend or edge workflow.

Keep the existing environment values described in `SETUP.md` on Netlify only. Never commit `.env`, API keys, passwords, tokens, or customer records. The access-link implementation uses the existing session secret and requires at least 32 bytes; no database migration is introduced.

Before production acceptance, test real ticket creation, confirmation delivery, email verification, authenticated lookup, admin login/reply/status/logout, cookies, redirects and response headers in an approved deployment. No real customer ticket was used in local testing. See `docs/SUPPORT_SECURITY.md` for rate-limiter and delivery limitations.

## Design and evidence

Latest refinement: [Research, made tangible](docs/MASTER_REFINEMENT_2026_11_17.md). The report-led opening uses three headline metrics, then adds monthly closing-equity context rather than repeating the same summary. The company story follows evidence, systems, research methods, existing learning resources and contact. Shared typography is Manrope with IBM Plex Mono quantities. The expanded report provides risk/method/cost definitions and a native 222-row data view. Existing URLs and the Netlify support/authentication architecture are preserved.

Current public presentation: [17 November investment technology refinement](docs/ENGINEERED_STUDIO_2026_11_17.md). The homepage introduces research, trading systems and education; the existing 2026 reported historical results appear in both the hero and a dedicated editorial section. Arc and Lune retain their existing routes as secondary projects. Both languages share the report summary and original equity series. V2 local verification includes 81 passing automated tests, responsive browser checks, chart input, language switching, keyboard/reduced-motion behavior, production CSP and local form retry/save handling. Local mobile Lighthouse scored 99 performance and 100 accessibility, best practices and SEO. These local results do not establish real email delivery or authenticated production operations.

Earlier implementation checkpoints below describe their respective releases, rather than the current homepage hierarchy.

Latest local extension: [private Vibb app and code](docs/PRIVATE_VIBB_APP.md), with [scoped Vibb design guidance](docs/private-vibb/DESIGN.md). The real React practice app sits beside its read-only source or opens inside the course. Independent review returned SHIP and 76/76 local tests pass. Publication is authorized but pending at this checkpoint; the earlier release evidence below remains separate.

Current local work: [27 October studio and private workspace](docs/STUDIO_PRIVATE_WORKSPACE_2026_10_27.md), including final review, responsive checks and deployment requirements. The homepage now introduces the company, shows Lune and Arc work, then services and contact. Admin provides private projects/tools beside support; [PRIVATE_WORKSPACE.md](docs/PRIVATE_WORKSPACE.md) documents authenticated loading and the encrypted public-repository boundary. Published with explicit approval on 27 October 2026. The private course and Groq helper were verified through the administrator session; anonymous course/assets are blocked. See the linked brief for the production deployment and access checks.

See `DESIGN.md`, `docs/design-2026-09-21/DIRECTION_STATUS.md` and `docs/design-2026-09-21/VERIFICATION.md`. The user explicitly requested direct implementation without further previews. The approved Arc wordmark and isolated empty-state app screenshots are retained; no public app launch, download, reviews or customers are invented.

Generated artwork and screenshot origins are recorded in `docs/design-2026-09-21/asset-provenance.json`. Font sources/licences are documented in `docs/THIRD_PARTY_FONTS.md`. Reference websites informed composition, not copied content or code.

## Separate pages and restaurant demo

The homepage combines a short introduction with a Products CTA, a prominent clickable Lune visual preview, a dedicated Arc product section with an actual app screenshot, and compact service descriptions. Detailed services, biography and contact remain on separate pages. Previous homepage fragments redirect to their new localized pages. The contact page retains the same ticket backend; `?project=web` or `?project=app` prefills the service choice.

The Lune restaurant demonstration lives at `/nb/restaurant/` and `/en/restaurant/`, linked from Services and Products. It is explicitly fictional, not client work. Menu filtering and table selection run locally without a reservation service, personal-data collection or storage. The demo calendar uses Europe/Oslo days and fictional opening hours. Original generated food imagery is documented in `docs/LUNE_IMAGE_PROMPT.txt` and its shipped WebP provenance sidecar; the 1536×1024 source was converted to quality-85 WebP (about 271 kB) without content edits.
