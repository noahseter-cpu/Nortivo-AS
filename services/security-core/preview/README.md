# KORVNT local presentation reference

KORVNT is a daughter company of Nortivo. The website introduces five service areas and the underlying Nortivo KORVNT framework. The canonical destination prepared for later release is korvnt.no. The Nortivo parent website retains separate localized pages about the relationship and actual application integrations.

Run `node services/security-core/scripts/preview.mjs` for the isolated static reference. The default address is http://127.0.0.1:4486/. It serves the English and Norwegian presentation, original KORVNT emblem, architectural hero asset, supplied Nortivo endorsement symbol and a browser-local reporting draft. The input screen here links to the combined local review for persistent service enquiries. Run `node scripts/build-public-pages.mjs` after editing the public-page generators to synchronize the output.

Use http://korvnt.localhost:4490/nb/ or /en/ on the combined preview server for persisted enquiries, private tracking and KORVNT-scoped customer conversations. Authorized staff use the separate KORVNT queue on Nortivo’s private company-hosted admin surface. The report-draft tool is a separate, browser-only text download. It handles common redaction patterns and requires the visitor to check the resulting text. It has no live report destination, alert delivery or response promise.

The review has no production DNS, hosting, email or publication effects. See the [domain and access plan](../../../docs/master-upgrade/KORVNT_DOMAIN.md).

