# Private administrator workspace

Implemented locally 27 October 2026. No publication, production requests, real tickets, email delivery or external credential provisioning were performed.

The existing admin login opens **Projects & tools**, with **Support tickets** as a separate choice in the same dashboard. Ticket search, detail, drafts, reply, close/reopen, counts, refresh and logout retain their existing IDs and server contracts. Projects never become ticket records. The admin interface supports nb/en. Learning content remains in its supplied language, identified by the English description. External shortcuts retain their destination's own authentication. The registry is read-only; project CRUD is not implemented.

## Public repository boundary

The Git repository is public. HTTP authentication alone does not protect source committed to it. Only the generated AES-256-GCM package `netlify/private/encrypted-content.mjs` may be committed; it contains authenticated ciphertext with a fresh 96-bit nonce and a 128-bit tag. Additional authenticated data fixes the package purpose/version. It encrypts the project registry JSON and standalone compiled Worker source together. No learner profile, course source catalog, registry contents or key is published in plaintext through this package.

Plaintext local inputs `netlify/private/projects.mjs` and `netlify/private/vibb-runtime.mjs` are explicitly gitignored. The dedicated 256-bit content key exists locally only in the gitignored `.env.private-workspace.local` as `NORTIVO_PRIVATE_CONTENT_KEY`. Packaging creates it with `crypto.randomBytes(32)` if absent, never prints it and never places it in command arguments. The key reader accepts exactly one canonical base64 value for that key in that exact file; it does not evaluate environment text or read provider configuration. Protect the local file and preserve it securely: losing it prevents decrypting its ciphertext package.

Authenticated Functions statically import ciphertext and crypto/loader modules, which are ordinary transitive dependencies outside the Functions entrypoint directory. They never import plaintext inputs. Netlify builds need no plaintext generation, decryption or build-time key. A clean public checkout can build and run ordinary support without the private content key. Refreshing encrypted content requires local private inputs and the key; neither should be recovered from public Git history.

## Authenticated loading

`admin-projects` and `admin-vibb` validate the existing `nortivo_admin` cookie with `isAdmin`, then origin/method/path/body constraints. Only afterward does `content-loader.mjs` read `NORTIVO_PRIVATE_CONTENT_KEY`, decrypt and validate the package. Missing, malformed, wrong or tampered keys/packages fail closed with generic 503 responses and no decryption diagnostics. Login/logout and support retain their existing session secret, password, cookie and eight-hour session independently of the content key.

Validated plaintext stays in process memory. The cache checks the current key fingerprint on each access; a missing or changed key cannot reuse earlier plaintext. The Worker must be standalone with no static/dynamic imports. Generated asset/catalog regions are validated as JSON data, so course examples containing import text are not executed. After admin authentication, the loader imports authenticated module source through an in-memory `data:` module URL without writing decrypted files. Only code authenticated by the package key reaches this step; this is not a general execution endpoint.

The course runs directly under `/admin/projects/vibb/` without an iframe. Every page, JavaScript, CSS, font, source-data asset and tutor action passes through the same cookie check. Anonymous index requests redirect to admin login; assets/API calls return 401 with recovery. Incoming identity, cookie and authorization headers never reach the Worker. Only after authentication does the wrapper supply a fixed non-personal internal owner identity.

The wrapper accepts its known route/function prefix only. Encoded traversal, dot segments, backslashes and arbitrary target URLs are rejected. Tutor POSTs require approved same origin and at most 24,000 bytes; the Worker validates the payload. Its existing three-second process-local limiter is not a distributed quota. There is no arbitrary upstream proxy.

Course responses use `private, no-store`, noindex, nosniff and denied framing. Legacy style attributes require `style-src 'self' 'unsafe-inline'` on this response only. Scripts, connections, fonts and assets stay same-origin; inline scripts/eval remain forbidden. Netlify custom static headers do not apply to Function responses: the wrapper CSP is authoritative. Public/support/admin CSP is unchanged. A private base and rewritten tutor URLs keep assets/API calls inside the authenticated prefix. Recovery and return links lead to admin. Existing course close/Escape/focus behavior is preserved inside the encrypted snapshot.

Netlify rewrites `/admin/projects/vibb/*` to `/.netlify/functions/admin-vibb/:splat` and redirects the exact no-slash route to the trailing-slash route. The locale edge function handles exact legacy routes and does not redirect the course path.

## Refresh and provenance

After rebuilding the original course Worker, run locally:

```powershell
node scripts/refresh-private-vibb.mjs
# Or provide another compiled Worker:
node scripts/refresh-private-vibb.mjs 'C:/path/to/interaktiv/dist/server/index.js'
# Repackage unchanged local plaintext inputs:
node scripts/package-private-workspace.mjs
```

The default source is the existing sibling course build. Refresh adds protected base/return links, rewrites tutor/recovery URLs, writes the ignored local Worker input, then encrypts registry and Worker. Recognizable provider-key shapes are rejected. `PRIVATE_VIBB_SNAPSHOT.json` records format, algorithm, hashes and asset count only. The supplied font licence remains inside encrypted assets. Browser notes/history retain existing storage keys; another hosted origin's notes are not automatically imported. No storage is reset.

## Deployment configuration and approval

**Do not publish or provision secrets without the user's final approval.** An approved deployment needs `NORTIVO_PRIVATE_CONTENT_KEY` configured securely in Netlify's Functions runtime environment, matching the package key. It must never enter Git, public assets, commands, logs, a PR description or a chat response. No external secret was provisioned here.

The optional tutor additionally needs server-only `GROQ_API_KEY`; `GROQ_MODEL` is optional. Packaging and fixture startup never read provider keys. Without a provider key, the course works, status reports unconfigured and tutor submission returns an honest 503. Actual provider availability, quota and production requests are untested.

## Local verification

```powershell
node --test tests/private-workspace.test.mjs tests/support-security.test.mjs
node scripts/preview-private-admin.mjs --fixtures
```

The fixture server binds only loopback port4400 (optional `--port`). Explicit fixture startup discards inherited provider/service settings, reads only the exact local content-key file and creates random per-process login/session credentials. It exercises the real admin cookie, encrypted catalog and course. One labelled synthetic support ticket and reply/status changes stay in memory; no database, email or Groq request occurs. Restart after changing server modules or ciphertext because Node caches imports; browser reload is insufficient. Restart invalidates preview sessions. The ordinary preview server remains unchanged and returns 503 for Functions.

Nine private-workspace tests use random synthetic content keys and synthetic registry/course fixtures. They never read the real local key or plaintext course. Coverage includes decrypt, missing/wrong keys, authenticated tampering, cached-key invalidation, unsigned/forged/expired sessions, identity isolation, HTML/JS/binary delivery, tutor recovery, origin/path/body/method guards, generic failures and Git publication-candidate isolation. Existing support tests use synthetic providers/storage. Tests do not establish deployed Netlify routing, production cookies/CSP or provider configuration. Browser verification belongs to the encompassing local redesign pass.
