# Nortivo website

The public Nortivo website, separate from the Arc application. Static HTML/CSS/JavaScript, Netlify Functions, Supabase ticket storage and Resend email. No frontend framework or package install is required.

## Local development

Use Node.js 20 or newer:

```powershell
node scripts/build-locales.mjs
node --test tests/*.test.mjs
node scripts/serve.mjs
```

Open `http://127.0.0.1:4399/nb/` or `/en/`. The local server deliberately returns 503 for server functions: it does not read production secrets, create tickets or send email. Form drafts remain in the open page after errors or language changes, not after reload/navigation.

## Editing

- English source pages: `dist/index.html` and `dist/{products,services,about,contact,restaurant,support,admin,privacy}/index.html`.
- Shared copy: `dist/assets/site-copy.json`. Runtime copy is embedded in `site.js`; the contract test checks they remain identical.
- Support/admin copy: `dist/assets/portal-copy.json`; page scripts embed the relevant dictionaries.
- Shared design: `dist/assets/site.css`; operational surfaces: `portal-v2.css`.
- Run the locale build after source/copy changes. It writes eighteen static pages under `/nb/` and `/en/`, including translated metadata and alternate-language links.
- Existing non-prefixed routes are preserved. On Netlify, the edge function chooses an explicit language, saved cookie, Norway signal, then English. Explicit prefixed routes are never redirected by geolocation.

## Deployment boundary

The redesign was implemented and tested locally on 2026-09-21. The user explicitly authorized publication to the existing Netlify project and support integration checks on 2026-09-22. Future production changes still require appropriate authorization: a Git push to the linked production branch triggers Netlify automatically.

`netlify.toml` runs the locale builder and publishes `dist`, with Functions from `netlify/functions` and the language edge function from `netlify/edge-functions`. A manual upload of `dist` alone does not establish the complete backend or edge workflow.

Keep the existing environment values described in `SETUP.md` on Netlify only. Never commit `.env`, API keys, passwords, tokens, or customer records. The access-link implementation uses the existing session secret and requires at least 32 bytes; no database migration is introduced.

Before production acceptance, test real ticket creation, confirmation delivery, email verification, authenticated lookup, admin login/reply/status/logout, cookies, redirects and response headers in an approved deployment. No real customer ticket was used in local testing. See `docs/SUPPORT_SECURITY.md` for rate-limiter and delivery limitations.

## Design and evidence

See `DESIGN.md`, `docs/design-2026-09-21/DIRECTION_STATUS.md` and `docs/design-2026-09-21/VERIFICATION.md`. The user explicitly requested direct implementation without further previews. The approved Arc wordmark and isolated empty-state app screenshots are retained; no public app launch, download, reviews or customers are invented.

Generated artwork and screenshot origins are recorded in `docs/design-2026-09-21/asset-provenance.json`. Font sources/licences are documented in `docs/THIRD_PARTY_FONTS.md`. Reference websites informed composition, not copied content or code.

## Separate pages and restaurant demo

The homepage is a short introduction with a Products CTA and links to Services, About Nortivo and Contact. Previous homepage fragments redirect to their new localized pages. The contact page retains the same ticket backend; `?project=web` or `?project=app` prefills the service choice.

The Lune restaurant demonstration lives at `/nb/restaurant/` and `/en/restaurant/`, linked from Services and Products. It is explicitly fictional, not client work. Menu filtering and table selection run locally without a reservation service, personal-data collection or storage. The demo calendar uses Europe/Oslo days and fictional opening hours. Original generated food imagery is documented in `docs/LUNE_IMAGE_PROMPT.txt` and its shipped WebP provenance sidecar; the 1536×1024 source was converted to quality-85 WebP (about 271 kB) without content edits.
