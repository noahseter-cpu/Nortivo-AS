---
name: Nortivo
description: "A cinematic navy presentation with clear blue actions and practical product interfaces."
colors:
  ink: "#07131f"
  surface: "#101e2e"
  paper: "#f3f7fb"
  muted: "#b8c7d8"
  line: "#2a4056"
  blue: "#0962d8"
  link-blue: "#79bdff"
  focus-blue: "#98ceff"
  white: "#fff"
  portal-line: "#263b52"
  portal-field: "#091624"
  portal-accent: "#80baff"
  portal-error: "#ffb4b4"
  portal-success: "#8ce0bd"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(2.1rem, 4vw, 3.45rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(1.8rem, 3vw, 2.65rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.025em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.025em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: ".86rem"
    fontWeight: 700
    lineHeight: 1.65
  portal-display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(2rem, 3.4vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "-.035em"
rounded:
  compact: "6px"
  control: "7px"
  portal-control: "8px"
  image: "10px"
  workspace: "12px"
spacing:
  field-gap: "8px"
  compact: "12px"
  text: "16px"
  form-gap: "20px"
  control-inline: "24px"
  workspace-padding: "30px"
  section-gap: "36px"
  section-mobile: "52px"
  section-tablet: "64px"
  section-desktop: "88px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "13px 24px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "13px 24px"
  text-link:
    textColor: "{colors.link-blue}"
  input-field:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  site-navigation:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.muted}"
  language-switch:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "0 7px"
  status-development:
    textColor: "#cfdaea"
    rounded: "{rounded.compact}"
    padding: "6px 10px"
  portal-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.paper}"
    rounded: "{rounded.workspace}"
    padding: "30px"
  support-tabs:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.portal-control}"
    padding: "12px"
  ticket-status:
    backgroundColor: "#142d46"
    textColor: "#a6d0ff"
    rounded: "{rounded.compact}"
    padding: "3px 8px"
---

# Design System: Nortivo

## Refinement — 22 September 2026

This update supersedes the older descriptions of the founder strip, support columns, mobile header and motion below. The user requested cleaner text/layout, Animate-based motion, their supplied professional biography, a refreshed tab icon and production publication. The existing navy art direction is retained.

- Removed the duplicate home feature-link row and founder strip. Arc details remain on Products; the founder's biography is grouped under About.
- Added the user-supplied Nortivo, Coor Norge, Framtia Barnehage and Drømtorp entries in both languages. Source: profile text supplied directly by the user on 2026-09-22; no private LinkedIn analytics included.
- Mobile header is one compact row with explicit language/menu controls. Pointer menu transitions use interruptible WAAPI, 180ms, opacity/translateY and the existing ease-out token; keyboard operations remain immediate.
- The marketing hero has one non-blocking 600ms settlement, 60ms stagger and a 1000ms decorative image settlement. Content begins visibly at opacity .8; no scroll hiding or recurring movement. Reduced motion disables positional animation.
- Support uses one centered 760px workspace and removes the repeated three-step explainer. Form IDs, functionality and backend contracts are unchanged.
- The navy/white/blue N favicon uses a versioned URL to refresh browser caches. Netlify's own badge setting was switched off for all visitors; no CSS hiding workaround or paid upgrade.
- Checked local desktop 1440px, mobile 390px, narrow English 320px, menu/Escape and translated biography; no horizontal overflow in the measured views. Real-device motion feel and assistive-technology testing remain untested.

## Overview

**Creative North Star: "The Midnight Product Stage"**

Nortivo uses a cinematic navy environment to give its products a clear setting. Compact Manrope headings, pale text and direct blue actions keep the interface readable around the image. The reusable character is calm and precise: substantial imagery where it explains the brand, followed by clear product information and practical controls.

Public pages have generous section spacing and visible product evidence. Support and administration use the same palette and type family with tighter workspaces, stronger field boundaries and plain state feedback. Neither surface relies on entrance animation to reveal content.

This is a record of the implemented local website, extracted from `dist/assets/site.css`, `dist/assets/portal-v2.css`, source HTML and `site.js` on 21 September 2026. The descriptive north star summarizes that implementation; it is not a newly approved concept name. The user explicitly instructed direct implementation after rejecting the earlier previews. The build is code-led, not an image-approved screen reproduction, and has not been publicly deployed. See [the direction contract](docs/design-2026-09-21/DIRECTION_STATUS.md) for the decision record and [verification](docs/design-2026-09-21/VERIFICATION.md) for tested scope.

**Key Characteristics:**

- Midnight navy surfaces, pale text and clear blue actions.
- One locally served Manrope family, with regular body text and bold hierarchy.
- Broad image presentation paired with real, labelled Arc screenshots.
- Flat content sections and bounded support workspaces.
- Immediate navigation and short, optional control feedback.
- Norwegian Bokmål and English receive the same visual hierarchy.

