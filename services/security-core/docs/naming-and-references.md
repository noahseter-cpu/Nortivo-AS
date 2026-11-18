# Working name and reference record

Checked 18 November 2026. The revised brief establishes **KORVNT** as the customer-facing daughter company, **Nortivo Security** as a security-service identity and **Nortivo KORVNT** as the underlying framework. The name is pronounced "kor-vent." The [updated naming screen](../../../docs/master-upgrade/NAMING.md) records checked names, territory, similar commercial uses and unresolved trademark questions. The intended future badge reads **Secured by KORVNT**. The name is a coined brand direction with a restrained industrial technology feel.

Initial web searches including the coined word "KORVNT" did not surface an obvious exact-match security product in the retrieved results. Several other short candidates were rejected because the search surfaced existing technology/security uses. This is preliminary screening only, not a trademark-register clearance, proof of availability or a guarantee against a naming dispute. Similar spellings, pronunciation and relevant services remain to be checked.

This is a public-branding update. The existing `services/security-core` directory, private package ID, authentication cookies, key derivation domains, session stores and exported APIs keep their technical identifiers. A naming change must not silently rotate security state or alter authorization. Prior test records retain the brand used when they were generated.

[Patentstyret's register guidance](https://www.patentstyret.no/sok-databaser/) identifies Navnesok, the Norwegian trademark register and international databases as places to investigate existing rights. Its [trademark guidance](https://www.patentstyret.no/varemerke/laer-om-varemerke) explains the requirements for distinctiveness and avoiding confusion with existing marks. Similar names and relevant services still need review before public release. This task did not complete those register searches or register a mark.

No domain was bought, no trademark application was filed and no company or account registration was changed. Do not imply Microsoft, Samsung or another security vendor's affiliation. The local-only rename does not modify Nortivo's existing company identity or live website.

The emblem in `preview/core-symbol.svg` is a new geometric concept created for this preview. It does not copy a Knox or Microsoft mark. Design authorship does not establish trademark clearance.

## Technical sources consulted

These sources informed the control design. This release does not claim certification or complete compliance with them.

| Source | Relevance |
| --- | --- |
| [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) | Baseline for requirements and verification scope; no invented ASVS pass level. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Explicit server-side permission checks, least privilege, default deny and testing. |
| [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Session-token and lifecycle control boundaries. |
| [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Session-bound tokens, exact origin and browser request defenses. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Minimal useful security events and credential/personal-data exclusion. |
| [Node Crypto API](https://nodejs.org/api/crypto.html) | Standard cryptographic primitives instead of an invented protocol. |
| [Netlify custom headers](https://docs.netlify.com/manage/routing/headers/) | Static headers do not automatically cover Function/proxy/edge responses. |

The source review is grounded in the current local code, not the accessible state of nortivo.no. The search service could not retrieve the live Nortivo page. Browser inspection of an already available live homepage informed brand context only; no authenticated or invasive live security tests ran.
