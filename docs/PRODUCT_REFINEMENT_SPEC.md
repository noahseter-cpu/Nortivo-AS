> Historical brief: the subsequent user-supplied terminal image supersedes its palette, panel shape and desktop-density instructions for Terminal Pro. See TERMINAL_REFERENCE_RESTORATION.md. All behavioral safeguards remain applicable.

Act as a senior product designer and frontend engineer. Inspect the existing Nortivo project, then implement a complete visual and UX refinement of its trading platform so that it clearly belongs to the same company as the main website.

**Brand reference:** https://nortivo.no/en/
**Primary application:** https://nortivo.no/en/terminal/
**Related portfolio workspace:** https://nortivo.no/en/portfolio/

The homepage is the approved visual reference. I want its precise black-and-ivory identity translated into an efficient, professional trading application. Carry the redesign through the entire existing product: screens, navigation, charts, tables, forms, dialogs, account entry, portfolio, connection states, and responsive layouts.

This is a design and usability refinement of the existing application. Preserve its working functionality and architecture. Implement the improvements in the actual project; do not stop at recommendations or a static mockup.

## 1. Inspect the current implementation

Read the project instructions and identify the actual framework, routing, terminal components, shared styles, chart library, account flows, and state management before editing. Inspect the live homepage and application again because their content may have changed.

Current public-review findings to investigate:

- The homepage uses near-black backgrounds, warm ivory text, Manrope typography, sharp rectangular framing, thin neutral borders, and ivory primary buttons.
- The terminal adds green-tinted surfaces, mint actions, green navigation selections, rounded cards, and a glowing chip illustration.
- The terminal and portfolio headers use an additional slashed icon that is not present in the homepage header.
- Overview, Trading bots, Research, News, and Reports are repeated in the top navigation and the sidebar.
- Six account-summary cards persist across secondary screens, taking space away from the task being viewed.
- In the public read-only demo, Trade, Trading bots, Strategies, Research, and Analytics reuse the same engine, signal, and risk panels under different headings. The chart’s AI analysis action also leads to that generic Research view.
- The global search placeholder mentions symbols, news, and insights, while the inspected dialog is an instrument search. Verify what search actually supports.
- Account and integration dialogs expose implementation-oriented language, such as “server-confirmed payment” and repeated configuration diagnostics.
- The homepage uses a static terminal preview that should reflect the finished application.

These observations come from the public desktop experience. They do not establish how signed-in or paid screens work. Inspect those through the source code and an authorized test account/session where available; state any remaining access limits honestly.

## 2. Use one Nortivo design system

Create or consolidate shared semantic tokens rather than applying isolated colour overrides to individual cards. Base the terminal on the homepage’s rendered styles, not an unused legacy theme variable.

**Observed homepage starting values:**

| Role | Starting value |
|---|---|
| Main background | `#08090B` |
| Primary text | `#F2F1ED` |
| Neutral panel/section surface | `#111318` |
| Neutral section border | `#30343C` |
| Positive report value | `#78B99A` |
| Main typeface | Manrope |
| Financial report numerals | IBM Plex Mono |

Verify these against the current implementation. Derive complementary raised surfaces, muted text, separators, hover states, and focus colours from this system. Give each token a clear role and apply it consistently to both Terminal Pro and Portfolio.

The visual character should be precise, confident, restrained, and engineered. Use neutral black and charcoal surfaces with warm ivory hierarchy. Keep the working interface visually quiet around the market information.

Use the same current Nortivo wordmark asset and proportions as the homepage. Remove the terminal-only legacy badge unless it is part of the shared canonical brand. Do not introduce another logo or independently redesign the brand.

Use mostly square panel geometry, with small corner radii where they help controls feel usable. A practical direction is 0–4px for major panels and 4–6px for controls; validate against the homepage. Keep compact rounded status badges only where their shape has a useful purpose.

