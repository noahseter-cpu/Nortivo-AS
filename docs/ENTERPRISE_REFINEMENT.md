# Product-led website refinement — 22 September 2026

The user accepted the preceding enterprise-buyer design audit and requested implementation, with ongoing permission to publish the website on Netlify. This is a code-led refinement of the existing navy identity, not a new visual world or image approval round.

## Surface brief

Mode: Persuade, with Experience in the two project demonstrations. A prospective customer should understand Nortivo's work, explore Arc first, try the visibly fictional Lune website, and find the project contact form without mistaking it for product support.

The hero now gives less space to decorative 3D artwork and more to the practical offer. Arc precedes Lune in source and visual order. A website-only, explicitly labelled budget explanation demonstrates one manual expense and its effect; it is not a screenshot or a claim about the app interface. The original real, empty-test app screenshots remain on Products at a larger reading size. No invented customer evidence, download availability or integrations.

Related surfaces: home, products, about and contact in nb/en; shared desktop navigation gains Contact. About leads with inspectable work and retains the supplied professional history below. Contact explains the enquiry process without a response-time promise. Form identifiers, backend, authentication and customer data are unchanged.

Responsive composition: two-column sections stack on smaller screens, text and language controls remain readable. Existing motion tokens and reduced-motion behavior remain. Budget numbers update immediately for reading and keyboard use; no counter animation or delay gates the result.

## Checks

- 60 Node tests pass, including two new tests for the isolated example: exact integer-øre calculation, repeat-click guard, reset and no network/storage dependencies.
- Browser captures: `.impeccable/review/enterprise-fix/`, desktop 1440×1000, mobile 390×844, narrow 320×740, intermediate 1024×900; viewport captures, not full-page screenshots.
- Mouse and Enter produce 2,050 NOK spent and 2,950 NOK remaining; reset restores the baseline. Mobile menu opens and Escape closes it. Checked nb/en and no horizontal overflow at measured sizes.
- Detector returned five cramped-padding warnings on section wrappers. The inner `.wrap` containers and `.section`/`.home-product` padding provide the insets; captured views confirm these are not flush text boundaries.
- Real devices, assistive technology and new production email delivery are not retested in this visual-only update. Existing support integration tests remain passing.

Independent review returned **SHIP** after checking all 11 evidence captures, with no material findings. Publication remains pending.
