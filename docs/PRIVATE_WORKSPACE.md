# Private administrator workspace

Implemented locally and published with explicit approval on 27 October 2026. Production admin/course access and an actual Groq answer were verified. No real support ticket or email was created in this release.

The subsequent [Vibb app and code extension](PRIVATE_VIBB_APP.md) has passed local review and 76 automated tests; its publication is pending at this documentation checkpoint. The production evidence below describes the earlier release, not this extension.

The existing admin login opens **Projects & tools**, with **Support tickets** as a separate choice in the same dashboard. Ticket search, detail, drafts, reply, close/reopen, counts, refresh and logout retain their existing IDs and server contracts. Projects never become ticket records. The admin interface supports nb/en. Learning content remains in its supplied language, identified by the English description. External shortcuts retain their destination's own authentication. The registry is read-only; project CRUD is not implemented.

## Public repository boundary

The Git repository is public. HTTP authentication alone does not protect source committed to it. Only the generated AES-256-GCM package `netlify/private/encrypted-content.mjs` may be committed; it contains authenticated ciphertext with a fresh 96-bit nonce and a 128-bit tag. Additional authenticated data fixes the package purpose/version. It encrypts the project registry JSON and standalone compiled Worker source together. No learner profile, course source catalog, registry contents or key is published in plaintext through this package.

Plaintext local inputs `netlify/private/projects.mjs` and `netlify/private/vibb-runtime.mjs` are explicitly gitignored. The dedicated 256-bit content key exists locally only in the gitignored `.env.private-workspace.local` as `NORTIVO_PRIVATE_CONTENT_KEY`. Packaging creates it with `crypto.randomBytes(32)` if absent, never prints it and never places it in command arguments. The key reader accepts exactly one canonical base64 value for that key in that exact file; it does not evaluate environment text or read provider configuration. Protect the local file and preserve it securely: losing it prevents decrypting its ciphertext package.

Authenticated Functions statically import ciphertext and crypto/loader modules, which are ordinary transitive dependencies outside the Functions entrypoint directory. They never import plaintext inputs. Netlify builds need no plaintext generation, decryption or build-time key. A clean public checkout can build and run ordinary support without the private content key. Refreshing encrypted content requires local private inputs and the key; neither should be recovered from public Git history.

## Authenticated loading

`admin-projects` and `admin-vibb` validate the existing `nortivo_admin` cookie with `isAdmin`, then origin/method/path/body constraints. Only afterward does `content-loader.mjs` read `NORTIVO_PRIVATE_CONTENT_KEY`, decrypt and validate the package. Missing, malformed, wrong or tampered keys/packages fail closed with generic 503 responses and no decryption diagnostics. Login/logout and support retain their existing session secret, password, cookie and eight-hour session independently of the content key.

Validated plaintext stays in process memory. The cache checks the current key fingerprint on each access; a missing or changed key cannot reuse earlier plaintext. The Worker must be standalone with no static/dynamic imports. Generated asset/catalog regions are validated as JSON data, so course examples containing import text are not executed. After admin authentication, the loader imports authenticated module source through an in-memory `data:` module URL without writing decrypted files. Only code authenticated by the package key reaches this step; this is not a general execution endpoint.

The course runs directly under `/admin/projects/vibb/`; its optional practice app is a same-origin child frame. Every page, JavaScript, CSS, font, source-data asset and tutor action passes through the same cookie check. Anonymous course/workspace documents and known app-page routes redirect to admin login; scripts, other assets and APIs return 401 with recovery. Incoming identity, cookie and authorization headers never reach the Worker. Only after authentication does the wrapper supply a fixed non-personal internal owner identity.

The wrapper accepts its known route/function prefix only. Encoded traversal, dot segments, backslashes and arbitrary target URLs are rejected. Tutor POSTs require approved same origin and at most 24,000 bytes; the Worker validates the payload. Its existing three-second process-local limiter is not a distributed quota. There is no arbitrary upstream proxy.

Course and workspace responses use `private, no-store`, noindex, nosniff and denied framing. The authenticated practice-app responses alone use `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`; the parent course/workspace permit `frame-src 'self'` so they can display that app. Authentication still precedes every response. Legacy style attributes require `style-src 'self' 'unsafe-inline'` on this private response only. Scripts, connections, fonts and assets stay same-origin; inline scripts/eval remain forbidden. Netlify custom static headers do not apply to Function responses: the wrapper CSP is authoritative. Public/support/admin CSP is unchanged. A private base and rewritten tutor URLs keep assets/API calls inside the authenticated prefix. Recovery and return links lead to admin. Existing course close/Escape/focus behavior is preserved inside the encrypted snapshot.

