# Nortivo design system

## Direction

Nortivo uses a dark editorial studio system: large, purposeful type; asymmetric page composition; quiet dividers; and one warm mint accent. The interface should feel authored and exact, not glassy, dashboard-like or overloaded with decorative technology motifs.

## Typography

- Display: Syne, weights 600 and 800.
- Body and controls: Manrope, weights 400 and 700.
- Both families are loaded locally from `dist/assets/fonts`.
- Display tracking stops at `-0.04em`; body copy uses comfortable line-height and restrained measure.

## Color

- Ink: `#080d0c`
- Surface: `#101715`
- Paper: `#f3f0e6`
- Muted text: `#9aa59f`
- Mint action/accent: `#9ee493`
- Dividers: translucent paper at 14% opacity

Mint marks primary actions, focus and the product voice. It is not used as decorative glow.

## Composition

- Public home: dominant editorial statement beside a narrow capability rail, followed by one contrasting Arc product strip.
- Support: explanation and sequence on the left, focused form workspace on the right.
- Admin: compact login surface; operational dashboard keeps its list/detail split and dense information hierarchy.
- Cards are reserved for bounded workspaces and the Arc product feature, not used as the default container for every section.

## Components

- Brand mark: solid mint rounded square with a Syne “N”.
- Primary action: mint, 11–12px radius, minimum 46px height.
- Secondary action: transparent surface with a quiet divider border.
- Inputs: near-black surface, visible focus ring, 11px radius.
- Status: compact text pill with state-specific color and tabular ticket IDs.

## Motion

- Homepage has one staged entrance: 720ms ease-out with small vertical travel; delays stay under 220ms.
- Support tab changes use a 260ms ease-out panel transition.
- Pressable controls scale to `0.97`; pointer hover is gated to hover-capable devices.
- `prefers-reduced-motion` removes meaningful durations and leaves content visible.

## Responsive behavior

At 760px and below, the hero becomes a single reading sequence: statement, action, capability rail, Arc. Support becomes one column below 880px. At 560px, forms become single-column and admin actions stack without horizontal page overflow.