## Colors

The palette moves from near-black navy through blue-grey structure to bright, readable action and focus colors. The frontmatter contains the normative values; the names below describe their use.

### Primary

- **Action Blue** (`blue`): solid primary buttons on public and operational pages.
- **Link Blue** (`link-blue`): text actions and supporting line icons.
- **Focus Blue** (`focus-blue`): the visible keyboard outline across shared components.
- **Portal Blue** (`portal-accent`): ticket identifiers, support step numbers, carets and focused portal fields.

### Neutral

- **Midnight Ink** (`ink`): the page, header and public field background.
- **Navy Surface** (`surface`): mobile navigation and support/admin workspace panels.
- **Frost Paper** (`paper`): primary text; **White** (`white`) gives actions and current navigation their stronger emphasis.
- **Blue-grey Text** (`muted`): descriptions, helper copy and secondary navigation.
- **Structural Line** (`line`): public dividers and quiet control boundaries.
- **Portal Line** (`portal-line`): operational panel and row boundaries.
- **Inset Field** (`portal-field`): portal inputs against their panel.

### Semantic states

- **Portal Error** (`portal-error`) and **Portal Success** (`portal-success`) accompany explicit feedback text.
- The development label uses an amber dot with written test status. Ticket chips use written Open, Answered or Closed states with their own blue, green or neutral treatment.
- Public contact feedback has dedicated error and success surfaces; these are not promotional accents.

**The Explicit State Rule.** Color accompanies text or a visible selected state; it never supplies the only explanation of status or failure.

## Typography

**Display Font:** Manrope, with sans-serif fallback.
**Body Font:** Manrope, with sans-serif fallback.

Regular (400) and bold (700) are served locally from `dist/assets/fonts` with `font-display: swap`. Syne files remain in the repository but are not loaded by the current site. Font sources and licensing are recorded in [THIRD_PARTY_FONTS.md](docs/THIRD_PARTY_FONTS.md).

The single family keeps marketing and support visibly related. Headings are compact and balanced; descriptions use comfortable line spacing instead of oversized display typography.

### Hierarchy

- **Display:** the public page heading role in the frontmatter. The home hero limits its heading to 560px on desktop; its final mobile size is 2.08rem, then 1.9rem below 360px.
- **Headline:** section headings. Arc introductions and product-page headings have their own smaller contextual clamps in the stylesheet.
- **Title:** the shared subheading role. Service headings use 1.5rem on desktop and 1.3rem on narrow screens.
- **Body:** regular text with a default measure of 65ch. Descriptions and metadata commonly step down below the base size.
- **Label:** bold public form labels. Portal labels use .83rem; support explanatory text retains its own line-height.
- **Portal display:** operational page headings. Login uses 2rem; the authenticated dashboard uses a smaller contextual clamp.
- **Numeric detail:** ticket identifiers, support step numbers and summary values use tabular numerals.

**The Single Family Rule.** Use the existing Manrope regular and bold files for the website; do not reintroduce Syne from the archived design.

## Layout

Public content uses a centered container with a maximum width of 1200px and 32px side gutters. The header is part of normal document flow, with an 88px desktop minimum height. Sections use 88px vertical padding, reducing to 64px at the tablet layout and 52px at the phone layout.

The public responsive thresholds are 1080px, 880px, 560px and 359px. At 880px, the content container caps at 680px with 20px gutters, desktop navigation gives way to the menu, and Arc, about and contact layouts become one column. At 560px, gutters are 18px; language controls occupy a separate line in the 102px header, service and form grids stack, and product features become a vertical sequence. Below 360px, gutters reduce to 14px. The hero artwork has a separate 700px source-image switch.

Support and admin use a 1160px maximum shell with 32px desktop gutters. The support introduction and workspace form a two-column composition; the workspace itself is a bounded panel. At 900px, spacing tightens and shell gutters become 20px. At 720px, support and admin list/detail become single columns and the supplemental support steps disappear. At 480px, shell gutters become 16px, fields and actions stack, and panel padding tightens to 22px by 18px.

Form grids preserve label-to-field spacing and allow long messages, translations and ticket identifiers to wrap. Mobile product screenshots use the real portrait asset inside a bounded preview with a caption; they are not invented device mockups. Preserve the reading order and meaningful headings when adding content in either language.

## Elevation & Depth

The interface is flat. Navy tonal changes, thin borders and whitespace distinguish sections, controls and workspaces; current stylesheets define no box-shadow vocabulary. Photographic depth belongs to the original hero artwork. A local dark overlay and text shadows protect its reading area.

### Text-shadow vocabulary

- **Hero heading:** `0 3px 14px #02080e`.
- **Hero supporting copy:** `0 2px 7px #02080e`.

