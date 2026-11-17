---
name: Nortivo
description: "An obsidian technology-studio identity with industrial display typography and practical software interfaces."
colors:
  ink: "#050505"
  surface: "#101114"
  surface-raised: "#181a1f"
  chart-surface: "#141820"
  paper: "#f1f2f4"
  white: "#ffffff"
  muted: "#b3b7bf"
  line: "#35383e"
  control-line: "#747b87"
  accent: "#d4dfed"
  button-paper: "#e8edf5"
  field-label: "#e1e6ef"
  field-error: "#ffb5bf"
typography:
  display:
    fontFamily: "'Barlow Condensed', sans-serif"
    fontSize: "clamp(5rem, 10vw, 11rem)"
    fontWeight: 600
    lineHeight: .91
    letterSpacing: "-.025em"
  headline:
    fontFamily: "'Barlow Condensed', sans-serif"
    fontSize: "clamp(2.7rem, 5.8vw, 6.4rem)"
    fontWeight: 600
    lineHeight: .99
    letterSpacing: "-.02em"
  interior-display:
    fontFamily: "'Barlow Condensed', sans-serif"
    fontSize: "clamp(3.2rem, 6.2vw, 7rem)"
    fontWeight: 600
    lineHeight: .98
    letterSpacing: "-.025em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.035em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  navigation:
    fontFamily: "Manrope, sans-serif"
    fontSize: ".77rem"
    fontWeight: 700
    letterSpacing: ".06em"
  action:
    fontFamily: "Manrope, sans-serif"
    fontSize: ".78rem"
    fontWeight: 700
    letterSpacing: ".07em"
rounded:
  square: "0"
  action: "2px"
  field: "3px"
  workspace: "5px"
spacing:
  compact: "12px"
  text: "16px"
  inset: "18px"
  gutter-mobile: "20px"
  row: "24px"
  group: "28px"
  section: "46px"
components:
  button-primary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "14px 23px"
    height: "52px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.square}"
    padding: "14px 23px"
    height: "52px"
  form-button:
    backgroundColor: "{colors.button-paper}"
    textColor: "{colors.surface}"
    rounded: "{rounded.action}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.paper}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  site-navigation:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  support-workspace:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.paper}"
    rounded: "{rounded.workspace}"
  support-tab-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
---

# Design System: Nortivo

## Overview

**Creative North Star: "The Future, Engineered."**

Nortivo's current local implementation uses an architectural black environment, condensed display lettering and silver controls. Original imagery gives the public studio presentation scale. Manrope, restrained dividers and explicit feedback keep product, contact and support areas readable.

The system was extracted from the implemented website on 17 November 2026. The authoritative extension is dist/assets/nortivo-engineered.css. Earlier stylesheets remain inside the named nt-legacy cascade layer, preserving their layout and interaction foundations beneath the current visual rules. This document supersedes the older navy, blue-action and warm editorial public palettes.

**Key Characteristics:**

- Obsidian and charcoal surfaces with occasional soft-white sections.
- Self-hosted Barlow Condensed display text and Manrope interface text.
- Asymmetric compositions, large real project previews and ruled service rows.
- Flat operational workspaces, persistent field labels and readable status text.
- Optional motion around marketing imagery and explicit control feedback.
- Equivalent Norwegian Bokmål and English routes.

The company name, founder attribution, Arc wordmark, real empty-test screenshots, fictional Lune status, private workspace boundaries and existing support contracts carry forward. Lune retains its own [restaurant design](docs/restaurant/DESIGN.md). The authenticated Vibb learning tool retains its [scoped design](docs/private-vibb/DESIGN.md).

The current build runs locally. Its [implementation record](docs/ENGINEERED_STUDIO_2026_11_17.md) carries validation and publication limits. Earlier design and release decisions remain in repository history and the linked release documents.

## Colors

The frontmatter records the reused public palette. Secondary colors separate content and controls without competing with imagery.

