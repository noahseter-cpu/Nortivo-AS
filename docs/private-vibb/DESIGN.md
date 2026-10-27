---
name: Private Vibb app and code
description: A scoped extension of the warm Vibb focus desk for trying the app beside literal source.
colors:
  primary: "#235a54"
  paper: "#f1f0e9"
  surface: "#fffef9"
  ink: "#202e32"
  muted: "#58676a"
  line: "#d9ddd3"
  nav: "#202f34"
  nav-text: "#d0dbd8"
  accent: "#d1ed8b"
  code: "#213437"
  code-text: "#f2f4e9"
  code-muted: "#b8c9c4"
  code-selected: "#3b5554"
  field-border: "#72877a"
  field-surface: "#fffefb"
  focus: "#718e36"
typography:
  title:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "16px"
  label:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 700
  source:
    fontFamily: "Consolas, 'Courier New', monospace"
    fontSize: "15px"
    lineHeight: "27px"
rounded:
  control: "8px"
  pane: "10px"
spacing:
  page-inline: "28px"
  pane-gap: "26px"
  compact-inline: "18px"
components:
  selected-view:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  source-reader:
    backgroundColor: "{colors.code}"
    textColor: "{colors.code-text}"
    rounded: "{rounded.pane}"
  input:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: Private Vibb app and code

## Overview

This ordinary extension preserves the existing Vibb **warm study folio inside an ink frame**, documented in the sibling course's `output/vibb-kurs/interaktiv/DESIGN.md`. It is an authenticated learning tool with its own visual authority. The public Nortivo design system and sidecar remain unchanged.

The source of truth for this extension is `scripts/private-vibb-ui/workspace.css` and `course-preview.css`, with their HTML/JavaScript. The embedded app retains its catalog's existing UI; the workspace does not restyle its five moods. [Implementation and evidence](../PRIVATE_VIBB_APP.md) records the local SHIP verdict and deployment boundary.

## Colors

Teal marks actions and the selected workspace mode. Warm paper supports pale reading surfaces; dark navigation and the distinct code field organize the screen. Citron identifies the Vibb wordmark and text selection. Field borders and the green focus outline remain visible on pale surfaces. Source matching uses a separate marked-line background with written result feedback.

**The Scoped Identity Rule.** These tokens belong to Vibb learning surfaces. Keep them out of Nortivo's public normative palette.

## Typography

Reuse the course's self-hosted Manrope and licence. Workspace branding is 25px/800, the page title uses the frontmatter title role (18px at ≤900px), pane titles are 18px and body introduction is 16px (15px at ≤640px). Controls are 13–14px; metadata is 12px. Literal code stays 15px/27px with 12px line numbers and local scrolling.

**The Literal Source Rule.** Keep source read-only, numbered and visually separate from explanatory copy and the running app.

## Layout

The header and page use 28px horizontal padding, reducing to 18px at ≤900px. Main content caps at 1800px. Two equal `minmax(0,1fr)` panes use a 26px gap (18px at ≤900px). They remain adjacent at the verified 706px user width and stack at ≤640px. Explicit App and code / App only / Code only controls expose selected state through `aria-pressed`.

The app frame has a 480px minimum height and the code reader a 310px minimum height; code overflow stays in its reader. The course companion reserves 440px on the right at ≥1240px; below that it appears in document flow. App and AI companions do not open together. The course's existing navigation and source layout adapt to the reserved space.

## Elevation & Depth

Flat tonal fields and thin dividers group the work. This extension introduces no shadows or raised-card vocabulary.

## Shapes

Controls use 8px corners; code and app frames use 10px. The course companion retains its flat 10px inset panel, becoming an edge-aligned panel without rounding in the wide dock.

## Components

**Controls.** View buttons have 42px minimum height and fields/search 43px. Selected view and Find use teal with pale text. Pointer hover uses a slight brightness change; header links retain readable citron hover. Focus uses a 3px outline and 3px offset. Native select, search input, labelled buttons, skip link and status text retain their semantics.

**Source and app.** The reader displays escaped catalog text, basic syntax colors and one marked search line. Page-file actions explicitly load the corresponding app route. Frames have written loading/failure feedback and descriptive titles; separate-tab links use `noopener`.

**Course companion.** The toggle exposes `aria-expanded`; the close control restores focus. The app loads on first opening. No new animation or motion token is introduced; course motion remains governed by the incumbent Vibb system.

## Do's and Don'ts

- Do preserve the warm reading surface, distinct dark source pane and local code overflow.
- Do keep practice-copy labels, separate storage and written status feedback.
- Do retain the source's exact content and explicitly acknowledge the three hosting adaptations.
- Don't imply the source pane edits the app or changes the school submission.
- Don't promote this tool's palette or pane composition into public Nortivo rules.
