---
name: Nortivo
description: "An architectural investment-technology identity with Manrope typography, titanium imagery, exact report data and readable operational interfaces."
colors:
  ink: "#08090b"
  surface: "#111318"
  surface-raised: "#181b21"
  chart-surface: "#141820"
  paper: "#f2f1ed"
  white: "#ffffff"
  muted: "#b5b8c0"
  line: "#30343c"
  control-line: "#747b87"
  accent: "#c6cad1"
  button-paper: "#e8edf5"
  field-label: "#e1e6ef"
  field-error: "#ffb5bf"
  financial-positive: "#78b99a"
  financial-negative: "#dc8c91"
  action-hover: "#c6cad1"
  field-focus: "#c6cad1"
  terminal-bg: "#08090b"
  terminal-panel: "#111318"
  terminal-raised: "#181b21"
  terminal-line: "#30343c"
  terminal-text: "#f2f1ed"
  terminal-muted: "#b5b8c0"
  terminal-green: "#78b99a"
  terminal-green-soft: "#78b99a"
  terminal-negative: "#e59ca2"
  terminal-caution: "#e8c76a"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(4.75rem, 6.2vw, 5.9rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-.04em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(2.4rem, 4.1vw, 3.8rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-.04em"
  interior-display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(2.6rem, 5.5vw, 4.9rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-.04em"
  financial:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "clamp(1.5rem, 2.25vw, 2.2rem)"
    fontWeight: 400
    lineHeight: 1.35
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
    fontSize: ".78rem"
    fontWeight: 700
    letterSpacing: ".01em"
  action:
    fontFamily: "Manrope, sans-serif"
    fontSize: ".78rem"
    fontWeight: 700
    letterSpacing: ".015em"
  application-heading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
  application-section:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.4
  application-metric:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "23px"
    fontWeight: 400
    lineHeight: 1.25
  terminal-body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  terminal-metadata:
    fontFamily: "Manrope, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  terminal-mono:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  square: "0"
  action: "2px"
  field: "3px"
  workspace: "5px"
  terminal-control: "5px"
  terminal-panel: "9px"
  terminal-pill: "20px"
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
    padding: "14px 19px"
    height: "52px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.square}"
    padding: "14px 19px"
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
  action-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.surface}"
  terminal-primary-control:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.terminal-bg}"
    rounded: "{rounded.terminal-control}"
    padding: "5px 10px"
  terminal-panel:
    backgroundColor: "{colors.terminal-panel}"
    textColor: "{colors.terminal-text}"
    rounded: "{rounded.terminal-panel}"
---

# Design System: Nortivo

## Overview

**Creative North Star: "The Future, Engineered."**

Nortivo's current local implementation retains the architectural black environment, titanium imagery and silver controls. The master refinement gives the investment-company narrative and historical report a shared opening composition. Manrope now carries the complete public display and interface hierarchy; IBM Plex Mono separates financial quantities from their explanations.

The system was extracted from the implemented website on 17 November 2026. The base extension is dist/assets/nortivo-engineered.css. The incremental financial presentation and interaction layer is dist/assets/investment-v2.css, with its behaviour in investment-v2.js. Earlier stylesheets remain inside the named nt-legacy cascade layer, preserving their layout and interaction foundations beneath the current visual rules. The master refinement updates that layer and adds the publication-specific dist/report-2026/report.css. This document supersedes earlier public palettes and condensed display rules; their assets remain in repository history.

**Key Characteristics:**

- Obsidian and charcoal surfaces with occasional soft-white sections.
- Self-hosted Manrope display and interface text, with IBM Plex Mono financial figures.
- Asymmetric publication compositions, shared evidence and ruled editorial chapters.
- Flat operational workspaces, persistent field labels and readable status text.
- Optional coordinated entrances, source-chart reveals and stationary control feedback.
- Equivalent Norwegian Bokmål and English routes.

The company name, founder attribution, Arc wordmark, real empty-test screenshots, fictional Lune status, private workspace boundaries and existing support contracts carry forward. Lune retains its own [restaurant design](docs/restaurant/DESIGN.md). The authenticated Vibb learning tool retains its [scoped design](docs/private-vibb/DESIGN.md).

The current build runs locally. Its [master refinement record](docs/MASTER_REFINEMENT_2026_11_17.md) carries the current local checkpoint and publication limits. The earlier [implementation record](docs/ENGINEERED_STUDIO_2026_11_17.md) preserves prior passes. Earlier design and release decisions remain in repository history and the linked release documents.

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
- **Financial positive** and **financial negative** distinguish reported positive figures and drawdowns alongside their written labels and numerical signs.
- **Action hover** supplies the restrained filled hover surface.
- **Field focus** strengthens the visible focus treatment.

The light guide chapter reverses the foreground relationship. The historical report chart keeps its existing light plot background and dark labels.

Color accompanies explicit labels, selected attributes and written messages. It does not supply the only explanation of status or failure.

## Typography

**Display Font:** Manrope Bold, with sans-serif fallback.

**Body and Interface Font:** Manrope Regular and Bold, with sans-serif fallback.

**Financial Font:** IBM Plex Mono Regular, with monospace fallback.

The two active public families are served locally with font-display swap. Barlow Condensed assets remain for historical compatibility and are no longer the public display voice. Sources and licence notes are in [THIRD_PARTY_FONTS.md](docs/THIRD_PARTY_FONTS.md).

### Hierarchy

- **Display** supplies the company homepage heading. It becomes clamp(3.5rem,6.2vw,4.75rem) at 1150px, clamp(3.4rem,9vw,4.8rem) at 900px and clamp(2.3rem,12vw,3rem) with 1.06 line-height at 600px. Short desktop viewports use a smaller 5.3rem cap.
- **Headline** supplies the editorial section hierarchy. At 600px it becomes clamp(2rem,8.6vw,2.8rem) with 1.13 line-height. The full report uses its own Manrope publication ramp and uppercase chapter headings.
- **Interior display** supplies the supported service, company and utility mastheads. Working tools retain a practical Manrope hierarchy.
- **Title** supplies content headings and operational sections.
- **Body** supplies prose with the inherited 65ch maximum. Particular introductions use a shorter measure and larger contextual type.
- **Navigation** and **action** use bold, letterspaced labels. Uppercase treatment belongs to these controls rather than to body copy.
- **Financial** supplies report P&L, selected summary values, chart readouts and dates. IBM Plex Mono uses tabular numerals. Text labels continue to use Manrope.
- The user explicitly prescribed the single investment-technology hero eyebrow. Its small uppercase identity line is scoped to that hero and does not establish a general section-label pattern.

The footer wordmark uses Manrope Bold at clamp(2rem,14.5vw,15rem) with -.04em tracking. It is a home link. Preserve the complete supplied Arc wordmark and the actual screenshot's own interface typography.

## Layout

The desktop public content container reaches 1440px with 56px side gutters. The header and footer wordmark reach 1560px with 48px gutters. At 1100px the primary content gutters become 32px. At 600px they become 20px, while the header uses 18px.

The desktop header has a 90px minimum height. At 880px it becomes 76px and exchanges desktop links for a menu button. On the homepage the header is fixed over the hero and defaults to an opaque near-black surface. Enhancement permits transparency only at the top of the page with the mobile menu closed. More than eight pixels of scrolling immediately restores the fully opaque surface, including deep links and browser-history restoration. Background changes do not fade, preventing content from briefly showing through the navigation. In-page sections account for it with a 90px scroll margin.

The retained cinematic layout vocabulary follows the content. Its original introduction uses a 1.45-to-1 split. Service rows align a heading, description and directional icon. Project previews alternate image and copy with a 1.7-to-1 relationship on desktop. The five-stage process uses five columns, then three at 880px, then a vertical sequence at 600px.

The base extension uses breakpoints at 1100px, 880px and 600px. The V2 hero adds 1150px and 900px layout adjustments and a short-desktop-height treatment. Its desktop grid places the introduction beside the report, with seven-to-five columns and a minimum 390px report pane (350px below 1150px). At 900px the hero becomes a single column with a 680px maximum. The report follows the introduction in normal mobile reading order. Functional surfaces retain their additional responsive rules inside the legacy layer. Form fields, tables and tool controls preserve semantic source order.

At enlarged text sizes, actions, summary metrics, process stages and footer links reflow through rem-based auto-fit columns with zero-minimum grid children. The monthly chart uses an 18rem container threshold to move its value onto a separate line. The footer wordmark can shrink to its two-rem minimum. These rules preserve source order and readable content rather than forcing a desktop row at 200% text.

The footer shell explicitly allocates one fraction to company identity and 1.6 fractions to navigation, rather than relying on the navigation's intrinsic width. Its three groups therefore form three deliberate desktop columns. At 900px the shell becomes one column; the navigation's rem-based minimum then governs its own reflow.

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

The action layer uses a restrained left-to-right inner wipe, a clipped label that moves up one pixel and a stroked arrow that moves right three pixels. Wipe, label and arrow feedback use 240ms; a 140ms press scales only the inner face to .98. Text links receive a thin sweeping underline. The hit target remains stable.

There is no cursor attraction or magnetic translation. Hover movement is limited to fine pointers. Keyboard input removes label, arrow and inner-face transforms; reduced motion removes these transitions and the decorative wipe.

Text actions have a 44px minimum height and a bottom rule. Service-detail actions use an unfilled underline with 8px vertical padding. Directional icons use a consistent stroked SVG.

### Inputs and feedback

Fields use charcoal, light text, a visible control line and a small radius. Labels remain above their inputs. The shared focus treatment is a two-pixel silver outline with five-pixel offset.

Contact and support preserve existing validation, honeypot, disabled/loading state, draft retention and saved-result feedback. Field errors have written messages and a dedicated light error color.

### Navigation and language

The shared header prioritizes actual research, systems, guides and company destinations, with a distinct Trading report action and the language choice. Support remains discoverable through utilities; secondary tools and Arc/Lune projects retain their existing routes.

The language control displays NO and EN with the current choice underlined and exposed through aria-pressed. The existing language script updates text and local links.

The mobile menu preserves aria-expanded, source-order navigation and Escape/focus recovery. Its interruptible 220ms opening/closing transition works with modal dialog semantics, focus trapping, background inertness and scroll lock. Closing restores the prior inert/dialog attributes, scroll position and appropriate focus. Keyboard and reduced-motion changes remain immediate.

### Support workspace and tabs

Support uses a charcoal bounded workspace. Selected tabs use silver with dark text. Inactive tabs use the elevated surface and light labels. Existing tab roles, linked panels and keyboard selection remain the behavioural contract.

Administration uses the practical interface hierarchy and preserved authentication controls. Public hero choreography does not run inside its operational workspace.

### Project previews

Arc uses the actual private-test screenshot inside a dark matte with its development/private-test status. Lune uses the existing illustration with an explicit fictional demonstration description.

Fine-pointer hover scales preview imagery to 1.018 over 260ms. Service arrows translate by three pixels. Reduced motion removes both effects.

### Marketing motion

The homepage introduction, report cover and source-equity line form one coordinated 700ms family. The introduction starts already visible at .7 opacity, moves up 12px and removes a two-percent bottom clip. The report moves up 8px from .75 opacity with a 70ms offset. The curve reveals a clip over 700ms after a 100ms offset; its values do not change. The titanium image remains static.

Selected editorial groups enter once over 520ms, using .7 opacity, a small bottom clip and 12px or 16px vertical travel. IntersectionObserver starts the group when it enters view and then unobserves it. A keydown cancels active entrance animations. The page remains readable without Web Animations or IntersectionObserver; reduced motion and saveData skip the enhanced entrances. SaveData also explicitly keeps inherited footer and structural animations static. No-JavaScript content is complete. Underlying retained project pages may keep their scoped preview feedback; the master homepage does not inherit their older hero choreography.

The extension reduced-motion rule disables animations, transitions and smooth scrolling. Required content stays available independently of motion.

### Trading examples and reports

Decision Replay, the rule simulator and the backtest retain their calculations, data sources and written context. The simulator's selected price uses silver with dark text. The dedicated report retains the original PDF and existing plot treatment.

The homepage now renders the reported 2026 account history as an SVG generated from all 222 source equity points. A summary JSON holds exact NOK integer minor units and the reporting definitions. Build-time validation reconciles profit, closing equity, period, sessions, return on opening equity and maximum drawdown before presentation. This validates agreement among supplied records, without asserting an external audit.

The compact hero shows profit after costs, return on opening equity and average session return on deployed capital alongside the 222-point source curve. The visible average basis and full risk/methodology link remain next to these values; maximum drawdown and losing periods remain in the full report. Pointer tracking and a labelled keyboard range inspect actual source rows, using UTC dates and localized NOK values. Exact values never count up. The following evidence chapter derives eleven monthly closing-equity changes from the same source using integer minor units, including both losing months. Those changes are explicitly distinct from the supplied monthly trading P&L; the full report retains the supplied P&L and explains its two offsetting one-øre differences.

The dedicated report is a complete publication with table of contents, account/deployed-capital definitions, historical risk, attributed costs, original PDF and source links, keyboard chart exploration and a native expandable 222-row table. On narrow screens the plot and data tables use labelled horizontal scroll regions instead of shrinking labels. The chart, report metrics and historical context remain visible when enhanced loading or motion is unavailable. The report remains described as reported historical results, with future returns allowed to differ.

V2 navigation can use native cross-document view transitions where supported. The outgoing and incoming opacity transitions take 100ms and 180ms. Reduced motion removes them. Navigation and product interactions retain their ordinary fallbacks.

The private Vibb project remains governed by its authenticated route and separate visual system.

### Product applications — approved layout, Nortivo brand colours

The latest owner clarification preserves the compact trading-platform design from `trading-platform-1920.jpg` and changes only its colours to match Nortivo. The earlier all-green terminal and the earlier square, spacious application treatment are historical references, not the current combined direction.

Keep the existing 160px rail, 66px header, compact KPI strip, 490px desktop market region, four lower panels, 9px panel radii, 5px controls and all current spacing, typography and responsive rules. Preserve the logo mark, instrument tiles, engine graphic, chart proportions and interaction behaviour. This is a palette refinement, not a new composition.

Use the homepage's near-black #08090b, charcoal #111318/#181b21, warm ivory #f2f1ed, muted #b5b8c0 and neutral #30343c rules. Primary actions use ivory on black; selected navigation, timeframes and instrument tiles use neutral silver/charcoal. Existing images receive a CSS grayscale treatment without changing their assets or geometry. Subtle panel depth remains neutral.

Green #78b99a and the existing readable red remain for actual gains, losses and operational states. Zero stays neutral and unknown values stay unavailable. The breadth ring represents real advancing share, not a decorative brand accent. Indicator series retain distinct ivory/slate/amber roles. No financial values, labels, periods, currencies or calculations change.

Preserve all existing workspaces, product switching, account entry, read-only sample restrictions, provider/plan distinctions, chart viewport and indicators, accessible data tables, keyboard focus and reduced-motion handling. Portfolio and the public website layout remain unchanged. Refresh the homepage's static preview from the completed real application.

## Do's and Don'ts

### Do:

- Do use the current black, charcoal, silver and soft-white palette on Nortivo company surfaces.
- Do use the current Manrope display ramp and preserve the titanium architectural imagery.
- Do use Manrope for practical interfaces, labels, form content and data explanations.
- Do use IBM Plex Mono for financial figures and preserve exact report definitions.
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
- Don't turn the prescribed hero eyebrow into a default for unrelated sections.
- Don't present reported historical results or simulated examples as audited, live or guaranteed outcomes.
- Don't apply public cinematic motion to authentication or support tasks.

## Selected public surfaces — 19 November 2026

The owner's selected Invest, KORVNT and specification images in `design-references/approved-master-20261118/` govern these surfaces. This is a scoped public-surface update; the compact terminal's existing palette, density, geometry and typography remain protected. The exact supplied ivory circular Nortivo PNG replaces only its parent-brand symbol.

Invest uses Manrope bold sans-serif, a four-line editorial display, neutral black/charcoal/ivory, restrained titanium planes, a substantial unmodified terminal reference and broad service rows. The obsolete serif hero is not part of this selected direction. The request page uses a 66px desktop mast, ivory specification sheet and charcoal brief/support sidebar at approximately 62/38. Practical extra integration/risk fields remain real; desktop pairing and compact row spacing keep the workflow usable. Mobile fields stack.

KORVNT uses its existing emblem/name as the primary identity, with a restrained Nortivo endorsement. Its architectural aperture, ivory CONTROL BY DESIGN., visible development state, ivory five-service index and dark needs section follow the selected composition. The phone crop protects text contrast. The parent Nortivo security pages retain their own introduction and integration content.

Scoped surface ramps and border/field/focus tones are defined in `assets/invest/public.css` and `assets/security-core/styles.css`; their functional focus colors and measured display sizes are intentional additions to the older global ramp. A three-pixel active-step underline on a flat, square step button follows the selected workspace; it is not an accent border on a rounded card. The mechanical detector completed and reported older-ramp advisories, which do not override the selected image authority. No unrelated design-system sidecar repair was performed.

These pages use project-bound background-only raster assets, semantic HTML controls and the existing standard icon system. Motion is restrained, content is visible by default, and no-preference transitions opt out for reduced motion. Source, screenshots, comparison states and remaining physical-device/assistive-technology checks are recorded in `design-qa.md` and `docs/master-upgrade/BROWSER_REVIEW_V2.md`.