### Primary

- **Silver accent** identifies links, focus, selected support tabs and selected simulation prices.
- **Soft white** supplies primary text on dark surfaces and the solid public action fill.
- **Button paper** supplies the shared form action fill.

### Neutral

- **Obsidian** is the page and header surface.
- **Charcoal** separates workspaces and large secondary sections.
- **Elevated charcoal** provides restrained panel and selected-state contrast.
- **Chart charcoal** separates the technical price diagram.
- **Silver text** carries supporting paragraphs and helper text.
- **Structural line** separates sections, navigation and rows.
- **Control line** gives fields a visible boundary.
- **Field label** remains legible above inputs.
- **Field error** accompanies written validation feedback.

The white service and closing sections reverse the foreground relationship. The historical report chart keeps its existing light plot background and dark labels.

Color accompanies explicit labels, selected attributes and written messages. It does not supply the only explanation of status or failure.

## Typography

**Display Font:** Barlow Condensed SemiBold, with sans-serif fallback.

**Body and Interface Font:** Manrope Regular and Bold, with sans-serif fallback.

Both families are served locally with font-display swap. Sources and licence notes are in [THIRD_PARTY_FONTS.md](docs/THIRD_PARTY_FONTS.md).

### Hierarchy

- **Display** supplies the large two-line homepage heading. Its contextual clamps become clamp(5rem,11vw,8rem) at 1100px, clamp(4.6rem,13vw,7.5rem) at 880px, and clamp(4.2rem,17vw,6rem) at 600px.
- **Headline** supplies uppercase public section headings. At 600px the homepage section clamp becomes clamp(2.7rem,10vw,3.8rem).
- **Interior display** supplies the supported service, company and utility mastheads. Working tools retain a practical Manrope hierarchy.
- **Title** supplies content headings and operational sections.
- **Body** supplies prose with the inherited 65ch maximum. Particular introductions use a shorter measure and larger contextual type.
- **Navigation** and **action** use bold, letterspaced labels. Uppercase treatment belongs to these controls rather than to body copy.
- Numerical information retains tabular numerals where the existing tool and report components define them.

The footer wordmark uses Barlow Condensed at clamp(4rem,18vw,18rem), becoming 22vw on narrow screens. It is a home link. Preserve the complete supplied Arc wordmark and the actual screenshot's own interface typography.

## Layout

The desktop public content container reaches 1440px with 56px side gutters. The header and footer wordmark reach 1560px with 48px gutters. At 1100px the primary content gutters become 32px. At 600px they become 20px, while the header uses 18px.

The desktop header has a 90px minimum height. At 880px it becomes 76px and exchanges desktop links for a menu button. On the homepage the header is fixed over the hero. An IntersectionObserver changes its surface to nearly opaque obsidian once the hero leaves the header region. In-page sections account for it with a 90px scroll margin.

Layouts follow the content. The introduction uses a 1.45-to-1 split. Service rows align a heading, description and directional icon. Project previews alternate image and copy with a 1.7-to-1 relationship on desktop. The five-stage process uses five columns, then three at 880px, then a vertical sequence at 600px.

The extension uses breakpoints at 1100px, 880px and 600px. Functional surfaces retain their additional responsive rules inside the legacy layer. Form fields, tables and tool controls preserve semantic source order.

## Elevation & Depth

Depth comes from the original metallic hero image, tonal surfaces, thin boundaries and negative space. The extension establishes no shadow vocabulary. Local overlays protect text against imagery.

Operational panels use a visible border and restrained corners. The design does not require decorative glass, glows or floating shadows.

The generated hero is a pre-rendered image delivered as a 143,331-byte JPEG. There is no real-time 3D scene or added 3D runtime.

## Shapes

Marketing actions use square corners. Shared form actions use the small action radius, fields use the field radius, and support/admin panels use the workspace radius.

Open sections and lists rely on straight rules. Product status labels retain written test/development information. The original Arc wordmark and Lune identity remain scoped to their products.