Use Manrope for interface text and headings, with tabular numerals for prices and financial tables. Reuse IBM Plex Mono where appropriate for compact numerical data. Keep large marketing typography on the marketing site; use a clear, compact heading scale inside the application. Aim for readable 13–14px primary desktop interface text and 12px or larger secondary metadata, increasing sizes where necessary.

Use a consistent spacing scale, such as 4, 8, 12, 16, 24, and 32px. Align panel edges, headings, controls, and table columns precisely.

## 3. Separate brand colour from financial meaning

Use ivory primary buttons with dark text for ordinary primary actions. Use restrained outlined or neutral secondary controls. Selected navigation and timeframe controls should use a neutral active surface, clear typography, and a thin ivory indicator.

Remove decorative green fills from generic navigation, icons, input focus, panel backgrounds, and ordinary buttons. Keep green where it communicates an actual gain or positive state. Preserve clear red for losses, sell-side meaning where applicable, errors, and meaningful risk conditions. Preserve amber for warnings and unavailable conditions that require attention.

Keep colour reinforced by labels, signs, icons, or other cues. Zero P&L should look neutral. Unavailable values should remain unavailable, not become zero. Distinct chart series must remain distinguishable.

Preserve the meaning, period, currency, and calculation of every metric. In particular, do not relabel the company’s **“Avg. session return on deployed capital”** as a daily return or as a user’s own return. Do not remove or recolour genuine negative results to improve appearances.

## 4. Simplify the application shell

Make the sidebar the primary navigation for the existing workspaces. Keep every useful destination reachable, including Overview, Markets/Trade, Trading bots, Strategies, Research, News, Calendar, Analytics, Reports, and Settings. Choose a coherent grouping based on the actual product.

Use the top bar for Nortivo identity, workspace/product switching, search, connection status, and account access. Remove redundant full navigation from that bar. Keep workspace naming consistent: distinguish Portfolio and Terminal Pro clearly instead of changing terminology between entry and application views.

Create one compact, persistent context area for the current environment and data state. Make read-only sample, paper trading, and real-money operation distinguishable wherever the existing product supports them. Data mode and execution mode are separate concepts; show both when relevant. Preserve the real gating and confirmation behaviour.

Keep the account overview useful on Overview. On News, Calendar, Research, Reports, and settings-oriented screens, reduce it to relevant context or a compact summary instead of repeating six large KPI cards everywhere.

Give each screen a clear title, a concise description only when useful, and its own relevant actions. Avoid stacked headers, repeated explanations, and large unused bands above the actual task.

## 5. Refine Overview and market tools

Preserve the useful watchlist–chart–context arrangement. Make the instrument and chart the dominant working area, with a compact watchlist and subordinate news/calendar context.

Improve:

- Watchlist row alignment, selected states, price formatting, and positive/negative change readability.
- Instrument name, symbol, currency, exchange, and data freshness where those fields exist.
- Timeframe buttons, indicator controls, chart expansion, zoom, and reset.
- Chart background, grid, axes, volume, legends, crosshair, tooltips, and the accessible data-table alternative.
- The relationship between the selected instrument, its news, signals, and AI/research context.

Keep chart gridlines subdued and labels readable. Avoid decorative backgrounds or imagery behind market data. Preserve candle colours and clear indicator distinctions. Preserve the selected instrument, timeframe, zoom, and other existing chart state through normal navigation and UI updates.

Make quick actions open the relevant screen or panel while retaining instrument context. Explain unavailable actions at the point of use. Do not route different tools into an unrelated generic panel.

Make search copy describe its real scope. If only instrument search is implemented, label it accordingly. Preserve existing search, keyboard, and selection behaviour; do not advertise unsupported global search categories.

## 6. Give every existing workspace a purposeful layout

### Trade

Refine the existing order-entry, account, position, and order-review interface where available. Keep side, order type, quantity, currency, estimated amount, fees, and execution environment clear. Maintain validation, review, and confirmation. A visual change must not submit an order or activate anything.

### Trading bots

