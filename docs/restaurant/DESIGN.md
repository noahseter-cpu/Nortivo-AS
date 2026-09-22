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
    fontFamily: "Gloock, Georgia, serif"
    fontSize: "clamp(3.5rem, 7.4vw, 6rem)"
    fontWeight: 400
    lineHeight: 1.03
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Gloock, Georgia, serif"
    fontSize: "clamp(2.5rem, 4.6vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.025em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.125rem"
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
    fontSize: ".875rem"
    fontWeight: 700
    lineHeight: 1.65
rounded:
  control: "2px"
  workspace: "2px"
spacing:
  label-gap: "10px"
  field-column-gap: "20px"
  field-row-gap: "26px"
  workspace-padding: "36px"
  section-mobile: "64px"
  section-desktop: "112px"
components:
  booking-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "15px 24px"
  enquiry-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "15px 24px"
  category:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "10px 12px"
  category-selected:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "10px 12px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  navigation:
    backgroundColor: "{colors.invitation}"
    textColor: "{colors.ink}"
  booking-workspace:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.workspace}"
    padding: "36px"
---

# Design System: Lune restaurant demonstration

## Overview

**Creative North Star: "Contemporary bistro dining journal"**

Lune pairs cool invitation paper and deep blue-green ink with Gloock’s expressive serif and precise Manrope controls. An asymmetric invitation, un-darkened interior photograph and offset circular food detail introduce a spacious menu folio and an ink booking chapter.

This scoped system records the implementation in `dist/assets/restaurant.css`, shared `site.css`, restaurant HTML and `restaurant.js` on 22 September 2026. The [editorial direction](../LUNE_EDITORIAL.md) supplies its descriptive language. It applies only to the fictional restaurant demonstration; corporate Nortivo documentation remains separate.

**Key Characteristics:**

- Gloock invitation, section headings and lowercase wordmark; Manrope body and controls.
- Light asymmetric hero with an offset circular food detail.
- Open menu folio, tabular prices and underlined category selection.
- Full-width ink booking chapter with a paper form workspace.
- Persistent fictional-demo disclosure and local-only table selection.

## Colors

### Primary

Ink anchors text, primary actions, selected times and the full-width booking chapter. Butter remains the sticky demo-banner return-link accent. Invitation fills the header, hero, bistro section and closing enquiry section.

### Neutral

Paper supports the menu, FAQ and booking workspace; white distinguishes native fields. Muted carries secondary copy, line divides menu rows and selection summaries, and soft-surface highlights the synthetic confirmation notice. Focus and field-line define focus rings and input boundaries. Error accompanies written validation feedback. The booking introduction uses a lighter ink-compatible text tone (`#ccdadc`).

**The Separate World Rule.** Lune tokens apply only to the restaurant demonstration; Nortivo retains its incumbent navy and blue system.

## Typography

**Display Font:** Gloock, Georgia, serif.
**Body Font:** Manrope, sans-serif.

Gloock regular (400) is self-hosted at `/assets/fonts/gloock-regular.ttf` with `font-display: swap`; shared `site.css` supplies local Manrope regular and bold. See [font licences](../THIRD_PARTY_FONTS.md). Gloock serves the invitation, section headings, wordmark and menu-feature heading. Dish names, form labels, prices and confirmation titles remain Manrope. The lowercase wordmark is 3.6rem, reducing to 3rem on mobile, with ink punctuation.

The invitation measures at most 19ch; section headings at most 16ch. Paragraphs use 1.75 line height and at most 56ch; the hero introduction is 31ch, widening to 38ch on mobile. Prices use bold tabular numerals. Menu-feature display is 2.4rem, reducing to 1.75rem on mobile; FAQ and closing headings have local size overrides.

## Layout

The content width is `min(1240px, calc(100% - 96px))`. The light hero places its full-width heading above a `.85fr 1.8fr` copy/image grid with a 64px column gap. The interior image is 450px high; the circular food detail sits near the lower left, clear of the actions. The menu pairs a sticky food illustration (top 88px) with a single-column folio in `.8fr 1.2fr` columns separated by 90px. Section introductions use `1.2fr 1fr`; bistro, booking and FAQ use `1fr 1.1fr`, with 80px gaps. Booking spans the viewport with content-aligned inner padding. Anchor targets reserve 80px above them for the sticky disclosure.

