# Nortivo studio and private workspace — 27 October 2026

Implemented directly under the existing no-preview instruction. The company website keeps Nortivo's navy palette, locally served Manrope, existing routes and nb/en journey. Its homepage now moves from a company introduction to unequal, clickable Lune and Arc previews, open service rows and contact. Lune remains a fictional demonstration; Arc remains a private test product, shown with the existing dated empty-state screenshot. Shared public headers/footers have wider shells, a larger wordmark and a clear contact action. Restaurant and admin retain their separate skins.

Admin opens on Projects & tools, with Support tickets as a separate choice. Private course pages, assets, catalog and tutor requests pass through existing admin authentication. The registry is read-only, and projects never become ticket records. Support contracts and data remain intact. See [PRIVATE_WORKSPACE.md](PRIVATE_WORKSPACE.md) for the security, packaging, refresh and configuration details.

## Design system and assets

`dist/assets/studio-refresh.css` supplies the public extension: 1320px maximum shells, a 4.6rem maximum introductory heading, unequal work previews and flat service rows. `admin-workspace.css` adds responsive project rows and underlined workspace choices. [DESIGN.md](../DESIGN.md) and its sidecar record these implemented extensions while preserving the incumbent palette and controls. Page composition stays scoped to [the surface brief](../.impeccable/surfaces/dist-index-html.md).

No new raster artwork, font or dependency was introduced. Retained Lune imagery, Arc screenshot and font provenance/licences remain in their existing records. Fine-pointer image feedback is a 180ms transform; reduced motion is immediate. The screenshot keeps its intrinsic aspect ratio inside its matte.

The separate Vibb Sites helper refinement reserves a 280px dock at 680–819px, a 312px dock from 820px and a limited bottom sheet below 680px. **Sites version 15 deployed successfully.** The live 706px viewport confirmed the 280px helper and no overlap: code right edge 392.4px, helper left edge 410.4px. Evidence: `C:/Users/noahn/Documents/ChatGPT/tobias/output/vibb-kurs/Vibb-kompakt-hjelper-live.png`. This separate release does not publish the authenticated Nortivo snapshot.

## Verification and review

The final local Node suite passed **74/74 tests**, including nine private-workspace tests. Private tests use synthetic keys/content and support tests use synthetic storage/providers; no customer data, email or provider request was used. Browser checks covered the public homepage at 1440×1000 and 390×844, and private admin/course at desktop and 390px mobile. Ordinary mobile viewport captures confirmed retained gutters; a faulty provider full-page capture was excluded as layout evidence.

Anonymous course navigation redirects to login. Authenticated registry, course, source assets and fonts load. After the final encrypted-content restart, an actual browser login and `main.jsx` source loading were verified on the loopback fixture server at port 4400. A labelled synthetic support detail remains accessible, logout blocks the next course request, and absent Groq configuration returns an honest 503. The service selector typo and mobile Arc aspect-width issue were corrected before the final checks.

Independent finish review returned **SHIP**, with no material corrections requested. Evidence is retained under `.impeccable/review/`, including `after-desktop.png`, `after-mobile.png`, the mobile work/services/footer captures and private admin captures. Detector padding warnings were checked against logical padding and nested inner wrappers; they were false positives.

Production Netlify routing/cookies/CSP, live Groq availability/quota, real database/email delivery, assistive technology and physical hardware were not tested in this pass. Pre-existing older design-document drift and the missing Impeccable `buildPath` configuration were reported, not repaired or made normative.

## Approved production publication

The user explicitly approved Nortivo publication and Groq connection on 27 October 2026, with Vibb restricted to the private admin workspace. Source `d83d577` is published as Netlify deploy `6ae0a2122c636d9d4fa27d77`. Production has the approved design, authenticated project registry/course and a working Groq chat. The final route uses explicit publish-directory `_redirects` rules to the exact Function endpoint; a regression test covers the original raw URL after rewriting.

The repository is public. Its private registry/course package uses AES-256-GCM ciphertext; plaintext inputs and the local key file are gitignored. An approved release must securely configure the matching `NORTIVO_PRIVATE_CONTENT_KEY` in the Functions runtime. The optional tutor also needs server-only `GROQ_API_KEY`; `GROQ_MODEL` is optional. No secret value belongs in Git, public assets, documentation, logs or chat. The matching content key and Groq key were securely provisioned as secret Production variables. No plan, billing, customer data or support integration was changed.

Anonymous production checks: nb/en homepage200; private course index302 to admin; course JS, tutor status and catalog401; plaintext/key file paths404. All protected responses tested use no-store. An authenticated browser opened the code reader and received an actual Groq explanation for Header.jsx. The old standalone course Site is owner-only and returns401 anonymously. Production routing, admin access and the exercised chat are now verified; email/database delivery, physical hardware and provider load remain outside this release test. Progress on another origin is not automatically imported.

The final regression suite after the production routing correction passed75/75 tests.
