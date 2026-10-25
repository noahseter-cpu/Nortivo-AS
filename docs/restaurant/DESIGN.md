---
name: Lune restaurant demonstration
description: "Light paper, deep blue-green ink and a compact blue about section for a fictional bistro."
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
    fontSize: "clamp(3.4rem, 5.5vw, 5rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(2rem, 3.2vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
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
  section-mobile: "44px"
  section-desktop: "72px"
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
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  booking-workspace:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.workspace}"
    padding: "36px"
---

# Design System: Lune restaurant demonstration

## Overview

**Creative North Star: "A clear, contemporary neighbourhood bistro"**

Lune pairs light paper and deep blue-green ink with Manrope headings and controls, retaining Gloock in the lowercase wordmark. A concise introduction sits beside a single interior image, followed by a tighter menu, a compact blue about-and-hours section and the established ink booking chapter.

This scoped system records the 25 October 2026 refinement in `dist/assets/restaurant.css` and restaurant HTML, with shared `site.css` and existing `restaurant.js` behavior. It supersedes the earlier layout and typography descriptions in the [editorial direction](../LUNE_EDITORIAL.md). It applies only to the fictional restaurant demonstration; corporate Nortivo documentation remains separate. Publication and live verification are not established by this document.

**Key Characteristics:**

- Gloock lowercase wordmark; Manrope headings, body and controls.
- Paper hero with title and copy on the left and one rectangular room image on the right.
- Tighter menu, shorter descriptive copy, tabular prices and underlined category selection.
- Compact blue about-and-hours section without a repeated interior image or circular food detail.
- Full-width ink booking chapter with a paper form workspace.
- Persistent fictional-demo disclosure and local-only table selection.

## Colors

The blue about/opening-hours section uses ink for all paragraph text; muted on this blue measured below the normal-text contrast threshold and was corrected during the October finish review.

### Primary

Ink anchors text, primary actions, selected times and the full-width booking chapter. Butter remains the sticky demo-banner return-link accent. Invitation blue fills the compact bistro section; the header, hero and closing enquiry use paper.

### Neutral

Paper supports the menu, FAQ and booking workspace; white distinguishes native fields. Muted carries secondary copy, line divides menu rows and selection summaries, and soft-surface highlights the synthetic confirmation notice. Focus and field-line define focus rings and input boundaries. Error accompanies written validation feedback. The booking introduction uses a lighter ink-compatible text tone (`#ccdadc`).

**The Separate World Rule.** Lune tokens apply only to the restaurant demonstration; Nortivo retains its incumbent navy and blue system.

## Typography

**Display and Heading Font:** Manrope, sans-serif. **Wordmark:** Gloock, Georgia, serif.
**Body Font:** Manrope, sans-serif.

Gloock regular (400) is self-hosted at `/assets/fonts/gloock-regular.ttf` with `font-display: swap`; shared `site.css` supplies local Manrope regular and bold. See [font licences](../THIRD_PARTY_FONTS.md). Gloock serves only the lowercase wordmark, at 3rem and 2.7rem on mobile, with ink punctuation. The main invitation, section headings, menu-feature heading, dish names, form labels, prices and confirmation titles use Manrope.

The invitation measures at most 12ch and reaches 5rem; section headings reach 3rem at at most 19ch. Paragraphs use 1.75 line height and at most 56ch; the hero introduction is 40ch, widening to 42ch on mobile. Prices use bold tabular numerals. The menu-feature heading is 1.25rem, reducing to 1.1rem on mobile; FAQ and closing headings have local size overrides.

## Layout

The content width is `min(1240px, calc(100% - 96px))`. The paper hero uses `1fr 1.1fr` columns with a 72px gap: title and copy/actions occupy the left column, and a 520px-high room image spans both rows on the right. The menu pairs a sticky food illustration (top 88px) with a single-column list in `.7fr 1.3fr` columns separated by 72px; its top/bottom padding is 72px/88px. Menu introductions use a flex row. The blue about section uses `1.2fr 1fr` columns, a 96px gap and 64px vertical padding, with opening hours beside the copy. Booking and FAQ retain `1fr 1.1fr` columns and 80px gaps. Booking spans the viewport with content-aligned inner padding. Anchor targets reserve 80px above them for the sticky disclosure.

At 1000px, gutters become 28px, major gaps tighten to 40px and the room image is 480px high. At 720px, gutters become 20px; hero, menu, visit, booking, FAQ and closing content stack. Navigation wraps into its own visible row. The invitation becomes `clamp(2.75rem,10vw,3.7rem)` at 14ch; the room image is 300px high. Section headings become 2.1rem. The non-sticky menu feature becomes an image/text pair with a square image. Menu padding becomes 44px/56px and about padding becomes 44px. Booking workspace padding remains 36px, then 28px, then 24px 20px; its field grid remains `1.2fr 1fr`, with time spanning both columns. Below 359px, fields and menu feature stack, invitation size becomes 2.75rem, and room image height becomes 260px.

## Elevation & Depth

Paper, blue and ink sections and thin dividers provide depth without shadows or glass. Hero imagery stays un-darkened, with a muted caption beneath it on paper. The sticky disclosure is a functional layer (z-index 10).

## Shapes

Buttons, fields, time labels and the booking workspace use restrained control corners. Categories use underlines rather than filled chips. The two images are rectangular: the room hero crops at 61% center (58% center on mobile), and menu food at 62% center in a 4:5 frame (square on mobile, 4:3 narrow). The circular food detail and repeated bistro interior have been removed.

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

Always-visible anchor navigation sits beside the serif wordmark and language choices on paper. Links are bold (.875rem), becoming .8rem at 720px and .75rem at 359px. Hover underlines them. Selected language is underlined and uses `aria-pressed`. The demo notice and return link stay above the header.

### Motion and imagery

The title and invitation block settle over 600ms with 0/60ms delays, from 12px translation and opacity .8. The room image settles from scale 1.035 to 1 over 1000ms. Time-label pointer presses scale to .98 over 120ms; keyboard input removes transitions. Menu filtering is immediate. Pointer confirmation uses cancellable WAAPI for 220ms from opacity .7/translateY(8px), after state and focus update. Keyboard and reduced motion skip confirmation animation; reset and reduced-motion changes cancel it. Reduced motion removes CSS settlement, transitions and press transforms.

Keep AI illustration captions and alternate text for the single room image and menu food image. Food provenance is [lune-table.webp.json](../../dist/assets/lune-table.webp.json), with its [authoring prompt](../LUNE_IMAGE_PROMPT.txt); interior provenance and prompt are in [lune-interior.webp.json](../../dist/assets/lune-interior.webp.json). No real restaurant, client relationship, availability, allergen assurance or booking is implied.

[Editorial verification](../LUNE_EDITORIAL_VERIFICATION.md) records the earlier September review and test scope; it is historical evidence, not verification of this October refinement. Booking behavior is unchanged in this pass. Current QA and publication status must be confirmed separately; this document makes no live, real-device or assistive-technology verification claim.

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
