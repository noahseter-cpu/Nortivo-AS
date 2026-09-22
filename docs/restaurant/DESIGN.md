---
name: Lune restaurant demonstration
description: "Cool invitation paper, deep blue-green ink and warm food imagery for a fictional bistro."
colors:
  ink: "#18343b"
  muted: "#4a6169"
  invitation: "#c5d5ed"
  paper: "#f5f7f6"
  line: "#bac9cc"
  butter: "#f1d582"
  white: "#fff"
  soft-surface: "#e3eae8"
  focus: "#295f86"
  field-line: "#789097"
  error: "#823824"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(3.4rem, 5.8vw, 5.6rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(2rem, 3.2vw, 3.2rem)"
    fontWeight: 700
    lineHeight: 1.13
    letterSpacing: "-.035em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.04rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: ".8rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  control: "3px"
  workspace: "8px"
spacing:
  label-gap: "8px"
  field-column-gap: "16px"
  field-row-gap: "22px"
  workspace-padding: "32px"
  section-mobile: "52px"
  section-desktop: "94px"
components:
  booking-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "15px 24px"
  enquiry-button:
    backgroundColor: "{colors.butter}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "15px 24px"
  category:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  category-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  navigation:
    backgroundColor: "{colors.invitation}"
    textColor: "{colors.ink}"
  booking-workspace:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.workspace}"
    padding: "32px"
---

# Design System: Lune restaurant demonstration

## Overview

**Creative North Star: "Supper-club invitation"**

Lune uses cool invitation-paper fields, ivory-white reading surfaces and deep blue-green ink. Large compact headings and open menu rows let the generated food photograph supply the warmth.

This scoped system records the implemented fictional restaurant, extracted on 22 September 2026 from `dist/assets/restaurant.css`, shared `site.css`, restaurant HTML and `restaurant.js`. It extends the repository with a separate visual world; it does not replace the corporate Nortivo system. The descriptive north star comes from the existing [direction contract](../RESTAURANT_DIRECTION.md), not a new approval round.

**Key Characteristics:**

- Cool invitation paper and compact Manrope headings.
- Open menu rows, tabular prices and explicit filter selection.
- Dark booking actions and a pale yellow closing enquiry action.
- Persistent fictional-demo disclosure and local-only table selection.

## Colors

### Primary

Ink anchors booking actions, selected categories and text. Butter distinguishes the closing Nortivo enquiry button; the demo-banner return link also uses it.

### Neutral

Invitation fills the header and hero text field. Paper supports reading; white isolates the booking workspace. Muted carries secondary descriptions, line divides dishes, and soft-surface separates the visit section and confirmation notice. Focus and field-line define keyboard focus and input boundaries. Error accompanies written validation feedback.

**The Separate World Rule.** Lune tokens apply only to the restaurant demonstration; Nortivo retains its incumbent navy and blue system.

## Typography

**Display Font:** Manrope, sans-serif fallback.
**Body Font:** Manrope, sans-serif fallback.

Shared `site.css` supplies locally served regular (400) and bold (700), with `font-display: swap`. See [font licences](../THIRD_PARTY_FONTS.md). Display is the invitation heading; headline defines section titles; title defines dish names; label identifies booking fields. Body measure is 56ch, with the hero introduction restricted to 35ch. Prices use tabular numerals. The wordmark is bold lowercase text (3.7rem), with a contrasting blue punctuation mark; mobile reduces it to 3rem.

## Layout

The main content width is `min(1160px, calc(100% - 80px))`. Desktop hero columns are `1fr 1.05fr` with a 590px minimum image height. Section introductions and menu rows use two columns with a 60px gap; the booking split uses `1fr 1.2fr` and a 70px gap. The demo banner stays sticky above ordinary anchor navigation; anchor sections reserve 72px scroll margin.

At 1000px, gutters become 28px, hero minimum height becomes 510px and major gaps tighten. At 720px, gutters become 20px, hero/menu/visit/booking stack, and navigation wraps into its own visible row. The image becomes 4:3; the display becomes 3.6rem with a 10ch measure. Menu and booking use section-mobile spacing; workspace padding becomes 24px 20px. At 359px, display becomes 3.1rem and the booking fields become one column. Otherwise the field grid is `1.25fr 1fr`, with time spanning both columns.

## Elevation & Depth

No box shadows or glass effects are introduced. Tonal fields, thin dividers and the food image provide depth. The photo caption uses an opaque-looking ink overlay (`#18343bed`) to protect its text. The sticky disclosure is a functional layer (z-index 10).

## Shapes

Controls use the control radius; the booking workspace uses the workspace radius. Menu entries remain open rows separated by a single line. The photo has square corners and crops at `58% center` on desktop. No decorative card system is introduced.

## Components

### Buttons

Booking actions are dark, with white text and a 52px minimum height. Only the closing enquiry button uses butter. Fine-pointer hover changes booking fill to `#2b4c53`; enquiry hover uses `#e4c369`. Focus is a 3px outline with 4px offset. Pointer press scales to .98; background feedback takes 160ms ease and press feedback takes 120ms with the shared `cubic-bezier(.23,1,.32,1)` curve. Underlined text actions remain unfilled.

### Chips

Category controls have 44px minimum height, line borders and transparent resting fill. `aria-pressed` and the selected ink fill identify the active category. Fine-pointer hover uses soft-surface. Filtering updates the written count and empty state immediately, without animation.

### Inputs / Fields

Native date and select controls use persistent labels, paper fill, field-line boundaries and 48px minimum height. Written status messages accompany invalid selection. The form contains only date, guest count and time: no personal-information fields. Confirmation is synthetic, held only in memory, and receives focus; reset returns focus to date. Reservation code sends no requests and writes no storage. The shared language preference is separate from reservation state.

### Navigation

Always-visible short anchor navigation sits beside the wordmark and language choices. Links are bold (.9rem), becoming .78rem at 720px and .72rem at 359px. Hover underlines links. The selected language is underlined and uses `aria-pressed`. The demo notice and return link stay visible above the header.

### Motion and imagery

The invitation title, introduction and actions use the shared visible-from-start hero settlement: 600ms, staggered 0/60/120ms, from 12px translation and opacity .8. Reduced motion disables animation and transitions through shared CSS and removes the Lune press transform explicitly. Menu changes and confirmation never wait for animation.

Keep the AI illustration caption and alternate text. The shipped image provenance is [lune-table.webp.json](../../dist/assets/lune-table.webp.json); the authoring prompt is [LUNE_IMAGE_PROMPT.txt](../LUNE_IMAGE_PROMPT.txt). No real restaurant, client relationship, availability, allergen assurance or booking is implied. Review and tested scope are recorded in [SPLIT_DEMO_VERIFICATION.md](../SPLIT_DEMO_VERIFICATION.md); this extraction adds no hardware or assistive-technology test claim.

## Do's and Don'ts

### Do:

- Do preserve the fictional-demo disclosure in both languages.
- Do keep menu changes immediate and reduced-motion behavior intact.
- Do keep booking selection local and free of personal data.
- Do preserve visible focus, native fields and written selection feedback.

### Don't:

- Don't apply Lune's palette to the Nortivo corporate pages.
- Don't imply that demonstration confirmation reserves a real table.
- Don't introduce invented customer evidence or remove image provenance.