## Components

### Buttons and text actions

Public actions have a 52px minimum height, compact uppercase labels and visible boundaries. The solid public variant uses soft white with obsidian text. The closing section reverses this relationship.

Fine-pointer hover changes the public button fill to white. Press feedback scales it to .98 over 120ms with the shared ease-out curve. Transitions name background, color and transform. Reduced motion removes transitions and movement.

Text actions have a 44px minimum height and a bottom rule. Service-detail actions use an unfilled underline with 8px vertical padding. Directional icons use a consistent stroked SVG.

### Inputs and feedback

Fields use charcoal, light text, a visible control line and a small radius. Labels remain above their inputs. The shared focus treatment is a two-pixel silver outline with five-pixel offset.

Contact and support preserve existing validation, honeypot, disabled/loading state, draft retention and saved-result feedback. Field errors have written messages and a dedicated light error color.

### Navigation and language

The shared public navigation links Work, Services, About, Support and Contact. Work targets the homepage project section. Trading tools remain directly reachable from the footer and project area.

The language control displays NO and EN with the current choice underlined and exposed through aria-pressed. The existing language script updates text and local links.

The mobile menu preserves aria-expanded, source-order navigation and Escape/focus recovery. Pointer toggles retain the existing interruptible 180ms opacity/translation feedback. Keyboard changes remain immediate.

### Support workspace and tabs

Support uses a charcoal bounded workspace. Selected tabs use silver with dark text. Inactive tabs use the elevated surface and light labels. Existing tab roles, linked panels and keyboard selection remain the behavioural contract.

Administration uses the practical interface hierarchy and preserved authentication controls. Public hero choreography does not run inside its operational workspace.

### Project previews

Arc uses the actual private-test screenshot inside a dark matte with its development/private-test status. Lune uses the existing illustration with an explicit fictional demonstration description.

Fine-pointer hover scales preview imagery to 1.018 over 260ms. Service arrows translate by three pixels. Reduced motion removes both effects.

### Marketing motion

The desktop heading enters over 850ms from an already-visible .6 opacity, a 16px translation and a small clipping inset. The hero image settles from a 1.035 scale over 1800ms. These sequences apply only at 900px and above with motion enabled.

Where CSS view timelines are supported, the introduction heading moves up 12px from .7 opacity, project imagery reveals a five-percent bottom clip while moving up 12px, and the footer wordmark moves up 14px from .7 opacity. Nested frames rotate from -12 to 12 degrees through their visible range. Process divider colors progress from the structural line to silver on entry. Unsupported browsers keep the static composition.

The extension's reduced-motion rule disables animations, transitions and smooth scrolling. Required content stays available independently of motion.

### Trading examples and reports

Decision Replay, the rule simulator and the backtest retain their calculations, data sources and written context. The simulator's selected price uses silver with dark text. The report retains the source PDF and light chart treatment.

The private Vibb project remains governed by its authenticated route and separate visual system.

## Do's and Don'ts

### Do:

- Do use the current black, charcoal, silver and soft-white palette on Nortivo company surfaces.
- Do reserve condensed uppercase display type for the public presentation hierarchy.
- Do use Manrope for practical interfaces, labels, form content and data explanations.
- Do preserve bilingual navigation, visible focus, label associations and written states.
- Do preserve supplied product assets, actual screenshots and clear demonstration status.
- Do preserve existing functional contracts while extending their visual treatment.
- Do keep generated-image provenance and font licence records with the project.

### Don'ts:

- Don't present earlier navy, blue-action or warm editorial tokens as the current public system.
- Don't invent company achievements, customer evidence, product availability or connected services.
- Don't conceal required content behind animation completion.
- Don't add scroll hijacking, excessive glow, rainbow gradients or unnecessary 3D dependencies.
- Don't use color as the only indicator of a state or financial result.
- Don't apply public cinematic motion to authentication or support tasks.
