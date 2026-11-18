# Terminal and Portfolio surface brief

The owner’s 18 November 2026 refinement brief in `docs/PRODUCT_REFINEMENT_SPEC.md` supersedes the older green-charcoal screenshot as visual authority. The current rendered homepage is the reference for Terminal Pro, Portfolio and their shared account screens.

## Direction

- Near-black background, ivory Manrope typography, neutral surfaces and straight rules. IBM Plex Mono distinguishes compact financial figures.
- One text-only NORTIVO wordmark. Shared semantic tokens live in `dist/assets/product-tokens.css`.
- The side rail owns workspace navigation; the top bar contains product switching, instrument search, connection state and account access.
- Overview keeps the watchlist–chart–context composition and six KPIs. Other destinations use relevant compact context and distinct task layouts.
- Neutral actions and selection; financial and operational colours retain meaning. Zero is neutral, missing data stays unavailable.
- Read-only sample, paper execution and production data states remain explicitly distinct. A subscription does not repair an unavailable provider.

## Behaviour boundaries

Preserve authentication, billing prices and entitlements, persisted data, provider adapters, risk controls and broker confirmation requirements. The refinement does not enable feeds, connect brokers or execute orders. Sample views use the fixed fictional catalogue and existing sample ledger, with no AI or provider-success fabrication.

Cache chart viewport by data mode, exact instrument and resolution. Restore it after remount; a newly selected event can intentionally focus its candle. Keep indicators, expansion, zoom controls, accessible recent-candle table and keyboard guidance. Tables scroll within their own labelled region.

Portfolio uses its existing manual ledger, decimal quantities, explicit instrument/display currencies and manual valuation provenance. Holdings without acquisition history must not gain invented purchase dates or historical returns. Company history remains a separate NOK publication, never a customer account balance.

## Responsive and motion

Inspect 1440px and 1280px desktop, 768px tablet and 390px phone layouts. Navigation, context and actions must wrap or scroll intentionally without document overflow. Touch controls have 44px targets. Fields and dialogs retain labels, focus, Escape handling and viewport scrolling.

Use 140–160ms control feedback and approximately 180ms overlays. Reduced motion removes transitions and transforms. No decorative chart sweeps, constant pulses or financial count-up effects.

## Evidence

The prior green terminal remains in Git history. Current before/after captures and release checks are recorded in `docs/PRODUCT_REFINEMENT.md`. Provider-dependent states require their real services and are reported separately from locally verified fixture workflows.