At 1000px, gutters become 28px and major gaps tighten to 40px (32px in the hero). At 720px, gutters become 20px; hero, menu, visit, booking, FAQ and closing content stack. Navigation wraps into its own visible row. The invitation becomes `clamp(3.4rem,12vw,4.7rem)` at 12ch; the room image is 330px high and the offset food detail 120px across. The non-sticky menu feature becomes an image/text pair. Booking workspace padding steps from 36px to 28px and then 24px 20px. Its field grid is `1.2fr 1fr`, with time spanning both columns. Below 359px, fields and menu feature stack, invitation size becomes 3.2rem, and room image height becomes 280px.

## Elevation & Depth

Tonal chapters, photographic overlap and thin dividers provide depth without shadows or glass. Hero imagery stays un-darkened; its small caption has an ink backing. The circular detail has an invitation-coloured rim. The sticky disclosure is a functional layer (z-index 10).

## Shapes

Buttons, fields, time labels and the booking workspace use restrained control corners. Categories use underlines rather than filled chips. Most photographs remain rectangular: room hero crops at center 58% (58% center on mobile), menu food at 62% center in a 4:5 frame (3:4 mobile, 4:3 narrow), and bistro interior at center 70% in 5:4 (4:3 mobile). The circular hero food detail crops at 67% center.

## Components

### Buttons

Hero booking, form submission and closing enquiry use ink with white text and a 52px minimum height. Fine-pointer hover changes fill to `#2b4c53`. Focus uses a 3px outline with 4px offset. Pointer press scales to .98; background feedback takes 160ms ease and press feedback takes 120ms with `cubic-bezier(.23,1,.32,1)`. Keyboard input removes transitions. Text actions are underlined and unfilled.

### Chips

Category controls are transparent, with 44px minimum height and a 2px bottom border. Active categories use ink text, bold weight, an ink underline and `aria-pressed`; others use muted text and a transparent underline. Hover changes text to ink. Filtering updates the written count and empty state immediately.

### Inputs / Fields

White native date and guest controls use persistent bold ink labels, field-line boundaries and 48px minimum height. Times are required native radios in a labelled fieldset; selected labels use ink fill, and keyboard focus outlines the visible label. Written status messages accompany invalid selection and closed days. A live summary reflects date, time and guest choices. The form contains no personal-information fields.

Confirmation exists only in memory and receives focus; reset returns focus to date. Reservation code sends no requests and writes no storage. Shared language preference remains separate from reservation state. The paper workspace sits within the full-width ink booking chapter.

### FAQ

Native details/summary disclosures retain markers and keyboard behavior. Three entries explain fictional booking, menu filters and the absence of saved reservation data. Opening needs no custom animation.

### Navigation

Always-visible anchor navigation sits beside the serif wordmark and language choices. Links are bold (.875rem), becoming .8rem at 720px and .72rem at 359px. Hover underlines them. Selected language is underlined and uses `aria-pressed`. The demo notice and return link stay above the header.

### Motion and imagery

The title, invitation block and circular detail settle over 600ms with 0/60/120ms delays, from 12px translation and opacity .8. The room image settles from scale 1.035 to 1 over 1000ms. Time-label pointer presses scale to .98 over 120ms; keyboard input removes transitions. Menu filtering is immediate. Pointer confirmation uses cancellable WAAPI for 220ms from opacity .7/translateY(8px), after state and focus update. Keyboard and reduced motion skip confirmation animation; reset and reduced-motion changes cancel it. Reduced motion removes CSS settlement, transitions and press transforms.

Keep AI illustration captions and alternate text; the repeated circular detail is decorative and hidden from accessibility APIs. Food provenance is [lune-table.webp.json](../../dist/assets/lune-table.webp.json), with its [authoring prompt](../LUNE_IMAGE_PROMPT.txt); interior provenance and prompt are in [lune-interior.webp.json](../../dist/assets/lune-interior.webp.json). No real restaurant, client relationship, availability, allergen assurance or booking is implied.

The independent finish review returned SHIP within eight section viewport captures, with no material fixes requested; this is not user aesthetic approval. [Editorial verification](../LUNE_EDITORIAL_VERIFICATION.md) records the 63 passing tests, desktop/mobile/narrow viewport scope, interaction checks and limitations. Netlify publication is blocked by exhausted deployment credits; production remains fe4bb0a. This revision is not verified live, and no real-device or assistive-technology audit is claimed.

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