**The Flat Workspace Rule.** Separate support and administration layers with the existing surface and border treatments; do not add floating-card shadows or glass blur.

## Shapes

Controls have small, deliberate corners: compact status/menu elements, public controls and portal controls use their respective frontmatter radii. Product images are slightly softer; support and login workspaces use the largest recurring radius. Ordinary content sections stay open, with straight horizontal dividers.

The visible header brand is the uppercase NORTIVO wordmark in Manrope. The unused legacy brand-mark rule is not a component to reintroduce. Arc uses the supplied complete SVG wordmark with its separate “by Nortivo” line; do not reconstruct it from a letter or a substitute font.

## Components

### Buttons

Direct, solid and easy to identify. Public primary buttons use Action Blue, white bold text, a 50px minimum height and the public control radius. Secondary buttons retain a transparent surface and a visible border. Hover changes the primary fill to `#1268db`, or the secondary surface to `#142a40`, on hover-capable fine pointers only.

Portal actions use 46px minimum height, 12px by 19px padding and the portal control radius; their primary hover fill is `#0755bd`. Disabled controls retain their label and use a waiting cursor with reduced opacity. Keyboard focus uses the shared visible outline.

Public action color feedback takes 160ms. Pointer activation scales shared buttons to .98 over 120ms using the extracted ease-out curve. The portal hover rule uses 140ms background feedback. Reduced motion removes transitions and press transforms.

### Text links

Blue, bold text with an optional inline arrow; no filled container. The arrow is 19px and moves right by 3px over 160ms on a fine-pointer hover. Hover also makes the label white. Keep its visible keyboard outline; reduced motion removes the translation.

### Fields and feedback

Public inputs use the ink background, 48px minimum height, 12px by 14px padding and a `#56718c` boundary. Textareas start at 150px. Labels remain above the field, and field errors accompany `aria-invalid`.

Portal fields use the inset field background, 46px minimum height, 12px by 13px padding and a `#526c88` boundary. Focus changes the boundary and adds a 2px Portal Blue outline with 2px offset. Portal textareas start at 152px. Feedback uses live status regions and explicit text; a positive state reflects the saved result. These fields do not use floating labels or placeholder-only identification.

### Navigation and language

The text wordmark anchors a compact header. Desktop links use .87rem bold text, with muted default and white current/hover states. The mobile menu is an in-flow panel with a visible toggle, `aria-expanded` and an immediate open/close state. Escape closes it and restores toggle focus.

Language buttons use `aria-pressed`, a visible underline on the chosen language and immediate text replacement. They do not animate layout or wait for an effect to finish. Keep both language names visible and preserve the selected-language styling.

### Development and ticket status

The Arc development label is a compact bordered rectangle with a small amber dot and a full text statement. It is informational, not a button. Its final phone font size is .75rem.

Operational status chips use the same compact radius and a 27px minimum height. Open is blue, Answered is green and Closed is neutral. They have no decorative dot. Tabular ticket numbers stay separate from the status label.

### Support workspace and tabs

A single navy panel with a thin portal border and workspace radius contains the support form. Its body has 30px desktop padding. The tab strip has 12px padding, an 8px gap and a divider; the selected tab uses `#1a2f46` with a `#3c5977` boundary.

Tabs use actual tab roles, linked panels and keyboard selection. Switching is immediate; the discarded 260ms panel entrance is not part of this implementation. The login panel reuses the same material at a maximum width of 460px. The admin workspace preserves the list/detail split until the responsive stack.

### Product evidence and disclosure

Keep the original Arc wordmark and actual empty-test screenshots, their aspect ratios, and a nearby caption describing the image. Native `details`/`summary` disclosures provide the product FAQ, with a simple bottom divider and visible keyboard focus. Hero artwork is decorative; product screenshots have meaningful alternate text.

## Do's and Don'ts

### Do:

- Do use the implemented navy palette and Manrope hierarchy across public, support and administration pages.
- Do keep primary actions visibly blue and keyboard focus clearly outlined.
- Do retain equal information hierarchy and usable wrapping in Norwegian Bokmål and English.
- Do preserve the complete Arc wordmark, actual screenshot captions and readable founder credit.
- Do use flat dividers for content and bounded panels for forms and operational work.
- Do keep navigation immediate and honor reduced motion for control feedback.
- Do keep source and licence records with shipped artwork, screenshots and fonts.

### Don'ts:

- Don't reintroduce the discarded mint-and-Syne system or treat rejected previews as approved targets.
- Don't fabricate app screens, customer evidence, download availability or product integrations.
- Don't hide initial content behind entrance animations, parallax or scroll control.
- Don't add glass blur, floating-card shadows or substitute logo geometry to this system.
- Don't use color alone for status, field errors or the selected language.
