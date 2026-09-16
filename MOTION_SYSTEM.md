# Motion system

Animate source verified as emilkowalski/skills. Purpose is feedback, spatial consistency and state indication; this app has no decorative entrance sequence.

Tokens: --ease-out cubic-bezier(.23,1,.32,1); --ease-drawer cubic-bezier(.32,.72,0,1). Press response120ms transform scale(.98); colour160ms ease. Progress200ms transform scaleX after committed state. Authoritative numbers change immediately, never count up.

Dialogs use CSS starting-style opacity200ms; mobile adds a small16px translate. Close is immediate to keep repeated logging responsive and focus predictable. Transitions are interruptible; no save waits on animation. Keyboard-initiated overlays skip transitions. Sonner supplies save/error feedback only after storage resolves. No extra animation library was installed.

Reduced motion removes transforms and transition/animation timing while preserving labels, focus and messages. Prefer transform/opacity; no animated layout or generic page fade-up. Native Radix focus containment and trigger restoration are retained. Touch never depends on hover.

Live validation belongs in VALIDATION.md. Static screenshots alone do not establish correct motion.

Nortivo0.3.0 replaces translated popup entry/centering with a single flex viewport and opacity-only200ms feedback. Dialog geometry never animates during keyboard resize. Reduced motion and keyboard-origin transitions still skip animation. Geometry and focus verified in browser tests; physical Android keyboard behavior remains a device check.
