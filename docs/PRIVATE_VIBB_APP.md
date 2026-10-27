# Private Vibb app and code

27 October 2026. Implemented and verified locally; independent review returned **SHIP** with no material fixes. Publication is already authorized, but this extension has not been verified live at this documentation checkpoint. The previous course/Groq deployment remains recorded in [PRIVATE_WORKSPACE.md](PRIVATE_WORKSPACE.md).

## Use

The authenticated admin project registry opens the course, **App og kode**, and the practice app. `/admin/projects/vibb/workspace.html` pairs the real Vibb app with a read-only file selector, file explanation, numbered source and literal, case-insensitive search. Repeated Find advances through matches and wraps. Register, History and About files offer an explicit action to open their corresponding app page. This does not edit or hot-reload code.

The course toolbar adds **Vis Vibb** and **App og kode i ny fane**. The separate workspace receives the current file where available. The practice app and AI helper are mutually exclusive companions. Closing the app with its close control returns focus to the toggle. Loading/session failure has written recovery text.

## Source and storage boundary

`scripts/build-private-vibb-app.mjs` compiles the same protected 17-file catalog shown by the course, version `d99fb3c`. It checks the locally installed versions against that catalog before building: React and React DOM 19.3, React Router 8.4 and Vite 8.3. It installs nothing. The three hosting adaptations are Router basename `/admin/projects/vibb/app`, prefixed mood asset paths and isolated storage key `vibb-nortivo-practice-v1`. A small written notice identifies the exercise copy. All five supplied moods remain.

The original school project, original course source/Site and learning storage are unchanged. Practice mood entries belong to this origin's separate browser storage; they do not become school records or learner results. Synthetic browser verification created and deleted one practice entry. No personal records are copied, reset or imported.

Refresh incorporates the compiled app and five workspace/companion files into the existing encrypted Worker package. Raw builds stay under ignored `.netlify/`; no plaintext app bundle is published in `dist`. The encrypted snapshot now contains 52 assets. [PRIVATE_VIBB_SNAPSHOT.json](PRIVATE_VIBB_SNAPSHOT.json) records hashes and version without source or profile data. Run the existing refresh/package workflow in [PRIVATE_WORKSPACE.md](PRIVATE_WORKSPACE.md); editing workspace source alone does not refresh ciphertext.

## Access and provider boundary

The existing admin cookie protects every workspace, app, direct app route, asset and tutor request. Anonymous course/workspace documents and known app-page routes redirect to admin login; scripts, other assets and APIs return 401. Only authenticated `/app` responses permit same-origin framing (`SAMEORIGIN`, `frame-ancestors 'self'`). Course and workspace parents retain denied framing and allow their same-origin child through `frame-src 'self'`. Existing no-store, noindex, origin/path/body/method checks and encryption remain in force.

This pass changes no Production Groq key or provider configuration. Local fixture verification disables providers; it makes no Groq, email or database calls. The earlier authenticated Production Groq success is not evidence of this extension's deployment. The former standalone course remains owner-private.

## Design and local verification

The [scoped design system](private-vibb/DESIGN.md) preserves the incumbent Vibb focus desk. It does not alter public Nortivo tokens or introduce motion, raster imagery, fonts or dependencies.

- Full local automated suite: **76/76 passed**.
- Browser: actual React rendering; synthetic Bra selection, save, history and deletion; file selection/search; linked app-page navigation; app-only/code-only views.
- Captures: desktop browser 1280×720 and the actual 706×668 CSS-pixel user pane, for workspace and course companion. Native screenshots omit scrollbar area and round output dimensions (1265×712 and 690×654); DOM viewport measurements establish the stated browser sizes and no root horizontal overflow.
- Evidence: `.impeccable/review/vibb-workspace-desktop.png`, `vibb-workspace-706.png`, `vibb-course-preview-desktop.png`, `vibb-course-preview-706.png`. These are review captures, not shipped product imagery.
- Independent visual/source review: **SHIP**, no material fixes. The hover contrast correction is incorporated. Logical-padding detector warnings and cross-project palette advisories were reviewed without promoting them to a new global design rule.

The requested target is PC. The ≤640px stacked fallback is implemented but not visually tested on a phone. Physical hardware, assistive technology and live deployment of this extension remain unverified here.
