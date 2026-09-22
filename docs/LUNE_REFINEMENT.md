# Lune refinement — 22 September 2026

User requested a less basic restaurant demonstration, purposeful Animate/Impeccable work, and corrected the corporate heading that implied a restaurant experience rather than website work. Direct implementation remains authorized; this expands the existing supper-club identity without a concept approval round.

## Surface brief

Experience + Persuade: prospective Nortivo customers should see a coherent restaurant website, explore its menu and try a fictional booking. Preserve the blue invitation paper, blue-green ink, Manrope, butter actions, truthful demo notice and nb/en parity.

The entry is a full-width fictional interior illustration with a protected left reading area, large invitation and clear menu/booking actions. The menu pairs the existing food image with a readable single-column menu folio. On mobile the imagery and content reorder into a linear journey. The bistro section connects atmosphere and example hours. Booking uses native radio time slots, a live selection summary and explicit fictional confirmation. Native FAQ disclosures explain the demonstration.

Motion: visible-from-start hero text settlement 600ms with 60ms stagger; image settlement 1000ms. Frequent filter changes are immediate. Pointer presses use 120ms scale feedback. Occasional pointer booking confirmation uses cancellable WAAPI opacity/translateY, 220ms with the existing ease-out; state and focus update before animation. Keyboard input and reduced motion skip that animation, and a change to reduced motion cancels it.

No address, reviews, real availability, personal data, payment or server-side reservation is added. Existing sample dishes, prices and Oslo calendar model remain intact. The corporate introduction is now “Se nettsidearbeidet vårt: Lune.” / “Explore our website work: Lune.”

## Image provenance

New asset: `dist/assets/lune-interior.webp`, generated using the built-in image tool, 1536×1024, quality-85 WebP, 193,790 bytes. The exact prompt is stored in `dist/assets/lune-interior.webp.json`. The original food asset is reused without editing. Visible captions distinguish both illustrations from real restaurant photography.

## Verification

Local locale build and all 62 automated tests passed. Browser checks covered keyboard and pointer booking, menu filtering, live selection summary, closed-day feedback and fictional confirmation. A 25 September 2026, 18:00, four-guest confirmation was exercised without sending a real booking or support message.

The independent finish review returned **SHIP**, with no material findings across nine screenshots in `.impeccable/review/lune-refinement/`. The image-provenance scan checked six rasters and found zero missing sidecars. The scoped design record and sidecar are updated in `docs/restaurant/DESIGN.md` and `docs/restaurant-design.json`; the corporate design system remains separate.

Netlify published implementation commit `fe4bb0a` (deploy `6ab2549997880700085bc2d5`) on 22 September 2026. Both localized homepages serve the corrected heading; both restaurant routes and the interior asset return 200, with CSP on HTML. A live 25 September, 18:00, two-guest demo confirmation and reset were verified without a real reservation. No physical-device or assistive-technology result is claimed.
