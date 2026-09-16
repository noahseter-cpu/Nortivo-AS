---
name: Nortivo
description: Quiet personal workspace for money, food and activity.
colors:
  background: "#faf9f6"
  paper: "#ffffff"
  ink: "#252e2a"
  muted: "#68716d"
  line: "#e5e8e2"
  accent: "#b74b31"
  accent-hover: "#9e3f29"
  navigation: "#242d2a"
  positive: "#477552"
  negative: "#aa402b"
typography:
  headline:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "34px"
    fontWeight: 700
    letterSpacing: "-0.035em"
  body:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
rounded:
  field: "7px"
  control: "8px"
  panel: "14px"
  dialog: "16px"
spacing:
  inline: "12px"
  phone-gutter: "20px"
  panel-padding: "26px"
  desktop-gutter: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
---

## Overview

Quiet personal workspace. Cream canvas, compact dark navigation and warm terracotta actions establish the implemented direction. Noah rejected the initial three mockups and requested direct implementation; this is an extracted system, not an approved image reference.

Daily logging is immediate and concrete. Financial summaries keep their monthly context. Empty states expose the next useful action without fabricated records.

## Colors

Terracotta marks primary actions and current navigation. Ink and muted text give hierarchy on paper and cream. Positive and negative colors supplement readable signed amounts. Activity uses restrained peach and blue icon backgrounds.

## Typography

Self-hosted Manrope regular, semibold and bold with Segoe UI fallback. Headlines become 30px below 1100px. Section titles are 18px; common controls 12–13px. Monetary and daily values use tabular numerals. Main phone navigation and date labels are 11px; small ancillary labels vary.

## Layout

Navigation is 216px on desktop, 188px at intermediate widths, then a 74px icon rail and named bottom navigation on phones. Main content has a 1340px maximum with desktop and phone gutter tokens. Phone overview puts the selected day first. Lists replace dense tables. Budget is an integrated subsection separated by a rule.

## Elevation & Depth

Panels stay flat with a thin divider border. Dialog shadow is 0 20px 90px #17241f30. Nesting tinted rounded cards inside larger cards is avoided.

## Shapes

Use panel and control radii from the tokens. Inputs have their own smaller radius. Navigation is 9px; phone sheet corners are 18px at the top. Round icon fields are sparse semantic accents.

## Components

Existing Button, Sidebar, Dialog and Tabs primitives are composed in the implementation. Labels stay visible. Dialogs become phone sheets. Inputs have a 3px #b9593b focus outline offset by 3px. Primary buttons press to scale(.98) in 120ms; colors transition in 160ms. Progress and dialog entry transition in 200ms with cubic-bezier(.23,1,.32,1). Closing is immediate. Reduced-motion and keyboard-origin overlays skip motion. Exact values update after successful persistence without count-up effects.

## Do's and Don'ts

- Do keep selected dates and money contexts explicit.
- Do distinguish recorded zero from missing data.
- Do keep repeated logging actions easy to reach on phones.
- Don't invent user history or arbitrary targets.
- Don't add decorative entrance sequences or count-up effects.
- Don't use a rejected mockup as an approved reference.

## Profile setup and Android

The profile uses the incumbent palette and typography, a two-step form with editable inputs and an explicit optional target checkbox. Fields are 48px high. Phone layout stacks at 780px; native safe-area padding preserves Android system bars. Steps switch instantly and focus the heading; existing button feedback remains. No new decorative animation system was introduced.

## Nortivo themes and dialogs (0.3.0)

Nortivo is the product brand. Personal profile names are retained. Light mode keeps the original cream/terracotta system; dark mode uses canvas #171c19, paper #222925, text #edf0e9, muted #b1bdb5, separators #414d45 and warm accent #eeaa89 with dark action text #30231c. Semantics cover inputs, dialogs, empty states, feedback, activity, navigation and Android system-bar contrast. System appearance is the migrated default; explicit Light/Dark persists.

Dialog positioning belongs only to the visible-viewport flex container. Do not reintroduce translated centering utilities on its content. Small screens use a bottom sheet, desktop a centered panel; both scroll internally and remain within keyboard-reduced height. The popup entry uses opacity only.
