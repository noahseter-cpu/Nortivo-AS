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
    fontSize: "clamp(3.8rem, 6.5vw, 6rem)"
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
    fontSize: "1.16rem"
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
    fontSize: ".9rem"
    fontWeight: 700
    lineHeight: 1.65
rounded:
  control: "3px"
  workspace: "8px"
spacing:
  label-gap: "8px"
  field-column-gap: "20px"
  field-row-gap: "24px"
  workspace-padding: "36px"
  section-mobile: "56px"
  section-desktop: "100px"
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
    padding: "10px 14px"
  category-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
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
    padding: "36px"
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

Ink anchors the form action, selected categories, selected times and text. Butter distinguishes the hero booking and closing Nortivo enquiry buttons; the demo-banner return link also uses it.

### Neutral

Invitation fills the header and bistro section. Paper supports reading and hero text; white isolates the booking workspace. Muted carries secondary descriptions, line divides dishes, and soft-surface separates the confirmation notice. Focus and field-line define keyboard focus and input boundaries. Error accompanies written validation feedback.

**The Separate World Rule.** Lune tokens apply only to the restaurant demonstration; Nortivo retains its incumbent navy and blue system.

## Typography

**Display Font:** Manrope, sans-serif fallback.
**Body Font:** Manrope, sans-serif fallback.

Shared `site.css` supplies locally served regular (400) and bold (700), with `font-display: swap`. See [font licences](../THIRD_PARTY_FONTS.md). Display is the invitation heading; headline is the base section-title role, amplified to `clamp(2.5rem,4.5vw,4rem)` for menu, bistro and booking; title defines dish names; label identifies booking fields. Body measure is 56ch, with the hero introduction restricted to 36ch (31ch on mobile). Prices use bold tabular numerals. The wordmark is bold lowercase text (3.7rem), with a contrasting blue punctuation mark; mobile reduces it to 3rem.

## Layout

The main content width is `min(1160px, calc(100% - 80px))`. The full-photo hero is at least 680px high; its protected reading area uses `min(1280px, calc(100% - 80px))`. The menu pairs a sticky food illustration with a single-column folio in `.75fr 1.25fr` columns with a 64px gap. Section introductions use `1.2fr 1fr`; booking and FAQ use `1fr 1.2fr` with a 70px gap. The demo banner stays sticky above ordinary anchor navigation; anchor sections reserve 72px scroll margin.

At 1000px, content gutters become 28px, hero gutters 32px and major gaps tighten. At 720px, gutters become 20px, menu/visit/booking/FAQ stack, and navigation wraps into its own visible row. The hero remains photographic with a 600px minimum height and `clamp(3.4rem,12vw,4.6rem)` display at a 10ch measure. The menu feature becomes a non-sticky image/text pair. Menu and booking use section-mobile spacing; workspace padding becomes 24px 20px (28px at 1000px). At 359px, hero minimum height becomes 620px, the menu feature stacks with a 4:3 image, and booking fields become one column. Otherwise the field grid is `1.25fr 1fr`, with time spanning both columns.

## Elevation & Depth

No box shadows or glass effects are introduced. Tonal fields, thin dividers and imagery provide depth. The hero protects its reading area with a dark ink gradient from .96 opacity through .82 at 32% to .1 at 76%; mobile uses a uniform .78 overlay. Its caption uses solid ink. The sticky disclosure is a functional layer (z-index 10).

## Shapes

Controls use the control radius; the booking workspace uses the workspace radius. Menu entries remain open rows separated by a single line. Images have square corners: hero crops at `center 56%` (`65% center` on mobile), food at `60% center` in a 4:5 frame, and the bistro detail at `center 70%` in a 16:9 frame. No decorative card system is introduced.

## Components

### Buttons

The full-width form action is dark with white text; hero booking and closing enquiry use butter. Actions have a 52px minimum height. Fine-pointer hover changes dark fill to `#2b4c53`; butter hover uses `#e4c369`. Focus is a 3px outline with 4px offset. Pointer press scales to .98; background feedback takes 160ms ease and press feedback takes 120ms with the shared `cubic-bezier(.23,1,.32,1)` curve. Underlined text actions remain unfilled.

### Chips

Category controls have 44px minimum height, line borders and transparent resting fill. `aria-pressed` and the selected ink fill identify the active category. Fine-pointer hover uses soft-surface. Filtering updates the written count and empty state immediately, without animation.

### Inputs / Fields

Native date and guest select controls use persistent bold labels, paper fill, field-line boundaries and 48px minimum height. Times are native required radios inside a labelled fieldset: visible labels wrap, selected times use ink fill, and keyboard focus outlines the visible label. Written status messages accompany invalid selection and closed days; a live summary reflects valid date/time/guest selections. The form contains no personal-information fields. Confirmation is synthetic, held only in memory, and receives focus; reset returns focus to date. Reservation code sends no requests and writes no storage. The shared language preference is separate from reservation state.

### FAQ

Native details/summary disclosures retain their markers and keyboard behavior. Three entries explain fictional booking, menu filters and the absence of saved reservation data. Opening disclosures needs no custom animation.

### Navigation

Always-visible short anchor navigation sits beside the wordmark and language choices. Links are bold (.9rem), becoming .85rem at 720px and .78rem at 359px. Hover underlines links. The selected language is underlined and uses `aria-pressed`. The demo notice and return link stay visible above the header.

### Motion and imagery

The invitation title, introduction and actions use the shared visible-from-start hero settlement: 600ms, staggered 0/60/120ms, from 12px translation and opacity .8. The hero image settles from scale 1.035 to 1 over 1000ms. Pointer category/time presses scale to .97 over 120ms; keyboard input removes their transitions. Menu filtering is immediate. Occasional pointer confirmation uses cancellable WAAPI for 220ms from opacity .7/translateY(8px), after state and focus update. Keyboard and reduced motion skip confirmation animation; reset and reduced-motion changes cancel it. Reduced motion also removes CSS animations, transitions and press transforms.

Keep the AI illustration captions and alternate text. Food provenance is [lune-table.webp.json](../../dist/assets/lune-table.webp.json), with its [authoring prompt](../LUNE_IMAGE_PROMPT.txt); interior provenance and exact prompt are in [lune-interior.webp.json](../../dist/assets/lune-interior.webp.json). No real restaurant, client relationship, availability, allergen assurance or booking is implied. Current review and tested scope are recorded in [LUNE_REFINEMENT.md](../LUNE_REFINEMENT.md); [SPLIT_DEMO_VERIFICATION.md](../SPLIT_DEMO_VERIFICATION.md) retains earlier history. This extraction adds no hardware or assistive-technology test claim.

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