Organize the existing strategy, operating state, data readiness, rule evidence, risk checks, and recent activity into a legible operational view. Replace the glowing chip illustration with compact monochrome status information that helps explain the engine. Make configuration, enable, pause, and stop controls visually distinct according to their actual behaviour.

### Strategies

Present the strategy list, details, parameters, rules, and existing evaluation tools in a clear hierarchy. Preserve all configuration and saving behaviour. Avoid presenting the bot overview again with only the heading changed.

### Research and AI

Provide a focused reading workspace for existing instrument research, signal evidence, and explanations. Keep the instrument, time horizon, timestamp, sources, and limits visible where available. Separate supplied facts from generated interpretation.

Long explanations need readable line lengths, headings, and progressive disclosure. Preserve request, loading, retry, and unavailable states. In read-only demo mode, explain the limitation in this context rather than implying an AI analysis has been performed.

### News

Use a clean feed with a clear headline/source/time hierarchy and instrument relevance where supported. Retain existing filters and article actions. Use the available width intentionally; avoid stretching short items into empty, full-width slabs. Keep fictional examples labelled as samples.

### Economic calendar

Use a consistent table or grouped list with time, time zone, country/currency, event, and available event fields. Use restrained impact indicators when the source provides them. Distinguish scheduled, released, unavailable, and fictional data correctly. Preserve existing filters and behaviour.

### Analytics

Give existing account performance, allocation, exposure, or trade analytics an appropriate layout. Use only metrics and history actually available. When there is insufficient history, provide a useful empty state instead of an invented curve or the generic engine panel.

### Reports

Clearly separate **“Your account”** records from **“Nortivo company report.”** Preserve company history in NOK and the user/sample ledger in its own currency. Keep the company report discoverable with a refined evidence panel and a clear route to its methodology. Never present the company result as the customer’s result.

For every section, use the current components and data capabilities. Where access or functionality is unavailable, show a section-specific explanation and the genuine next action. Do not invent new backend features or fake populated screens just to fill the layout.

## 7. Include the Portfolio product

Apply the same header, colours, typography, controls, and panel system to `/en/portfolio/` and its existing localized equivalent.

Refine the existing holdings, transactions, cash, allocation, performance, and add/edit workflows. Make manual entry obvious and distinguish it from broker synchronization. Keep decimal quantities, instrument currency, display currency, manual valuations, and validation clear.

Existing holdings without purchase history must not acquire fabricated dates or historical performance through the redesign. Use the actual available data and explain missing history through the interface.

Improve portfolio onboarding and empty states with a clear first action and short explanation. Remove duplicated calls to action where they compete. Keep Portfolio and Terminal Pro visually equal in quality; their available tools can differ according to the existing subscription rules.

## 8. Finish account, connection, and overlay screens

Restyle account entry, sign-in, registration, verification, recovery, account menus, settings, plan selection, billing states, upgrade prompts, notifications, tooltips, dialogs, and drawers. Inventory the actual screens in the project and include all of them in the same system.

The terminal entry screen should visually connect to the homepage: strong but compact typography, neutral framing, an ivory primary action, and a clear secondary demo route. Preserve the distinction between free registration and paid product access.

Replace implementation-oriented customer copy with plain language. For example, explain when a subscription starts without making “server-confirmed payment” part of the primary user-facing message. Keep necessary technical diagnostics in an appropriate secondary detail view.

For connection readiness, show the capability, its actual status, the relevant limitation, and the action the user can take. Separate subscription eligibility, provider availability, and account authorization. **An upgrade must not be presented as solving an unavailable or unverified provider connection.** Keep detailed troubleshooting accessible where appropriate.

Preserve current plan names, prices, billing intervals, entitlements, and backend checks. This redesign must not alter subscriptions or capability gates.

Use consistent modal widths, labelled fields, clear error messages, appropriate scrolling, and a predictable close action. Keep keyboard focus visible and contained appropriately, support Escape where expected, and return focus to the triggering control.

## 9. Add precise, restrained motion

Improve the feel of the application with brief, coherent interaction feedback:

