# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Prospective customers evaluating Nortivo’s web, app and digital design work.
- Customers who need to create or follow a support ticket.
- Nortivo’s administrator, who reviews, answers and closes support tickets.

## Product Purpose

Nortivo presents the company’s digital product work and provides a direct support workflow. Success means visitors quickly understand what Nortivo builds, while customers can create and follow tickets and the administrator can answer them.

## Positioning

Nortivo builds focused digital products and also develops Arc, a personal progress product. The site should feel considered and product-led rather than like a generic agency template.

## Capabilities and Constraints

- Static website deployed through Netlify from the `dist` directory.
- Netlify Functions provide ticket creation, lookup, authentication, administration and email replies.
- Supabase stores tickets and replies; Resend handles email delivery.
- Existing `/`, `/support/` and `/admin/` routes and all form IDs/API contracts must remain stable.
- The public site currently uses English copy.

## Brand Commitments

- Company and product name: Nortivo.
- Founder credit: Noah J.C. Sæter.
- Arc is presented as a Nortivo product in development.
- Voice: direct, calm and confident; avoid inflated claims.

## Evidence on Hand

- Working support and administration flows in this repository.
- No testimonials, customer logos, case studies or performance claims are supplied; the site must not fabricate them.

## Product Principles

1. Make the purpose obvious before adding atmosphere.
2. Keep support direct and easy to recover.
3. Use real product facts instead of generic agency claims.
4. Preserve existing service contracts and routes during visual changes.

## Accessibility & Inclusion

Keyboard focus, readable contrast, responsive reflow and reduced-motion behavior are required across public and administration surfaces.