The deployed `dist/_redirects` explicitly rewrites both `/admin/projects/vibb` and `/admin/projects/vibb/*` to the exact `/.netlify/functions/admin-vibb` endpoint with status 200 and force enabled. Equivalent rules remain in `netlify.toml`, but the publish-directory rules were required for the verified production route. The handler extracts the original course path from `rawUrl`, including after Netlify rewrites `event.path`. Index requests and asset/API requests retain different anonymous recovery behavior. The locale edge function handles exact legacy routes and does not redirect the course path. Routing reference: https://docs.netlify.com/build/functions/configuration/.

## Refresh and provenance

After rebuilding the original course Worker, run locally:

```powershell
node scripts/refresh-private-vibb.mjs
# Or provide another compiled Worker:
node scripts/refresh-private-vibb.mjs 'C:/path/to/interaktiv/dist/server/index.js'
# Repackage unchanged local plaintext inputs:
node scripts/package-private-workspace.mjs
```

The default source is the existing sibling course build. Refresh compiles the practice React app from its protected catalog using exact matching installed dependency versions, adds the workspace and course companion, adds protected base/return links, rewrites tutor/recovery URLs, writes the ignored local Worker input, then encrypts registry and Worker. No dependency installation is performed. Recognizable provider-key shapes are rejected. `PRIVATE_VIBB_SNAPSHOT.json` records format, algorithm, hashes, asset count and practice version only. The supplied font licence remains inside encrypted assets. Browser learning notes/history retain existing storage keys; practice mood records use `vibb-nortivo-practice-v1`. Another hosted origin's records are not automatically imported. No storage is reset.

## Deployment configuration and approval

The user explicitly approved publication and Groq configuration on 27 October 2026. Future publication and secret provisioning require the applicable user authorization. This deployment uses `NORTIVO_PRIVATE_CONTENT_KEY` configured securely in Netlify's Functions runtime environment, matching the package key. It must never enter Git, public assets, commands, logs, a PR description or a chat response. The matching key was securely provisioned for Production on Netlify and rotated before public source publication.

The optional tutor additionally needs server-only `GROQ_API_KEY`; `GROQ_MODEL` is optional. Packaging and fixture startup never read provider keys. Without a provider key, the course works, status reports unconfigured and tutor submission returns an honest 503. An actual authenticated production chat request succeeded with the displayed code file as context. Provider quota and load limits were not stress-tested. Both private-content and Groq keys are secret Production values; preview/branch/local contexts are empty. The existing plan applies Builds/Functions/Runtime scopes together; no plan upgrade was made.

## Local verification

```powershell
node --test tests/private-workspace.test.mjs tests/support-security.test.mjs
node scripts/preview-private-admin.mjs --fixtures
```

The fixture server binds only loopback port4400 (optional `--port`). Explicit fixture startup discards inherited provider/service settings, reads only the exact local content-key file and creates random per-process login/session credentials. It exercises the real admin cookie, encrypted catalog and course. One labelled synthetic support ticket and reply/status changes stay in memory; no database, email or Groq request occurs. Restart after changing server modules or ciphertext because Node caches imports; browser reload is insufficient. Restart invalidates preview sessions. The ordinary preview server remains unchanged and returns 503 for Functions.

Private-workspace tests use random synthetic content keys and synthetic registry/course fixtures. They never read the real local key or plaintext course. Coverage includes decrypt, missing/wrong keys, authenticated tampering, cached-key invalidation, unsigned/forged/expired sessions, identity isolation, HTML/JS/binary delivery, tutor recovery, origin/path/body/method guards, generic failures and Git publication-candidate isolation. The app extension adds framing, route and workspace checks; the full local suite passes 76/76. Existing support tests use synthetic providers/storage. Tests do not establish deployed Netlify routing, production cookies/CSP or provider configuration. App-extension browser evidence and limitations are recorded in [PRIVATE_VIBB_APP.md](PRIVATE_VIBB_APP.md).

## Verified production release

Netlify published source `d83d577` as deploy `6ae0a2122c636d9d4fa27d77`. Anonymous index requests redirect302 to admin; course JavaScript and tutor status return401 with no-store. The project catalog also returns401 without a session. Ignored local inputs and the content-key file return404. The authenticated catalog, course, source reader and Groq chat work in the browser. The former standalone course Site now has a custom owner-only allowlist (no other users/groups) and returns401 to anonymous requests. The separate Vibb mood-tracker application was not changed. Notes from its old course origin are not imported automatically.

The app-and-code extension is now live as source `6a73e60`, deploy `6ae0b57c471afa5741926d79`; see [PRIVATE_VIBB_APP.md](PRIVATE_VIBB_APP.md) for the final browser/access verification. No admin credential or Groq setting changed.