- Hover and focus transitions around 120–160ms.
- Menu, tab, and drawer transitions around 160–220ms.
- Subtle opacity changes and very small positional movement where useful.
- Clear button pressed, pending, success, and error feedback tied to real state.
- Stable skeletons and content dimensions while data loads.

Respect reduced-motion preferences. Avoid constant pulsing, sweeping highlights, decorative chart animation, bouncing panels, delayed input, or animations that shift prices and controls. Financial values should not count up from invented intermediate numbers.

## 10. Make the system work at every size

Design for wide desktop workspaces, ordinary laptops, tablets, and phones. At narrower widths, use a clear hierarchy: current market context and the active task first, supporting panels in reachable tabs or drawers where appropriate.

Keep the chart usable, navigation reachable, and important actions visible. Use deliberate horizontal scrolling for wide data tables instead of clipping columns or shrinking text excessively. Dialogs must fit the viewport and remain usable with an on-screen keyboard. Keep touch targets comfortable and all important functions keyboard-accessible.

Check focus states, labels, contrast, selected states, disabled states, and reading order. Do not rely on colour alone. Preserve the existing accessible chart data and keyboard guidance.

Apply the shared components to both English and Norwegian, allowing for different text lengths. Use the existing locale and formatting utilities consistently for currency, decimals, dates, and time zones.

## 11. Implement cleanly and preserve behaviour

Work within the existing stack. Reuse and improve shared primitives such as Panel, Button, Input, Tabs, Badge, Table, Dialog, Drawer, EmptyState, and DataStatus where they exist. Avoid a blanket CSS override pile, conflicting theme variables, or page-by-page hard-coded replacements.

Preserve authentication, APIs, provider adapters, routing, persisted user data, calculations, subscription rules, broker connections, and execution safeguards. Fix presentation or navigation defects in their proper components without rewriting unrelated systems.

Do not weaken access controls, simulate successful provider connections, or replace real data with generated figures. Keep the public demo read-only. Validate order-related interactions in an authorized test/paper environment; do not place real trades, connect accounts, or start automation as part of design testing.

After the actual application is polished, refresh the homepage’s static terminal preview with a real capture of the implemented interface if that image is still outdated. Keep the homepage’s overall layout, report content, and brand direction intact. The preview should accurately show the product and its data mode.

## 12. Verify and deliver the finished refinement

Implement across the full component and screen inventory, then inspect the rendered result. Check representative desktop widths around 1280 and 1440px, tablet around 768px, and phones around 390px. Check narrower layouts when content requires it.

Run the existing build, lint, and relevant tests. Verify the workflows affected by the work: navigation, symbol selection, timeframe changes, chart expansion/data view, search, research context, news/calendar, account dialogs, manual portfolio forms, plan-locked states, and connection status. Use existing safe test states for actions that modify data. Add targeted regression tests only where a substantive behaviour fix needs them.

**Acceptance criteria:**

- Moving from the homepage to the application feels like entering another part of the same Nortivo product.
- Terminal Pro, Portfolio, account screens, and overlays use one coherent design system.
- Green/red/amber communicate financial or operational meaning, rather than decorating the interface.
- Navigation has clear roles and all existing destinations remain reachable.
- Secondary screens have relevant layouts or honest section-specific unavailable states.
- Charts and tables remain readable, responsive, and functional.
- Data meaning, permissions, prices, and existing user records remain unchanged.
- The company report remains distinct from personal account performance.
- Reduced motion, keyboard use, focus, and small screens are checked.
- The homepage preview accurately reflects the redesigned terminal.

Finish with a concise summary of what changed, the meaningful checks completed, and before/after desktop and mobile captures. Identify any account-protected or provider-dependent states you could not verify. Follow the project’s existing release process and accurately distinguish implemented, tested, and deployed work.

**The finished result should feel unmistakably Nortivo: the homepage’s precise black-and-ivory identity, adapted into a capable, calm, and cohesive investment workspace.**
